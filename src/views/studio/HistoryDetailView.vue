<template>
  <div class="detail-shell">
    <div class="detail-hero">
      <div class="hero-left">
        <button type="button" class="hero-back" @click="goBack" aria-label="返回灵感记录">
          <ArrowLeftIcon :size="17" />
          <span>返回</span>
        </button>

        <div class="hero-copy">
          <div class="hero-title-row">
            <h1 class="hero-kicker">作品详情</h1>
            <div class="hero-meta" v-if="image">
              <span>{{ modeLabel }}</span>
              <span>{{ image.aspectRatio }}</span>
              <span>{{ formatTime(image.createdAt) }}</span>
            </div>
          </div>
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
          <div class="preview-action-bar" aria-label="图片操作">
            <div class="preview-action-group">
              <button type="button" class="preview-action primary" @click="reuse">
                <Wand2Icon :size="15" />
                <span>再次创作</span>
              </button>
              <button v-if="image?.imageUrls?.[0]" type="button" class="preview-action" @click="openEditor('inpaint')">
                <Wand2Icon :size="15" />
                <span>局部重绘</span>
              </button>
              <button v-if="image?.imageUrls?.[0]" type="button" class="preview-action" @click="openEditor('outpaint')">
                <ExpandIcon :size="15" />
                <span>扩图</span>
              </button>
              <button v-if="image?.imageUrls?.[0]" type="button" class="preview-action" @click="openUpscale">
                <SparklesIcon :size="15" />
                <span>高清增强</span>
              </button>
            </div>
            <div class="preview-action-group secondary">
              <button v-if="activeUrl" type="button" class="preview-action" @click="downloadActive">
                <DownloadIcon :size="15" />
                <span>下载</span>
              </button>
              <button v-if="image" type="button" class="preview-action danger" @click="remove">
                <Trash2Icon :size="15" />
                <span>{{ isDialogueDetail ? '删除对话' : '删除记录' }}</span>
              </button>
            </div>
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
            <div
              v-for="(round, index) in dialogueRounds"
              :key="round.key"
              class="chain-round"
              role="button"
              tabindex="0"
              :class="{ active: round.image?.id === image.id }"
              @click="selectDialogueRound(round)"
              @keydown.enter.prevent="selectDialogueRound(round)"
              @keydown.space.prevent="selectDialogueRound(round)"
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
                  <button type="button" class="chain-continue" @click.stop="continueFromRound(round)">
                    从此继续
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="chain-empty">暂无对话链记录</div>
        </div>

        <div class="meta-card">
          <div class="meta-head">
            <div class="meta-title">参数</div>
          </div>
          <div class="detail-list">
            <div class="detail-row">
              <span>模式</span>
              <strong>{{ modeLabel }}</strong>
            </div>
            <div class="detail-row">
              <span>操作</span>
              <strong>{{ operationLabel }}</strong>
            </div>
            <div class="detail-row">
              <span>比例</span>
              <strong>{{ image.aspectRatio }}</strong>
            </div>
            <div class="detail-row">
              <span>时间</span>
              <strong>{{ formatTime(image.createdAt) }}</strong>
            </div>
            <div v-for="row in generationParamRows" :key="row.key" class="detail-row">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
            <div class="detail-row id-row">
              <span>ID</span>
              <strong class="mono">{{ image.id }}</strong>
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
import { ArrowLeftIcon, CopyIcon, DownloadIcon, ExpandIcon, FolderOpenIcon, SparklesIcon, TagIcon, Trash2Icon, Wand2Icon } from 'lucide-vue-next'
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
  if (op === 'upscale') return '高清增强'
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
const generationParamRows = computed(() => {
  return generationParamLines.value.map((line) => {
    const [label, ...valueParts] = String(line).split('：')
    return {
      key: line,
      label,
      value: valueParts.join('：') || '-'
    }
  })
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

function openUpscale() {
  if (!image.value?.imageUrls?.[0]) return
  router.push({
    path: '/studio',
    query: {
      mode: 'tools',
      tool: 'upscale',
      input: encodeURIComponent(image.value.imageUrls[0]),
      sourceImageId: image.value.id,
      ratio: image.value.aspectRatio || '1:1'
    }
  })
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0 12px;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.hero-back {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(15, 23, 42, 0.62);
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  flex: 0 0 auto;
}

.hero-back:hover {
  color: rgba(15, 23, 42, 0.92);
}

.hero-copy {
  min-width: 0;
}

.hero-title-row {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.hero-kicker {
  margin: 0;
  color: rgba(15, 23, 42, 0.94);
  font-size: 17px;
  line-height: 1.2;
  font-weight: 900;
}

.hero-meta {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(100, 116, 139, 0.9);
  font-size: 12px;
  font-weight: 800;
}

.hero-meta span {
  min-width: 0;
  display: inline-flex;
  align-items: center;
}

.hero-meta span + span::before {
  content: "";
  width: 3px;
  height: 3px;
  margin-right: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.72);
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
  grid-template-columns: minmax(0, 1.42fr) minmax(320px, 0.88fr);
  gap: 16px;
  align-items: start;
  margin-top: 14px;
}

.preview-panel {
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255,255,255,0.76);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.64);
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
  font-size: 13px;
  font-weight: 900;
}

.preview-subtitle {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.segmented {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(14px);
}

.seg-btn {
  height: 28px;
  padding: 0 11px;
  border-radius: 9px;
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

.preview-stage {
  width: 100%;
  padding: 10px;
  background: rgba(248, 250, 252, 0.72);
}

.preview-frame {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
}

.preview-frame.result {
  height: min(58svh, 620px);
  width: auto;
  max-width: 100%;
}

.preview-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.fallback-cover {
  color: var(--muted);
  font-size: 14px;
}

.meta-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 12px;
}

.thumb-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.thumb-item {
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
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

.preview-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.preview-action-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.preview-action-group.secondary {
  justify-content: flex-end;
}

.preview-action {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.76);
  color: rgba(15, 23, 42, 0.76);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: border-color 0.18s, background-color 0.18s, color 0.18s, box-shadow 0.18s;
}

.preview-action:hover {
  border-color: rgba(99, 102, 241, 0.22);
  background: #ffffff;
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.preview-action.primary {
  color: #ffffff;
  border-color: transparent;
  background: var(--primary);
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.16);
}

.preview-action.danger {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.14);
  background: rgba(254, 242, 242, 0.64);
}

.preview-action.danger:hover {
  border-color: rgba(239, 68, 68, 0.28);
  background: #fef2f2;
  color: #991b1b;
}

.meta-card {
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255,255,255,0.76);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.035);
  padding: 13px;
}

.meta-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.meta-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-title {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.asset-lines {
  display: grid;
  gap: 8px;
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
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
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
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(248, 250, 252, 0.72);
  padding: 11px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.58;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}

.chain-count {
  height: 22px;
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
  gap: 8px;
  max-height: 330px;
  overflow: auto;
  padding-right: 2px;
}

.chain-round {
  width: 100%;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  gap: 9px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.66);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.chain-round:hover,
.chain-round.active {
  border-color: rgba(99, 102, 241, 0.28);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.chain-round:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.48);
  outline-offset: 2px;
}

.chain-round img,
.chain-thumb-empty {
  width: 50px;
  height: 50px;
  border-radius: 9px;
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
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.chain-round-prompt {
  color: var(--text);
  font-size: 12px;
  line-height: 1.42;
  font-weight: 700;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chain-round-params {
  margin-top: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chain-round-actions {
  display: flex;
  margin-top: 6px;
}

.chain-continue {
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.07);
  color: var(--primary);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.chain-continue:hover {
  background: rgba(99, 102, 241, 0.12);
}

.chain-empty {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.detail-list {
  display: grid;
  gap: 2px;
}

.detail-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: baseline;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.055);
}

.detail-row:last-child {
  border-bottom: 0;
}

.detail-row span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.detail-row strong {
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 850;
  word-break: break-word;
}

.detail-row.id-row strong {
  color: rgba(15, 23, 42, 0.62);
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

  .meta-panel {
    position: static;
  }

  .preview-frame.result {
    width: 100%;
    height: auto;
  }
}

@media (max-width: 560px) {
  .meta-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-left {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .hero-title-row {
    gap: 8px;
  }

  .hero-meta {
    flex-wrap: wrap;
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
  .preview-action-bar,
  .meta-actions {
    width: 100%;
  }

  .preview-action {
    flex: 1 1 120px;
  }

  .preview-action-group,
  .preview-action-group.secondary {
    width: 100%;
  }

  .seg-btn,
  .meta-actions :deep(.btn) {
    flex: 1 1 0;
  }

}
</style>
