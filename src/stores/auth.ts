import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getToken, setToken } from '@/api/client'
import * as ep from '@/api/endpoints'
import type { User } from '@/api/types'
import { clearAll as clearData } from '@/lib/dataCache'
import { saveLastPhone } from '@/lib/lastPhone'
import { clearQr } from '@/lib/qrCache'
import { revokeTrackerSession } from '@/lib/supabase'

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

  const loggedIn = computed(() => !!token.value && !!user.value)
  /** Profile is remembered but the token is gone (revoked server-side): only the cached QR stays reachable. */
  const sessionExpired = computed(() => !loggedIn.value && !!user.value)

  /** The register_token issued by verify-otp for numbers without an account yet. */
  const registerToken = ref<string | null>(null)

  async function completeLogin(u: User, accessToken: string, noHp: string) {
    if (user.value && user.value.id !== u.id) {
      void revokeTrackerSession(user.value.id) // shared-device hygiene: don't leave a stray grit session behind
      clearData()
      clearQr()
    }
    setToken(accessToken)
    token.value = accessToken
    user.value = u
    registerToken.value = null
    localStorage.setItem(userKey, JSON.stringify(u))
    saveLastPhone(noHp) // convenience only: remembered across logout, never used to skip OTP
    // tracker: load this member's local copy and push anything recorded while logged out
    const { useTracker } = await import('./tracker')
    const tracker = useTracker()
    tracker.init(u.id)
    void tracker.sync()
  }

  /** Verify the OTP. Returns 'registered' when logged in, 'new' when the number needs to register first. */
  async function login(noHp: string, otp: string): Promise<'registered' | 'new'> {
    const res = await ep.verifyOtp(noHp, otp)
    if (res.status === 'registered' && res.access_token && res.user) {
      await completeLogin(res.user, res.access_token, noHp)
      return 'registered'
    }
    registerToken.value = res.register_token ?? null
    return 'new'
  }

  /** Finish a new member's registration (FormData per the API) and log in with the result. */
  async function registerAccount(form: FormData, noHp: string) {
    if (registerToken.value) form.set('register_token', registerToken.value)
    const res = await ep.register(form)
    if (res.access_token && res.user) await completeLogin(res.user, res.access_token, noHp)
  }

  function patchUser(patch: Partial<User>) {
    if (!user.value) return
    user.value = { ...user.value, ...patch }
    localStorage.setItem(userKey, JSON.stringify(user.value))
  }

  /** Refresh the profile from the server (no-op when it fails — the cached copy stays). */
  async function refreshUser() {
    if (!token.value) return
    try {
      const u = await ep.me()
      user.value = u
      localStorage.setItem(userKey, JSON.stringify(u))
    } catch {
      /* offline or revoked; the 401 handler deals with the latter */
    }
  }

  /** Session ended (401: token revoked server-side): drop the token but keep the profile and cached QR. */
  function expire() {
    if (!token.value) return // parallel 401s must not repeat this
    setToken(null)
    token.value = null
  }

  /** Deliberate logout: also wipes every locally cached personal datum. */
  async function logout() {
    const { useTracker } = await import('./tracker')
    const tracker = useTracker()
    tracker.init(user.value?.id ?? null)
    if (token.value) await tracker.flushBeforeLogout() // push queued check-ins first
    await tracker.wipe()
    if (token.value) await ep.logout().catch(() => {})
    setToken(null)
    token.value = null
    user.value = null
    registerToken.value = null
    localStorage.removeItem(userKey)
    localStorage.removeItem('grit.notifSeen')
    clearData()
    clearQr()
    await caches?.delete('api').catch(() => {}) // leftover from v1 service-worker API caching
  }

  return { user, token, loggedIn, sessionExpired, registerToken, login, registerAccount, logout, expire, patchUser, refreshUser }
})
