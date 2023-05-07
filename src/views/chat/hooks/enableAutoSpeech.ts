import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { t } from '@/locales'
import { useChatStore } from '@/store'

export function getAutoSpeechStateAPI() {
  const ms = useMessage()
  const chatStore = useChatStore()
  const enableAutoSpeech = computed<boolean>(() => chatStore.enableAutoSpeech)

  function toggleAutoSpeech() {
    chatStore.setAutoSpeech(!enableAutoSpeech.value)
    if (enableAutoSpeech.value)
      ms.success(t('chat.enableAutoSpeech'))

    else ms.warning(t('chat.disableAutoSpeech'))
  }

  return {
    enableAutoSpeech,
    toggleAutoSpeech,
  }
}
