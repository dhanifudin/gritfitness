import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useOnline } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

export function useUpdater() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })
  return { needRefresh, update: () => updateServiceWorker(true) }
}
export { useOnline }

// Android/desktop Chrome install prompt
export function useInstall() {
  const evt = ref<any>(null)
  const handler = (e: Event) => {
    e.preventDefault()
    evt.value = e
  }
  onMounted(() => window.addEventListener('beforeinstallprompt', handler))
  onUnmounted(() => window.removeEventListener('beforeinstallprompt', handler))
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
  return {
    canInstall: () => !standalone && !!evt.value,
    showIosHint: () => !standalone && isIos,
    install: async () => {
      await evt.value?.prompt()
      evt.value = null
    },
  }
}
