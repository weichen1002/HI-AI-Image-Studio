<template>
  <TablePageLayout
    title=""
    subtitle=""
    density="compact"
  >
    <template #actions>
      <Button variant="ghost" size="sm" :disabled="loading" @click="load">刷新</Button>
    </template>

    <template #toolbar>
      <TableToolbar>
        <template #left>
          <Input v-model="q" size="sm" placeholder="搜索标题" class="q" @keydown.enter.prevent="load" />
          <Button size="sm" :disabled="loading" @click="load">搜索</Button>
          <Button variant="ghost" size="sm" :disabled="loading" @click="reset">重置</Button>
        </template>
        <template #right>
          <div class="stat">
            <span class="stat-label">条数</span>
            <span class="stat-value">{{ rows.length }}</span>
          </div>
        </template>
      </TableToolbar>
    </template>

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      clickable
      empty-text="暂无公告"
      @rowClick="openDetail"
    >
      <template #cell-title="{ row }">
        <div class="title-cell">
          <div class="title-top">
            <span class="title-main">{{ row.title }}</span>
            <span v-if="row.repeatMode === 'always'" class="chip sticky">必读</span>
            <span v-else-if="!row.readAt" class="chip unread">未读</span>
          </div>
          <div class="title-sub mono">{{ formatTime(row.createdAt) }}</div>
        </div>
      </template>

      <template #cell-notifyMode="{ row }">
        <span class="chip mode">{{ row.notifyMode === 'modal' ? '弹窗' : '静默' }}</span>
      </template>
    </DataTable>
  </TablePageLayout>

  <Modal v-model:open="detailOpen" :title="selected?.title || '公告'" size="lg">
    <div class="detail-meta">
      <span class="chip mode">{{ selected?.notifyMode === 'modal' ? '弹窗' : '静默' }}</span>
      <span v-if="selected?.repeatMode === 'always'" class="chip sticky">必读</span>
      <span class="mono">{{ selected?.createdAt ? formatTime(selected.createdAt) : '' }}</span>
    </div>
    <div class="detail-content">
      <pre class="md">{{ selected?.contentMd || '' }}</pre>
    </div>
    <template #footer>
      <div class="footer">
        <Button variant="ghost" size="sm" @click="closeDetail">关闭</Button>
        <Button v-if="selected && selected.repeatMode === 'once' && !selected.readAt" size="sm" @click="ack">我已知晓</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, DataTable, Input, Modal, toastError } from '../../components/common'
import { TablePageLayout, TableToolbar } from '../../components/layout'
import { useAnnouncementsStore } from '../../stores/announcements'

const store = useAnnouncementsStore()

const columns = [
  { key: 'title', title: '标题', width: '76%', nowrap: true, ellipsis: true },
  { key: 'notifyMode', title: '通知方式', width: '24%', nowrap: true }
]

const q = ref('')
const errorMsg = ref('')
const detailOpen = ref(false)
const selected = ref(null)

const loading = computed(() => store.activeLoading)

const rows = computed(() => {
  const list = store.active || []
  const keyword = String(q.value || '').trim().toLowerCase()
  if (!keyword) return list
  return list.filter((a) => String(a.title || '').toLowerCase().includes(keyword))
})

async function load() {
  errorMsg.value = ''
  try {
    await store.fetchActive({ limit: 50 })
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  }
}

function reset() {
  q.value = ''
  load()
}

function openDetail(row) {
  selected.value = row
  detailOpen.value = true
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

async function ack() {
  if (!selected.value?.id) return
  try {
    await store.markRead(selected.value.id)
    selected.value = (store.active || []).find((a) => a.id === selected.value.id) || selected.value
    detailOpen.value = false
  } catch (e) {
    toastError(e.message || '操作失败')
  }
}

function closeDetail() {
  detailOpen.value = false
}

onMounted(load)
</script>

<style scoped>
.q {
  min-width: 240px;
  flex: 1;
}

.error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.06);
  color: var(--accent);
  font-weight: 800;
  margin-bottom: 14px;
}

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

.title-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-main {
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
}

.chip.unread {
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.18);
}

.chip.sticky {
  color: rgba(16, 185, 129, 1);
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.20);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.detail-content {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
}

.md {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
