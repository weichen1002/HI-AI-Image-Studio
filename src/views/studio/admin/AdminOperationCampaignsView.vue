<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #intro>
        <section class="campaign-intro">
          <div>
            <div class="intro-kicker">运营活动是什么？</div>
            <h2>一次运营动作的计划单</h2>
            <p>比如“新用户送余额”“春节活动公告”“收集低分反馈”。先在这里写清楚目标、人群和时间，再关联公告、兑换码或反馈样本，后面复盘就能知道这次活动到底做了什么。</p>
          </div>
          <div class="intro-steps">
            <span>1. 写清目标</span>
            <span>2. 选择工具</span>
            <span>3. 上线执行</span>
            <span>4. 归档复盘</span>
          </div>
        </section>
      </template>
      <template #filters>
        <SearchInput v-model="q" placeholder="搜索运营活动、目标、关联 ID..." @keydown.enter.prevent="load" />
        <SelectMenu v-model="statusFilter" size="sm" :options="statusFilterOptions" placeholder="全部状态" class="sel" />
        <SelectMenu v-model="channelFilter" size="sm" :options="channelFilterOptions" placeholder="全部落地工具" class="sel" />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">
          <template #icon><RefreshCcwIcon :size="16" aria-hidden="true" /></template>
          刷新数据
        </Button>
      </template>
      <template #tools>
        <Button variant="ghost" size="sm" :disabled="loading" @click="openSegments">用户分群</Button>
        <Button size="sm" :disabled="loading" @click="openCreate">创建运营活动</Button>
      </template>
      <template #table>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <DataTable variant="flat" :columns="columns" :rows="rows" :loading="loading" empty-text="暂无运营活动">
          <template #cell-name="{ row }">
            <div class="title-cell">
              <div class="title-main">{{ row.name }}</div>
              <div class="title-sub mono">ID: {{ row.id }}</div>
            </div>
          </template>

          <template #cell-channel="{ row }">
            <span class="chip mode">{{ channelLabel(row.channel) }}</span>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status">{{ statusLabel(row.status) }}</span>
          </template>

          <template #cell-goal="{ row }">
            <span class="goal-text">{{ row.goal || '未填写' }}</span>
          </template>

          <template #cell-audience="{ row }">
            <span class="audience-summary">{{ audienceSummary(row.audience) }}</span>
          </template>

          <template #cell-window="{ row }">
            <div class="window">
              <div class="window-line">
                <span class="window-k">开始</span>
                <span class="mono">{{ row.startAt ? formatTime(row.startAt) : '立即' }}</span>
              </div>
              <div class="window-line">
                <span class="window-k">结束</span>
                <span class="mono">{{ row.endAt ? formatTime(row.endAt) : '长期' }}</span>
              </div>
            </div>
          </template>

          <template #cell-linked="{ row }">
            <div class="linked-cell">
              <span>{{ linkedLabel(row.linkedRefType) }}</span>
              <span class="mono">{{ row.linkedRefId || '未关联' }}</span>
            </div>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <Button variant="ghost" size="xs" @click="openReview(row)">复盘</Button>
              <Button variant="ghost" size="xs" @click="openEdit(row)">编辑</Button>
              <Button v-if="row.status === 'draft'" variant="ghost" size="xs" @click="activate(row)">上线</Button>
              <Button v-else-if="row.status === 'active'" variant="ghost" size="xs" @click="archive(row)">归档</Button>
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

  <Modal v-model:open="modalOpen" :title="form.id ? '编辑运营活动' : '创建运营活动'" size="lg">
    <div class="form-grid">
      <div class="form-item">
        <div class="form-label">运营活动名称</div>
        <Input v-model="form.name" placeholder="例如：新用户首周送 20 余额" />
      </div>

      <div class="form-item">
        <div class="form-label">落地工具</div>
        <SelectMenu v-model="form.channel" :options="channelOptions" placeholder="选择这次活动用什么工具执行" />
      </div>

      <div class="form-item form-span">
        <div class="form-label">运营目标</div>
        <textarea v-model="form.goal" class="textarea goal" placeholder="用大白话写：这次活动想让用户做什么？例如提升首日出图、召回沉默用户、收集低分样本..." />
      </div>

      <div class="form-item">
        <div class="form-label">开始时间</div>
        <Input v-model="form.startAt" type="datetime-local" />
      </div>

      <div class="form-item">
        <div class="form-label">结束时间</div>
        <Input v-model="form.endAt" type="datetime-local" />
      </div>

      <div class="form-item">
        <div class="form-label">关联对象类型</div>
        <SelectMenu v-model="form.linkedRefType" :options="linkedTypeOptions" placeholder="先不关联也可以" />
      </div>

      <div class="form-item">
        <div class="form-label">关联对象 ID</div>
        <Input v-model="form.linkedRefId" placeholder="公告 ID / 兑换码 ID / 样本 ID" />
      </div>

      <div class="form-item form-span audience-panel">
        <div class="audience-head">
          <div>
            <div class="form-label">目标人群</div>
            <div class="audience-hint">不设置条件就是全量用户。只想给新用户、付费用户或管理员看时，再选下面的条件。</div>
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
        <Button v-if="form.id && form.status === 'draft'" size="sm" :disabled="saving" @click="activateCurrent">上线</Button>
      </div>
    </template>
  </Modal>

  <Modal v-model:open="reviewOpen" title="活动复盘" size="lg">
    <div v-if="reviewLoading" class="muted-panel">复盘数据加载中...</div>
    <div v-else-if="reviewData" class="review-panel">
      <section class="review-head">
        <div>
          <div class="review-kicker">运营活动</div>
          <h3>{{ reviewData.campaign?.name }}</h3>
          <p>{{ reviewData.campaign?.goal || '未填写运营目标' }}</p>
        </div>
        <span class="chip" :class="reviewData.campaign?.status">{{ statusLabel(reviewData.campaign?.status) }}</span>
      </section>

      <div class="review-metrics">
        <div class="review-metric">
          <span>命中用户</span>
          <strong>{{ reviewData.matchedUsers || 0 }}</strong>
        </div>
        <div class="review-metric">
          <span>生成任务</span>
          <strong>{{ reviewData.metrics?.generatedJobs || 0 }}</strong>
        </div>
        <div class="review-metric">
          <span>成功生成</span>
          <strong>{{ reviewData.metrics?.succeededJobs || 0 }}</strong>
        </div>
        <div class="review-metric">
          <span>待看反馈</span>
          <strong>{{ reviewData.metrics?.feedbackNeedsReview || 0 }}</strong>
        </div>
      </div>

      <section class="linked-review">
        <div class="review-section-title">关联对象</div>
        <div v-if="reviewData.linked" class="linked-object">
          <strong>{{ reviewData.linked.title || reviewData.linked.id }}</strong>
          <span>{{ linkedLabel(reviewData.linked.type) }} · {{ reviewData.linked.meta || reviewData.linked.status }}</span>
        </div>
        <div v-else class="muted-panel">还没有关联公告、兑换码或反馈样本。可以编辑活动后补上关联对象 ID。</div>
      </section>

      <section class="linked-review">
        <div class="review-section-title">复盘提示</div>
        <div class="note-list">
          <span v-for="note in reviewData.notes || []" :key="note">{{ note }}</span>
        </div>
      </section>
    </div>
    <div v-else class="muted-panel">暂无复盘数据</div>
    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" size="sm" @click="reviewOpen = false">关闭</Button>
      </div>
    </template>
  </Modal>

  <Modal v-model:open="segmentsOpen" title="用户分群" size="lg">
    <div v-if="segmentsLoading" class="muted-panel">分群加载中...</div>
    <div v-else class="segment-grid">
      <div v-for="segment in segments" :key="segment.key" class="segment-card">
        <div class="segment-top">
          <strong>{{ segment.name }}</strong>
          <span>{{ segment.matchedUsers }} 人</span>
        </div>
        <p>{{ segment.desc }}</p>
        <Button variant="ghost" size="sm" @click="useSegment(segment)">带入新活动</Button>
      </div>
    </div>
    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" size="sm" @click="segmentsOpen = false">关闭</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Input, Modal, SearchInput, SelectMenu, confirmAction, confirmDanger, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { useOperationCampaignsStore } from '../../../stores/operationCampaigns'

const store = useOperationCampaignsStore()

const columns = [
  { key: 'name', title: '运营活动', width: '20%', nowrap: true, ellipsis: true },
  { key: 'channel', title: '落地工具', width: '10%', nowrap: true },
  { key: 'status', title: '状态', width: '9%', nowrap: true },
  { key: 'goal', title: '目标', width: '20%', nowrap: true, ellipsis: true },
  { key: 'audience', title: '人群', width: '16%', nowrap: true },
  { key: 'window', title: '活动时间', width: '14%', nowrap: true },
  { key: 'linked', title: '关联', width: '13%', nowrap: true },
  { key: 'actions', title: '操作', width: '12%', nowrap: true }
]

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已归档', value: 'archived' }
]
const statusFilterOptions = [{ label: '全部状态', value: '' }, ...statusOptions]

const channelOptions = [
  { label: '公告/弹窗', value: 'announcement' },
  { label: '兑换码', value: 'redeem_code' },
  { label: '反馈样本', value: 'feedback' },
  { label: '其他手动动作', value: 'manual' }
]
const channelFilterOptions = [{ label: '全部落地工具', value: '' }, ...channelOptions]

const linkedTypeOptions = [
  { label: '不关联', value: '' },
  { label: '公告', value: 'announcement' },
  { label: '兑换码', value: 'redeem_code' },
  { label: '反馈样本', value: 'feedback_sample' },
  { label: '其他', value: 'manual' }
]

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
const channelFilter = ref('')
const errorMsg = ref('')
const loading = computed(() => store.adminLoading)
const rows = computed(() => store.adminList || [])

const modalOpen = ref(false)
const saving = ref(false)
const reviewOpen = ref(false)
const reviewLoading = ref(false)
const reviewData = ref(null)
const segmentsOpen = ref(false)
const segmentsLoading = ref(false)
const segments = ref([])
const form = reactive({
  id: '',
  name: '',
  channel: 'announcement',
  status: 'draft',
  goal: '',
  startAt: '',
  endAt: '',
  linkedRefType: '',
  linkedRefId: '',
  audience: {
    statuses: [],
    roles: [],
    createdAfter: '',
    createdBefore: '',
    paidOnly: false
  }
})

function statusLabel(v) {
  if (v === 'active') return '进行中'
  if (v === 'archived') return '已归档'
  return '草稿'
}

function channelLabel(v) {
  return channelOptions.find((item) => item.value === v)?.label || '其他手动动作'
}

function linkedLabel(v) {
  return linkedTypeOptions.find((item) => item.value === v)?.label || '不关联'
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
  return v.includes('T') ? v : v.replace(' ', 'T')
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
}

function applyAudienceToForm(audience) {
  setAudience(audience || {})
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
}

async function load() {
  errorMsg.value = ''
  try {
    await store.fetchAdmin({
      q: String(q.value || '').trim(),
      status: statusFilter.value,
      channel: channelFilter.value,
      limit: 200
    })
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  }
}

let qTimer = null

function scheduleLoad() {
  if (qTimer) window.clearTimeout(qTimer)
  qTimer = window.setTimeout(load, 400)
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.channel = 'announcement'
  form.status = 'draft'
  form.goal = ''
  form.startAt = ''
  form.endAt = ''
  form.linkedRefType = ''
  form.linkedRefId = ''
  setAudience({})
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

async function openSegments() {
  try {
    segmentsLoading.value = true
    segmentsOpen.value = true
    segments.value = await store.fetchSegments()
  } catch (e) {
    toastError(e.message || '分群加载失败')
  } finally {
    segmentsLoading.value = false
  }
}

function useSegment(segment) {
  resetForm()
  form.name = `${segment.name}运营活动`
  form.goal = segment.desc || ''
  applyAudienceToForm(segment.audience || {})
  segmentsOpen.value = false
  modalOpen.value = true
}

function openEdit(row) {
  form.id = String(row.id || '')
  form.name = String(row.name || '')
  form.channel = String(row.channel || 'announcement')
  form.status = String(row.status || 'draft')
  form.goal = String(row.goal || '')
  form.startAt = row.startAt ? String(row.startAt).slice(0, 16) : ''
  form.endAt = row.endAt ? String(row.endAt).slice(0, 16) : ''
  form.linkedRefType = String(row.linkedRefType || '')
  form.linkedRefId = String(row.linkedRefId || '')
  setAudience(row.audience || {})
  modalOpen.value = true
}

async function saveDraft() {
  const name = String(form.name || '').trim()
  if (!name) {
    toastError('运营活动名称不能为空')
    return
  }

  const payload = {
    name,
    channel: form.channel,
    goal: String(form.goal || '').trim(),
    startAt: normalizeDateInput(form.startAt) || null,
    endAt: normalizeDateInput(form.endAt) || null,
    linkedRefType: String(form.linkedRefType || '').trim() || null,
    linkedRefId: String(form.linkedRefId || '').trim() || null,
    audience: audiencePayload()
  }

  try {
    saving.value = true
    if (form.id) {
      const updated = await store.updateCampaign(form.id, payload)
      form.status = String(updated?.status || form.status)
    } else {
      const created = await store.createCampaign(payload)
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

async function activateCurrent() {
  if (!form.id) return
  try {
    saving.value = true
    await store.activateCampaign(form.id)
    toastSuccess('已上线')
    modalOpen.value = false
    await load()
  } catch (e) {
    toastError(e.message || '上线失败')
  } finally {
    saving.value = false
  }
}

async function openReview(row) {
  try {
    reviewLoading.value = true
    reviewData.value = null
    reviewOpen.value = true
    reviewData.value = await store.fetchReview(row.id)
  } catch (e) {
    toastError(e.message || '复盘加载失败')
  } finally {
    reviewLoading.value = false
  }
}

async function activate(row) {
  const ok = await confirmAction({
    title: '上线运营活动',
    tone: 'warning',
    objectName: row.name,
    message: '确认上线该运营活动？',
    details: '上线后代表这件运营动作开始执行，后续可以归档复盘。',
    confirmText: '上线',
    destructive: false
  })
  if (!ok) return
  try {
    await store.activateCampaign(row.id)
    toastSuccess('已上线')
    await load()
  } catch (e) {
    toastError(e.message || '上线失败')
  }
}

async function archive(row) {
  const ok = await confirmAction({
    title: '归档运营活动',
    tone: 'warning',
    objectName: row.name,
    message: '确认归档该运营活动？',
    details: '归档后活动会保留记录，但不再视为进行中。',
    confirmText: '归档',
    destructive: false
  })
  if (!ok) return
  try {
    await store.archiveCampaign(row.id)
    toastSuccess('已归档')
    await load()
  } catch (e) {
    toastError(e.message || '归档失败')
  }
}

async function remove(row) {
  const ok = await confirmDanger({
    title: '删除运营活动',
    objectName: row.name,
    message: '确认删除该运营活动？',
    details: '进行中的活动需要先归档；删除后不可恢复。',
    confirmText: '删除'
  })
  if (!ok) return
  try {
    await store.deleteCampaign(row.id)
    toastSuccess('已删除')
    await load()
  } catch (e) {
    toastError(e.message || '删除失败')
  }
}

onMounted(load)

watch([statusFilter, channelFilter], load)
watch(q, scheduleLoad)

onUnmounted(() => {
  if (qTimer) window.clearTimeout(qTimer)
})
</script>

<style scoped>
.campaign-intro {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 17px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
}

.intro-kicker {
  margin-bottom: 7px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
}

.campaign-intro h2 {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  font-weight: 950;
  letter-spacing: 0;
}

.campaign-intro p {
  max-width: 760px;
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.65;
}

.intro-steps {
  flex: 0 0 260px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: center;
}

.intro-steps span {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 11px;
  background: rgba(37, 99, 235, 0.08);
  color: rgba(29, 78, 216, 1);
  font-size: 12px;
  font-weight: 900;
}

.sel {
  width: 188px;
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

.title-cell,
.linked-cell {
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

.title-sub,
.goal-text,
.audience-summary,
.linked-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-text,
.audience-summary,
.linked-cell span:first-child {
  display: block;
  color: var(--text);
  font-size: 12px;
  font-weight: 850;
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

.chip.active {
  color: rgba(4, 120, 87, 1);
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.20);
}

.chip.archived {
  color: var(--muted);
  background: rgba(15, 23, 42, 0.04);
}

.chip.mode {
  color: rgba(29, 78, 216, 1);
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.16);
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

.row-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
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

.textarea.goal {
  min-height: 110px;
}

.audience-panel {
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.025);
}

.audience-head {
  margin-bottom: 14px;
}

.audience-hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
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

.muted-panel {
  padding: 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.035);
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.6;
}

.review-panel {
  display: grid;
  gap: 14px;
}

.review-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.82);
}

.review-kicker {
  margin-bottom: 6px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
}

.review-head h3 {
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 950;
}

.review-head p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.6;
}

.review-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.review-metric,
.segment-card {
  padding: 13px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
}

.review-metric {
  display: grid;
  gap: 5px;
}

.review-metric span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.review-metric strong {
  color: var(--text);
  font-size: 24px;
  font-weight: 950;
}

.linked-review {
  display: grid;
  gap: 9px;
}

.review-section-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.linked-object {
  display: grid;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.06);
}

.linked-object strong {
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
}

.linked-object span,
.note-list span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.55;
}

.note-list {
  display: grid;
  gap: 7px;
}

.segment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.segment-card {
  display: grid;
  gap: 10px;
}

.segment-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.segment-top strong {
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
}

.segment-top span {
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: rgba(29, 78, 216, 1);
  font-size: 12px;
  font-weight: 950;
}

.segment-card p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .campaign-intro,
  .intro-steps {
    display: grid;
    grid-template-columns: 1fr;
  }

  .intro-steps {
    flex-basis: auto;
  }

  .form-grid,
  .audience-grid,
  .audience-dates,
  .review-metrics,
  .segment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
