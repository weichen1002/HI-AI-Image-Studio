import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isInitialized = ref(false)

  async function fetchUser() {
    try {
      const data = await apiFetch('/api/me', undefined, { toast: false, redirectOn401: false })
      user.value = data?.user || null
    } catch (e) {
      user.value = null
    } finally {
      isInitialized.value = true
    }
  }

  async function login(username, password) {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }, { toast: false, redirectOn401: false })
    user.value = data?.user || null
    return data
  }

  async function register(username, password, captchaId, captcha) {
    const data = await apiFetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, captchaId, captcha })
    }, { toast: false, redirectOn401: false })
    user.value = data?.user || null
    return data
  }

  async function logout() {
    await apiFetch('/api/logout', { method: 'POST' }, { toast: false, redirectOn401: false })
    user.value = null
  }

  return { user, isInitialized, fetchUser, login, register, logout }
})
