export type FetchFn = (url: string, options?: any) => Promise<any>

export interface RequestProps {
  prompt: string
  options?: ChatContext
  systemMessage: string
  usingGPT4?: boolean
  usingGPT5?: boolean
  temperature?: number
  top_p?: number
}

export interface ChatContext {
  conversationId?: string
  parentMessageId?: string
}

export interface ModelConfig {
  apiModel?: ApiModel
  timeoutMs?: number
  socksProxy?: string
  httpsProxy?: string
  usage?: string
}

export type ApiModel = 'ChatGPTAPI' | undefined
