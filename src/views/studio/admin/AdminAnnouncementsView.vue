<template>
  <TablePageLayout
    title=""
    subtitle=""
    density="compact"
    variant="plain"
  >
    <AdminListLayout>
      <template #filters>
        <SearchInput v-model="q" placeholder="搜索公告标题、内容..." @keydown.enter.prevent="load" />
        <SelectMenu v-model="statusFilter" size="sm" :options="statusOptions" placeholder="全部状态" class="sel" />
        <SelectMenu v-model="notifyFilter" size="sm" :options="notifyOptions" placeholder="全部通知方式" class="sel" />
        <SelectMenu v-model="repeatFilter" size="sm" :options="repeatFilterOptions" placeholder="全部策略" class="sel" />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">
          <template #icon><RefreshCcwIcon :size="16" aria-hidden="true" /></template>
          刷新数据
        </Button>
      </template>
      <template #tools>
        <Button size="sm" :disabled="loading" @click="openCreate">创建公告</Button>
      </template>
      <template #table>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <DataTable variant="flat" :columns="columns" :rows="rows" :loading="loading" empty-text="暂无公告">
          <template #cell-title="{ row }">
            <div class="title-cell">
              <div class="title-main">{{ row.title }}</div>
              <div class="title-sub mono">ID: {{ row.id }}</div>
            </div>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status">{{ statusLabel(row.status) }}</span>
          </template>

          <template #cell-notifyMode="{ row }">
            <span class="chip mode">{{ notifyLabel(row.notifyMode) }}</span>
          </template>

          <template #cell-repeatMode="{ row }">
            <span class="chip repeat">{{ repeatLabel(row.repeatMode) }}</span>
          </template>

          <template #cell-audience="{ row }">
            <div class="audience-cell">
              <span class="audience-summary">{{ audienceSummary(row.audience) }}</span>
            </div>
          </template>

          <template #cell-window="{ row }">
            <div class="window">
              <div class="window-line">
                <span class="window-k">开始</span>
                <span class="mono">{{ row.startAt ? formatTime(row.startAt) : '立即' }}</span>
              </div>
              <div class="window-line">
                <span class="window-k">结束</span>
                <span class="mono">{{ row.endAt ? formatTime(row.endAt) : '永久' }}</span>
              </div>
            </div>
          </template>

          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <Button variant="ghost" size="xs" @click="openEdit(row)">编辑</Button>
              <Button v-if="row.status === 'draft'" variant="ghost" size="xs" @click="publish(row)">发布</Button>
              <Button v-else-if="row.status === 'published'" variant="ghost" size="xs" @click="archive(row)">下线</Button>
              <Button variant="danger" size="xs" @click="remove(row)">删除</Button>
            </div>
          </template>
        </DataTable>
      </template>
      <template #footer>
        <div class="foot-summary">共 {{ rows.length }} 条</div>
      </template>
    </AdminListLayout>
  </TablePageLayout>

  <Modal v-model:open="modalOpen" :title="form.id ? '编辑公告' : '创建公告'" size="lg">
    <div class="form-grid">
      <div class="form-item">
        <div class="form-label">标题</div>
        <Input v-model="form.title" placeholder="请输入公告标题" />
      </div>

      <div class="form-item form-span">
        <div class="form-label">内容（支持 Markdown）</div>
        <textarea v-model="form.contentMd" class="textarea md" placeholder="请输入公告内容..." />
      </div>

      <div class="form-item">
        <div class="form-label">通知方式</div>
        <SelectMenu v-model="form.notifyMode" :options="notifyOptions.slice(1)" placeholder="选择通知方式" />
      </div>

      <div class="form-item">
        <div class="form-label">弹窗策略</div>
        <SelectMenu v-model="form.repeatMode" :options="repeatOptions" placeholder="选择策略" />
      </div>

      <div class="form-item">
        <div class="form-label">开始时间</div>
        <Input v-model="form.startAt" type="datetime-local" />
      </div>

      <div class="form-item">
        <div class="form-label">结束时间</div>
        <Input v-model="form.endAt" type="datetime-local" />
      </div>

      <div class="form-item form-span audience-panel">
        <div class="audience-head">
          <div>
            <div class="form-label">投放人群</div>
            <div class="audience-hint">不选择任何条件时，对所有用户展示。</div>
          </div>
          <div class="audience-preview">
            <span v-if="previewResult" class="preview-count">命中 {{ previewResult.matchedUsers }} 人</span>
            <Button variant="ghost" size="sm" :disabled="previewing" @click="previewAudience">预览命中</Button>
          </div>
        </div>

        <div class="audience-grid">
          <div class="audience-group">
            <div class="audience-label">账号状态</div>
            <div class="toggle-row">
              <button
                v-for="item in userStatusOptions"
                :key="item.value"
                type="button"
                class="toggle-pill"
                :class="{ active: form.audience.statuses.includes(item.value) }"
                @click="toggleAudienceList('statuses', item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="audience-group">
            <div class="audience-label">用户角色</div>
            <div class="toggle-row">
              <button
                v-for="item in roleOptions"
                :key="item.value"
                type="button"
                class="toggle-pill"
                :class="{ active: form.audience.roles.includes(item.value) }"
                @click="toggleAudienceList('roles', item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <label class="check-row">
            <input v-model="form.audience.paidOnly" type="checkbox" />
            <span>仅已付费用户</span>
          </label>

          <div class="audience-dates">
            <div class="form-item">
              <div class="audience-label">注册不早于</div>
              <Input v-model="form.audience.createdAfter" type="datetime-local" />
            </div>
            <div class="form-item">
              <div class="audience-label">注册不晚于</div>
              <Input v-model="form.audience.createdBefore" type="datetime-local" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" size="sm" :disabled="saving" @click="modalOpen = false">取消</Button>
        <Button size="sm" :disabled="saving" @click="saveDraft">保存</Button>
        <Button v-if="form.id && form.status === 'draft'" size="sm" :disabled="saving" @click="publishCurrent">发布</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Input, Modal, SearchInput, SelectMenu, confirmAction, confirmDanger, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { useAnnouncementsStore } from '../../../stores/announcements'

const store = useAnnouncementsStore()

const columns = [
  { key: 'title', title: '标题', width: '28%', nowrap: true, ellipsis: true },
  { key: 'status', title: '状态', width: '10%', nowrap: true },
  { key: 'notifyMode', title: '通知方式', width: '12%', nowrap: true },
  { key: 'repeatMode', title: '策略', width: '10%', nowrap: true },
  { key: 'audience', title: '投放人群', width: '18%', nowrap: true },
  { key: 'window', title: '有效期', width: '16%', nowrap: true },
  { key: 'createdAt', title: '创建时间', width: '12%', nowrap: true },
  { key: 'actions', title: '操作', width: '12%', nowrap: true }
]

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已下线', value: 'archived' }
]

const notifyOptions = [
  { label: '全部', value: '' },
  { label: '静默', value: 'silent' },
  { label: '弹窗', value: 'modal' }
]

const repeatOptions = [
  { label: '读过不再弹', value: 'once' },
  { label: '每次必读', value: 'always' }
]

const repeatFilterOptions = [{ label: '全部策略', value: '' }, ...repeatOptions]
const userStatusOptions = [
  { label: '正常', value: 'active' },
  { label: '待验证', value: 'pending_verification' },
  { label: '封禁', value: 'banned' }
]
const roleOptions = [
  { label: '用户', value: 'user' },
  { label: '管理员', value: 'admin' },
  { label: '超管', value: 'superadmin' }
]

const q = ref('')
const statusFilter = ref('')
const notifyFilter = ref('')
const repeatFilter = ref('')
const errorMsg = ref('')
const loading = computed(() => store.adminLoading)
const rows = computed(() => {
  const list = store.adminList || []
  if (!repeatFilter.value) return list
  return list.filter((a) => a.repeatMode === repeatFilter.value)
})

const modalOpen = ref(false)
const saving = ref(false)
const previewing = ref(false)
const previewResult = ref(null)
const form = reactive({
  id: '',
  title: '',
  contentMd: '',
  status: 'draft',
  notifyMode: 'silent',
  repeatMode: 'once',
  startAt: '',
  endAt: '',
  audience: {
    statuses: [],
    roles: [],
    createdAfter: '',
    createdBefore: '',
    paidOnly: false
  }
})

function statusLabel(v) {
  if (v === 'published') return '展示中'
  if (v === 'archived') return '已下线'
  return '草稿'
}

function notifyLabel(v) {
  return v === 'modal' ? '弹窗' : '静默'
}

function repeatLabel(v) {
  return v === 'always' ? '必读' : '一次'
}

function optionLabels(options, values) {
  const set = new Set(Array.isArray(values) ? values : [])
  return options.filter((item) => set.has(item.value)).map((item) => item.label)
}

function audienceSummary(audience) {
  const a = audience || {}
  const parts = []
  const statuses = optionLabels(userStatusOptions, a.statuses)
  const roles = optionLabels(roleOptions, a.roles)
  if (statuses.length) parts.push(statuses.join('/'))
  if (roles.length) parts.push(roles.join('/'))
  if (a.paidOnly) parts.push('已付费')
  if (a.createdAfter) parts.push(`注册后 ${formatTime(a.createdAfter)}`)
  if (a.createdBefore) parts.push(`注册前 ${formatTime(a.createdBefore)}`)
  return parts.length ? parts.join(' · ') : '全量用户'
}

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(val))
}

function normalizeDateInput(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  const iso = v.includes('T') ? v : v.replace(' ', 'T')
  return iso
}

function normalizeAudienceForm(audience) {
  const a = audience || {}
  return {
    statuses: Array.isArray(a.statuses) ? a.statuses.filter((item) => userStatusOptions.some((opt) => opt.value === item)) : [],
    roles: Array.isArray(a.roles) ? a.roles.filter((item) => roleOptions.some((opt) => opt.value === item)) : [],
    createdAfter: a.createdAfter ? String(a.createdAfter).slice(0, 16) : '',
    createdBefore: a.createdBefore ? String(a.createdBefore).slice(0, 16) : '',
    paidOnly: a.paidOnly === true
  }
}

function setAudience(audience) {
  const next = normalizeAudienceForm(audience)
  form.audience.statuses = next.statuses
  form.audience.roles = next.roles
  form.audience.createdAfter = next.createdAfter
  form.audience.createdBefore = next.createdBefore
  form.audience.paidOnly = next.paidOnly
  previewResult.value = null
}

function audiencePayload() {
  const payload = {}
  if (form.audience.statuses.length) payload.statuses = [...form.audience.statuses]
  if (form.audience.roles.length) payload.roles = [...form.audience.roles]
  const createdAfter = normalizeDateInput(form.audience.createdAfter)
  const createdBefore = normalizeDateInput(form.audience.createdBefore)
  if (createdAfter) payload.createdAfter = createdAfter
  if (createdBefore) payload.createdBefore = createdBefore
  if (form.audience.paidOnly) payload.paidOnly = true
  return payload
}

function toggleAudienceList(key, value) {
  const list = form.audience[key]
  const index = list.indexOf(value)
  if (index >= 0) {
    list.splice(index, 1)
  } else {
    list.push(value)
  }
  previewResult.value = null
}

async function load() {
  errorMsg.value = ''
  try {
    const qv = String(q.value || '').trim()
    await store.fetchAdmin({
      q: qv,
      status: statusFilter.value,
      notifyMode: notifyFilter.value,
      limit: 200
    })
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  }
}

let qTimer = null

function scheduleLoad() {
  if (qTimer) window.clearTimeout(qTimer)
  qTimer = window.setTimeout(() => {
    load()
  }, 400)
}

function openCreate() {
  form.id = ''
  form.title = ''
  form.contentMd = ''
  form.status = 'draft'
  form.notifyMode = 'silent'
  form.repeatMode = 'once'
  form.startAt = ''
  form.endAt = ''
  setAudience({})
  modalOpen.value = true
}

function openEdit(row) {
  form.id = String(row.id || '')
  form.title = String(row.title || '')
  form.contentMd = String(row.contentMd || '')
  form.status = String(row.status || 'draft')
  form.notifyMode = String(row.notifyMode || 'silent')
  form.repeatMode = String(row.repeatMode || 'once')
  form.startAt = row.startAt ? String(row.startAt).slice(0, 16) : ''
  form.endAt = row.endAt ? String(row.endAt).slice(0, 16) : ''
  setAudience(row.audience || {})
  modalOpen.value = true
}

async function saveDraft() {
  const title = String(form.title || '').trim()
  const contentMd = String(form.contentMd || '').trim()
  if (!title) {
    toastError('标题不能为空')
    return
  }
  if (!contentMd) {
    toastError('内容不能为空')
    return
  }

  const payload = {
    title,
    contentMd,
    notifyMode: form.notifyMode,
    repeatMode: form.repeatMode,
    startAt: normalizeDateInput(form.startAt) || null,
    endAt: normalizeDateInput(form.endAt) || null,
    audience: audiencePayload()
  }

  try {
    saving.value = true
    if (form.id) {
      const updated = await store.updateAnnouncement(form.id, payload)
      form.status = String(updated?.status || form.status)
    } else {
      const created = await store.createAnnouncement(payload)
      form.id = String(created?.id || '')
      form.status = String(created?.status || 'draft')
    }
    toastSuccess('已保存')
    await load()
  } catch (e) {
    toastError(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function previewAudience() {
  try {
    previewing.value = true
    previewResult.value = await store.previewAudience(audiencePayload())
  } catch (e) {
    toastError(e.message || '预览失败')
  } finally {
    previewing.value = false
  }
}

async function publishCurrent() {
  if (!form.id) return
  try {
    saving.value = true
    await store.publishAnnouncement(form.id)
    toastSuccess('已发布')
    modalOpen.value = false
    await load()
  } catch (e) {
    toastError(e.message || '发布失败')
  } finally {
    saving.value = false
  }
}

async function publish(row) {
  const ok = await confirmAction({
    title: '发布公告',
    tone: 'warning',
    objectName: row.title,
    message: '确认发布该公告？',
    details: '发布后符合条件的用户会在公告中心看到它。',
    confirmText: '发布',
    destructive: false
  })
  if (!ok) return
  try {
    await store.publishAnnouncement(row.id)
    toastSuccess('已发布')
    await load()
  } catch (e) {
    toastError(e.message || '发布失败')
  }
}

async function archive(row) {
  const ok = await confirmAction({
    title: '下线公告',
    tone: 'warning',
    objectName: row.title,
    message: '确认下线该公告？',
    details: '下线后用户将不再看到该公告。',
    confirmText: '下线',
    destructive: false
  })
  if (!ok) return
  try {
    await store.archiveAnnouncement(row.id)
    toastSuccess('已下线')
    await load()
  } catch (e) {
    toastError(e.message || '下线失败')
  }
}

async function remove(row) {
  const ok = await confirmDanger({
    title: '删除公告',
    objectName: row.title,
    message: '确认删除该公告？',
    details: '已发布公告需要先下线；删除后不可恢复。',
    confirmText: '删除'
  })
  if (!ok) return
  try {
    await store.deleteAnnouncement(row.id)
    toastSuccess('已删除')
    await load()
  } catch (e) {
    toastError(e.message || '删除失败')
  }
}

onMounted(load)

watch([statusFilter, notifyFilter], () => {
  load()
})

watch(
  q,
  () => {
    scheduleLoad()
  }
)

onUnmounted(() => {
  if (qTimer) window.clearTimeout(qTimer)
})
</script>

<style scoped>
.sel {
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: var(--muted);
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.title-main {
  font-weight: 900;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
}

.chip.published {
  color: rgba(16, 185, 129, 1);
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.20);
}

.chip.archived {
  color: var(--muted);
  background: rgba(15, 23, 42, 0.04);
}

.row-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.audience-cell {
  min-width: 0;
}

.audience-summary {
  display: block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 12px;
  font-weight: 850;
}

.window {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.window-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.window-k {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.06em;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-span {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.textarea.md {
  min-height: 180px;
}

.audience-panel {
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.025);
}

.audience-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.audience-hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.audience-preview {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.preview-count {
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.10);
  color: rgba(4, 120, 87, 1);
  font-size: 12px;
  font-weight: 900;
}

.audience-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.audience-group {
  min-width: 0;
}

.audience-label {
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toggle-pill {
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.toggle-pill.active {
  border-color: rgba(37, 99, 235, 0.30);
  background: rgba(37, 99, 235, 0.10);
  color: rgba(29, 78, 216, 1);
}

.check-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.check-row input {
  width: 16px;
  height: 16px;
  accent-color: rgba(37, 99, 235, 1);
}

.audience-dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .audience-head,
  .audience-preview {
    align-items: stretch;
    flex-direction: column;
  }

  .audience-grid,
  .audience-dates {
    grid-template-columns: 1fr;
  }
}
</style>
