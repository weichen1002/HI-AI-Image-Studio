<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #filters>
        <div class="user-id">
          <Input
            v-model="userId"
            size="sm"
            placeholder="输入 userId"
            class="user-id-input"
            @keydown.enter.prevent="load"
          />
          <button
            v-if="userId"
            type="button"
            class="user-id-copy"
            :disabled="loading"
            aria-label="复制 userId"
            @click="copy(userId)"
          >
            <CopyIcon :size="16" aria-hidden="true" />
          </button>
        </div>
        <SelectMenu
          v-model="statusFilter"
          size="sm"
          :options="statusOptions"
          placeholder="全部状态"
          class="status-select"
        />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading" @click="exportCsv">
          导出当前筛选
        </Button>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">
          <template #icon><RefreshCcwIcon :size="16" aria-hidden="true" /></template>
          刷新数据
        </Button>
      </template>
      <template #table>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <DataTable
          variant="flat"
          :columns="columns"
          :rows="orders"
          :loading="loading"
          empty-text="暂无订单"
        >
          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>

          <template #cell-userId="{ row }">
            <span class="mono">{{ row.userId }}</span>
          </template>

          <template #cell-packageName="{ row }">
            <div class="package-cell">
              <div class="package-main">{{ row.packageName || row.packageId }}</div>
              <div class="package-sub mono">{{ row.id }}</div>
            </div>
          </template>

          <template #cell-creditsAmount="{ row }">
            <span class="balance">+{{ row.creditsAmount }}</span>
          </template>

          <template #cell-amountCents="{ row }">
            <span class="money">{{ formatMoney(row.amountCents, row.currency) }}</span>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status">{{ statusLabel(row.status) }}</span>
          </template>

          <template #cell-payment="{ row }">
            <div class="payment-cell">
              <span class="mono">{{ row.paymentChannel || 'manual' }}</span>
              <span v-if="row.paymentRef" class="mono payment-ref">{{ row.paymentRef }}</span>
            </div>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <Button
                v-if="row.status === 'pending'"
                variant="ghost"
                size="xs"
                :disabled="completingId === row.id"
                @click="completeOrder(row)"
              >
                {{ completingId === row.id ? '确认中...' : '确认入账' }}
              </Button>
              <Button
                v-if="row.status === 'paid'"
                variant="ghost"
                size="xs"
                :disabled="refundingId === row.id"
                @click="refundOrder(row)"
              >
                {{ refundingId === row.id ? '退款中...' : '退款' }}
              </Button>
            </div>
          </template>
        </DataTable>
      </template>
      <template #footer>
        <div class="foot-summary">共 {{ total }} 条</div>
        <Pagination
          variant="plain"
          :show-summary="false"
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
    </AdminListLayout>
  </TablePageLayout>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CopyIcon, RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Input, Pagination, SelectMenu, confirmAction, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const route = useRoute()
const router = useRouter()

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已退款', value: 'refunded' },
  { label: '已取消', value: 'cancelled' },
  { label: '失败', value: 'failed' }
]

const columns = [
  { key: 'createdAt', title: '时间', width: '14%', nowrap: true },
  { key: 'userId', title: '用户', width: '15%', nowrap: true, ellipsis: true },
  { key: 'packageName', title: '订单', width: '22%', nowrap: true, ellipsis: true },
  { key: 'creditsAmount', title: '余额', width: '8%', nowrap: true },
  { key: 'amountCents', title: '金额', width: '9%', nowrap: true },
  { key: 'status', title: '状态', width: '9%', nowrap: true },
  { key: 'payment', title: '渠道', width: '13%', nowrap: true, ellipsis: true },
  { key: 'actions', title: '操作', width: '10%', nowrap: true }
]

const userId = ref(String(route.query.userId || ''))
const statusFilter = ref(String(route.query.status || ''))
const orders = ref([])
const total = ref(0)
const page = ref(Number(route.query.page || 1) || 1)
const pageSize = ref(Number(route.query.limit || 20) || 20)
const loading = ref(false)
const completingId = ref('')
const refundingId = ref('')
const errorMsg = ref('')
let inputTimer = null

function handlePageChange(next) {
  page.value = next
  load()
}

function handlePageSizeChange(next) {
  pageSize.value = next
  page.value = 1
  load()
}

function buildFilterParams() {
  const params = new URLSearchParams()
  const id = String(userId.value || '').trim()
  if (id) params.set('userId', id)
  if (statusFilter.value) params.set('status', String(statusFilter.value))
  return params
}

function downloadUrl(url) {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function exportCsv() {
  downloadUrl(`/api/admin/exports/orders?${buildFilterParams().toString()}`)
}

async function load() {
  errorMsg.value = ''
  try {
    loading.value = true
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    const id = String(userId.value || '').trim()
    if (id) params.set('userId', id)
    if (statusFilter.value) params.set('status', String(statusFilter.value))

    router.replace({ query: Object.fromEntries(params.entries()) })
    const data = await apiFetch(`/api/admin/billing/orders?${params.toString()}`)
    orders.value = data?.orders || []
    total.value = Number(data?.total || 0)

    const totalPages = Math.max(1, Math.ceil((total.value || 0) / pageSize.value))
    if (page.value > totalPages) {
      page.value = totalPages
      await load()
    }
  } catch (e) {
    orders.value = []
    total.value = 0
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function scheduleLoad() {
  if (inputTimer) window.clearTimeout(inputTimer)
  inputTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 450)
}

async function completeOrder(order) {
  if (!order?.id || order.status !== 'pending') return
  const ok = await confirmAction({
    title: '手动确认入账',
    tone: 'warning',
    objectName: order.id,
    message: '确认将这笔订单手动入账？',
    details: `${order.packageName || order.packageId} · +${order.creditsAmount} 积分。该操作会影响用户余额和账务流水。`,
    confirmText: '确认入账',
    destructive: false
  })
  if (!ok) return

  try {
    completingId.value = order.id
    const data = await apiFetch(`/api/admin/billing/orders/${encodeURIComponent(order.id)}/manual-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, { toast: false })
    toastSuccess(data?.idempotent ? '订单已入账，无需重复处理' : '订单已确认入账')
    await load()
  } catch (e) {
    toastError(e.message || '确认入账失败')
  } finally {
    completingId.value = ''
  }
}

async function refundOrder(order) {
  if (!order?.id || order.status !== 'paid') return
  const reason = window.prompt(`确认退款订单 ${order.id}？请输入退款原因`, 'billing_order_admin_refund')
  if (reason === null) return
  const normalizedReason = String(reason || '').trim() || 'billing_order_admin_refund'

  try {
    refundingId.value = order.id
    const data = await apiFetch(`/api/admin/billing/orders/${encodeURIComponent(order.id)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: normalizedReason })
    }, { toast: false })
    toastSuccess(data?.idempotent ? '订单已退款，无需重复处理' : '订单已退款并扣回积分')
    await load()
  } catch (e) {
    toastError(e.message || '退款失败')
  } finally {
    refundingId.value = ''
  }
}

async function copy(text) {
  const value = String(text || '').trim()
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toastSuccess('已复制')
  } catch {
    toastError('复制失败')
  }
}

function statusLabel(status) {
  const map = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    cancelled: '已取消',
    failed: '失败'
  }
  return map[status] || status || '-'
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value))
}

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents || 0) / 100
  const prefix = String(currency || 'CNY').toUpperCase() === 'CNY' ? '¥' : `${currency || ''} `
  return `${prefix}${amount.toFixed(2)}`
}

onMounted(() => {
  load()
})

watch(
  () => userId.value,
  () => {
    scheduleLoad()
  }
)

watch(
  () => statusFilter.value,
  () => {
    page.value = 1
    load()
  }
)

onUnmounted(() => {
  if (inputTimer) window.clearTimeout(inputTimer)
})
</script>

<style scoped>
.user-id {
  position: relative;
  width: min(360px, 100%);
}

.user-id-input {
  padding-right: 40px;
}

.user-id-copy {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.8);
  color: var(--muted);
  border-radius: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.user-id-copy:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-id-copy:hover:not(:disabled) {
  color: var(--text);
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.14);
}

.status-select {
  width: 200px;
}

.error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.06);
  color: var(--accent);
  font-weight: 800;
  margin: 12px 14px;
}

.foot-summary {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--muted);
}

.package-cell,
.payment-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.package-main {
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.package-sub,
.payment-ref {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 950;
  color: var(--text);
}

.chip.pending {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.08);
  color: #b45309;
}

.chip.paid {
  border-color: rgba(16, 185, 129, 0.24);
  background: rgba(16, 185, 129, 0.08);
  color: #047857;
}

.chip.refunded {
  border-color: rgba(59, 130, 246, 0.24);
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
}

.chip.cancelled,
.chip.failed {
  border-color: rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.07);
  color: var(--accent);
}

.balance {
  font-weight: 950;
  color: var(--primary);
}

.money {
  font-weight: 950;
  color: var(--text);
}

.row-actions {
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
