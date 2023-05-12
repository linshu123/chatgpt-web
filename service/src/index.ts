import express from 'express'
import { readJSONFile, writeJSONFile } from './utils/json-files'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'
import { sendEmail } from './utils/email'
const BLOCKED_IP_FILE_PATH = '/tmp/blocked_ips.json'
const MESSAGE_COUNT_FILE_PATH = '/tmp/message_count.json'

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())

async function recordMessage(prompt: string, ip: string, blockedIps: any): Promise<void> {
  // Do not record special messages
  if (prompt === 'continue' || prompt === '继续')
    return

  const messageCount = await readJSONFile(MESSAGE_COUNT_FILE_PATH)
  if (messageCount[ip] && messageCount[ip][prompt] && Date.now() - messageCount[ip][prompt].timestamp < 1000 * 3600 * 24) {
    // 24 小时内同一个 IP 发送同一个消息超过 3 次，封禁该 IP
    if (messageCount[ip][prompt].count >= 2) {
      blockedIps[ip] = Date.now()
      delete messageCount[ip][prompt]
      await writeJSONFile(MESSAGE_COUNT_FILE_PATH, messageCount)
      await writeJSONFile(BLOCKED_IP_FILE_PATH, blockedIps)
      sendEmail(`Blocked IP: ${ip}`, `Spam content: ${prompt}`, 'linshuty@hotmail.com')
    }
    else {
      messageCount[ip][prompt].count++
      await writeJSONFile(MESSAGE_COUNT_FILE_PATH, messageCount)
    }
    return
  }

  // Insert new message count with timestamp
  if (!messageCount[ip]) {
    messageCount[ip] = {
      [prompt]: {
        count: 1,
        timestamp: Date.now(),
      },
    }
  }
  else {
    messageCount[ip][prompt] = {
      count: 1,
      timestamp: Date.now(),
    }
  }
  await writeJSONFile(MESSAGE_COUNT_FILE_PATH, messageCount)
}

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  const blockedIps = await readJSONFile(BLOCKED_IP_FILE_PATH)
  if (blockedIps[req.ip]) {
    const currentTimestamp = Date.now()
    if (currentTimestamp - blockedIps[req.ip] > 1000 * 3600 * 24) {
      delete blockedIps[req.ip]
      await writeJSONFile(BLOCKED_IP_FILE_PATH, blockedIps)
    }
    else {
      res.write(JSON.stringify({ type: 'Fail', message: 'Internal error' }))
      res.end()
      return
    }
  }
  if (req.headers['user-agent'].includes('python-requests')) {
    res.write(JSON.stringify({ type: 'Fail', message: 'Internal error' }))
    res.end()
    return
  }

  try {
    const { prompt, usingGPT4, options = {}, systemMessage, temperature, top_p } = req.body as RequestProps
    await recordMessage(prompt, req.ip, blockedIps)
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      usingGPT4: usingGPT4 ?? false,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    },
    {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
    )
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
