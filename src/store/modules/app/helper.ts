import { ss } from '@/utils/storage'

const LOCAL_NAME = 'appSetting'

export type Theme = 'light' | 'dark' | 'auto'

export type Language = 'zh-CN' | 'zh-TW' | 'en-US' | 'ko-KR'

export interface AppState {
  siderCollapsed: boolean
  theme: Theme
  language: Language
  lastGPT4ActivatedTimestamp: number
  lastGPT5ActivatedTimestamp: number
}

export function defaultSetting(): AppState {
  return { siderCollapsed: false, theme: 'light', language: 'zh-CN', lastGPT4ActivatedTimestamp: 0, lastGPT5ActivatedTimestamp: 0 }
}

export function getLocalSetting(): AppState {
  const localSetting: AppState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalSetting(setting: AppState): void {
  ss.set(LOCAL_NAME, setting)
}
