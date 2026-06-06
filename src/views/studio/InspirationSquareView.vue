<template>
  <div class="square-page">
    <div class="square-toolbar">
      <Input v-model="searchText" size="sm" placeholder="搜索标题、分类、提示词" />
      <Button size="sm" variant="ghost" :disabled="loading" @click="loadPublic">
        <template #icon><RefreshCwIcon :size="15" /></template>
        刷新
      </Button>
      <Button size="sm" :disabled="!authStore.user" @click="openSubmit">
        <template #icon><SendIcon :size="15" /></template>
        投稿灵感
      </Button>
    </div>

    <div v-if="loading" class="square-state">加载灵感广场中...</div>
    <div v-else-if="!filteredItems.length" class="square-state">还没有公开灵感</div>
    <div v-else class="square-grid">
      <article v-for="item in filteredItems" :key="item.id" class="square-card">
        <div class="square-cover">
          <img v-if="item.coverImage" :src="item.coverImage" :alt="item.title" loading="lazy" />
          <div v-else class="cover-fallback">{{ item.category || '灵感' }}</div>
          <span class="category-pill">{{ item.category || '灵感投稿' }}</span>
        </div>
        <div class="square-card-body">
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc || '暂无说明' }}</p>
          <code>{{ item.prompt }}</code>
          <Button size="sm" variant="ghost" @click="useInWorkbench(item)">
            带入工作台
          </Button>
        </div>
      </article>
    </div>

    <Modal v-model:open="submitOpen" title="选择内容投稿" size="lg">
      <div class="submission-form">
        <div class="source-tabs" role="tablist" aria-label="投稿来源">
          <button
            v-for="item in submitSourceTabs"
            :key="item.value"
            type="button"
            class="source-tab"
            :class="{ active: submitSource === item.value }"
            @click="submitSource = item.value"
          >
            {{ item.label }}
          </button>
        </div>

        <Input v-model="assetSearch" size="sm" :placeholder="submitSource === 'template' ? '搜索我的模板' : '搜索灵感记录'" />

        <div v-if="assetLoading" class="asset-picker-state">加载可投稿内容中...</div>
        <div v-else-if="!filteredAssets.length" class="asset-picker-state">
          {{ submitSource === 'template' ? '还没有我的模板' : '还没有可投稿的灵感记录' }}
        </div>
        <div v-else class="asset-picker-list">
          <button
            v-for="asset in filteredAssets"
            :key="asset.key"
            type="button"
            class="asset-option"
            :class="{ active: selectedAssetKey === asset.key }"
            @click="selectAsset(asset)"
          >
            <img v-if="asset.coverImage" :src="asset.coverImage" alt="" loading="lazy" />
            <span v-else class="asset-option-fallback">{{ asset.sourceLabel }}</span>
            <span class="asset-option-copy">
              <strong>{{ asset.title }}</strong>
              <span>{{ asset.description || asset.prompt }}</span>
            </span>
            <span class="asset-option-meta">{{ asset.category || asset.sourceLabel }}</span>
          </button>
        </div>

        <div v-if="selectedAsset" class="submission-preview">
          <div class="preview-head">
            <span>{{ selectedAsset.sourceLabel }}</span>
            <strong>{{ selectedAsset.title }}</strong>
          </div>
          <code>{{ selectedAsset.prompt }}</code>
        </div>
        <div class="submit-hint">提交后会先进入审核，通过后才会公开显示在灵感广场。</div>
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button variant="ghost" :disabled="saving" @click="submitOpen = false">取消</Button>
          <Button :disabled="saving" @click="submit">
            {{ saving ? '提交中...' : '提交审核' }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCwIcon, SendIcon } from 'lucide-vue-next'
import { Button, Input, Modal, toastError, toastSuccess } from '../../components/common'
import { useAuthStore } from '../../stores/auth'
import { useImagesStore } from '../../stores/images'
import { apiFetch } from '../../utils/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const imagesStore = useImagesStore()
const loading = ref(false)
const saving = ref(false)
const assetLoading = ref(false)
const submitOpen = ref(false)
const searchText = ref('')
const assetSearch = ref('')
const submitSource = ref('template')
const selectedAssetKey = ref('')
const publicItems = ref([])
const userTemplates = ref([])
const historyAssets = ref([])
const form = reactive({
  title: '',
  category: '灵感投稿',
  aspectRatio: '',
  coverImageUrl: '',
  description: '',
  prompt: '',
  sourceType: '',
  sourceId: ''
})
const submitSourceTabs = [
  { label: '我的模板', value: 'template' },
  { label: '灵感记录', value: 'history' }
]

const filteredItems = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return publicItems.value
  return publicItems.value.filter((item) => {
    return [item.title, item.desc, item.category, item.prompt].join(' ').toLowerCase().includes(keyword)
  })
})

const submitAssets = computed(() => submitSource.value === 'template' ? userTemplates.value : historyAssets.value)
const selectedAsset = computed(() => submitAssets.value.find((asset) => asset.key === selectedAssetKey.value) || null)
const filteredAssets = computed(() => {
  const keyword = assetSearch.value.trim().toLowerCase()
  const list = submitAssets.value
  if (!keyword) return list
  return list.filter((asset) => asset.searchText.includes(keyword))
})

onMounted(() => {
  void loadPublic()
  if (route.query.submitSource || route.query.sourceId) {
    submitSource.value = routeString(route.query.submitSource) === 'history' ? 'history' : 'template'
    void openSubmit()
  }
})

async function openSubmit() {
  if (!authStore.user) {
    toastError('请先登录后再投稿')
    return
  }
  submitOpen.value = true
  await loadSubmitAssets()
}

function resetForm() {
  Object.assign(form, {
    title: '',
    category: '灵感投稿',
    aspectRatio: '',
    coverImageUrl: '',
    description: '',
    prompt: '',
    sourceType: '',
    sourceId: ''
  })
  selectedAssetKey.value = ''
  assetSearch.value = ''
}

async function loadPublic() {
  loading.value = true
  try {
    const data = await apiFetch('/api/templates/community/public?limit=120', undefined, { toast: false })
    publicItems.value = Array.isArray(data?.templates) ? data.templates : []
  } catch (error) {
    publicItems.value = []
  } finally {
    loading.value = false
  }
}

async function loadSubmitAssets() {
  assetLoading.value = true
  try {
    const [templateData] = await Promise.all([
      apiFetch('/api/templates/user', undefined, { toast: false }),
      imagesStore.fetchImages({ limit: 48, offset: 0 })
    ])
    userTemplates.value = (Array.isArray(templateData?.templates) ? templateData.templates : [])
      .map(normalizeTemplateAsset)
    historyAssets.value = (Array.isArray(imagesStore.images) ? imagesStore.images : [])
      .filter((image) => String(image?.prompt || '').trim())
      .map(normalizeHistoryAsset)
    applyRouteSelection()
  } catch (error) {
    toastError(error?.message || '可投稿内容加载失败')
  } finally {
    assetLoading.value = false
  }
}

function routeString(value) {
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim()
}

function applyRouteSelection() {
  const sourceId = routeString(route.query.sourceId)
  if (!sourceId) return
  const asset = submitAssets.value.find((item) => item.sourceId === sourceId)
  if (asset) selectAsset(asset)
}

function normalizeTemplateAsset(tpl) {
  const title = String(tpl?.title || '未命名模板')
  const prompt = String(tpl?.prompt || '')
  const category = String(tpl?.category || '我的模板')
  const description = String(tpl?.desc || tpl?.description || '')
  return {
    key: `template:${tpl?.id || title}`,
    sourceType: 'template',
    sourceId: String(tpl?.id || ''),
    sourceLabel: '我的模板',
    title,
    description,
    category,
    prompt,
    aspectRatio: String(tpl?.aspectRatio || ''),
    coverImage: String(tpl?.coverImage || ''),
    searchText: [title, description, category, prompt].join(' ').toLowerCase()
  }
}

function normalizeHistoryAsset(image) {
  const title = String(image?.prompt || '历史作品').slice(0, 42)
  const category = modeLabel(image)
  const prompt = String(image?.prompt || '')
  const coverImage = image?.imageUrls?.[0] || image?.previewImageUrls?.[0] || ''
  return {
    key: `history:${image?.id || title}`,
    sourceType: 'history',
    sourceId: String(image?.id || ''),
    sourceLabel: '灵感记录',
    title,
    description: image?.createdAt ? `生成于 ${formatDate(image.createdAt)}` : '',
    category,
    prompt,
    aspectRatio: String(image?.aspectRatio || ''),
    coverImage,
    searchText: [title, category, prompt].join(' ').toLowerCase()
  }
}

function modeLabel(image) {
  if (image?.mode === 'dialogue' || image?.mode === 'continuous') return '对话创作'
  if (image?.mode === 'tools') return '图片工具'
  if (image?.mode === 'image') return '图生图'
  return '文生图'
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function selectAsset(asset) {
  selectedAssetKey.value = asset.key
  Object.assign(form, {
    title: asset.title,
    category: asset.category || '灵感投稿',
    aspectRatio: asset.aspectRatio || '',
    coverImageUrl: asset.coverImage || '',
    description: asset.description || '',
    prompt: asset.prompt,
    sourceType: asset.sourceType,
    sourceId: asset.sourceId
  })
}

watch(submitSource, () => {
  resetForm()
  applyRouteSelection()
})

async function submit() {
  if (!selectedAsset.value) {
    toastError('请选择要投稿的内容')
    return
  }
  if (!form.title.trim()) {
    toastError('请输入标题')
    return
  }
  if (!form.prompt.trim()) {
    toastError('请输入提示词')
    return
  }
  saving.value = true
  try {
    await apiFetch('/api/templates/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    resetForm()
    submitOpen.value = false
    toastSuccess('已提交审核，通过后会出现在灵感广场')
  } catch (error) {
    toastError(error?.message || '提交失败')
  } finally {
    saving.value = false
  }
}

function useInWorkbench(item) {
  router.push({
    path: '/studio',
    query: {
      prompt: item.prompt,
      ...(item.aspectRatio ? { ratio: item.aspectRatio } : {})
    }
  })
}
</script>

<style scoped>
.square-page {
  display: grid;
  gap: 14px;
}

.square-toolbar,
.square-state,
.square-card {
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(18px);
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.square-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  padding: 10px;
}

.square-state {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
}

.square-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.square-card {
  overflow: hidden;
  min-width: 0;
}

.square-cover {
  position: relative;
  height: 168px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.05);
}

.square-cover img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(620px 220px at 20% 0%, rgba(37, 99, 235, 0.26), transparent 58%),
    radial-gradient(620px 260px at 90% 20%, rgba(20, 184, 166, 0.18), transparent 58%),
    rgba(248, 250, 252, 0.9);
  color: var(--primary);
  font-weight: 950;
}

.category-pill {
  position: absolute;
  left: 12px;
  bottom: 12px;
  max-width: calc(100% - 24px);
  height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
}

.square-card-body {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.square-card-body h3 {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.square-card-body p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 750;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.square-card-body code {
  min-height: 58px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  color: rgba(15, 23, 42, 0.72);
  font-size: 12px;
  line-height: 1.5;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.submission-form {
  display: grid;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.prompt-box {
  min-height: 220px;
  resize: vertical;
  line-height: 1.58;
}

.submit-hint {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.07);
  color: var(--primary);
  font-size: 12px;
  font-weight: 850;
}

@media (max-width: 760px) {
  .form-row,
  .square-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
