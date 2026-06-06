<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #filters>
        <SelectMenu v-model="statusFilter" size="sm" :options="statusOptions" class="sel" />
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
          :rows="submissions"
          :loading="loading"
          empty-text="暂无灵感投稿"
        >
          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>

          <template #cell-title="{ row }">
            <div class="title-cell">
              <div class="title-main">{{ row.title }}</div>
              <div class="title-sub">{{ row.category || '-' }} · {{ sourceLabel(row.sourceType) }}</div>
            </div>
          </template>

          <template #cell-cover="{ row }">
            <a
              v-if="row.coverImage"
              class="cover-link"
              :href="row.coverImage"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              查看封面
            </a>
            <span v-else class="muted">-</span>
          </template>

          <template #cell-prompt="{ row }">
            <div class="prompt-cell">
              <span>{{ row.desc || '暂无说明' }}</span>
              <code>{{ row.prompt }}</code>
            </div>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status">{{ statusLabel(row.status) }}</span>
          </template>

          <template #cell-reviewNote="{ row }">
            <span class="note">{{ row.reviewNote || '-' }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <Button
                v-if="row.status !== 'approved'"
                variant="ghost"
                size="xs"
                :disabled="reviewingId === row.id"
                @click="review(row, 'approved')"
              >
                通过
              </Button>
              <Button
                v-if="row.status !== 'rejected'"
                variant="danger"
                size="xs"
                :disabled="reviewingId === row.id"
                @click="openReject(row)"
              >
                拒绝
              </Button>
            </div>
          </template>
        </DataTable>
      </template>

      <template #footer>
        <div class="foot-summary">共 {{ submissions.length }} 条</div>
      </template>
    </AdminListLayout>
  </TablePageLayout>

  <Modal v-model:open="rejectOpen" title="拒绝灵感投稿" size="md">
    <div class="reject-form">
      <div class="reject-target">{{ rejectTarget?.title || '未命名投稿' }}</div>
      <label class="reject-field">
        <span>拒绝原因</span>
        <textarea v-model="rejectNote" class="textarea reject-note" placeholder="例如：提示词过于简单、封面无法访问、内容不适合公开。"></textarea>
      </label>
    </div>
    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" :disabled="Boolean(reviewingId)" @click="rejectOpen = false">取消</Button>
        <Button variant="danger" :disabled="Boolean(reviewingId)" @click="confirmReject">确认拒绝</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Modal, SelectMenu, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const statusOptions = [
  { label: '待审核', value: 'pending' },
  { label: '全部状态', value: '' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' }
]

const columns = [
  { key: 'createdAt', title: '时间', width: '12%', nowrap: true },
  { key: 'title', title: '投稿', width: '20%', nowrap: false },
  { key: 'cover', title: '封面', width: '9%', nowrap: true },
  { key: 'prompt', title: '说明 / 提示词', width: '33%', nowrap: false },
  { key: 'status', title: '状态', width: '9%', nowrap: true },
  { key: 'reviewNote', title: '备注', width: '10%', nowrap: false },
  { key: 'actions', title: '操作', width: '7%', nowrap: true }
]

const submissions = ref([])
const statusFilter = ref('pending')
const loading = ref(false)
const errorMsg = ref('')
const reviewingId = ref('')
const rejectOpen = ref(false)
const rejectTarget = ref(null)
const rejectNote = ref('')

async function load() {
  errorMsg.value = ''
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    const data = await apiFetch(`/api/templates/community/admin?${params.toString()}`)
    submissions.value = Array.isArray(data?.submissions) ? data.submissions : []
  } catch (error) {
    submissions.value = []
    errorMsg.value = error?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function review(row, status, note = '') {
  reviewingId.value = row.id
  try {
    await apiFetch(`/api/templates/community/admin/${encodeURIComponent(row.id)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNote: note })
    })
    toastSuccess(status === 'approved' ? '已通过投稿' : '已拒绝投稿')
    await load()
  } catch (error) {
    toastError(error?.message || '审核失败')
  } finally {
    reviewingId.value = ''
  }
}

function openReject(row) {
  rejectTarget.value = row
  rejectNote.value = row.reviewNote || ''
  rejectOpen.value = true
}

async function confirmReject() {
  if (!rejectTarget.value) return
  await review(rejectTarget.value, 'rejected', rejectNote.value)
  rejectOpen.value = false
}

function statusLabel(value) {
  if (value === 'approved') return '已通过'
  if (value === 'rejected') return '已拒绝'
  return '待审核'
}

function sourceLabel(value) {
  if (value === 'template') return '我的模板'
  if (value === 'history') return '灵感记录'
  return '直接投稿'
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

watch(statusFilter, load)
onMounted(load)
</script>

<style scoped>
.sel {
  width: 160px;
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

.foot-summary,
.muted,
.note {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--muted);
}

.title-cell,
.prompt-cell {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.title-main {
  color: var(--text);
  font-weight: 900;
  line-height: 1.35;
}

.title-sub,
.prompt-cell span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.prompt-cell code {
  max-height: 58px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  white-space: normal;
  color: rgba(15, 23, 42, 0.78);
  line-height: 1.45;
}

.cover-link {
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
}

.cover-link:hover {
  text-decoration: underline;
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
  color: #92400e;
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.20);
}

.chip.approved {
  color: #166534;
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.18);
}

.chip.rejected {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.18);
}

.row-actions,
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.reject-form {
  display: grid;
  gap: 12px;
}

.reject-target {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.reject-field {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.reject-note {
  min-height: 120px;
  resize: vertical;
}
</style>
