<template>
  <div class="tasks-page">
    <div class="tasks-head">
      <div class="metrics-strip">
        <div class="metric-item">
          <span class="metric-value">{{ imagesStore.jobQueueStats.running }}/{{ imagesStore.jobQueueStats.concurrency }}</span>
          <span class="metric-label">并发</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">{{ imagesStore.jobQueueStats.queued }}</span>
          <span class="metric-label">队列</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">{{ failureRateText }}</span>
          <span class="metric-label">失败率</span>
        </div>
      </div>
      <div class="tasks-sub">后台生成任务会在这里保留状态，刷新页面后也能继续追踪。</div>
      <div class="tasks-actions">
        <Button variant="ghost" size="sm" :disabled="imagesStore.isLoadingJobs" @click="reload">
          刷新
        </Button>
        <Button variant="ghost" size="sm" :disabled="clearing" @click="clearCompleted">
          {{ clearing ? '清理中...' : '清理已完成' }}
        </Button>
      </div>
    </div>

    <div class="tasks-toolbar">
      <div class="status-tabs">
        <button
          v-for="item in statusOptions"
          :key="item.value"
          type="button"
          class="status-tab"
          :class="{ active: statusFilter === item.value }"
          @click="setStatus(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="tasks-count">{{ imagesStore.jobsTotal }} 条任务</div>
    </div>

    <div v-if="imagesStore.isLoadingJobs" class="state-card">加载任务中...</div>
    <div v-else-if="!imagesStore.jobs.length" class="state-card">暂无任务</div>

    <div v-else class="tasks-list">
      <article
        v-for="job in imagesStore.jobs"
        :key="job.id"
        class="task-row"
        :class="'task-row-' + job.status"
      >
        <div class="task-status">
          <span class="status-dot"></span>
          <span>{{ statusLabel(job.status) }}</span>
          <span v-if="job.attempts" class="attempt-chip">{{ job.attempts }} 次</span>
        </div>

        <div class="task-main">
          <div class="task-line">
            <span class="task-mode">{{ modeLabel(job) }}</span>
            <span class="task-time">{{ formatTime(job.updatedAt || job.startedAt) }}</span>
          </div>
          <div class="task-prompt">{{ job.prompt || '无提示词' }}</div>
          <div v-if="job.error" class="task-error">{{ job.error }}</div>
        </div>

        <div class="task-result">
          <div v-if="job.image?.imageUrls?.[0]" class="task-thumb">
            <img :src="job.image.imageUrls[0]" alt="" loading="lazy" />
          </div>
          <div v-else class="task-thumb empty">
            <ImageIcon :size="18" />
          </div>
        </div>

        <div class="task-actions">
          <Button
            v-if="job.status === 'success' && job.image?.id"
            variant="ghost"
            size="sm"
            @click="viewResult(job)"
          >
            查看结果
          </Button>
          <Button
            v-else-if="job.status === 'error'"
            variant="ghost"
            size="sm"
            :disabled="actionJobId === job.id"
            @click="retryJob(job)"
          >
            {{ job.retryable ? '重试' : '重新提交' }}
          </Button>
          <Button
            v-else-if="job.status === 'queued'"
            variant="ghost"
            size="sm"
            :disabled="actionJobId === job.id"
            @click="cancelJob(job)"
          >
            取消
          </Button>
          <Button
            v-else-if="job.status === 'running'"
            variant="ghost"
            size="sm"
            @click="trackJob(job)"
          >
            跟踪
          </Button>
        </div>
      </article>
    </div>

    <Pagination
      v-if="imagesStore.jobsTotal > pageSize"
      :page="currentPage"
      :page-size="pageSize"
      :total="imagesStore.jobsTotal"
      :page-size-options="[10, 20, 50]"
      @update:page="changePage"
      @update:pageSize="changePageSize"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ImageIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { Button, Pagination, toastError, toastSuccess } from '../../components/common'

const router = useRouter()
const imagesStore = useImagesStore()

const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)
const clearing = ref(false)
const actionJobId = ref('')
let refreshTimer = null

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'success', label: '成功' },
  { value: 'error', label: '失败' }
]

const hasActiveJobs = computed(() =>
  imagesStore.jobs.some((job) => job.status === 'queued' || job.status === 'running')
)

const failureRateText = computed(() => {
  const rate = Number(imagesStore.jobStats.failureRate || 0)
  return `${Math.round(rate * 100)}%`
})

function pageOffset() {
  return (currentPage.value - 1) * pageSize.value
}

async function reload() {
  await imagesStore.fetchJobs({
    status: statusFilter.value,
    limit: pageSize.value,
    offset: pageOffset()
  })
  scheduleRefresh()
}

function scheduleRefresh() {
  if (refreshTimer) window.clearTimeout(refreshTimer)
  refreshTimer = null
  if (!hasActiveJobs.value) return
  refreshTimer = window.setTimeout(() => {
    void reload()
  }, 2200)
}

function setStatus(status) {
  statusFilter.value = status
  currentPage.value = 1
  void reload()
}

function changePage(page) {
  currentPage.value = page
  void reload()
}

function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  void reload()
}

function statusLabel(status) {
  const map = {
    queued: '排队中',
    running: '生成中',
    success: '成功',
    error: '失败',
    cancelled: '已取消'
  }
  return map[status] || status
}

function modeLabel(job) {
  if (job.mode === 'dialogue') return '对话创作'
  if (job.mode === 'tools') {
    if (job.operationType === 'cutout') return '抠图'
    if (job.operationType === 'upscale') return '高清增强'
    return '工具'
  }
  if (job.mode === 'image') return '图生图'
  return '文生图'
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

function viewResult(job) {
  if (!job?.image?.id) return
  router.push(`/studio/history/${encodeURIComponent(job.image.id)}`)
}

function retryInCreate(job) {
  const mode = job.mode === 'image' || job.mode === 'dialogue' || job.mode === 'tools'
    ? job.mode
    : 'text'
  router.push({
    name: 'studio-create',
    query: {
      mode,
      prompt: job.prompt || ''
    }
  })
}

async function retryJob(job) {
  if (!job?.id) return
  if (!job.retryable) {
    retryInCreate(job)
    return
  }
  try {
    actionJobId.value = job.id
    await imagesStore.retryJob(job.id)
    toastSuccess('任务已重新排队')
    await reload()
  } catch (error) {
    toastError(error?.message || '重试失败')
  } finally {
    actionJobId.value = ''
  }
}

async function cancelJob(job) {
  if (!job?.id) return
  try {
    actionJobId.value = job.id
    await imagesStore.cancelJob(job.id)
    toastSuccess('已取消排队任务')
    await reload()
  } catch (error) {
    toastError(error?.message || '取消失败')
  } finally {
    actionJobId.value = ''
  }
}

async function trackJob(job) {
  if (!job?.id) return
  try {
    imagesStore.activeJob = job
    await imagesStore.pollJob(job.id, { immediate: true })
    await reload()
  } catch (error) {
    toastError(error?.message || '任务状态获取失败')
  }
}

async function clearCompleted() {
  try {
    clearing.value = true
    const deleted = await imagesStore.clearCompletedJobs()
    toastSuccess(deleted > 0 ? `已清理 ${deleted} 条任务` : '没有可清理任务')
    currentPage.value = 1
    await reload()
  } catch (error) {
    toastError(error?.message || '清理失败')
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  void reload()
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearTimeout(refreshTimer)
})
</script>

<style scoped>
.tasks-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tasks-head,
.tasks-toolbar,
.task-row,
.state-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
}

.tasks-head {
  min-height: 78px;
  border-radius: 18px;
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(270px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}

.tasks-sub {
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.5;
}

.tasks-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.metrics-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(72px, 1fr));
  gap: 8px;
  min-width: 270px;
}

.metric-item {
  min-height: 58px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(248, 250, 252, 0.68));
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.metric-value {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.metric-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.tasks-toolbar {
  border-radius: 16px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-tab {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.62);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.status-tab.active {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.10);
  color: var(--primary);
}

.tasks-count {
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.state-card {
  min-height: 180px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 14px;
  font-weight: 850;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-row {
  min-height: 96px;
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 58px 104px;
  align-items: center;
  gap: 14px;
}

.task-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 12px;
  font-weight: 950;
}

.attempt-chip {
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(100, 116, 139, 0.7);
}

.task-row-queued .status-dot {
  background: #f59e0b;
}

.task-row-running .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.12);
}

.task-row-success .status-dot {
  background: #10b981;
}

.task-row-error .status-dot {
  background: var(--accent);
}

.task-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.task-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.task-mode {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.task-time {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.task-prompt,
.task-error {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.4;
}

.task-prompt {
  color: var(--text);
  font-weight: 750;
}

.task-error {
  color: #be185d;
  font-weight: 850;
}

.task-result {
  display: flex;
  justify-content: center;
}

.task-thumb {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.04);
  display: grid;
  place-items: center;
  color: var(--muted);
}

.task-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .tasks-head,
  .tasks-toolbar {
    align-items: flex-start;
  }

  .tasks-head {
    grid-template-columns: 1fr;
  }

  .metrics-strip {
    width: 100%;
    min-width: 0;
  }

  .tasks-actions {
    justify-content: flex-start;
  }

  .task-row {
    grid-template-columns: 1fr 58px;
    align-items: start;
  }

  .task-status,
  .task-actions {
    grid-column: 1 / -1;
  }

  .task-actions {
    justify-content: flex-start;
  }
}
</style>
