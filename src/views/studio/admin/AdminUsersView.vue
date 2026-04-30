<template>
  <TablePageLayout
    title=""
    subtitle=""
    density="compact"
    variant="plain"
  >
    <AdminListLayout>
      <template #filters>
        <SearchInput v-model="q" placeholder="搜索用户名、ID..." @keydown.enter.prevent="search" />
        <SelectMenu v-model="planFilter" size="sm" :options="planOptions" placeholder="全部 plan" class="sel" />
        <SelectMenu v-model="roleFilter" size="sm" :options="roleOptions" placeholder="全部 role" class="sel" />
        <Input v-model="minBalance" size="sm" placeholder="余额≥" class="num" />
        <Input v-model="maxBalance" size="sm" placeholder="余额≤" class="num" />
        <Toggle v-model="lowBalanceOnly" size="sm" label="仅余额不足" class="toggle" />
      </template>
      <template #filterActions>
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
          :rows="users"
          :loading="loading"
          :selected-key="selected?.id || ''"
          clickable
          @rowClick="openDrawer"
        >
          <template #cell-user="{ row }">
            <div class="user-cell">
              <div class="user-top">
                <div class="user-name">{{ row.username }}</div>
              </div>
              <div class="user-sub">
                <span class="mono">{{ row.id }}</span>
              </div>
            </div>
          </template>

          <template #cell-plan="{ row }">
            <span class="chip plan">{{ row.plan }}</span>
          </template>

          <template #cell-role="{ row }">
            <span class="chip" :class="row.role">{{ row.role }}</span>
          </template>

          <template #cell-creditBalance="{ row }">
            <span class="balance" :class="{ low: Number(row.creditBalance) <= 0 }">{{ row.creditBalance }}</span>
          </template>

          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
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

  <Drawer v-model:open="drawerOpen" size="lg">
      <div class="drawer-head">
        <div class="drawer-title">
          <div class="drawer-name">{{ selected?.username }}</div>
          <div class="drawer-meta">
            <span class="pill">{{ selected?.plan }}</span>
            <span class="pill">{{ selected?.role }}</span>
            <span class="pill">余额 {{ selected?.creditBalance ?? 0 }}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" @click="closeDrawer">关闭</Button>
      </div>

      <div class="drawer-tabs">
        <button class="tab" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">概览</button>
        <button class="tab" :class="{ active: tab === 'billing' }" @click="tab = 'billing'">账务</button>
        <button class="tab" :class="{ active: tab === 'ledger' }" @click="tab = 'ledger'">流水</button>
        <button v-if="isSuperAdmin" class="tab" :class="{ active: tab === 'perm' }" @click="tab = 'perm'">权限</button>
      </div>

      <div class="drawer-body">
        <div v-if="tab === 'overview'" class="section">
          <div class="kv">
            <div class="kv-label">基本信息</div>
            <div class="grid-2 info-grid">
              <div class="info-item">
                <div class="info-k">用户名</div>
                <div class="info-v">
                  <span class="info-main">{{ selected?.username }}</span>
                  <Button variant="ghost" size="xs" @click="copy(selected?.username)">复制</Button>
                </div>
              </div>
              <div class="info-item">
                <div class="info-k">用户 ID</div>
                <div class="info-v">
                  <span class="mono">{{ selected?.id }}</span>
                  <Button variant="ghost" size="xs" @click="copy(selected?.id)">复制</Button>
                </div>
              </div>
              <div class="info-item">
                <div class="info-k">当前 Plan</div>
                <div class="info-v">
                  <span class="info-main">{{ selected?.plan }}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-k">当前 Role</div>
                <div class="info-v">
                  <span class="info-main">{{ selected?.role }}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-k">余额</div>
                <div class="info-v">
                  <span class="info-main">{{ selected?.creditBalance ?? 0 }}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-k">创建时间</div>
                <div class="info-v">
                  <span class="mono">{{ formatTime(selected?.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="kv">
            <div class="kv-label">Plan / Role</div>
            <div class="edit-stack">
              <div class="edit-item">
                <div class="edit-title">Plan</div>
                <SelectMenu
                  v-model="editPlan"
                  size="sm"
                  :options="planOptions.filter((o) => o.value !== '')"
                  :disabled="saving.plan"
                />
                <div class="edit-actions">
                  <Button
                    size="sm"
                    :disabled="saving.plan || editPlan === selected?.plan"
                    @click="savePlan"
                  >
                    保存 Plan
                  </Button>
                </div>
              </div>

              <div class="edit-item">
                <div class="edit-title">Role</div>
                <div class="muted edit-hint">仅 superadmin 可编辑；superadmin 账号本身不可修改。</div>
                <SelectMenu
                  v-model="editRole"
                  size="sm"
                  :options="roleOptions.filter((o) => o.value !== '' && o.value !== 'superadmin')"
                  :disabled="!isSuperAdmin || saving.role || selected?.role === 'superadmin'"
                />
                <div class="edit-actions">
                  <Button
                    size="sm"
                    :disabled="!isSuperAdmin || saving.role || editRole === selected?.role || selected?.role === 'superadmin'"
                    @click="saveRole"
                  >
                    保存 Role
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'billing'" class="section">
          <div class="kv">
            <div class="kv-label">调账</div>
            <div class="grid-2">
              <Input v-model="adjustAmount" size="sm" placeholder="例如 100 或 -50" />
              <Input v-model="adjustReason" size="sm" placeholder="manual_adjust" />
            </div>
            <div class="actions">
              <Button size="sm" :disabled="adjustLoading" @click="submitAdjust">
                {{ adjustLoading ? '处理中...' : '确认调账' }}
              </Button>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'ledger'" class="section">
          <div class="kv">
            <div class="kv-label">流水</div>
            <div v-if="ledgerLoading" class="muted">加载中...</div>
            <div v-else-if="ledger.length === 0" class="muted">暂无流水</div>
            <div v-else class="ledger">
              <div v-for="e in ledger" :key="e.id" class="ledger-row">
                <div class="ledger-top">
                  <div class="ledger-type">{{ e.type }}</div>
                  <div class="ledger-amt" :class="{ neg: e.amount < 0 }">{{ e.amount }}</div>
                </div>
                <div class="ledger-sub">
                  <span class="mono">{{ formatTime(e.createdAt) }}</span>
                  <span class="dot">·</span>
                  <span>{{ e.reason }}</span>
                </div>
                <div v-if="e.refType || e.refId" class="ledger-sub mono">
                  <span v-if="e.refType">{{ e.refType }}:</span><span v-if="e.refId">{{ e.refId }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="section">
          <div class="kv">
            <div class="kv-label">管理员授权</div>
            <div class="muted">仅超级管理员可修改普通用户与管理员的角色。</div>
            <div class="actions">
              <Button
                v-if="selected?.role === 'user'"
                size="sm"
                :disabled="saving.role"
                @click="setRole('admin')"
              >
                设为 admin
              </Button>
              <Button
                v-else-if="selected?.role === 'admin'"
                variant="ghost"
                size="sm"
                :disabled="saving.role"
                @click="setRole('user')"
              >
                取消 admin
              </Button>
              <div v-else class="muted">超级管理员不可在此修改</div>
            </div>
          </div>
        </div>
      </div>
  </Drawer>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../../../stores/auth'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Drawer, Input, Pagination, SearchInput, SelectMenu, Toggle, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const authStore = useAuthStore()
const isSuperAdmin = computed(() => authStore.user?.role === 'superadmin')

const planOptions = [
  { label: 'free', value: 'free' },
  { label: 'pro', value: 'pro' }
]

const roleOptions = [
  { label: 'user', value: 'user' },
  { label: 'admin', value: 'admin' },
  { label: 'superadmin', value: 'superadmin', disabled: true }
]

const columns = [
  { key: 'user', title: '用户', width: '44%', nowrap: true, ellipsis: true },
  { key: 'plan', title: 'Plan', width: '12%', align: 'left', nowrap: true },
  { key: 'role', title: 'Role', width: '12%', align: 'left', nowrap: true },
  { key: 'creditBalance', title: '余额', width: '10%', align: 'left', nowrap: true },
  { key: 'createdAt', title: '创建时间', width: '22%', align: 'left', nowrap: true }
]

const q = ref('')
const users = ref([])
const total = ref(0)
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = ref(20)

const planFilter = ref('')
const roleFilter = ref('')
const minBalance = ref('')
const maxBalance = ref('')
const lowBalanceOnly = ref(false)

async function api(url, options) {
  return apiFetch(url, options)
}

async function load() {
  errorMsg.value = ''
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('search', String(q.value || ''))
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    if (planFilter.value) params.set('plan', String(planFilter.value))
    if (roleFilter.value) params.set('role', String(roleFilter.value))
    if (String(minBalance.value || '').trim() !== '') params.set('minBalance', String(minBalance.value))
    if (String(maxBalance.value || '').trim() !== '') params.set('maxBalance', String(maxBalance.value))
    if (lowBalanceOnly.value) params.set('lowBalanceOnly', '1')

    const data = await api(`/api/admin/users?${params.toString()}`)
    users.value = data.users || []
    total.value = Number(data.total || 0)

    const totalPages = Math.max(1, Math.ceil((total.value || 0) / pageSize.value))
    if (page.value > totalPages) {
      page.value = totalPages
      await load()
    }
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function handlePageChange(next) {
  page.value = next
  load()
}

function handlePageSizeChange(next) {
  pageSize.value = next
  page.value = 1
  load()
}

let filterTimer = null

function scheduleFilterLoad() {
  if (filterTimer) window.clearTimeout(filterTimer)
  filterTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 400)
}

watch([planFilter, roleFilter, lowBalanceOnly], () => {
  page.value = 1
  load()
})

watch([q], () => {
  scheduleFilterLoad()
})

watch([minBalance, maxBalance], () => {
  scheduleFilterLoad()
})

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

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(val))
}

const drawerOpen = ref(false)
const selected = ref(null)
const tab = ref('overview')

const editPlan = ref('free')
const editRole = ref('user')
const saving = ref({ plan: false, role: false })

function openDrawer(user) {
  selected.value = { ...user }
  editPlan.value = selected.value.plan
  editRole.value = selected.value.role
  drawerOpen.value = true
  tab.value = 'overview'
}

function closeDrawer() {
  drawerOpen.value = false
  selected.value = null
  ledger.value = []
}

function updateLocalUser(id, patch) {
  users.value = (users.value || []).map((u) => (u.id === id ? { ...u, ...patch } : u))
}

async function savePlan() {
  if (!selected.value?.id) return
  saving.value = { ...saving.value, plan: true }
  try {
    await api(`/api/admin/users/${selected.value.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: editPlan.value })
    })
    selected.value.plan = editPlan.value
    updateLocalUser(selected.value.id, { plan: editPlan.value })
    toastSuccess('已更新套餐')
  } catch (e) {
    await load()
  } finally {
    saving.value = { ...saving.value, plan: false }
  }
}

async function saveRole() {
  if (!selected.value?.id) return
  saving.value = { ...saving.value, role: true }
  try {
    await api(`/api/admin/users/${selected.value.id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editRole.value })
    })
    selected.value.role = editRole.value
    updateLocalUser(selected.value.id, { role: editRole.value })
    toastSuccess('已更新角色')
  } catch (e) {
    await load()
  } finally {
    saving.value = { ...saving.value, role: false }
  }
}

async function setRole(role) {
  editRole.value = role
  await saveRole()
}

const adjustAmount = ref('')
const adjustReason = ref('manual_adjust')
const adjustLoading = ref(false)

async function submitAdjust() {
  const amount = Number(adjustAmount.value)
  if (!Number.isFinite(amount) || amount === 0) {
    toastError('amount 必须是非 0 数值')
    return
  }
  if (!selected.value?.id) return
  adjustLoading.value = true
  try {
    const data = await api(`/api/admin/users/${selected.value.id}/credits/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: adjustReason.value })
    })
    selected.value.creditBalance = data.balance
    updateLocalUser(selected.value.id, { creditBalance: data.balance })
    toastSuccess('调账成功')
    await loadLedger()
  } catch (e) {
  } finally {
    adjustLoading.value = false
  }
}

const ledger = ref([])
const ledgerLoading = ref(false)

async function loadLedger() {
  if (!selected.value?.id) return
  ledgerLoading.value = true
  try {
    const data = await api(`/api/admin/users/${encodeURIComponent(selected.value.id)}/credits/ledger?limit=100&page=1`)
    ledger.value = data.entries || []
  } catch (e) {
    ledger.value = []
  } finally {
    ledgerLoading.value = false
  }
}

watch(
  () => drawerOpen.value,
  async (open) => {
    if (open) await loadLedger()
  }
)

watch(
  () => tab.value,
  async (v) => {
    if (v === 'ledger') await loadLedger()
  }
)

function onKeydown(e) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}

onMounted(load)
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.sel {
  width: 200px;
}

.num {
  width: 120px;
}

.toggle {
  min-width: 160px;
}

.error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(236, 72, 153, 0.25);
  background: rgba(236, 72, 153, 0.06);
  color: var(--accent);
  font-weight: 800;
  margin: 12px 14px;
}

.foot-summary {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.user-top,
.user-sub {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  min-width: 0;
}

.user-name {
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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

.chip.admin {
  color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.18);
}

.chip.superadmin {
  color: var(--accent);
  background: rgba(236, 72, 153, 0.08);
  border-color: rgba(236, 72, 153, 0.18);
}

.balance {
  font-weight: 950;
  color: var(--primary);
}

.balance.low {
  color: var(--accent);
}

.drawer-head {
  padding: 18px 18px 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
}

.drawer-title {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.drawer-name {
  font-weight: 950;
  font-size: 20px;
  line-height: 1.2;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.66);
  font-size: 11px;
  font-weight: 950;
  color: rgba(15, 23, 42, 0.75);
}

.drawer-tabs {
  padding: 10px 14px;
  display: flex;
  gap: 6px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  overflow: auto;
}

.tab {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  color: var(--text);
}

.tab.active {
  border-color: rgba(99, 102, 241, 0.22);
  background: var(--gradient-subtle);
  color: var(--primary);
}

.drawer-body {
  padding: 16px;
  overflow: auto;
  flex: 1;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kv {
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.78);
  padding: 14px;
}

.kv-label {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  margin-bottom: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kv-value {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
}

.kv-controls {
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.kv-controls .input {
  flex: 1 1 220px;
  min-width: 200px;
}

.kv-controls .btn {
  flex: 0 0 auto;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-grid {
  margin-top: 2px;
}

.info-item {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  padding: 12px;
  min-width: 0;
}

.info-k {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.info-v {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.info-main {
  font-weight: 950;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-item {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  padding: 12px;
}

.edit-title {
  font-size: 12px;
  font-weight: 950;
  color: var(--text);
  margin-bottom: 10px;
}

.edit-hint {
  margin: -6px 0 10px;
}

.edit-item .input {
  width: 100%;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.edit-actions .btn,
.actions .btn {
  min-width: 140px;
}

.muted {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.ledger {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ledger-row {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.78);
  padding: 14px;
}

.ledger-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ledger-type {
  font-weight: 950;
  color: var(--text);
  font-size: 13px;
}

.ledger-amt {
  font-weight: 950;
  color: var(--primary);
  font-size: 13px;
}

.ledger-amt.neg {
  color: var(--accent);
}

.ledger-sub {
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.dot {
  margin: 0 6px;
  opacity: 0.6;
}

@media (max-width: 820px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
