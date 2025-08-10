import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { t } from '@/locales'
import { useAppStore, useChatStore } from '@/store'

export function useUsingGPT5() {
  const ms = useMessage()
  const chatStore = useChatStore()
  const appStore = useAppStore()
  const usingGPT5 = computed<boolean>(() => chatStore.usingGPT5)

  function toggleUsingGPT5() {
    chatStore.setUsingGPT5(!usingGPT5.value)
    if (usingGPT5.value) {
      ms.success(t('chat.turnOnGPT5'))
      appStore.setLastGPT5ActivatedTimestamp(Date.now())
    }
    else {
      ms.warning(t('chat.turnOffGPT5'))
    }
  }

  return {
    usingGPT5,
    toggleUsingGPT5,
  }
}
