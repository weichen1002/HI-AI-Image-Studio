<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #filters>
        <SearchInput v-model="userId" placeholder="筛选用户 ID" @keydown.enter.prevent="search" />
        <SelectMenu v-model="categoryFilter" size="sm" :options="categoryOptions" placeholder="全部分类" class="sel" />
        <SelectMenu v-model="statusFilter" size="sm" :options="statusOptions" placeholder="全部结果" class="sel" />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">刷新数据</Button>
      </template>

      <template #table>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        <DataTable
          variant="flat"
          :columns="columns"
          :rows="entries"
          :loading="loading"
        >
          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>

          <template #cell-category="{ row }">
            <span class="chip">{{ row.category }}</span>
          </template>

          <template #cell-status="{ row }">
            <span class="chip" :class="row.status === 'failure' ? 'failure' : 'success'">
              {{ row.status === 'failure' ? '失败' : '成功' }}
            </span>
          </template>

          <template #cell-action="{ row }">
            <div class="action-cell">
              <div class="action-main">{{ row.action }}</div>
              <div class="action-sub mono">{{ row.actorUserId || '-' }} -> {{ row.targetUserId || '-' }}</div>
            </div>
          </template>

          <template #cell-ip="{ row }">
            <span class="mono">{{ row.ip || '-' }}</span>
          </template>

          <template #cell-detail="{ row }">
            <span class="detail">{{ detailText(row.detail) }}</span>
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
import { onMounted, ref, watch } from 'vue'
import { Button, DataTable, Pagination, SearchInput, SelectMenu } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const categoryOptions = [
  { label: 'auth', value: 'auth' },
  { label: 'admin', value: 'admin' },
  { label: 'security', value: 'security' }
]

const statusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failure' }
]

const columns = [
  { key: 'createdAt', title: '时间', width: '17%', align: 'left', nowrap: true },
  { key: 'category', title: '分类', width: '10%', align: 'left', nowrap: true },
  { key: 'status', title: '结果', width: '10%', align: 'left', nowrap: true },
  { key: 'action', title: '动作', width: '28%', align: 'left', nowrap: true },
  { key: 'ip', title: 'IP', width: '15%', align: 'left', nowrap: true },
  { key: 'detail', title: '详情', width: '20%', align: 'left', ellipsis: true }
]

const entries = ref([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const page = ref(1)
const pageSize = ref(50)
const userId = ref('')
const categoryFilter = ref('')
const statusFilter = ref('')

async function load() {
  errorMsg.value = ''
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    if (userId.value) params.set('userId', String(userId.value))
    if (categoryFilter.value) params.set('category', String(categoryFilter.value))
    if (statusFilter.value) params.set('status', String(statusFilter.value))
    const data = await apiFetch(`/api/admin/audit-logs?${params.toString()}`)
    entries.value = data.entries || []
    total.value = Number(data.total || 0)
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

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(val))
}

function detailText(detail) {
  if (!detail || typeof detail !== 'object') return '-'
  return Object.entries(detail)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ') || '-'
}

watch([categoryFilter, statusFilter], () => {
  page.value = 1
  load()
})

onMounted(load)
</script>

<style scoped>
.sel {
  width: 180px;
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

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--muted);
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

.chip.success {
  color: #166534;
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.18);
}

.chip.failure {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.18);
}

.action-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.action-main {
  font-weight: 900;
  color: var(--text);
}

.action-sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
</style>
