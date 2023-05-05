import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { t } from '@/locales'
import { useChatStore } from '@/store'

export function useUsingGPT4() {
  const ms = useMessage()
  const chatStore = useChatStore()
  const usingGPT4 = computed<boolean>(() => chatStore.usingGPT4)

  function toggleUsingGPT4() {
    chatStore.setUsingGPT4(!usingGPT4.value)
    if (usingGPT4.value)
      ms.success(t('chat.turnOnGPT4'))
    else
      ms.warning(t('chat.turnOffGPT4'))
  }

  return {
    usingGPT4,
    toggleUsingGPT4,
  }
}
