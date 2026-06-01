<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <AdminListLayout>
      <template #filters>
        <SelectMenu
          v-model="lowOnly"
          size="sm"
          :options="lowOnlyOptions"
          placeholder="低分反馈"
          class="sel"
        />
        <SelectMenu
          v-model="ratingFilter"
          size="sm"
          :options="ratingOptions"
          placeholder="全部评分"
          class="sel"
        />
        <SelectMenu
          v-model="issueTypeFilter"
          size="sm"
          :options="issueTypeOptions"
          placeholder="全部问题"
          class="sel"
        />
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
          :rows="feedback"
          :loading="loading"
          empty-text="暂无反馈"
        >
          <template #cell-createdAt="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>

          <template #cell-rating="{ row }">
            <span class="rating" :class="ratingClass(row.rating)">
              {{ ratingText(row.rating) }}
            </span>
          </template>

          <template #cell-issueType="{ row }">
            <span class="chip">{{ issueTypeLabel(row.issueType) }}</span>
          </template>

          <template #cell-user="{ row }">
            <div class="user-cell">
              <div class="user-main">{{ row.username || row.userName || '-' }}</div>
              <div class="mono">{{ row.userId || '-' }}</div>
            </div>
          </template>

          <template #cell-image="{ row }">
            <div class="image-cell">
              <a
                v-if="row.imageUrl"
                class="image-link"
                :href="row.imageUrl"
                target="_blank"
                rel="noreferrer"
                @click.stop
              >
                查看图片
              </a>
              <span v-else-if="row.imageId" class="mono">{{ row.imageId }}</span>
              <span v-else class="muted">-</span>
              <div class="prompt">{{ row.prompt || '-' }}</div>
            </div>
          </template>

          <template #cell-note="{ row }">
            <span class="note">{{ row.note || row.remark || row.comment || '-' }}</span>
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
import { useRoute, useRouter } from 'vue-router'
import { RefreshCcwIcon } from 'lucide-vue-next'
import { Button, DataTable, Pagination, SelectMenu } from '../../../components/common'
import { AdminListLayout, TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const route = useRoute()
const router = useRouter()

const lowOnlyOptions = [
  { label: '仅低分', value: '1' },
  { label: '全部反馈', value: '0' }
]

const issueTypeOptions = [
  { label: '画质/细节', value: 'bad_quality' },
  { label: '主体不符', value: 'wrong_subject' },
  { label: '文字错误', value: 'bad_text' },
  { label: '构图问题', value: 'composition' },
  { label: '不合规', value: 'unsafe' },
  { label: '其他', value: 'other' }
]

const ratingOptions = [
  { label: '点赞', value: 'like' },
  { label: '点踩', value: 'dislike' },
  { label: '未评分', value: 'none' }
]

const columns = [
  { key: 'createdAt', title: '时间', width: '14%', nowrap: true },
  { key: 'rating', title: '评分', width: '9%', nowrap: true },
  { key: 'issueType', title: '问题类型', width: '12%', nowrap: true },
  { key: 'user', title: '用户', width: '16%', nowrap: true, ellipsis: true },
  { key: 'image', title: '图片 / 提示词', width: '31%', nowrap: false, ellipsis: true },
  { key: 'note', title: '备注', width: '18%', nowrap: false, ellipsis: true }
]

const feedback = ref([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const page = ref(Number(route.query.page || 1) || 1)
const pageSize = ref(Number(route.query.limit || 20) || 20)
const lowOnly = ref(String(route.query.lowOnly ?? '1') === '0' ? '0' : '1')
const ratingFilter = ref(String(route.query.rating || ''))
const issueTypeFilter = ref(String(route.query.issueType || ''))

function normalizeFeedbackRow(row) {
  return {
    ...row,
    id: row.id || row.feedbackId || `${row.createdAt || row.created_at || ''}:${row.imageId || row.image_id || ''}`,
    createdAt: row.createdAt || row.created_at,
    issueType: row.issueType || row.issue_type || '',
    userId: row.userId || row.user_id || row.user?.id || '',
    username: row.username || row.userName || row.user_name || row.user?.username || '',
    imageId: row.imageId || row.image_id || row.image?.id || '',
    imageUrl: row.imageUrl || row.image_url || row.image?.url || row.imageUrls?.[0] || row.image_urls?.[0] || '',
    prompt: row.prompt || row.imagePrompt || row.image_prompt || row.image?.prompt || '',
    rating: String(row.rating || 'none')
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

async function load() {
  errorMsg.value = ''
  try {
    loading.value = true
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('limit', String(pageSize.value))
    params.set('lowOnly', lowOnly.value === '1' ? 'true' : 'false')
    if (ratingFilter.value) params.set('rating', String(ratingFilter.value))
    if (issueTypeFilter.value) params.set('issueType', String(issueTypeFilter.value))

    router.replace({ query: Object.fromEntries(params.entries()) })
    const data = await apiFetch(`/api/admin/image-feedback?${params.toString()}`)
    const rows = data?.samples || data?.entries || data?.items || data?.feedback || []
    feedback.value = rows.map(normalizeFeedbackRow)
    total.value = Number(data?.total || 0)

    const totalPages = Math.max(1, Math.ceil((total.value || 0) / pageSize.value))
    if (page.value > totalPages) {
      page.value = totalPages
      await load()
    }
  } catch (e) {
    feedback.value = []
    total.value = 0
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(val))
}

function ratingText(value) {
  if (value === 'like') return '点赞'
  if (value === 'dislike') return '点踩'
  if (value === 'none') return '未评分'
  return '-'
}

function ratingClass(value) {
  if (value === 'dislike') return 'low'
  if (value === 'like') return 'high'
  return 'mid'
}

function issueTypeLabel(value) {
  return issueTypeOptions.find((item) => item.value === value)?.label || value || '-'
}

watch([lowOnly, ratingFilter, issueTypeFilter], () => {
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

.muted {
  color: var(--muted);
}

.chip,
.rating {
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

.rating.low {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.18);
}

.rating.mid {
  color: #92400e;
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.20);
}

.rating.high {
  color: #166534;
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.18);
}

.user-cell,
.image-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-main {
  font-weight: 850;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-link {
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
}

.image-link:hover {
  text-decoration: underline;
}

.prompt,
.note {
  color: var(--text);
  line-height: 1.45;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.note {
  color: var(--muted);
}
</style>
