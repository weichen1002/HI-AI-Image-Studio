<template>
  <div>
    <section class="history-control-surface">
      <div class="history-toolbar">
        <div class="history-heading">
          <div class="history-kicker">灵感记录</div>
          <div class="history-stats">
            <span class="stat-pill strong">{{ visibleHistoryItems.length }}</span>
            <span class="stat-caption">当前结果</span>
            <span v-if="serverTotal !== visibleHistoryItems.length" class="stat-caption">/ 匹配 {{ serverTotal }}</span>
            <span v-if="favoritesOnly" class="active-filter-pill">收藏</span>
          </div>
        </div>
        <div class="history-actions">
          <Button
            v-if="imagesCount"
            variant="ghost"
            @click="toggleBatchMode"
            :disabled="imagesStore.isLoading"
          >
            <template #icon>
              <CheckSquareIcon :size="16" />
            </template>
            {{ batchMode ? '退出批量' : '批量管理' }}
          </Button>
          <Button variant="ghost" @click="fetchImages" :disabled="imagesStore.isLoading">
            <template #icon>
              <RefreshCwIcon :size="16" />
            </template>
            刷新
          </Button>
          <Button v-if="hasActiveFilters" variant="ghost" @click="resetFilters">
            <template #icon>
              <XIcon :size="16" />
            </template>
            重置
          </Button>
          <Button class="clear-history-btn" variant="ghost" @click="clearAll" :disabled="imagesStore.isLoading || !imagesStore.images.length">
            <template #icon>
              <Trash2Icon :size="16" />
            </template>
            清空
          </Button>
        </div>
      </div>

      <div v-if="imagesCount || hasActiveFilters" class="history-filters">
        <label class="search-field">
          <SearchIcon :size="16" />
          <Input v-model="searchText" size="sm" placeholder="搜索提示词" />
        </label>
        <div class="mode-tabs" role="tablist" aria-label="类型筛选">
          <button
            v-for="item in modeFilterOptions"
            :key="item.value"
            type="button"
            class="mode-tab"
            :class="{ active: modeFilter === item.value }"
            role="tab"
            :aria-selected="modeFilter === item.value"
            @click="modeFilter = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <button
          type="button"
          class="favorite-filter"
          :class="{ active: favoritesOnly }"
          @click="favoritesOnly = !favoritesOnly"
        >
          <StarIcon :size="15" />
          <span>只看收藏</span>
        </button>
      </div>

      <div v-if="showAssetFilters" class="asset-filter-panel">
        <div v-if="showFolderFilters" class="asset-filter-row">
          <div class="asset-filter-label">
            <FolderOpenIcon :size="15" />
            <span>文件夹</span>
          </div>
          <div class="asset-filter-chips" aria-label="文件夹筛选">
            <button
              v-for="item in folderFilterOptions"
              :key="item.value"
              type="button"
              class="asset-filter-chip"
              :class="{ active: folderFilter === item.value }"
              @click="folderFilter = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div v-if="showTagFilters" class="asset-filter-row">
          <div class="asset-filter-label">
            <TagIcon :size="15" />
            <span>标签</span>
          </div>
          <div class="asset-filter-chips" aria-label="标签筛选">
            <button
              v-for="item in tagFilterOptions"
              :key="item.value"
              type="button"
              class="asset-filter-chip"
              :class="{ active: tagFilter === item.value }"
              @click="tagFilter = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div v-if="batchMode && imagesCount" class="batch-toolbar">
      <div class="batch-summary">
        <span class="batch-count">{{ selectedItems.length }}</span>
        <span>已选内容</span>
      </div>
      <div class="batch-actions">
        <Button size="sm" variant="ghost" @click="selectVisibleItems" :disabled="!visibleHistoryItems.length">
          <template #icon>
            <CheckSquareIcon :size="15" />
          </template>
          选择当前
        </Button>
        <Button size="sm" variant="ghost" @click="clearSelection" :disabled="!selectedItems.length">
          <template #icon>
            <XIcon :size="15" />
          </template>
          清空选择
        </Button>
        <Button size="sm" variant="ghost" @click="openAssetModalForBatch" :disabled="!selectedItems.length">
          <template #icon>
            <FolderOpenIcon :size="15" />
          </template>
          整理
        </Button>
        <Button size="sm" variant="ghost" @click="downloadSelected" :disabled="!selectedItems.length">
          <template #icon>
            <DownloadIcon :size="15" />
          </template>
          下载
        </Button>
        <Button size="sm" variant="danger" @click="deleteSelected" :disabled="!selectedItems.length">
          <template #icon>
            <Trash2Icon :size="15" />
          </template>
          删除
        </Button>
      </div>
    </div>

    <div v-if="imagesStore.isLoading" class="grid-history" aria-label="正在加载灵感记录">
      <div v-for="item in 6" :key="item" class="history-card skeleton-card">
        <div class="history-cover skeleton-block"></div>
        <div class="history-body">
          <div class="skeleton-line wide"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-meta">
            <span class="skeleton-pill"></span>
            <span class="skeleton-pill short"></span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!imagesCount && !hasActiveFilters" class="panel flex flex-col items-center justify-center text-center gap-4" style="height: 420px;">
      <ImageOffIcon :size="48" class="text-muted" />
      <div class="text-lead">暂无历史记录</div>
      <LinkButton to="/studio">去创作</LinkButton>
    </div>

    <div v-else-if="!visibleHistoryItems.length" class="panel flex flex-col items-center justify-center text-center gap-4 empty-filter-state">
      <ImageOffIcon :size="42" class="text-muted" />
      <div class="text-lead">没有匹配的记录</div>
      <Button variant="ghost" @click="resetFilters">重置筛选</Button>
    </div>

    <div v-else class="grid-history">
      <div
        v-for="item in visibleHistoryItems"
        :key="item.key"
        class="history-card"
        :class="{ 'dialogue-chain-card': item.type === 'dialogue-chain', selected: isSelected(item), batch: batchMode }"
        role="button"
        tabindex="0"
        @click="handleCardClick(item)"
        @keydown.enter.prevent="handleCardClick(item)"
      >
        <div class="history-cover">
          <img v-if="coverUrl(item)" :src="coverUrl(item)" loading="lazy" />
          <div v-else class="fallback-cover">无图片</div>

          <button
            v-if="batchMode"
            type="button"
            class="select-toggle"
            :class="{ active: isSelected(item) }"
            :aria-label="isSelected(item) ? '取消选择' : '选择'"
            @click.stop="toggleSelected(item)"
          >
            <CheckIcon v-if="isSelected(item)" :size="16" />
          </button>

          <div v-if="item.type === 'dialogue-chain'" class="count-badge">{{ item.roundCount }} 轮</div>
          <div v-else-if="(item.image.imageUrls || []).length > 1" class="count-badge">{{ item.image.imageUrls.length }} 张</div>

          <div v-if="item.image.inputImageUrls && item.image.inputImageUrls[0]" class="cover-toggle" @click.stop>
            <button type="button" class="toggle-btn" :class="{ active: coverMode[item.key] !== 'input' }" @click="setCoverMode(item, 'result')">结果</button>
            <button type="button" class="toggle-btn" :class="{ active: coverMode[item.key] === 'input' }" @click="setCoverMode(item, 'input')">参考</button>
          </div>

          <div class="cover-actions" @click.stop>
            <button class="cover-action" type="button" title="复制提示词" aria-label="复制提示词" @click="copyPrompt(item)">
              <CopyIcon :size="16" />
            </button>
            <button class="cover-action" type="button" title="整理作品" aria-label="整理作品" @click="openAssetModalForItem(item)">
              <FolderOpenIcon :size="16" />
            </button>
            <button
              v-if="coverUrl(item)"
              class="cover-action"
              type="button"
              title="下载图片"
              @click="downloadCover(item)"
            >
              <DownloadIcon :size="16" />
            </button>
            <button class="cover-action danger" type="button" title="删除" @click="removeOne(item)">
              <Trash2Icon :size="16" />
            </button>
          </div>
        </div>
        <div class="history-body">
          <div class="card-headline">
            <p class="prompt-text">{{ item.image.prompt }}</p>
            <button
              class="inline-favorite"
              :class="{ active: isFavorite(item) }"
              type="button"
              :aria-label="isFavorite(item) ? '取消收藏' : '收藏'"
              :title="isFavorite(item) ? '取消收藏' : '收藏'"
              @click.stop="toggleFavorite(item)"
            >
              <StarIcon :size="15" />
            </button>
          </div>
          <div class="card-actions">
            <button class="card-continue-action" type="button" @click.stop="reusePrompt(item)">
              <Wand2Icon :size="15" />
              <span>{{ item.type === 'dialogue-chain' ? '继续对话' : '再次创作' }}</span>
            </button>
          </div>
          <div v-if="item.assetSummary.folder || item.assetSummary.tags.length" class="asset-meta-row">
            <span v-if="item.assetSummary.folder" class="asset-pill folder-pill">
              {{ item.assetSummary.folder }}
            </span>
            <span v-for="tag in item.assetSummary.tags" :key="tag" class="asset-pill">
              {{ tag }}
            </span>
          </div>
          <div class="meta">
            <span class="meta-pill">{{ modeLabel(item) }}</span>
            <span class="meta-pill">{{ item.image.aspectRatio }}</span>
            <span class="meta-time">{{ formatTime(item.image.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="serverTotal > pageSize" class="history-pagination">
      <div class="pagination-summary">
        第 {{ currentPage }} / {{ totalPages }} 页，共 {{ serverTotal }} 条匹配记录
      </div>
      <div class="pagination-actions">
        <SelectMenu v-model="pageSizeText" :options="pageSizeOptions" size="sm" />
        <Button variant="ghost" size="sm" @click="goPrevPage" :disabled="currentPage <= 1 || imagesStore.isLoading">
          上一页
        </Button>
        <Button variant="ghost" size="sm" @click="goNextPage" :disabled="currentPage >= totalPages || imagesStore.isLoading">
          下一页
        </Button>
      </div>
    </div>

    <Modal v-model:open="assetModalOpen" :title="assetModalTitle" size="md">
      <div class="asset-form">
        <div>
          <label class="label">文件夹</label>
          <SelectMenu v-if="isBatchAssetEdit" v-model="assetForm.folderMode" :options="assetEditModeOptions" size="sm" />
          <Input v-model="assetForm.folder" placeholder="例如：电商海报、头像、插画参考" />
        </div>
        <div>
          <label class="label">标签</label>
          <SelectMenu v-if="isBatchAssetEdit" v-model="assetForm.tagsMode" :options="assetEditModeOptions" size="sm" />
          <Input v-model="assetForm.tags" placeholder="多个标签用逗号分隔" />
        </div>
        <div class="asset-form-hint">
          当前会整理 {{ assetTargetImageIds.length }} 张图片；单个整理留空会清除字段，批量整理需选择覆盖或清除。
        </div>
      </div>

      <template #footer>
        <div class="asset-modal-actions">
          <Button variant="ghost" @click="assetModalOpen = false">取消</Button>
          <Button @click="saveAssetMeta">保存</Button>
        </div>
      </template>
    </Modal>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CheckIcon, CheckSquareIcon, CopyIcon, DownloadIcon, FolderOpenIcon, RefreshCwIcon, ImageOffIcon, SearchIcon, TagIcon, Wand2Icon, Trash2Icon, StarIcon, XIcon } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useImagesStore } from '../../stores/images'
import { usePreferencesStore } from '../../stores/preferences'
import { Button, Input, LinkButton, Modal, SelectMenu, toastError, toastSuccess } from '../../components/common'

const imagesStore = useImagesStore()
const preferencesStore = usePreferencesStore()
const router = useRouter()
const route = useRoute()
const searchText = ref('')
const modeFilter = ref('all')
const folderFilter = ref('all')
const tagFilter = ref('all')
const favoritesOnly = ref(false)
const currentPage = ref(1)
const pageSize = ref(24)
const pageSizeText = ref('24')
let searchTimer = null
let suppressServerFetch = false
const batchMode = ref(false)
const selectedKeys = ref([])
const assetModalOpen = ref(false)
const assetTargetItems = ref([])
const assetForm = reactive({
  folderMode: 'keep',
  folder: '',
  tagsMode: 'keep',
  tags: ''
})

const modeFilterOptions = [
  { label: '全部类型', value: 'all' },
  { label: '文生图', value: 'text' },
  { label: '图生图', value: 'image' },
  { label: '对话创作', value: 'dialogue' },
  { label: '图片工具', value: 'tools' }
]

const serverAssetFolders = computed(() => {
  return Array.from(
    new Set(
      (imagesStore.images || [])
        .map((image) => String(image?.folder || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const serverAssetTags = computed(() => {
  return Array.from(
    new Set(
      (imagesStore.images || [])
        .flatMap((image) => Array.isArray(image?.tags) ? image.tags : [])
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const allAssetFolders = computed(() => {
  const selected = folderFilter.value && !['all', 'unfiled'].includes(folderFilter.value)
    ? [folderFilter.value]
    : []
  return Array.from(new Set([...serverAssetFolders.value, ...preferencesStore.assetFolders, ...selected]))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const allAssetTags = computed(() => {
  const selected = tagFilter.value && !['all', 'untagged'].includes(tagFilter.value)
    ? [tagFilter.value]
    : []
  return Array.from(new Set([...serverAssetTags.value, ...preferencesStore.assetTags, ...selected]))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const folderFilterOptions = computed(() => [
  { label: '全部文件夹', value: 'all' },
  { label: '未归档', value: 'unfiled' },
  ...allAssetFolders.value.map((folder) => ({ label: folder, value: folder }))
])
const tagFilterOptions = computed(() => [
  { label: '全部标签', value: 'all' },
  { label: '未打标签', value: 'untagged' },
  ...allAssetTags.value.map((tag) => ({ label: tag, value: tag }))
])
const assetEditModeOptions = [
  { label: '保持不变', value: 'keep' },
  { label: '覆盖为输入内容', value: 'set' },
  { label: '清除', value: 'clear' }
]
const pageSizeOptions = [
  { label: '每页 12 条', value: '12' },
  { label: '每页 24 条', value: '24' },
  { label: '每页 48 条', value: '48' },
  { label: '每页 96 条', value: '96' }
]
function isDialogueImage(image) {
  return image?.mode === 'dialogue' || image?.mode === 'continuous'
}

function modeLabel(item) {
  if (item?.type === 'dialogue-chain') return `对话创作 · ${item.roundCount}轮`
  const image = item?.image || item
  if (image?.mode === 'dialogue' || image?.mode === 'continuous') return '对话创作'
  if (image?.mode === 'tools') return '图片工具'
  if (image?.mode === 'image') return '图生图'
  return '文生图'
}
const coverMode = reactive({})
const imagesCount = computed(() => (imagesStore.images || []).length)
const serverTotal = computed(() => Number(imagesStore.total || 0))
const totalPages = computed(() => Math.max(1, Math.ceil(serverTotal.value / pageSize.value)))
const hasActiveFilters = computed(() => {
  return Boolean(
    String(searchText.value || '').trim() ||
    modeFilter.value !== 'all' ||
    folderFilter.value !== 'all' ||
    tagFilter.value !== 'all' ||
    favoritesOnly.value
  )
})
const showFolderFilters = computed(() => {
  return folderFilter.value !== 'all' || allAssetFolders.value.length > 0
})
const showTagFilters = computed(() => {
  return tagFilter.value !== 'all' || allAssetTags.value.length > 0
})
const showAssetFilters = computed(() => {
  return (imagesCount.value || hasActiveFilters.value) && (showFolderFilters.value || showTagFilters.value)
})
const sortedImages = computed(() => {
  const list = Array.isArray(imagesStore.images) ? imagesStore.images.slice() : []
  list.sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime()
    const tb = new Date(b?.createdAt || 0).getTime()
    return tb - ta
  })
  return list
})
const historyItems = computed(() => {
  const items = []
  const dialogueChains = new Map()

  for (const image of sortedImages.value) {
    if (isDialogueImage(image) && image.continuationChainId) {
      const chainId = image.continuationChainId
      const existing = dialogueChains.get(chainId)
      if (existing) {
        existing.images.push(image)
        existing.roundCount += 1
        continue
      }
      const item = {
        type: 'dialogue-chain',
        key: `chain-${chainId}`,
        chainId,
        image,
        images: [image],
        roundCount: Math.max(1, Number(image.chainRoundCount || 1))
      }
      dialogueChains.set(chainId, item)
      items.push(item)
      continue
    }
    items.push({
      type: 'image',
      key: image.id,
      image
    })
  }

  return items
})
const enrichedHistoryItems = computed(() => {
  return historyItems.value.map((item) => {
    const image = item.image || item
    const assetSummary = assetMetaSummary(item)
    return {
      ...item,
      assetSummary,
      searchText: [
        image.prompt,
        image.aspectRatio,
        modeLabel(item),
        image.operationType
      ].join(' ').toLowerCase()
    }
  })
})
const visibleHistoryItems = computed(() => {
  return enrichedHistoryItems.value.filter((item) => {
    const matchesFavorite = !favoritesOnly.value || isFavorite(item)
    return matchesFavorite
  })
})
const selectedKeySet = computed(() => new Set(selectedKeys.value))
const selectedItems = computed(() => {
  const keys = selectedKeySet.value
  return visibleHistoryItems.value.filter((item) => keys.has(item.key))
})
const assetTargetImageIds = computed(() => assetTargetItems.value.flatMap((item) => imageIdsForItem(item)))
const isBatchAssetEdit = computed(() => assetTargetItems.value.length > 1)
const assetModalTitle = computed(() => {
  if (assetTargetItems.value.length > 1) return `批量整理 ${assetTargetItems.value.length} 项`
  return '整理作品'
})

onMounted(() => {
  applyRouteFilters()
  fetchImages()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})

async function fetchImages() {
  await imagesStore.fetchImages({
    limit: pageSize.value,
    offset: (currentPage.value - 1) * pageSize.value,
    mode: modeFilter.value,
    q: searchText.value,
    folder: folderFilter.value,
    tag: tagFilter.value
  })
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
    await imagesStore.fetchImages({
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
      mode: modeFilter.value,
      q: searchText.value,
      folder: folderFilter.value,
      tag: tagFilter.value
    })
  }
  clearSelection()
}

function routeString(value) {
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim()
}

function applyRouteFilters() {
  const folder = routeString(route.query.folder)
  const tag = routeString(route.query.tag)
  const q = routeString(route.query.q)

  suppressServerFetch = true
  if (folder) folderFilter.value = folder
  if (tag) tagFilter.value = tag
  if (q) searchText.value = q
  suppressServerFetch = false
}

function resetServerPageAndFetch() {
  currentPage.value = 1
  fetchImages()
}

function goPrevPage() {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
  fetchImages()
}

function goNextPage() {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
  fetchImages()
}

watch(searchText, () => {
  if (suppressServerFetch) return
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    resetServerPageAndFetch()
  }, 300)
})

watch(modeFilter, () => {
  if (suppressServerFetch) return
  resetServerPageAndFetch()
})

watch(folderFilter, () => {
  if (suppressServerFetch) return
  resetServerPageAndFetch()
})

watch(tagFilter, () => {
  if (suppressServerFetch) return
  resetServerPageAndFetch()
})

watch(pageSizeText, (value) => {
  const nextSize = Number(value || 24)
  pageSize.value = [12, 24, 48, 96].includes(nextSize) ? nextSize : 24
  resetServerPageAndFetch()
})

function imageIdsForItem(item) {
  if (item.type === 'dialogue-chain') return item.images.map((image) => image.id).filter(Boolean)
  return item?.image?.id ? [item.image.id] : []
}

function favoriteIdsForItem(item) {
  return imageIdsForItem(item)
}

function isFavorite(item) {
  const ids = favoriteIdsForItem(item)
  return ids.length > 0 && ids.some((id) => preferencesStore.isFavoriteImage(id))
}

function toggleFavorite(item) {
  const ids = favoriteIdsForItem(item)
  const shouldFavorite = !ids.some((id) => preferencesStore.isFavoriteImage(id))
  preferencesStore.setFavoriteImages(ids, shouldFavorite)
}

function resetFilters() {
  suppressServerFetch = true
  searchText.value = ''
  modeFilter.value = 'all'
  folderFilter.value = 'all'
  tagFilter.value = 'all'
  favoritesOnly.value = false
  suppressServerFetch = false
  resetServerPageAndFetch()
}

async function removeOne(item) {
  if (!item?.image?.id) return
  const isChain = item.type === 'dialogue-chain'
  const ok = window.confirm(isChain ? '确定删除整条对话记录吗？该操作不可撤销。' : '确定删除这条记录吗？')
  if (!ok) return
  if (isChain) {
    await imagesStore.deleteDialogueChain(item.chainId)
    preferencesStore.removeImagePreferences(imageIdsForItem(item))
    return
  }
  await imagesStore.deleteImage(item.image.id)
  preferencesStore.removeImagePreferences([item.image.id])
}

async function clearAll() {
  const ok = window.confirm('确定清空全部灵感记录吗？该操作不可撤销。')
  if (!ok) return
  const ids = (imagesStore.images || []).map((image) => image.id).filter(Boolean)
  await imagesStore.clearImages()
  preferencesStore.removeImagePreferences(ids)
  clearSelection()
}

function formatTime(val) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(val))
}

function reusePrompt(item) {
  const image = item?.image || item
  if (image.mode === 'dialogue' || image.mode === 'continuous') {
    router.push({ path: '/studio', query: { mode: 'dialogue', imageId: image.id } })
    return
  }
  if (image.mode === 'tools') {
    router.push({ path: '/studio', query: { mode: 'tools' } })
    return
  }
  if (image.mode === 'image' && image.inputImageUrls?.[0]) {
    router.push({
      path: '/studio',
      query: {
        ...reuseQueryForImage(image, 'image'),
        mode: 'image',
        input: encodeURIComponent(image.inputImageUrls[0])
      }
    })
    return
  }
  router.push({ path: '/studio', query: reuseQueryForImage(image, 'text') })
}

function reuseQueryForImage(image, mode = 'text') {
  const params = image?.generationParams && typeof image.generationParams === 'object'
    ? image.generationParams
    : {}
  const query = {
    mode,
    prompt: image?.prompt || '',
    ratio: image?.aspectRatio || '1:1'
  }
  for (const key of ['qualityTier', 'count', 'outputFormat', 'outputCompression', 'background', 'moderation']) {
    if (params[key] !== undefined && params[key] !== '') {
      query[key] = String(params[key])
    }
  }
  return query
}

function openDetail(item) {
  router.push({ path: `/studio/history/${item.image.id}` })
}

function handleCardClick(item) {
  if (batchMode.value) {
    toggleSelected(item)
    return
  }
  openDetail(item)
}

function isSelected(item) {
  return selectedKeySet.value.has(item.key)
}

function toggleSelected(item) {
  const current = new Set(selectedKeys.value)
  if (current.has(item.key)) current.delete(item.key)
  else current.add(item.key)
  selectedKeys.value = Array.from(current)
}

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) clearSelection()
}

function selectVisibleItems() {
  selectedKeys.value = visibleHistoryItems.value.map((item) => item.key)
}

function clearSelection() {
  selectedKeys.value = []
}

function assetMetaSummary(item) {
  const folders = []
  const tags = []
  const images = item.type === 'dialogue-chain' ? item.images : [item.image]
  for (const image of images) {
    if (image?.folder) folders.push(String(image.folder).trim())
    if (Array.isArray(image?.tags)) tags.push(...image.tags)
  }
  for (const id of imageIdsForItem(item)) {
    const meta = preferencesStore.assetMeta(id)
    if (meta.folder) folders.push(meta.folder)
    tags.push(...meta.tags)
  }
  const uniqueFolders = Array.from(new Set(folders))
  const uniqueTags = Array.from(new Set(tags))
  return {
    folders: uniqueFolders,
    folder: uniqueFolders.length > 1 ? '多个文件夹' : uniqueFolders[0] || '',
    tags: uniqueTags
  }
}

function parseTags(value) {
  return String(value || '')
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function openAssetModal(items) {
  assetTargetItems.value = items
  const summary = items.length === 1 ? items[0].assetSummary || assetMetaSummary(items[0]) : { folder: '', tags: [] }
  assetForm.folderMode = items.length === 1 ? 'set' : 'keep'
  assetForm.folder = summary.folder === '多个文件夹' ? '' : summary.folder
  assetForm.tagsMode = items.length === 1 ? 'set' : 'keep'
  assetForm.tags = summary.tags.join('，')
  assetModalOpen.value = true
}

function openAssetModalForItem(item) {
  openAssetModal([item])
}

function openAssetModalForBatch() {
  if (!selectedItems.value.length) return
  openAssetModal(selectedItems.value)
}

async function saveAssetMeta() {
  const next = {}
  if (!isBatchAssetEdit.value || assetForm.folderMode === 'set') next.folder = assetForm.folder
  else if (assetForm.folderMode === 'clear') next.folder = ''

  if (!isBatchAssetEdit.value || assetForm.tagsMode === 'set') next.tags = parseTags(assetForm.tags)
  else if (assetForm.tagsMode === 'clear') next.tags = []

  try {
    await Promise.all(assetTargetImageIds.value.map((id) => imagesStore.updateImageMeta(id, next)))
    preferencesStore.updateAssetMeta(assetTargetImageIds.value, next)
    assetModalOpen.value = false
    toastSuccess('已保存整理信息')
  } catch (error) {
    toastError(error?.message || '保存失败')
  }
}

async function downloadSelected() {
  for (const item of selectedItems.value) {
    await downloadCover(item)
  }
}

async function deleteSelected() {
  if (!selectedItems.value.length) return
  const ok = window.confirm(`确定删除选中的 ${selectedItems.value.length} 项吗？对话记录会按整条链删除。`)
  if (!ok) return
  const ids = selectedItems.value.flatMap((item) => imageIdsForItem(item))
  for (const item of selectedItems.value) {
    if (item.type === 'dialogue-chain') await imagesStore.deleteDialogueChain(item.chainId)
    else if (item.image?.id) await imagesStore.deleteImage(item.image.id)
  }
  preferencesStore.removeImagePreferences(ids)
  clearSelection()
}

async function copyPrompt(item) {
  const image = item?.image || item
  const text = String(image?.prompt || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('已复制提示词')
  } catch {
    toastError('复制失败')
  }
}

function setCoverMode(item, val) {
  coverMode[item.key] = val
}

function coverUrl(item) {
  const image = item.image || item
  const current = coverMode[item.key || image.id] === 'input' ? 'input' : 'result'
  if (current === 'input') return image.inputImageUrls?.[0] || image.imageUrls?.[0] || ''
  return image.imageUrls?.[0] || ''
}

function downloadName(item) {
  const image = item.image || item
  const date = new Date(image.createdAt || Date.now()).toISOString().slice(0, 10)
  const current = coverMode[item.key || image.id] === 'input' ? 'input' : 'result'
  const prefix = item.type === 'dialogue-chain' ? 'dialogue' : 'image'
  return `hi-${prefix}-${date}-${current}-${image.id || Date.now()}.png`
}

function triggerDownload(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadCover(item) {
  const url = coverUrl(item)
  if (!url) return

  if (url.startsWith('data:')) {
    triggerDownload(url, downloadName(item))
    return
  }

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, downloadName(item))
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<style scoped>
.history-control-surface {
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: calc(var(--radius-md) + 4px);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(18px);
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.history-heading {
  min-width: 0;
}

.history-kicker {
  margin-bottom: 6px;
  color: rgba(15, 23, 42, 0.92);
  font-size: 15px;
  font-weight: 900;
}

.history-stats {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}

.stat-pill.strong {
  min-width: 42px;
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.2);
  background: rgba(99, 102, 241, 0.08);
  font-size: 14px;
}

.stat-caption {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.active-filter-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #fff7ed;
  color: #b45309;
  font-size: 11px;
  font-weight: 900;
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-history-btn {
  color: rgba(15, 23, 42, 0.52);
}

.clear-history-btn:hover {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.18);
  background: rgba(254, 242, 242, 0.68);
}

.history-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(0, 520px) auto;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
}

.search-field {
  position: relative;
  display: block;
  min-width: 0;
  color: var(--muted);
}

.search-field > svg {
  position: absolute;
  z-index: 1;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.search-field :deep(.input) {
  padding-left: 38px;
}

.mode-tabs {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.66);
}

.mode-tab {
  min-width: 0;
  height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.mode-tab:hover {
  color: rgba(15, 23, 42, 0.86);
  background: rgba(255, 255, 255, 0.68);
}

.mode-tab.active {
  color: #ffffff;
  background: var(--primary);
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.18);
}

.favorite-filter {
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.58);
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.favorite-filter:hover {
  background: #ffffff;
  border-color: rgba(245, 158, 11, 0.3);
}

.favorite-filter.active {
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.34);
  background: #fff7ed;
  box-shadow: 0 8px 18px rgba(245, 158, 11, 0.12);
}

.asset-filter-panel {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.asset-filter-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.asset-filter-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(15, 23, 42, 0.62);
  font-size: 12px;
  font-weight: 900;
}

.asset-filter-chips {
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 1px 2px 3px;
  scrollbar-width: thin;
}

.asset-filter-chip {
  flex: 0 0 auto;
  max-width: 180px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.asset-filter-chip:hover {
  color: rgba(15, 23, 42, 0.86);
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.16);
}

.asset-filter-chip.active {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.26);
  background: rgba(99, 102, 241, 0.09);
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.08);
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(14, 165, 233, 0.06));
  box-shadow: 0 10px 26px rgba(99, 102, 241, 0.08);
}

.batch-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: rgba(15, 23, 42, 0.76);
  font-size: 13px;
  font-weight: 900;
}

.batch-count {
  color: var(--primary);
  font-size: 22px;
  line-height: 1;
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.empty-filter-state {
  min-height: 320px;
}

.grid-history {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.history-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s;
  min-width: 0;
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
}

.history-card.selected {
  border-color: rgba(99, 102, 241, 0.42);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1), 0 18px 46px rgba(99, 102, 241, 0.14);
}

.history-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.18);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.dialogue-chain-card {
  border-color: rgba(99, 102, 241, 0.16);
}

.dialogue-chain-card .history-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 55%, rgba(15, 23, 42, 0.22));
  pointer-events: none;
}

.dialogue-chain-card .count-badge {
  background: rgba(99, 102, 241, 0.88);
}

.history-card:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.6);
  outline-offset: 2px;
}

.history-cover {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--bg-subtle);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
  position: relative;
}

.select-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--primary);
  cursor: pointer;
  backdrop-filter: blur(12px);
}

.select-toggle.active {
  background: var(--primary);
  color: #ffffff;
}

.history-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.01);
  transition: transform 0.25s ease;
}

.history-card:hover .history-cover img {
  transform: scale(1.05);
}

.cover-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
}

.history-card.batch .cover-toggle {
  left: 54px;
}

.toggle-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.toggle-btn.active {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.35);
  background: var(--gradient-subtle);
}

.cover-action {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--primary);
  cursor: pointer;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
  backdrop-filter: blur(12px);
}

.cover-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}

.count-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}

.history-card:hover .cover-action,
.cover-action:focus-visible {
  opacity: 1;
  transform: translateY(0);
}

.cover-action:hover {
  background: #ffffff;
}

.cover-action.danger {
  color: var(--accent);
}

.cover-action.danger:hover {
  background: #ffffff;
}

.fallback-cover {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
  font-size: 14px;
}

.history-body {
  padding: 14px;
  min-height: 148px;
  display: flex;
  flex-direction: column;
}

.card-headline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 10px;
  align-items: start;
}

.prompt-text {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 62px;
}

.inline-favorite {
  display: inline-grid;
  place-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s, transform 0.2s;
}

.inline-favorite {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.inline-favorite:hover {
  transform: translateY(-1px);
  background: #ffffff;
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.18);
}

.inline-favorite.active {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.24);
  background: #fff7ed;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.meta-pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.72);
}

.meta-time {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

.card-actions {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.card-continue-action {
  min-width: 0;
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.card-continue-action:hover {
  color: rgba(79, 70, 229, 0.86);
}

.asset-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.asset-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.folder-pill {
  border-color: rgba(99, 102, 241, 0.16);
  background: rgba(99, 102, 241, 0.08);
  color: var(--primary);
}

.asset-form {
  display: grid;
  gap: 14px;
}

.asset-form-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.asset-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.history-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding: 12px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
}

.pagination-summary {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 980px) {
  .history-filters {
    grid-template-columns: 1fr;
  }

  .mode-tabs {
    grid-template-columns: repeat(5, minmax(86px, 1fr));
    overflow-x: auto;
  }

  .batch-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .history-pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .pagination-actions {
    justify-content: flex-start;
  }

  .batch-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 520px) {
  .history-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .history-actions,
  .batch-actions,
  .asset-modal-actions,
  .pagination-actions {
    flex-direction: column;
  }

  .pagination-actions :deep(.select-menu),
  .pagination-actions :deep(.button) {
    width: 100%;
  }

  .cover-action {
    opacity: 1;
    transform: translateY(0);
  }

  .history-filters {
    grid-template-columns: 1fr;
  }

  .history-actions,
  .favorite-filter {
    width: 100%;
  }

  .mode-tabs {
    grid-template-columns: repeat(5, 92px);
  }

  .asset-filter-row {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .grid-history {
    grid-template-columns: 1fr;
  }
}

.skeleton-card {
  pointer-events: none;
}

.skeleton-block,
.skeleton-line,
.skeleton-pill {
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.8), rgba(255,255,255,0.9), rgba(226, 232, 240, 0.8));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-line {
  height: 14px;
  width: 72%;
  border-radius: 999px;
  margin-bottom: 10px;
}

.skeleton-line.wide {
  width: 92%;
}

.skeleton-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.skeleton-pill {
  width: 52px;
  height: 12px;
  border-radius: 999px;
}

.skeleton-pill.short {
  width: 80px;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
