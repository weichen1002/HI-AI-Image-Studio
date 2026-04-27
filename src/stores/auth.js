import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isInitialized = ref(false)

  async function fetchUser() {
    try {
      const response = await fetch('/api/me')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      user.value = data.user
    } catch (e) {
      user.value = null
    } finally {
      isInitialized.value = true
    }
  }

  async function login(username, password) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || data.message || '登录失败')
    user.value = data.user
    return data
  }

  async function register(username, password) {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || data.message || '注册失败')
    user.value = data.user
    return data
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    user.value = null
  }

  return { user, isInitialized, fetchUser, login, register, logout }
})