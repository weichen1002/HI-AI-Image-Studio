import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

export const useBillingStore = defineStore('billing', () => {
  const packages = ref([])
  const orders = ref([])
  const ordersTotal = ref(0)
  const isLoadingPackages = ref(false)
  const isLoadingOrders = ref(false)
  const isCreatingOrder = ref(false)

  async function fetchPackages() {
    isLoadingPackages.value = true
    try {
      const data = await apiFetch('/api/billing/packages')
      packages.value = data?.packages || []
    } finally {
      isLoadingPackages.value = false
    }
  }

  async function fetchOrders({ page = 1, limit = 20, status } = {}) {
    isLoadingOrders.value = true
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) params.set('status', status)
      const data = await apiFetch(`/api/billing/orders?${params}`)
      orders.value = data?.orders || []
      ordersTotal.value = data?.total ?? (data?.orders?.length ?? 0)
    } finally {
      isLoadingOrders.value = false
    }
  }

  async function createOrder(packageId, paymentChannel = 'manual') {
    isCreatingOrder.value = true
    try {
      const data = await apiFetch('/api/billing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, paymentChannel }),
      })
      return data?.order || null
    } finally {
      isCreatingOrder.value = false
    }
  }

  return {
    packages,
    orders,
    ordersTotal,
    isLoadingPackages,
    isLoadingOrders,
    isCreatingOrder,
    fetchPackages,
    fetchOrders,
    createOrder,
  }
})
