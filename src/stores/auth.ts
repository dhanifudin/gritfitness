import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getToken, setToken } from '@/api/client'
import * as ep from '@/api/endpoints'
import type { User } from '@/api/types'

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

  async function login(noHp: string, otp: string) {
    const { access_token, token_type, ...u } = await ep.verifyOtp(noHp, otp)
    void token_type
    setToken(access_token)
    token.value = access_token
    user.value = u
    localStorage.setItem(userKey, JSON.stringify(u))
  }

  function patchUser(patch: Partial<User>) {
    if (!user.value) return
    user.value = { ...user.value, ...patch }
    localStorage.setItem(userKey, JSON.stringify(user.value))
  }

  function clear() {
    setToken(null)
    token.value = null
    user.value = null
    localStorage.removeItem(userKey)
  }

  async function logout() {
    await ep.logout().catch(() => {})
    clear()
  }

  return { user, token, loggedIn, login, logout, clear, patchUser }
})
