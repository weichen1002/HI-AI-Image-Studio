import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

const defaultSettings = {
  siteName: 'Hi AI Image Studio',
  siteSubtitle: '把想法变成可以直接使用的商业图片。',
  supportContact: 'QQ 3756934376',
  allowRegistration: true,
  footerCopyright: `© ${new Date().getFullYear()} Hi AI Image Studio. All rights reserved.`
}

export const useSiteStore = defineStore('site', () => {
  const settings = ref({ ...defaultSettings })
  const loaded = ref(false)
  const loading = ref(false)

  async function fetchSettings(force = false) {
    if (loading.value) return settings.value
    if (loaded.value && !force) return settings.value

    loading.value = true
    try {
      const data = await apiFetch('/api/settings/public', undefined, {
        toast: false,
        redirectOn401: false
      })
      settings.value = {
        siteName: String(data?.siteName || defaultSettings.siteName),
        siteSubtitle: String(data?.siteSubtitle || defaultSettings.siteSubtitle),
        supportContact: String(data?.supportContact || defaultSettings.supportContact),
        allowRegistration: data?.allowRegistration !== false,
        footerCopyright: String(data?.footerCopyright || defaultSettings.footerCopyright)
      }
      if (typeof document !== 'undefined') {
        document.title = settings.value.siteName
      }
      loaded.value = true
      return settings.value
    } catch (e) {
      settings.value = { ...defaultSettings }
      if (typeof document !== 'undefined') {
        document.title = settings.value.siteName
      }
      loaded.value = true
      return settings.value
    } finally {
      loading.value = false
    }
  }

  return { settings, loaded, loading, fetchSettings }
})
