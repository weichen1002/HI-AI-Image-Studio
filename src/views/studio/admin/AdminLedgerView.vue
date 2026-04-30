<template>
  <TablePageLayout
    title="账务流水"
    subtitle="用于对账与排查：按 userId 查询，并支持类型筛选与复制。"
    density="compact"
  >
    <template #actions>
      <Button variant="ghost" size="sm" :disabled="loading" @click="load">刷新</Button>
    </template>

    <template #toolbar>
      <div class="grid grid-cols-12 gap-3">
        <div class="col-span-12 lg:col-span-7 flex items-center gap-3 flex-wrap">
          <div class="flex-1 min-w-[260px]">
            <Input v-model="userId" size="sm" placeholder="输入 userId" />
          </div>
          <Button size="sm" :disabled="loading" @click="load">查询</Button>
          <Button variant="ghost" size="sm" :disabled="!userId" @click="copy(userId)">复制 userId</Button>
        </div>
        <div class="col-span-12 lg:col-span-5 flex items-center justify-end">
          <div class="stat">
            <span class="stat-label">条数</span>
            <span class="stat-value">{{ filteredEntries.length }}</span>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
          <SelectMenu v-model="typeFilter" size="sm" :options="typeOptions" placeholder="所有类型" />
        </div>
      </div>
    </template>

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <DataTable
      :columns="columns"
      :rows="filteredEntries"
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
  </TablePageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, DataTable, Input, SelectMenu, toastError, toastSuccess } from '../../../components/common'
import { TablePageLayout } from '../../../components/layout'
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
const errorMsg = ref('')
const loading = ref(false)
const typeFilter = ref('')

const filteredEntries = computed(() => {
  const t = typeFilter.value
  if (!t) return entries.value || []
  return (entries.value || []).filter((e) => e.type === t)
})

async function api(url, options) {
  return apiFetch(url, options)
}

async function load() {
  errorMsg.value = ''
  entries.value = []
  const id = String(userId.value || '').trim()
  if (!id) {
    errorMsg.value = '请输入 userId'
    return
  }
  try {
    loading.value = true
    router.replace({ query: { userId: id } })
    const data = await api(`/api/admin/users/${encodeURIComponent(id)}/credits/ledger?limit=100`)
    entries.value = data.entries || []
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
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

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(val))
}

onMounted(() => {
  if (userId.value) load()
})
</script>

<style scoped>
.stat {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(15, 23, 42, 0.03);
}

.stat-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stat-value {
  color: var(--text);
  font-size: 16px;
  font-weight: 900;
}

.error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(236, 72, 153, 0.25);
  background: rgba(236, 72, 153, 0.06);
  color: var(--accent);
  font-weight: 800;
  margin-bottom: 14px;
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
