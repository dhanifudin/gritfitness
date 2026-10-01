import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getToken, setToken } from '@/api/client'
import * as ep from '@/api/endpoints'
import type { User } from '@/api/types'
import { clearAll as clearData } from '@/lib/dataCache'
import { clearQr } from '@/lib/qrCache'

const userKey = 'grit.user'
const load = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(userKey) ?? 'null')
  } catch {
    return null
  }
}

export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(load())
  const token = ref<string | null>(getToken())
  // bumped on expire() so `loggedIn` re-evaluates; the clock alone is not reactive
  const tick = ref(0)

  /** Token present and not past its server-issued expiry (about 5 h after login). */
  const tokenValid = computed(() => {
    void tick.value
    if (!token.value) return false
    const exp = user.value?.token_expired ? Date.parse(user.value.token_expired) : NaN
    return Number.isNaN(exp) || Date.now() < exp
  })
  const loggedIn = computed(() => tokenValid.value && !!user.value)
  /** Profile is remembered but the token is gone/expired: only the cached QR stays reachable. */
  const sessionExpired = computed(() => !loggedIn.value && !!user.value)

  async function login(noHp: string, otp: string) {
    const { access_token, token_type, ...u } = await ep.verifyOtp(noHp, otp)
    void token_type
    if (user.value && user.value.id !== u.id) {
      clearData()
      clearQr()
    }
    setToken(access_token)
    token.value = access_token
    user.value = u
    localStorage.setItem(userKey, JSON.stringify(u))
    // tracker: load this member's local copy and push anything recorded while logged out
    const { useTracker } = await import('./tracker')
    const tracker = useTracker()
    tracker.init(u.id)
    void tracker.sync()
  }

  function patchUser(patch: Partial<User>) {
    if (!user.value) return
    user.value = { ...user.value, ...patch }
    localStorage.setItem(userKey, JSON.stringify(user.value))
  }

  /** Session ended (401 / clock): drop the token but keep the profile and cached QR. */
  function expire() {
    setToken(null)
    token.value = null
    tick.value++
  }

  /** Deliberate logout: also wipes every locally cached personal datum. */
  async function logout() {
    const { useTracker } = await import('./tracker')
    const tracker = useTracker()
    tracker.init(user.value?.id ?? null)
    if (tokenValid.value) await tracker.flushBeforeLogout() // push queued check-ins first
    tracker.wipe()
    if (tokenValid.value) await ep.logout().catch(() => {})
    setToken(null)
    token.value = null
    user.value = null
    localStorage.removeItem(userKey)
    clearData()
    clearQr()
    await caches?.delete('api').catch(() => {}) // leftover from v1 service-worker API caching
  }

  return { user, token, loggedIn, tokenValid, sessionExpired, login, logout, expire, patchUser }
})
