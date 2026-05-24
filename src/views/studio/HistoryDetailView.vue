<template>
  <div class="detail-shell">
    <div class="detail-hero">
      <div class="hero-left">
        <Button variant="ghost" class="hero-back" @click="goBack">
          <template #icon>
            <ArrowLeftIcon :size="16" />
          </template>
          返回
        </Button>

        <div class="hero-copy">
          <div class="hero-kicker">作品详情</div>
          <div class="chips" v-if="image">
            <span class="chip chip-primary">{{ modeLabel }}</span>
            <span class="chip">{{ image.aspectRatio }}</span>
            <span class="chip chip-muted">{{ formatTime(image.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="image" class="hero-summary">
        <div class="summary-item">
          <span class="summary-label">操作</span>
          <strong>{{ operationLabel }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">图片</span>
          <strong>{{ image.imageUrls?.length || 0 }}</strong>
        </div>
      </div>
    </div>

    <div v-if="loading" class="state-shell">
      <div class="state-card">加载中...</div>
    </div>

    <div v-else-if="errorMsg" class="state-shell">
      <div class="state-card error">{{ errorMsg }}</div>
    </div>

    <div v-else-if="image" class="detail-grid">
      <section class="preview-panel" aria-label="图片预览">
        <div class="preview-topbar">
          <div class="preview-context">
            <div class="preview-title-block">
              <div class="preview-title">{{ tabLabel }}</div>
              <div class="preview-subtitle">
                {{ currentGallery.length > 1 ? `${currentIndex + 1} / ${currentGallery.length}` : operationLabel }}
              </div>
            </div>
            <div class="segmented" v-if="hasInput">
              <button type="button" class="seg-btn" :class="{ active: tab === 'result' }" @click="tab = 'result'">结果</button>
              <button type="button" class="seg-btn" :class="{ active: tab === 'input' }" @click="tab = 'input'">参考</button>
            </div>
          </div>
          <div class="preview-toolbar" aria-label="图片操作">
            <button type="button" class="toolbar-primary" @click="reuse">
              <Wand2Icon :size="15" />
              <span>再次创作</span>
            </button>
            <button v-if="image?.imageUrls?.[0]" type="button" class="icon-action" title="局部重绘" aria-label="局部重绘" @click="openEditor('inpaint')">
              <Wand2Icon :size="15" />
            </button>
            <button v-if="image?.imageUrls?.[0]" type="button" class="icon-action" title="扩图" aria-label="扩图" @click="openEditor('outpaint')">
              <ExpandIcon :size="15" />
            </button>
            <button v-if="activeUrl" type="button" class="icon-action" :title="`下载${tabLabel}`" :aria-label="`下载${tabLabel}`" @click="downloadActive">
              <DownloadIcon :size="15" />
            </button>
            <button v-if="image" type="button" class="icon-action danger" :title="isDialogueDetail ? '删除对话' : '删除记录'" :aria-label="isDialogueDetail ? '删除对话' : '删除记录'" @click="remove">
              <Trash2Icon :size="15" />
            </button>
          </div>
        </div>

        <div class="preview-stage">
          <div class="preview-frame" :class="{ result: tab === 'result' }" :style="{ aspectRatio: previewAspect }">
            <img v-if="activeUrl" :src="activeUrl" :alt="tabLabel" />
            <div v-else class="fallback-cover">无图片</div>
          </div>
          <div v-if="currentGallery.length > 1" class="thumb-strip">
            <button
              v-for="(url, index) in currentGallery"
              :key="`${tab}-${url}-${index}`"
              type="button"
              class="thumb-item"
              :class="{ active: currentIndex === index }"
              @click="currentIndex = index"
            >
              <img :src="url" :alt="`${tabLabel} ${index + 1}`" />
            </button>
          </div>
        </div>
      </section>

      <aside class="meta-panel" aria-label="记录信息">
        <div class="meta-card">
          <div class="meta-head">
            <div class="meta-title">提示词</div>
            <div class="meta-actions">
              <Button variant="ghost" size="xs" @click="copyParams">
                <template #icon>
                  <CopyIcon :size="14" />
                </template>
                复制参数
              </Button>
              <Button variant="ghost" size="xs" @click="copyPrompt">
                <template #icon>
                  <CopyIcon :size="14" />
                </template>
                复制
              </Button>
            </div>
          </div>
          <div class="prompt-box">{{ image.prompt }}</div>
        </div>

        <div v-if="image.folder || image.tags?.length" class="meta-card">
          <div class="meta-head">
            <div class="meta-title">整理信息</div>
          </div>
          <div class="asset-lines">
            <div v-if="image.folder" class="asset-line">
              <FolderOpenIcon :size="15" />
              <span class="asset-chip folder">{{ image.folder }}</span>
            </div>
            <div v-if="image.tags?.length" class="asset-line">
              <TagIcon :size="15" />
              <span v-for="tag in image.tags" :key="tag" class="asset-chip">{{ tag }}</span>
            </div>
          </div>
        </div>

        <div v-if="isDialogueDetail" class="meta-card">
          <div class="meta-head">
            <div class="meta-title">对话链</div>
            <div class="chain-count">{{ dialogueRounds.length }} 轮</div>
          </div>
          <div v-if="dialogueRounds.length" class="chain-list">
            <button
              v-for="(round, index) in dialogueRounds"
              :key="round.key"
              type="button"
              class="chain-round"
              :class="{ active: round.image?.id === image.id }"
              @click="selectDialogueRound(round)"
            >
              <img v-if="round.coverUrl" :src="round.coverUrl" :alt="`第 ${index + 1} 轮`" />
              <div v-else class="chain-thumb-empty">{{ index + 1 }}</div>
              <div class="chain-round-body">
                <div class="chain-round-meta">
                  <span>第 {{ index + 1 }} 轮</span>
                  <span>{{ formatTime(round.createdAt) }}</span>
                </div>
                <div class="chain-round-prompt">{{ round.prompt }}</div>
                <div v-if="round.paramSummary" class="chain-round-params">{{ round.paramSummary }}</div>
                <div class="chain-round-actions">
                  <span>查看</span>
                  <span @click.stop="continueFromRound(round)">从此继续</span>
                </div>
              </div>
            </button>
          </div>
          <div v-else class="chain-empty">暂无对话链记录</div>
        </div>

        <div class="meta-card">
          <div class="kv-grid">
            <div class="kv">
              <div class="kv-label">模式</div>
              <div class="kv-value">{{ modeLabel }}</div>
            </div>
            <div class="kv">
              <div class="kv-label">比例</div>
              <div class="kv-value">{{ image.aspectRatio }}</div>
            </div>
            <div class="kv">
              <div class="kv-label">时间</div>
              <div class="kv-value">{{ formatTime(image.createdAt) }}</div>
            </div>
            <div class="kv">
              <div class="kv-label">操作</div>
              <div class="kv-value">{{ operationLabel }}</div>
            </div>
            <div class="kv">
              <div class="kv-label">ID</div>
              <div class="kv-value mono">{{ image.id }}</div>
            </div>
          </div>
        </div>

        <div v-if="image.sourceImageId" class="meta-card">
          <div class="meta-head">
            <div class="meta-title">编辑链路</div>
          </div>
          <div class="source-box">
            <div class="source-line">
              <span class="source-label">来源图片</span>
              <button type="button" class="source-link" @click="openSourceImage">
                查看来源图
              </button>
            </div>
            <div class="source-id mono">{{ image.sourceImageId }}</div>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <ImageEditModal
    v-model:open="editorOpen"
    :source-url="image?.imageUrls?.[0] || ''"
    :source-image-id="image?.id || ''"
    :source-prompt="image?.prompt || ''"
    :aspect-ratio="image?.aspectRatio || '1:1'"
    :initial-mode="editorInitialMode"
    @completed="handleEditorCompleted"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, CopyIcon, DownloadIcon, ExpandIcon, FolderOpenIcon, TagIcon, Trash2Icon, Wand2Icon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { Button, toastError, toastSuccess } from '../../components/common'
import ImageEditModal from '../../components/studio/ImageEditModal.vue'

const route = useRoute()
const router = useRouter()
const imagesStore = useImagesStore()

const loading = ref(true)
const errorMsg = ref('')
const image = ref(null)
const dialogueChain = ref({
  chainId: '',
  images: [],
  messages: []
})
const tab = ref('result')
const currentIndex = ref(0)
const editorOpen = ref(false)
const editorInitialMode = ref('inpaint')

const hasInput = computed(() => !!image.value?.inputImageUrls?.[0])
const tabLabel = computed(() => (tab.value === 'input' ? '参考图' : '结果图'))
const currentGallery = computed(() => {
  if (!image.value) return []
  return tab.value === 'input'
    ? (image.value.inputImageUrls || []).filter(Boolean)
    : (image.value.imageUrls || []).filter(Boolean)
})
const activeUrl = computed(() => {
  return currentGallery.value[currentIndex.value] || ''
})
const isDialogueDetail = computed(() => image.value?.mode === 'dialogue' || image.value?.mode === 'continuous')
const dialogueImageById = computed(() => {
  const map = new Map()
  for (const item of dialogueChain.value.images || []) {
    map.set(String(item.id), item)
  }
  return map
})
const dialogueRounds = computed(() => {
  const messages = Array.isArray(dialogueChain.value.messages) ? dialogueChain.value.messages : []
  if (messages.length) {
    return messages.map((message) => {
      const roundImage = dialogueImageById.value.get(String(message.imageId || '')) || null
      return {
        key: message.id || message.imageId,
        image: roundImage,
        prompt: message.prompt || roundImage?.prompt || '',
        createdAt: message.createdAt || roundImage?.createdAt || '',
        coverUrl: roundImage?.imageUrls?.[0] || '',
        paramSummary: paramSummaryForImage(roundImage)
      }
    })
  }
  return (dialogueChain.value.images || []).map((roundImage) => ({
    key: roundImage.id,
    image: roundImage,
    prompt: roundImage.prompt || '',
    createdAt: roundImage.createdAt || '',
    coverUrl: roundImage.imageUrls?.[0] || '',
    paramSummary: paramSummaryForImage(roundImage)
  }))
})

const previewAspect = computed(() => {
  const ratio = image.value?.aspectRatio || '1:1'
  if (ratio === '16:9') return '16 / 9'
  if (ratio === '9:16') return '9 / 16'
  if (ratio === '4:3') return '4 / 3'
  if (ratio === '3:4') return '3 / 4'
  return '1 / 1'
})

const modeLabel = computed(() => {
  if (image.value?.mode === 'dialogue' || image.value?.mode === 'continuous') return '对话创作'
  if (image.value?.mode === 'tools') return '图片工具'
  if (image.value?.mode === 'image') return '图生图'
  return '文生图'
})

const operationLabel = computed(() => {
  const op = image.value?.operationType || (image.value?.mode === 'image' ? 'image_to_image' : 'generate')
  if (op === 'inpaint') return '局部重绘'
  if (op === 'outpaint') return '扩图'
  if (op === 'cutout') return '抠图'
  if (op === 'dialogue') return '对话创作'
  if (op === 'continuous') return '对话创作'
  if (op === 'image_to_image') return '图生图'
  return '生成'
})
const generationParamLines = computed(() => {
  const params = image.value?.generationParams && typeof image.value.generationParams === 'object'
    ? image.value.generationParams
    : {}
  const labels = {
    qualityTier: '质量',
    count: '张数',
    outputFormat: '格式',
    outputCompression: '压缩率',
    background: '背景',
    moderation: '审核',
    size: '尺寸',
    quality: '质量',
    operationType: '工具'
  }
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${labels[key] || key}：${value}`)
})

onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await imagesStore.fetchImage(route.params.id)
    image.value = data?.image || null
    if (isDialogueDetail.value) {
      dialogueChain.value = await imagesStore.fetchDialogueChain({
        chainId: image.value?.continuationChainId || '',
        imageId: image.value?.id || ''
      })
    } else {
      dialogueChain.value = { chainId: '', images: [], messages: [] }
    }
    currentIndex.value = 0
    tab.value = hasInput.value ? 'result' : 'result'
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})

function goBack() {
  router.push('/studio/history')
}

function reuse() {
  if (!image.value) return
  if (image.value.mode === 'dialogue' || image.value.mode === 'continuous') {
    router.push({ path: '/studio', query: { mode: 'dialogue', imageId: image.value.id } })
    return
  }
  if (image.value.mode === 'tools') {
    router.push({ path: '/studio', query: { mode: 'tools' } })
    return
  }
  if (image.value.mode === 'image' && image.value.inputImageUrls?.[0]) {
    router.push({
      path: '/studio',
      query: {
        ...reuseQueryForImage(image.value, 'image'),
        mode: 'image',
        input: encodeURIComponent(image.value.inputImageUrls[0])
      }
    })
    return
  }
  router.push({ path: '/studio', query: reuseQueryForImage(image.value, 'text') })
}

function reuseQueryForImage(source, mode = 'text') {
  const params = source?.generationParams && typeof source.generationParams === 'object'
    ? source.generationParams
    : {}
  const query = {
    mode,
    prompt: source?.prompt || '',
    ratio: source?.aspectRatio || '1:1'
  }
  for (const key of ['qualityTier', 'count', 'outputFormat', 'outputCompression', 'background', 'moderation']) {
    if (params[key] !== undefined && params[key] !== '') {
      query[key] = String(params[key])
    }
  }
  return query
}

function paramSummaryForImage(source) {
  const params = source?.generationParams && typeof source.generationParams === 'object'
    ? source.generationParams
    : {}
  const parts = [
    source?.aspectRatio,
    params.qualityTier,
    params.count ? `${params.count}张` : '',
    params.outputFormat ? String(params.outputFormat).toUpperCase() : ''
  ].filter(Boolean)
  return parts.join(' · ')
}

function continueFromRound(round) {
  if (!round?.image?.id) return
  router.push({ path: '/studio', query: { mode: 'dialogue', imageId: round.image.id } })
}

function resetGalleryIndex() {
  currentIndex.value = 0
}

function openEditor(nextMode) {
  editorInitialMode.value = nextMode
  editorOpen.value = true
}

function selectDialogueRound(round) {
  if (!round?.image) return
  image.value = round.image
  currentIndex.value = 0
  tab.value = round.image.inputImageUrls?.[0] ? 'result' : 'result'
}

function handleEditorCompleted(nextImage) {
  if (!nextImage?.id) return
  router.push({ path: `/studio/history/${nextImage.id}` })
}

function openSourceImage() {
  if (!image.value?.sourceImageId) return
  router.push({ path: `/studio/history/${image.value.sourceImageId}` })
}

async function remove() {
  if (!image.value?.id) return
  const ok = window.confirm(isDialogueDetail.value ? '确定删除整条对话记录吗？该操作不可撤销。' : '确定删除这条记录吗？')
  if (!ok) return
  if (isDialogueDetail.value && image.value.continuationChainId) {
    await imagesStore.deleteDialogueChain(image.value.continuationChainId)
  } else {
    await imagesStore.deleteImage(image.value.id)
  }
  router.push('/studio/history')
}

watch(tab, () => {
  resetGalleryIndex()
})

function downloadName() {
  const date = new Date(image.value?.createdAt || Date.now()).toISOString().slice(0, 10)
  const suffix = tab.value === 'input' ? 'input' : 'result'
  return `hi-image-${date}-${suffix}-${image.value?.id || Date.now()}.png`
}

function triggerDownload(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadActive() {
  const url = activeUrl.value
  if (!url) return

  if (url.startsWith('data:')) {
    triggerDownload(url, downloadName())
    return
  }

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, downloadName())
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function formatTime(val) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(val))
}

async function copyPrompt() {
  const text = String(image.value?.prompt || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('已复制提示词')
  } catch {
    toastError('复制失败')
  }
}

async function copyParams() {
  if (!image.value) return
  const lines = [
    `提示词：${image.value.prompt || ''}`,
    `模式：${modeLabel.value}`,
    `比例：${image.value.aspectRatio || '1:1'}`,
    `操作：${operationLabel.value}`,
    ...generationParamLines.value,
    `结果图：${(image.value.imageUrls || []).filter(Boolean).join(', ')}`,
    `参考图：${(image.value.inputImageUrls || []).filter(Boolean).join(', ')}`
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    toastSuccess('已复制参数')
  } catch {
    toastError('复制失败')
  }
}
</script>

<style scoped>
.detail-shell {
  padding: 0;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px 14px;
  border-radius: calc(var(--radius-md) + 8px);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
}

.hero-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.hero-back {
  height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  flex: 0 0 auto;
}

.hero-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-kicker {
  color: rgba(15, 23, 42, 0.92);
  font-size: 15px;
  font-weight: 900;
}

.chips {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.chip {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.72);
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
}

.chip-primary {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.22);
  background: var(--gradient-subtle);
}

.chip-muted {
  color: var(--muted);
}

.hero-summary {
  display: flex;
  align-items: stretch;
  gap: 8px;
  flex: 0 0 auto;
}

.summary-item {
  min-width: 96px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.86);
}

.summary-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.summary-item strong {
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.state-shell {
  height: 360px;
  display: grid;
  place-items: center;
  margin-top: 18px;
}

.state-card {
  width: min(520px, 100%);
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.8);
  color: var(--muted);
  text-align: center;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.state-card.error {
  border-color: rgba(236, 72, 153, 0.25);
  color: var(--accent);
  background: rgba(236, 72, 153, 0.06);
}

.source-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.source-label {
  font-size: 13px;
  font-weight: 850;
  color: var(--muted);
}

.source-link {
  border: none;
  background: transparent;
  color: var(--primary);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  padding: 0;
}

.source-id {
  font-size: 12px;
  color: var(--text);
  word-break: break-all;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 22px;
  align-items: start;
  margin-top: 18px;
}

.preview-panel {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(255,255,255,0.72);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(18px);
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.58);
}

.preview-context {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.preview-title-block {
  min-width: 0;
}

.preview-title {
  color: rgba(15, 23, 42, 0.92);
  font-size: 14px;
  font-weight: 900;
}

.preview-subtitle {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.segmented {
  display: flex;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(14px);
}

.seg-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.seg-btn.active {
  color: var(--primary);
  background: var(--gradient-subtle);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.14);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
}

.toolbar-primary,
.icon-action {
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.18s, background-color 0.18s, color 0.18s, box-shadow 0.18s;
}

.toolbar-primary {
  gap: 7px;
  padding: 0 12px;
  color: #ffffff;
  border-color: transparent;
  background: var(--primary);
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.16);
}

.icon-action {
  width: 34px;
  color: rgba(15, 23, 42, 0.68);
}

.toolbar-primary:hover,
.icon-action:hover {
  border-color: rgba(99, 102, 241, 0.24);
  background: #ffffff;
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.toolbar-primary:hover {
  background: var(--primary);
  color: #ffffff;
}

.icon-action.danger {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.14);
  background: rgba(254, 242, 242, 0.62);
}

.icon-action.danger:hover {
  border-color: rgba(239, 68, 68, 0.28);
  background: #fef2f2;
  color: #991b1b;
}

.preview-stage {
  width: 100%;
  padding: 12px;
  background:
    radial-gradient(900px 360px at 25% 0%, rgba(99, 102, 241, 0.10), transparent 55%),
    radial-gradient(800px 340px at 90% 20%, rgba(236, 72, 153, 0.08), transparent 55%),
    var(--bg-subtle);
}

.preview-frame {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.55));
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10);
}

.preview-frame.result {
  height: min(62svh, 680px);
  width: auto;
  max-width: 100%;
}

.preview-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 8px;
}

.fallback-cover {
  color: var(--muted);
  font-size: 14px;
}

.meta-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 16px;
}

.thumb-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
}

.thumb-item {
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.72);
}

.thumb-item.active {
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 10px 26px rgba(99, 102, 241, 0.12);
}

.thumb-item img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.meta-card {
  border-radius: var(--radius-md);
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.75);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
  padding: 16px;
  backdrop-filter: blur(18px);
}

.meta-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-title {
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}

.asset-lines {
  display: grid;
  gap: 10px;
}

.asset-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

.asset-line svg {
  flex: 0 0 auto;
}

.asset-chip {
  max-width: 100%;
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(99, 102, 241, 0.06);
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-chip.folder {
  color: #0369a1;
  border-color: rgba(14, 165, 233, 0.16);
  background: rgba(240, 249, 255, 0.8);
}

.prompt-box {
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(99, 102, 241, 0.03);
  padding: 12px 12px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
}

.chain-count {
  height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--primary);
  font-size: 11px;
  font-weight: 900;
}

.chain-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
  padding-right: 2px;
}

.chain-round {
  width: 100%;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 10px;
  padding: 9px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.62);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.chain-round:hover,
.chain-round.active {
  border-color: rgba(99, 102, 241, 0.28);
  background: rgba(99, 102, 241, 0.05);
}

.chain-round img,
.chain-thumb-empty {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(15, 23, 42, 0.05);
}

.chain-thumb-empty {
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
}

.chain-round-body {
  min-width: 0;
}

.chain-round-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.chain-round-prompt {
  color: var(--text);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 700;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chain-round-params {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chain-round-actions {
  display: flex;
  gap: 10px;
  margin-top: 7px;
  color: var(--primary);
  font-size: 11px;
  font-weight: 900;
}

.chain-round-actions span {
  cursor: pointer;
}

.chain-empty {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.kv {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255,255,255,0.6);
  padding: 12px;
}

.kv-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  margin-bottom: 6px;
}

.kv-value {
  font-size: 14px;
  color: var(--text);
  word-break: break-word;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}

@media (max-width: 980px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-hero {
    flex-direction: column;
  }

  .hero-summary {
    width: 100%;
  }

  .summary-item {
    flex: 1 1 0;
  }

  .meta-panel {
    position: static;
  }

  .preview-frame.result {
    width: 100%;
    height: auto;
  }
}

@media (max-width: 560px) {
  .hero-left,
  .meta-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .preview-topbar {
    align-items: stretch;
    flex-direction: column;
  }

  .preview-context {
    align-items: flex-start;
    flex-direction: column;
  }

  .segmented,
  .preview-toolbar,
  .meta-actions {
    width: 100%;
  }

  .preview-toolbar {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .toolbar-primary {
    flex: 1 1 150px;
  }

  .seg-btn,
  .meta-actions :deep(.btn) {
    flex: 1 1 0;
  }

  .hero-summary,
  .kv-grid {
    grid-template-columns: 1fr;
  }

  .hero-summary {
    display: grid;
  }

}
</style>
