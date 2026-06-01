<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #filters>
        <SearchInput v-model="query" placeholder="搜索标题或遮罩码..." @keydown.enter.prevent="search" />
        <SelectMenu v-model="typeFilter" size="sm" :options="typeFilterOptions" placeholder="全部类型" class="sel" />
        <SelectMenu v-model="statusFilter" size="sm" :options="statusFilterOptions" placeholder="全部状态" class="sel" />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">
          <template #icon><RefreshCcwIcon :size="16" aria-hidden="true" /></template>
          刷新数据
        </Button>
      </template>
      <template #tools>
        <Button size="sm" :disabled="loading" @click="openCreate">创建兑换码</Button>
      </template>
      <template #table>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <DataTable
          variant="flat"
          :columns="columns"
          :rows="codes"
          :loading="loading"
          empty-text="暂无兑换码"
        >
          <template #cell-title="{ row }">
            <div class="title-cell">
              <div class="title-main">{{ row.title }}</div>
              <div class="title-sub mono">{{ row.codeMask }}</div>
            </div>
          </template>

          <template #cell-type="{ row }">
            <span class="chip">{{ row.type === 'campaign' ? '活动码' : '单次码' }}</span>
          </template>

          <template #cell-plainCode="{ row }">
            <span class="mono plain-code">{{ row.plainCode || '旧码不可回看' }}</span>
          </template>

          <template #cell-creditsAmount="{ row }">
            <span class="balance">+{{ row.creditsAmount }}</span>
          </template>

          <template #cell-progress="{ row }">
            <span class="mono">{{ row.redeemedCount }} / {{ row.totalLimit }}</span>
          </template>

          <template #cell-expiresAt="{ row }">
            <span class="mono">{{ row.expiresAt ? formatTime(row.expiresAt) : '永久' }}</span>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status">{{ statusLabel(row.status) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <Button variant="ghost" size="xs" @click="openClaims(row)">记录</Button>
              <Button variant="ghost" size="xs" @click="openEdit(row)">编辑</Button>
              <Button
                v-if="row.enabled"
                variant="ghost"
                size="xs"
                @click="toggleEnabled(row, false)"
              >
                停用
              </Button>
              <Button
                v-else
                variant="ghost"
                size="xs"
                @click="toggleEnabled(row, true)"
              >
                启用
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

  <Modal v-model:open="editorOpen" :title="form.id ? '编辑兑换码' : '创建兑换码'" size="lg">
    <div class="form-grid">
      <div class="form-item">
        <div class="form-label">标题</div>
        <Input v-model="form.title" placeholder="例如：五一活动码" />
      </div>

      <div class="form-item">
        <div class="form-label">类型</div>
        <SelectMenu
          v-model="form.type"
          :options="typeOptions"
          :disabled="Boolean(form.id)"
          placeholder="请选择类型"
        />
      </div>

      <div class="form-item form-tip-box">
        <div class="form-label">兑换码</div>
        <div class="field-help">
          {{ form.id ? '兑换码创建后不可修改，列表仅展示遮罩码。' : '保存后由系统自动生成随机兑换码。' }}
        </div>
      </div>

      <div class="form-item">
        <div class="form-label">到账余额</div>
        <Input v-model="form.creditsAmount" type="number" min="1" placeholder="例如 10" />
      </div>

      <div v-if="form.type === 'campaign'" class="form-item">
        <div class="form-label">总次数</div>
        <Input v-model="form.totalLimit" type="number" min="2" placeholder="例如 500" />
      </div>

      <div v-else class="form-item form-tip-box">
        <div class="form-label">总次数</div>
        <div class="field-help">单次码固定只可成功兑换 1 次。</div>
      </div>

      <div class="form-item">
        <div class="form-label">结束时间</div>
        <Input v-model="form.expiresAt" type="datetime-local" />
      </div>

      <div class="form-item">
        <div class="form-label">是否启用</div>
        <Switch v-model="form.enabled" />
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" size="sm" :disabled="saving" @click="editorOpen = false">取消</Button>
        <Button size="sm" :disabled="saving" @click="saveCode">
          {{ saving ? '保存中...' : '保存' }}
        </Button>
      </div>
    </template>
  </Modal>

  <Modal v-model:open="claimsOpen" title="兑换记录" size="lg">
    <div v-if="claimLoading" class="muted">加载中...</div>
    <div v-else-if="claims.length === 0" class="muted">暂无兑换记录</div>
    <div v-else class="claim-list">
      <div v-for="claim in claims" :key="claim.id" class="claim-row">
        <div class="claim-top">
          <div class="claim-user">{{ claim.username || claim.userId }}</div>
          <div class="claim-balance">+{{ claim.creditsAmount }}</div>
        </div>
        <div class="claim-sub mono">{{ formatTime(claim.claimedAt) }}</div>
      </div>
    </div>
    <template #footer>
      <div class="modal-actions">
        <div class="foot-summary">共 {{ claimsTotal }} 条</div>
        <Pagination
          variant="plain"
          :show-summary="false"
          :page="claimsPage"
          :page-size="claimsPageSize"
          :total="claimsTotal"
          @update:page="handleClaimsPageChange"
          @update:pageSize="handleClaimsPageSizeChange"
        />
      </div>
    </template>
  </Modal>

  <Modal v-model:open="createdCodeOpen" title="随机兑换码已生成" size="sm">
    <div class="created-code-body">
      <div class="field-help">{{ createdCodeHelp }}</div>
      <div class="created-code-value mono">{{ createdPlainCode }}</div>
    </div>
    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" size="sm" @click="createdCodeOpen = false">关闭</Button>
        <Button size="sm" @click="copyCreatedCode">复制兑换码</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Input, Modal, Pagination, SearchInput, SelectMenu, Switch, confirmAction, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const columns = [
  { key: 'title', title: '标题', width: '18%', nowrap: true, ellipsis: true },
  { key: 'type', title: '类型', width: '8%', nowrap: true },
  { key: 'plainCode', title: '完整兑换码', width: '20%', nowrap: true, ellipsis: true },
  { key: 'creditsAmount', title: '余额', width: '8%', nowrap: true },
  { key: 'progress', title: '使用进度', width: '10%', nowrap: true },
  { key: 'expiresAt', title: '结束时间', width: '14%', nowrap: true },
  { key: 'status', title: '状态', width: '8%', nowrap: true },
  { key: 'actions', title: '操作', width: '14%', nowrap: true }
]

const typeOptions = [
  { label: '单次码', value: 'single' },
  { label: '活动码', value: 'campaign' }
]

const typeFilterOptions = [{ label: '全部类型', value: '' }, ...typeOptions]
const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '生效中', value: 'active' },
  { label: '已停用', value: 'disabled' },
  { label: '已过期', value: 'expired' },
  { label: '已领完', value: 'exhausted' }
]

const loading = ref(false)
const saving = ref(false)
const claimLoading = ref(false)
const errorMsg = ref('')
const query = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const codes = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
let searchTimer = null

const editorOpen = ref(false)
const createdCodeOpen = ref(false)
const createdPlainCode = ref('')
const createdCodeHelp = ref('完整兑换码只在本次创建成功后展示一次，请立即复制保存。')
const originalEnabled = ref(true)
const form = reactive({
  id: '',
  title: '',
  type: 'single',
  creditsAmount: '5',
  totalLimit: '2',
  expiresAt: '',
  enabled: true
})

const claimsOpen = ref(false)
const currentClaimCodeId = ref('')
const claims = ref([])
const claimsTotal = ref(0)
const claimsPage = ref(1)
const claimsPageSize = ref(10)

function statusLabel(status) {
  if (status === 'disabled') return '已停用'
  if (status === 'expired') return '已过期'
  if (status === 'exhausted') return '已领完'
  return '生效中'
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function resetForm() {
  form.id = ''
  form.title = ''
  form.type = 'single'
  form.creditsAmount = '5'
  form.totalLimit = '2'
  form.expiresAt = ''
  form.enabled = true
}

async function load() {
  errorMsg.value = ''
  try {
    loading.value = true
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    if (String(query.value || '').trim()) params.set('q', String(query.value || '').trim())
    if (typeFilter.value) params.set('type', typeFilter.value)
    if (statusFilter.value) params.set('status', statusFilter.value)
    const data = await apiFetch(`/api/admin/redeem-codes?${params.toString()}`)
    codes.value = data.codes || []
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
  if (searchTimer) window.clearTimeout(searchTimer)
  page.value = 1
  load()
}

function openCreate() {
  resetForm()
  editorOpen.value = true
}

function openEdit(row) {
  form.id = String(row.id || '')
  form.title = String(row.title || '')
  form.type = String(row.type || 'single')
  form.creditsAmount = String(row.creditsAmount || 0)
  form.totalLimit = String(row.totalLimit || 2)
  form.expiresAt = row.expiresAt ? String(row.expiresAt).slice(0, 16) : ''
  form.enabled = Boolean(row.enabled)
  originalEnabled.value = Boolean(row.enabled)
  editorOpen.value = true
}

async function saveCode() {
  const title = String(form.title || '').trim()
  const creditsAmount = Number(form.creditsAmount)
  const totalLimit = Number(form.totalLimit)
  const nextEnabled = Boolean(form.enabled)
  if (!title) {
    toastError('标题不能为空')
    return
  }
  if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
    toastError('兑换余额必须大于 0')
    return
  }
  if (form.type === 'campaign' && (!Number.isFinite(totalLimit) || totalLimit < 2)) {
    toastError('活动码总次数至少为 2')
    return
  }

  const payload = {
    title,
    type: form.type,
    creditsAmount,
    totalLimit: form.type === 'campaign' ? totalLimit : 1,
    expiresAt: form.expiresAt || null,
    enabled: nextEnabled
  }

  try {
    if (form.id && originalEnabled.value !== nextEnabled) {
      const ok = await confirmAction({
        title: nextEnabled ? '启用兑换码' : '停用兑换码',
        tone: nextEnabled ? 'warning' : 'danger',
        objectName: title,
        message: `确认将该兑换码状态改为${nextEnabled ? '启用' : '停用'}吗？`,
        details: nextEnabled ? '启用后用户可继续兑换。' : '停用后用户将无法继续兑换该码。',
        confirmText: nextEnabled ? '启用' : '停用',
        destructive: !nextEnabled
      })
      if (!ok) return
    }
    saving.value = true
    // 创建和编辑共用一套表单，提交时按是否存在 id 自动切换接口。
    if (form.id) {
      await apiFetch(`/api/admin/redeem-codes/${encodeURIComponent(form.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      toastSuccess('已保存')
    } else {
      const created = await apiFetch('/api/admin/redeem-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      toastSuccess('已创建')
      createdPlainCode.value = String(created?.code?.plainCode || '')
      createdCodeHelp.value = '系统已生成随机兑换码，你也可以后续在列表里再次查看或复制。'
      createdCodeOpen.value = Boolean(createdPlainCode.value)
    }
    editorOpen.value = false
    await load()
  } catch (e) {
    toastError(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function copyCreatedCode() {
  const value = String(createdPlainCode.value || '').trim()
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toastSuccess('已复制兑换码')
  } catch {
    toastError('复制失败')
  }
}

async function toggleEnabled(row, enabled) {
  const ok = await confirmAction({
    title: enabled ? '启用兑换码' : '停用兑换码',
    tone: enabled ? 'warning' : 'danger',
    objectName: row.title,
    message: enabled ? '确认启用这个兑换码？' : '确认停用这个兑换码？',
    details: enabled ? '启用后用户可继续兑换。' : '停用后用户将无法继续兑换该码。',
    confirmText: enabled ? '启用' : '停用',
    destructive: !enabled
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/redeem-codes/${encodeURIComponent(row.id)}/${enabled ? 'enable' : 'disable'}`, {
      method: 'POST'
    })
    toastSuccess(enabled ? '已启用' : '已停用')
    await load()
  } catch (e) {
    toastError(e.message || '操作失败')
  }
}

async function openClaims(row) {
  currentClaimCodeId.value = String(row.id || '')
  claimsPage.value = 1
  claimsOpen.value = true
  await loadClaims()
}

async function loadClaims() {
  if (!currentClaimCodeId.value) return
  try {
    claimLoading.value = true
    const params = new URLSearchParams()
    params.set('page', String(claimsPage.value))
    params.set('limit', String(claimsPageSize.value))
    const data = await apiFetch(
      `/api/admin/redeem-codes/${encodeURIComponent(currentClaimCodeId.value)}/claims?${params.toString()}`
    )
    claims.value = data.claims || []
    claimsTotal.value = Number(data.total || 0)

    const totalPages = Math.max(1, Math.ceil((claimsTotal.value || 0) / claimsPageSize.value))
    if (claimsPage.value > totalPages) {
      claimsPage.value = totalPages
      await loadClaims()
    }
  } catch (e) {
    toastError(e.message || '加载记录失败')
  } finally {
    claimLoading.value = false
  }
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

function handleClaimsPageChange(next) {
  claimsPage.value = next
  loadClaims()
}

function handleClaimsPageSizeChange(next) {
  claimsPageSize.value = next
  claimsPage.value = 1
  loadClaims()
}

watch(
  () => form.type,
  (next) => {
    // 单次码固定只允许兑换 1 次，这里直接同步表单值，避免前端传错。
    if (next === 'single') {
      form.totalLimit = '1'
    } else if (Number(form.totalLimit) < 2) {
      form.totalLimit = '2'
    }
  }
)

watch([query, typeFilter, statusFilter], () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

onMounted(() => {
  load()
})

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
})
</script>

<style scoped>
.sel {
  width: 180px;
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

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-main {
  font-weight: 800;
}

.title-sub,
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--muted);
}

.plain-code {
  color: var(--text);
  font-weight: 800;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
}

.chip.active {
  color: #2563eb;
}

.chip.disabled,
.chip.expired,
.chip.exhausted {
  color: var(--muted);
}

.balance {
  font-weight: 900;
  color: var(--primary);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}

.field-help,
.muted {
  color: var(--muted);
  font-size: 13px;
}

.form-tip-box {
  justify-content: center;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.claim-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.created-code-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.created-code-value {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: rgba(37, 99, 235, 0.06);
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
  text-align: center;
}

.claim-row {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.claim-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.claim-user {
  font-weight: 800;
}

.claim-balance {
  font-weight: 900;
  color: var(--primary);
}

.claim-sub {
  margin-top: 6px;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
