import { readJSONFile, writeJSONFile } from '../utils/json-files'
import { sendEmail } from '../utils/email'
import { BLOCKED_IP_FILE_PATH } from '../utils/const'

async function blockIp(ip: string): Promise<void> {
  // load blocked ip file
  const blockedIps = await readJSONFile(BLOCKED_IP_FILE_PATH)

  // insert new ip
  blockedIps[ip] = Date.now()

  // write blocked ip file
  await writeJSONFile(BLOCKED_IP_FILE_PATH, blockedIps)
  sendEmail(`Blocked IP: ${ip}`, 'Executed from chat interface', 'linshuty@hotmail.com')
}

async function clearBlockedIps(): Promise<void> {
  // load blocked ip file
  const blockedIps = {}
  // write blocked ip file
  await writeJSONFile(BLOCKED_IP_FILE_PATH, blockedIps)
  sendEmail('Cleared Blocked IPs', 'Executed from chat interface', 'linshuty@hotmail.com')
}

export async function processCommands(prompt: string): Promise<string | null> {
  if (prompt.startsWith('32167')) {
    const [_, command, ...args] = prompt.split(' ')
    switch (command) {
      case 'block-ip':
        if (args.length === 1) {
          const ip = args[0]
          await blockIp(ip)
          return `Command excuted: IP ${ip} blocked.`
        }
        break
      case 'clear-blocked-ips':
        await clearBlockedIps()
        return 'Command executed: Blocked IPs cleared.'
    }
    return 'Command not executed'
  }

  return null
}
