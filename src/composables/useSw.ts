import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useOnline } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

const CHECK_EVERY_MS = 15 * 60 * 1000
let registration: ServiceWorkerRegistration | undefined

// When a new worker takes over an already-controlled page, reload so the page runs the new version
// (the old lazy-route chunks are dropped from the cache). workbox's own reload does not fire for
// updates found through registration.update(), so this is handled here. The first install is not an
// update (no previous controller), so it never reloads.
if ('serviceWorker' in navigator) {
  let hasController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true // first install claiming this page: not an update
      return
    }
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

/** Is the user typing? An update must not reload the page under a half-filled form. */
const isTyping = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/**
 * Service-worker updates. A new version installs in the background and waits; this applies it at a
 * safe moment (route change or app resume, never while typing) and keeps looking for new versions
 * while an installed app stays open for days. Call once, from App.vue.
 */
export function useUpdater() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg
      if (reg) setInterval(() => reg.update().catch(() => {}), CHECK_EVERY_MS)
    },
  })
  const update = () => updateServiceWorker(true)
  /** Apply a waiting update unless the user is typing. */
  const applyIfSafe = () => {
    if (needRefresh.value && !isTyping()) void update()
  }
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    registration?.update().catch(() => {})
    applyIfSafe()
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisible))
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))
  return { needRefresh, update, applyIfSafe }
}

/** Manual "Periksa pembaruan": 'latest' | 'available' (waiting or installing) | 'unsupported'. */
export async function checkForUpdate(): Promise<'latest' | 'available' | 'unsupported'> {
  if (!registration) return 'unsupported'
  await registration.update().catch(() => {})
  await new Promise((r) => setTimeout(r, 1500)) // let a freshly found worker reach "installed"
  return registration.waiting || registration.installing ? 'available' : 'latest'
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
