import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

export const useOperationCampaignsStore = defineStore('operationCampaigns', () => {
  const adminList = ref([])
  const adminLoading = ref(false)

  async function fetchAdmin(params) {
    const opts = params || {}
    const q = String(opts.q || '').trim()
    const status = String(opts.status || '').trim()
    const channel = String(opts.channel || '').trim()
    const limit = Number(opts.limit || 100)
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    if (status) query.set('status', status)
    if (channel) query.set('channel', channel)
    query.set('limit', String(limit))

    try {
      adminLoading.value = true
      const data = await apiFetch(`/api/admin/operations/campaigns?${query.toString()}`)
      adminList.value = data?.campaigns || []
      return adminList.value
    } finally {
      adminLoading.value = false
    }
  }

  async function createCampaign(payload) {
    const data = await apiFetch('/api/admin/operations/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    })
    return data?.campaign
  }

  async function updateCampaign(id, payload) {
    const campaignId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/operations/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    })
    return data?.campaign
  }

  async function activateCampaign(id) {
    const campaignId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/operations/campaigns/${encodeURIComponent(campaignId)}/activate`, { method: 'POST' })
    return data?.campaign
  }

  async function archiveCampaign(id) {
    const campaignId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/operations/campaigns/${encodeURIComponent(campaignId)}/archive`, { method: 'POST' })
    return data?.campaign
  }

  async function deleteCampaign(id) {
    const campaignId = String(id || '').trim()
    const data = await apiFetch(`/api/admin/operations/campaigns/${encodeURIComponent(campaignId)}`, { method: 'DELETE' })
    return data?.deleted
  }

  async function fetchReview(id) {
    const campaignId = String(id || '').trim()
    return apiFetch(`/api/admin/operations/campaigns/${encodeURIComponent(campaignId)}/review`)
  }

  async function fetchSegments() {
    const data = await apiFetch('/api/admin/operations/campaigns/segments')
    return data?.segments || []
  }

  return {
    adminList,
    adminLoading,
    fetchAdmin,
    createCampaign,
    updateCampaign,
    activateCampaign,
    archiveCampaign,
    deleteCampaign,
    fetchReview,
    fetchSegments
  }
})
