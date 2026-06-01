<template>
  <div class="billing-page">
    <div class="billing-hero">
      <div class="billing-tabs" role="tablist" aria-label="充值中心视图">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'packages' }"
          @click="activeTab = 'packages'"
        >套餐</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'orders' }"
          @click="switchToOrders"
        >订单记录</button>
      </div>
      <div class="billing-hero-actions">
        <span class="billing-note">选择套餐后创建待支付订单，由管理员完成确认入账。</span>
        <Button variant="ghost" @click="goBack">返回账户</Button>
      </div>
    </div>

    <div v-if="activeTab === 'packages'" class="section-strip">
      <span>可用套餐</span>
      <strong>{{ billingStore.packages.length }} 个</strong>
    </div>

    <div v-if="activeTab === 'orders'" class="orders-toolbar">
      <div class="status-filters">
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          class="filter-chip"
          :class="{ active: statusFilter === opt.value }"
          @click="setStatusFilter(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <Button variant="ghost" size="sm" :disabled="billingStore.isLoadingOrders" @click="reloadOrders">刷新</Button>
    </div>

    <div v-if="activeTab === 'orders'" class="section-strip subtle">
      <span>订单记录</span>
      <strong>{{ billingStore.ordersTotal }} 条</strong>
    </div>

    <!-- 套餐列表 -->
    <div v-if="activeTab === 'packages'" class="tab-content">
      <div v-if="billingStore.isLoadingPackages" class="state-center">
        <span class="muted">加载中…</span>
      </div>
      <div v-else-if="!billingStore.packages.length" class="state-center">
        <span class="muted">暂无可用套餐</span>
      </div>
      <div v-else class="packages-grid">
        <div
          v-for="pkg in billingStore.packages"
          :key="pkg.id"
          class="package-card"
          :class="{ selected: selectedPackageId === pkg.id }"
          @click="selectedPackageId = pkg.id"
        >
          <div class="pkg-name">{{ pkg.name }}</div>
          <div class="pkg-credits">
            <span class="credits-num">{{ pkg.creditsAmount }}</span>
            <span class="credits-unit">积分</span>
          </div>
          <div class="pkg-price">¥{{ (pkg.priceCents / 100).toFixed(2) }}</div>
          <div v-if="pkg.description" class="pkg-desc">{{ pkg.description }}</div>
          <div class="pkg-check" :class="{ visible: selectedPackageId === pkg.id }">✓</div>
        </div>
      </div>

      <div v-if="billingStore.packages.length" class="purchase-bar">
        <div class="purchase-hint">
          <span v-if="selectedPkg">已选：{{ selectedPkg.name }} · {{ selectedPkg.creditsAmount }} 积分 · ¥{{ (selectedPkg.priceCents / 100).toFixed(2) }}</span>
          <span v-else class="muted">请选择套餐</span>
        </div>
        <Button
          :disabled="!selectedPackageId || billingStore.isCreatingOrder"
          @click="handleCreateOrder"
        >
          {{ billingStore.isCreatingOrder ? '创建中…' : '创建订单' }}
        </Button>
      </div>

      <div v-if="createdOrder" class="order-result">
        <div class="order-result-title">订单已创建</div>
        <div class="order-result-body">
          <div class="result-row">
            <span class="result-k">订单号</span>
            <span class="result-v mono">{{ createdOrder.id }}</span>
          </div>
          <div class="result-row">
            <span class="result-k">套餐</span>
            <span class="result-v">{{ createdOrder.packageName }}</span>
          </div>
          <div class="result-row">
            <span class="result-k">积分</span>
            <span class="result-v">{{ createdOrder.creditsAmount }}</span>
          </div>
          <div class="result-row">
            <span class="result-k">金额</span>
            <span class="result-v">¥{{ (createdOrder.amountCents / 100).toFixed(2) }}</span>
          </div>
          <div class="result-row">
            <span class="result-k">状态</span>
            <span class="result-v"><span class="status-chip pending">待支付</span></span>
          </div>
        </div>
        <div class="order-result-hint">订单已创建，请联系管理员完成支付确认。</div>
        <Button variant="ghost" size="sm" @click="switchToOrders">查看全部订单</Button>
      </div>
    </div>

    <!-- 订单列表 -->
    <div v-if="activeTab === 'orders'" class="tab-content">
      <div v-if="billingStore.isLoadingOrders" class="state-center">
        <span class="muted">加载中…</span>
      </div>
      <div v-else-if="!billingStore.orders.length" class="state-center">
        <span class="muted">暂无订单记录</span>
      </div>
      <div v-else class="orders-list">
        <div v-for="order in billingStore.orders" :key="order.id" class="order-row">
          <div class="order-main">
            <div class="order-pkg">{{ order.packageName }}</div>
            <div class="order-meta">
              <span class="mono order-id">{{ order.id.slice(0, 16) }}…</span>
              <span class="order-time">{{ formatTime(order.createdAt) }}</span>
            </div>
          </div>
          <div class="order-right">
            <div class="order-amount">¥{{ (order.amountCents / 100).toFixed(2) }}</div>
            <span class="status-chip" :class="order.status">{{ statusLabel(order.status) }}</span>
          </div>
        </div>
      </div>

      <Pagination
        v-if="billingStore.ordersTotal > pageSize"
        :page="currentPage"
        :page-size="pageSize"
        :total="billingStore.ordersTotal"
        :page-size-options="[10, 20, 50]"
        @update:page="changePage"
        @update:pageSize="changePageSize"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBillingStore } from '../../stores/billing'
import { Button, Pagination, toastSuccess, toastError } from '../../components/common'

const router = useRouter()
const billingStore = useBillingStore()

const activeTab = ref('packages')
const selectedPackageId = ref(null)
const createdOrder = ref(null)
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'cancelled', label: '已取消' },
  { value: 'failed', label: '失败' },
]

const selectedPkg = computed(() =>
  billingStore.packages.find(p => p.id === selectedPackageId.value) || null
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(billingStore.ordersTotal / pageSize.value))
)

function goBack() {
  router.push('/studio/settings')
}

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(val))
}

function statusLabel(status) {
  const map = { pending: '待支付', paid: '已支付', cancelled: '已取消', failed: '失败' }
  return map[status] || status
}

async function handleCreateOrder() {
  if (!selectedPackageId.value) return
  try {
    const order = await billingStore.createOrder(selectedPackageId.value)
    if (order) {
      createdOrder.value = order
      toastSuccess('订单已创建')
      currentPage.value = 1
      await billingStore.fetchOrders({ page: 1, limit: pageSize.value })
    }
  } catch (e) {
    toastError(e?.message || '创建订单失败')
  }
}

async function switchToOrders() {
  activeTab.value = 'orders'
  await reloadOrders()
}

async function reloadOrders() {
  await billingStore.fetchOrders({
    page: currentPage.value,
    limit: pageSize.value,
    status: statusFilter.value || undefined,
  })
}

async function setStatusFilter(val) {
  statusFilter.value = val
  currentPage.value = 1
  await reloadOrders()
}

async function changePage(page) {
  currentPage.value = page
  await reloadOrders()
}

async function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  await reloadOrders()
}

onMounted(() => {
  billingStore.fetchPackages()
})
</script>

<style scoped>
.billing-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.billing-hero {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.10), rgba(255, 255, 255, 0.68) 46%),
    rgba(255, 255, 255, 0.68);
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
  padding: 12px;
}

.billing-hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

.billing-note {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.billing-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.72);
  flex: none;
}

.tab-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 900;
  color: var(--muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.16s, background 0.16s, box-shadow 0.16s;
}

.tab-btn.active {
  color: var(--primary);
  background: rgba(37, 99, 235, 0.10);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.14);
}

.section-strip {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.64);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.section-strip strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.section-strip.subtle {
  margin-top: -4px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.state-center {
  padding: 48px 0;
  text-align: center;
}

.muted {
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
}

/* Packages */
.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.package-card {
  position: relative;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
  padding: 16px 14px 14px;
  cursor: pointer;
  transition: border-color 0.16s, box-shadow 0.16s;
}

.package-card:hover {
  border-color: rgba(37, 99, 235, 0.3);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.1);
}

.package-card.selected {
  border-color: var(--primary);
  box-shadow: 0 6px 22px rgba(37, 99, 235, 0.16);
}

.pkg-name {
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
  margin-bottom: 10px;
}

.pkg-credits {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 6px;
}

.credits-num {
  font-size: 28px;
  font-weight: 950;
  color: var(--primary);
  line-height: 1;
}

.credits-unit {
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}

.pkg-price {
  font-size: 15px;
  font-weight: 950;
  color: var(--text);
  margin-bottom: 6px;
}

.pkg-desc {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  line-height: 1.5;
}

.pkg-check {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 950;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.16s;
}

.pkg-check.visible {
  opacity: 1;
}

.purchase-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(18px);
}

.purchase-hint {
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
}

/* Order result */
.order-result {
  border-radius: 8px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  background: var(--gradient-subtle);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-result-title {
  font-size: 14px;
  font-weight: 950;
  color: var(--primary);
}

.order-result-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.result-k {
  width: 60px;
  font-weight: 900;
  color: var(--muted);
  flex-shrink: 0;
}

.result-v {
  font-weight: 900;
  color: var(--text);
}

.order-result-hint {
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}

/* Orders list */
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.status-filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-chip {
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 950;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.16s, border-color 0.16s, background 0.16s;
}

.filter-chip.active {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.3);
  background: var(--gradient-subtle);
}

.orders-list {
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.74);
  overflow: hidden;
}

.order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  transition: background 0.16s;
}

.order-row:first-child {
  border-top: none;
}

.order-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.order-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-pkg {
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
}

.order-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.order-id {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.order-time {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
}

.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.order-amount {
  font-size: 14px;
  font-weight: 950;
  color: var(--text);
}

.status-chip {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
}

.status-chip.pending {
  color: #d97706;
  border-color: rgba(217, 119, 6, 0.22);
  background: rgba(254, 243, 199, 0.7);
}

.status-chip.paid {
  color: #059669;
  border-color: rgba(5, 150, 105, 0.22);
  background: rgba(209, 250, 229, 0.7);
}

.status-chip.cancelled,
.status-chip.failed {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.18);
  background: rgba(254, 226, 226, 0.7);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 760px) {
  .billing-hero,
  .billing-hero-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .billing-tabs {
    width: 100%;
  }

  .tab-btn {
    flex: 1;
  }

  .packages-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  .purchase-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
