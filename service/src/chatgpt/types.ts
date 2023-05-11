import type { ChatMessage } from 'chatgpt'
import type fetch from 'node-fetch'

export interface RequestOptions {
  usingGPT4?: boolean
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
