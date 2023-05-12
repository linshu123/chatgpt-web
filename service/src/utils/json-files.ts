import * as fs from 'fs/promises'

export async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  }
  catch (err) {
    return false
  }
}

export async function writeJSONFile(filePath: string, data: any): Promise<void> {
  try {
    const jsonString = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonString, 'utf-8')
  }
  catch (error) {
    console.error(`Error while writing JSON file: ${error}`)
    throw error
  }
}

export async function readJSONFile(filePath: string): Promise<any> {
  try {
    if (!await fileExists(filePath))
      return {}
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  }
  catch (error) {
    console.error(`Error while reading JSON file: ${error}`)
    throw error
  }
}
