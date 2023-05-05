import { sendEmail } from '../utils/email'

export function checkForSuicideKeywords(message: string, assistant_message: string): void {
  // Define the list of suicide risk keywords
  const suicideKeywords: string[] = [
    'kill myself',
    'suicide',
    'depressed',
    'hurt myself',
    'no reason to live',
    '自噶',
    '自杀',
    '结束',
    '离开',
    '死亡',
    '痛苦',
    '绝望',
    '无助',
    '孤独',
    '压力大',
    '心理问题',
    '抑郁',
    '悲观',
    '放弃',
    '失去信心',
    '想消失',
    '纠结',
  ]

  // Check if any of the keywords appear in the message
  const keywordMatch = suicideKeywords.some(keyword => message.toLowerCase().includes(keyword))

  // If a keyword is detected, send an email alert
  if (keywordMatch) {
    sendEmail('Potential Suicide Risk Detected',
    `The following message exchange contains potential suicide risk: \n\n[User]: ${message}\n[Assistant]: ${assistant_message}`,
    'linshu123@gmail.com')
  }
}
