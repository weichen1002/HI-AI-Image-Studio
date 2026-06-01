<template>
  <TablePageLayout
    title=""
    subtitle=""
    density="compact"
    variant="plain"
  >
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
        <SelectMenu v-model="typeFilter" size="sm" :options="typeOptions" placeholder="全部类型" class="type-select" />
      </template>
      <template #filterActions>
        <Button variant="ghost" size="sm" :disabled="loading || !String(userId || '').trim()" @click="exportCsv">
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
          :rows="entries"
          :loading="loading"
          empty-text="暂无流水"
        >
          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>
          <template #cell-type="{ row }">
            <span class="chip">{{ row.type }}</span>
          </template>
          <template #cell-amount="{ row }">
            <span class="amt" :class="{ neg: row.amount < 0 }">{{ row.amount }}</span>
          </template>
          <template #cell-ref="{ row }">
            <span class="mono">
              <span v-if="row.refType">{{ row.refType }}:</span><span v-if="row.refId">{{ row.refId }}</span>
            </span>
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
import { Button, DataTable, Input, Pagination, SelectMenu, toastError, toastSuccess } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const route = useRoute()
const router = useRouter()

const typeOptions = [
  { label: 'charge', value: 'charge' },
  { label: 'adjust', value: 'adjust' },
  { label: 'grant', value: 'grant' },
  { label: 'refund', value: 'refund' }
]

const columns = [
  { key: 'createdAt', title: '时间', width: '20%', nowrap: true },
  { key: 'type', title: '类型', width: '14%', nowrap: true },
  { key: 'amount', title: '金额', width: '12%', nowrap: true },
  { key: 'reason', title: '原因', width: '32%', nowrap: true, ellipsis: true },
  { key: 'ref', title: '关联', width: '22%', nowrap: true, ellipsis: true }
]

const userId = ref(String(route.query.userId || ''))
const entries = ref([])
const total = ref(0)
const errorMsg = ref('')
const loading = ref(false)
const typeFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
let inputTimer = null

function handlePageChange(next) {
  page.value = next
  if (String(userId.value || '').trim()) load()
}

function handlePageSizeChange(next) {
  pageSize.value = next
  page.value = 1
  if (String(userId.value || '').trim()) load()
}

function buildFilterParams() {
  const params = new URLSearchParams()
  const id = String(userId.value || '').trim()
  if (id) params.set('userId', id)
  if (typeFilter.value) params.set('type', String(typeFilter.value))
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
  const params = buildFilterParams()
  if (!params.get('userId')) return
  downloadUrl(`/api/admin/exports/ledger?${params.toString()}`)
}

async function load() {
  errorMsg.value = ''
  entries.value = []
  total.value = 0
  const id = String(userId.value || '').trim()
  if (!id) {
    errorMsg.value = '请输入 userId'
    return
  }
  try {
    loading.value = true
    router.replace({ query: { userId: id } })
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    if (typeFilter.value) params.set('type', String(typeFilter.value))
    const data = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/credits/ledger?${params.toString()}`)
    entries.value = data.entries || []
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

function scheduleLoad() {
  if (inputTimer) window.clearTimeout(inputTimer)
  inputTimer = window.setTimeout(() => {
    if (String(userId.value || '').trim()) {
      page.value = 1
      load()
    } else {
      entries.value = []
      total.value = 0
      errorMsg.value = ''
      router.replace({ query: {} })
    }
  }, 450)
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

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(val))
}

onMounted(() => {
  if (userId.value) load()
})

watch(
  () => userId.value,
  () => {
    scheduleLoad()
  }
)

watch(
  () => typeFilter.value,
  async () => {
    if (!String(userId.value || '').trim()) return
    page.value = 1
    await load()
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

.type-select {
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

.amt {
  font-weight: 950;
  color: var(--primary);
}

.amt.neg {
  color: var(--accent);
}
</style>
