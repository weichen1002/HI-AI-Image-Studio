import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '../utils/api'

export const useAnnouncementsStore = defineStore('announcements', () => {
  const active = ref([])
  const activeLoading = ref(false)

  const adminList = ref([])
  const adminLoading = ref(false)

  const unreadCount = computed(() => {
    return (active.value || []).filter((a) => a.repeatMode === 'once' && !a.readAt).length
  })

  async function fetchActive(params) {
    const opts = params || {}
    const limit = Number(opts.limit || 20)
    try {
      activeLoading.value = true
      const data = await apiFetch(`/api/announcements/active?limit=${encodeURIComponent(limit)}`, undefined, {
        toast: opts.toast !== true ? false : true
      })
      active.value = data?.announcements || []
      return active.value
    } finally {
      activeLoading.value = false
    }
  }

  async function markRead(id) {
    const announcementId = String(id || '').trim()
    if (!announcementId) return null
    const data = await apiFetch(`/api/announcements/${encodeURIComponent(announcementId)}/read`, { method: 'POST' }, { toast: false })
    const readAt = data?.read?.readAt || new Date().toISOString()
    active.value = (active.value || []).map((a) => (a.id === announcementId ? { ...a, readAt } : a))
    return data
  }

  async function fetchAdmin(params) {
    const opts = params || {}
    const q = String(opts.q || '').trim()
    const status = String(opts.status || '').trim()
    const notifyMode = String(opts.notifyMode || '').trim()
    const limit = Number(opts.limit || 100)
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    if (status) query.set('status', status)
    if (notifyMode) query.set('notifyMode', notifyMode)
    query.set('limit', String(limit))

    try {
      adminLoading.value = true
      const data = await apiFetch(`/api/admin/announcements?${query.toString()}`)
      adminList.value = data?.announcements || []
      return adminList.value
    } finally {
      adminLoading.value = false
    }
  }

  async function createAnnouncement(payload) {
    const body = payload || {}
    const data = await apiFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return data?.announcement
  }

  async function updateAnnouncement(id, payload) {
    const announcementId = String(id || '').trim()
    const body = payload || {}
    const data = await apiFetch(`/api/admin/announcements/${encodeURIComponent(announcementId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return data?.announcement
  }

  async function previewAudience(audience) {
    const data = await apiFetch('/api/admin/announcements/audience/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: audience || {} })
    })
    return data
  }

  async function publishAnnouncement(id) {
    const announcementId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/announcements/${encodeURIComponent(announcementId)}/publish`, { method: 'POST' })
    return data?.announcement
  }

  async function archiveAnnouncement(id) {
    const announcementId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/announcements/${encodeURIComponent(announcementId)}/archive`, { method: 'POST' })
    return data?.announcement
  }

  async function deleteAnnouncement(id) {
    const announcementId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/announcements/${encodeURIComponent(announcementId)}`, { method: 'DELETE' })
    return data?.deleted
  }

  return {
    active,
    activeLoading,
    adminList,
    adminLoading,
    unreadCount,
    fetchActive,
    markRead,
    fetchAdmin,
    createAnnouncement,
    updateAnnouncement,
    previewAudience,
    publishAnnouncement,
    archiveAnnouncement,
    deleteAnnouncement
  }
})
