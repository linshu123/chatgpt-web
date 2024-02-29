import { AUTHENTICATED_IP_FILE_PATH } from '../utils/const'
import { readJSONFile, writeJSONFile } from '../utils/json-files'

async function getIPsAndRemoveStaleIPs(filepath, staleLimit): Promise<string[]> {
  const authenticatedIPJson = await readJSONFile(filepath)
  const authenticatedIps = []
  const currentTime = Date.now()

  for (const ip in authenticatedIPJson) {
    if (currentTime - authenticatedIPJson[ip] <= staleLimit)
      authenticatedIps.push(ip)

    else
      delete authenticatedIPJson[ip]
  }

  await writeJSONFile(filepath, authenticatedIPJson)
  return authenticatedIps
}

async function getAuthenticatedIps(): Promise<string[]> {
  return await getIPsAndRemoveStaleIPs(AUTHENTICATED_IP_FILE_PATH, 1000 * 3600 * 24 * 7)
}

export async function isIPAuthenticated(ip: string): Promise<boolean> {
  const authenticatedIps = await getAuthenticatedIps()
  return authenticatedIps.includes(ip)
}

async function addIPToAuthenticationFile(ip: string, filename: string): Promise<void> {
  const authenticatedIPJson = await readJSONFile(filename)
  authenticatedIPJson[ip] = Date.now()
  await writeJSONFile(filename, authenticatedIPJson)
}

export async function addIPToAuthenticated(ip: string): Promise<void> {
  await addIPToAuthenticationFile(ip, AUTHENTICATED_IP_FILE_PATH)
}
