import type fetch from 'node-fetch'

export interface ChatMessage {
  id: string
  conversationId?: string
  parentMessageId?: string
  role: string
  text: string
  detail?: any
}

export interface RequestOptions {
  usingGPT5?: boolean
  message: string
  lastContext?: { conversationId?: string; parentMessageId?: string }
  process?: (chat: ChatMessage) => void
  systemMessage?: string
  temperature?: number
  top_p?: number
}

export interface RequestMetadata {
  ipAddress: string
  userAgent: string
}

export interface SetProxyOptions {
  fetch?: typeof fetch
}

export interface UsageResponse {
  total_usage: number
}
