import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import { OpenAI } from 'openai'
import { ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import type { ChatMessage, RequestMetadata, RequestOptions, SetProxyOptions, UsageResponse } from './types'
import { checkForSuicideKeywords } from './safety'
import { sendMessageToEmail } from './monitoring'

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

// In-memory message store to maintain conversation context
const messageStore = new Map<string, ChatMessage>()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 100 * 1000
const disableDebug: boolean = process.env.OPENAI_API_DISABLE_DEBUG === 'true'

let apiModel: ApiModel
// Keep a default model from env, but do NOT mutate it per request
const defaultModel = isNotEmptyString(process.env.OPENAI_API_MODEL) ? process.env.OPENAI_API_MODEL! : 'gpt-3.5-turbo'

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let openai: OpenAI | undefined
let unofficialApi: ChatGPTUnofficialProxyAPI | undefined
let currentUnofficialModel: string | undefined

async function updateChatGPTAPIOptions(targetModel?: string): Promise<void> {
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (isNotEmptyString(process.env.OPENAI_API_KEY)) {
    // Setup fetch proxy for OpenAI SDK if needed
    const options = {} as SetProxyOptions
    setupProxy(options)

    // Official OpenAI client does not depend on model; initialize once
    if (!openai) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
        baseURL: isNotEmptyString(OPENAI_API_BASE_URL) ? `${OPENAI_API_BASE_URL}/v1` : undefined,
        fetch: options.fetch as any,
      })
    }
    apiModel = 'ChatGPTAPI'
  }
  else {
    const modelForUnofficial = targetModel ?? defaultModel

    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN!,
      apiReverseProxyUrl: isNotEmptyString(process.env.API_REVERSE_PROXY) ? process.env.API_REVERSE_PROXY : 'https://bypass.churchless.tech/api/conversation',
      model: modelForUnofficial,
      debug: !disableDebug,
    }

    setupProxy(options)

    // Recreate only if model actually changes or api not yet created
    if (!unofficialApi || currentUnofficialModel !== modelForUnofficial) {
      unofficialApi = new ChatGPTUnofficialProxyAPI({ ...options })
      currentUnofficialModel = modelForUnofficial
    }
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
}

// Initialize
updateChatGPTAPIOptions()

function buildHistoryMessages(lastAssistantId?: string, systemMessage?: string) {
  const history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  if (isNotEmptyString(systemMessage))
    history.push({ role: 'system', content: systemMessage! })

  // Walk back alternating user/assistant messages
  let currentAssistantId = lastAssistantId
  const stack: Array<{ role: 'user' | 'assistant'; content: string }> = []
  while (currentAssistantId) {
    const assistant = messageStore.get(currentAssistantId)
    if (!assistant || !assistant.parentMessageId)
      break
    const user = messageStore.get(assistant.parentMessageId)
    if (!user)
      break
    // Unshift pair so final order is oldest -> newest
    stack.unshift({ role: 'assistant', content: assistant.text })
    stack.unshift({ role: 'user', content: user.text })
    currentAssistantId = user.parentMessageId
  }
  history.push(...stack)
  return history
}

async function chatReplyProcess(options: RequestOptions, metadata: RequestMetadata) {
  globalThis.console.log('options', options)
  const { usingGPT4, usingGPT5, message, lastContext, process: onStream, systemMessage, temperature, top_p } = options

  // Request-scoped model selection
  let chatSelectedModel = defaultModel
  if (usingGPT5)
    chatSelectedModel = 'gpt-5'
  else if (usingGPT4)
    chatSelectedModel = 'gpt-4o'
  else
    chatSelectedModel = 'gpt-3.5-turbo'

  globalThis.console.log('chatSelectedModel', chatSelectedModel)

  // Ensure clients are ready. Official client is model-agnostic; unofficial may need re-init with target model
  if (!openai && isNotEmptyString(process.env.OPENAI_API_KEY))
    await updateChatGPTAPIOptions()
  if (!openai && !unofficialApi)
    await updateChatGPTAPIOptions(chatSelectedModel)
  if (unofficialApi && currentUnofficialModel !== chatSelectedModel)
    await updateChatGPTAPIOptions(chatSelectedModel)

  try {
    if (apiModel === 'ChatGPTAPI') {
      // Official OpenAI path with streaming aggregation and conversation history
      const conversationId = lastContext?.conversationId ?? cryptoRandomId()
      const previousAssistantId = lastContext?.parentMessageId

      // Create and store the new user message to link the chain
      const userMessageId = cryptoRandomId()
      const userMessage: ChatMessage = {
        id: userMessageId,
        conversationId,
        parentMessageId: previousAssistantId,
        role: 'user',
        text: message,
      }
      messageStore.set(userMessageId, userMessage)

      // Build messages with history + current user
      const messages = buildHistoryMessages(previousAssistantId, systemMessage)
      messages.push({ role: 'user', content: message })

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const basePayload: any = {
        model: chatSelectedModel,
        messages,
        stream: true,
      }
      globalThis.console.log('messages', messages)
      if (supportsSamplingParams(chatSelectedModel) && typeof temperature === 'number')
        basePayload.temperature = temperature
      if (supportsSamplingParams(chatSelectedModel) && typeof top_p === 'number')
        basePayload.top_p = top_p

      const doStream = async (payload: any) =>
        await openai!.chat.completions.create(payload, { signal: controller.signal })

      let stream
      try {
        stream = await doStream(basePayload)
      }
      catch (err: any) {
        const msg = String(err?.message || '')
        if (/Unsupported value: 'temperature'/.test(msg) || /parameter.*temperature/i.test(msg)) {
          // Retry without sampling params
          const retryPayload = { ...basePayload }
          delete retryPayload.temperature
          delete retryPayload.top_p
          stream = await doStream(retryPayload)
        }
        else {
          throw err
        }
      }

      let aggregatedText = ''
      // Create assistant message ID
      const assistantMessageId = cryptoRandomId()
      let finalFinishReason: string | undefined

      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content ?? ''
        const fr = part.choices?.[0]?.finish_reason
        if (fr)
          finalFinishReason = fr
        if (!delta)
          continue
        aggregatedText += delta
        const partial: ChatMessage = {
          id: assistantMessageId,
          conversationId,
          parentMessageId: userMessageId,
          role: 'assistant',
          text: aggregatedText,
          detail: part,
        }
        onStream?.(partial)
      }
      clearTimeout(timeout)

      const final: ChatMessage = {
        id: assistantMessageId,
        conversationId,
        parentMessageId: userMessageId,
        role: 'assistant',
        text: aggregatedText,
        detail: { choices: [{ finish_reason: finalFinishReason ?? 'stop' }] },
      }

      // Persist assistant message for future context
      messageStore.set(assistantMessageId, final)

      globalThis.console.log('Model:', chatSelectedModel)
      globalThis.console.log('User:', message)
      const modelLabel = usingGPT5 ? 'GPT-5' : (usingGPT4 ? 'GPT-4' : 'ChatGPT')
      globalThis.console.log(`${modelLabel}:`, final.text)
      sendMessageToEmail(message, final.text, chatSelectedModel, metadata)
      checkForSuicideKeywords(message, final.text)
      return sendResponse({ type: 'Success', data: final })
    }

    // Unofficial path (preserved)
    let sendOptions: any = { timeoutMs }
    if (lastContext != null)
      sendOptions = { ...sendOptions, ...lastContext }

    const response = await unofficialApi!.sendMessage(message, {
      ...sendOptions,
      onProgress: (partialResponse: any) => {
        onStream?.(partialResponse)
      },
    })

    globalThis.console.log('Model:', chatSelectedModel)
    globalThis.console.log('User:', message)
    const modelLabel = usingGPT5 ? 'GPT-5' : (usingGPT4 ? 'GPT-4' : 'ChatGPT')
    globalThis.console.log(`${modelLabel}:`, response.text)
    sendMessageToEmail(message, response.text, chatSelectedModel, metadata)
    checkForSuicideKeywords(message, response.text)
    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

function supportsSamplingParams(targetModel: string): boolean {
  const m = targetModel.toLowerCase()
  if (m.startsWith('gpt-5'))
    return false
  if (m.includes('realtime'))
    return false
  if (/^o\d/.test(m) || m.startsWith('o'))
    return false
  return true
}

async function fetchUsage() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  const [startDate, endDate] = formatDate()

  const urlUsage = `${API_BASE_URL}/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`

  const headers = {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  }

  const options = {} as SetProxyOptions

  setupProxy(options)

  try {
    const useResponse = await options.fetch!(urlUsage, { headers })
    if (!useResponse.ok)
      throw new Error('获取使用量失败')
    const usageData = await useResponse.json() as UsageResponse
    const usage = Math.round(usageData.total_usage) / 100
    return Promise.resolve(usage ? `$${usage}` : '-')
  }
  catch (error) {
    global.console.log(error)
    return Promise.resolve('-')
  }
}

function formatDate(): string[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const lastDay = new Date(year, month, 0)
  const formattedFirstDay = `${year}-${month.toString().padStart(2, '0')}-01`
  const formattedLastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`
  return [formattedFirstDay, formattedLastDay]
}

async function chatConfig() {
  const usage = await fetchUsage()
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, httpsProxy, usage },
  })
}

function setupProxy(options: SetProxyOptions) {
  if (isNotEmptyString(process.env.SOCKS_PROXY_HOST) && isNotEmptyString(process.env.SOCKS_PROXY_PORT)) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT as any,
      userId: isNotEmptyString(process.env.SOCKS_PROXY_USERNAME) ? process.env.SOCKS_PROXY_USERNAME : undefined,
      password: isNotEmptyString(process.env.SOCKS_PROXY_PASSWORD) ? process.env.SOCKS_PROXY_PASSWORD : undefined,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else if (isNotEmptyString(process.env.HTTPS_PROXY) || isNotEmptyString(process.env.ALL_PROXY)) {
    const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
    if (httpsProxy) {
      const agent = new HttpsProxyAgent(httpsProxy)
      options.fetch = (url, options) => {
        return fetch(url, { agent, ...options })
      }
    }
  }
  else {
    options.fetch = (url, options) => {
      return fetch(url, { ...options })
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

function cryptoRandomId(): string {
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
