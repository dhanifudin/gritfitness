import { onMounted, onUnmounted } from 'vue'

/**
 * Keeps the screen awake while active — for the QR screens, so it doesn't dim/sleep mid-scan at the
 * gym door. Feature-detected: silently does nothing where the Screen Wake Lock API isn't available
 * (e.g. some iOS Safari versions), never throws.
 */
export function useWakeLock() {
  let sentinel: { release: () => Promise<void> } | null = null

  async function request() {
    if (!('wakeLock' in navigator)) return
    try {
      sentinel = await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
    } catch {
      /* e.g. tab not visible, or permission denied — fine to just not hold a lock */
    }
  }
  function release() {
    void sentinel?.release().catch(() => {})
    sentinel = null
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void request()
  }

  onMounted(() => {
    void request()
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    release()
    document.removeEventListener('visibilitychange', onVisible)
  })
}
