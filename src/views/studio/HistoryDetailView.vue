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
                <span>生成变体</span>
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
              <button v-if="activeUrl" type="button" class="preview-action" :disabled="describeLoading" @click="describeActiveImage">
                <SparklesIcon v-if="!describeLoading" :size="15" />
                <LoaderIcon v-else :size="15" class="loading-icon" />
                <span>{{ describeLoading ? '反推中...' : '反推提示词' }}</span>
              </button>
              <button v-if="image?.imageUrls?.[0]" type="button" class="preview-action" @click="openStyleBoardModal">
                <PanelsTopLeftIcon :size="15" />
                <span>加入风格板</span>
              </button>
            </div>
            <div class="preview-action-group secondary">
              <button v-if="image" type="button" class="preview-action" @click="openFeedbackPanel">
                <component :is="feedbackActionIcon" :size="15" />
                <span>{{ feedbackActionLabel }}</span>
              </button>
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

        <div v-if="describePrompt || describeLoading || describeError" class="meta-card">
          <div class="meta-head">
            <div class="meta-title">反推提示词</div>
            <div class="meta-actions">
              <Button variant="ghost" size="xs" :disabled="describeLoading || !describePrompt" @click="copyDescribePrompt">
                <template #icon>
                  <CopyIcon :size="14" />
                </template>
                复制
              </Button>
              <Button variant="ghost" size="xs" :disabled="describeLoading || !describePrompt" @click="useDescribePrompt">
                <template #icon>
                  <Wand2Icon :size="14" />
                </template>
                带入工作台
              </Button>
            </div>
          </div>
          <div v-if="describeBilling" class="billing-note">{{ describeBilling }}</div>
          <div v-if="describeError" class="describe-error">{{ describeError }}</div>
          <div v-if="describeLoading" class="describe-loading">
            <LoaderIcon :size="16" class="loading-icon" />
            <span>正在从图片生成可编辑提示词...</span>
          </div>
          <textarea
            v-else
            v-model="describePrompt"
            class="describe-textarea"
            placeholder="反推结果会显示在这里"
          ></textarea>
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

        <div v-if="hasVariantContext" class="meta-card variant-card">
          <div class="meta-head">
            <div class="meta-title">变体对比</div>
            <div class="chain-count">{{ variantCountLabel }}</div>
          </div>
          <div v-if="sourceImage" class="compare-pair">
            <button type="button" class="compare-tile" @click="openImage(sourceImage.id)">
              <img v-if="sourceImage.imageUrls?.[0]" :src="sourceImage.imageUrls[0]" alt="来源图" />
              <div v-else class="compare-empty">来源</div>
              <span>来源图</span>
            </button>
            <button type="button" class="compare-tile current">
              <img v-if="image.imageUrls?.[0]" :src="image.imageUrls[0]" alt="当前图" />
              <div v-else class="compare-empty">当前</div>
              <span>当前图</span>
            </button>
          </div>
          <div class="compare-diff-list">
            <div v-for="row in variantDiffRows" :key="row.key" class="compare-diff-row">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
          <div v-if="variants.length" class="variant-list">
            <button
              v-for="item in variants"
              :key="item.id"
              type="button"
              class="variant-item"
              @click="openImage(item.id)"
            >
              <img v-if="item.imageUrls?.[0]" :src="item.imageUrls[0]" :alt="item.prompt || '变体'" />
              <div class="variant-info">
                <span>{{ item.prompt || '未命名变体' }}</span>
                <small>{{ paramSummaryForImage(item) || formatTime(item.createdAt) }}</small>
              </div>
            </button>
          </div>
          <div class="variant-actions">
            <Button size="xs" @click="reuse">
              <template #icon>
                <Wand2Icon :size="14" />
              </template>
              继续生成变体
            </Button>
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

  <Modal v-model:open="styleBoardModalOpen" title="加入风格板" size="md">
    <div class="style-board-form">
      <div class="style-board-preview">
        <img v-if="image?.imageUrls?.[0]" :src="image.imageUrls[0]" alt="风格参考图" />
        <div>
          <div class="style-board-form-title">保存为项目参考图</div>
          <div class="style-board-form-sub">加入后不会自动影响生成，只有在工作台手动选择该风格板时才参与本次创作。</div>
        </div>
      </div>
      <label class="style-board-field">
        <span>选择已有风格板</span>
        <SelectMenu
          v-model="styleBoardTargetId"
          :options="styleBoardOptions"
          placeholder="选择风格板"
          size="sm"
        />
      </label>
      <label class="style-board-field">
        <span>或新建风格板</span>
        <Input v-model="styleBoardNewName" placeholder="例如：新品电商冷白光" />
      </label>
    </div>
    <template #footer>
      <div class="style-board-modal-actions">
        <Button variant="ghost" :disabled="styleBoardSaving" @click="styleBoardModalOpen = false">取消</Button>
        <Button :disabled="styleBoardSaving" @click="saveToStyleBoard">
          {{ styleBoardSaving ? '加入中...' : '加入' }}
        </Button>
      </div>
    </template>
  </Modal>

  <Modal v-model:open="feedbackPanelOpen" title="结果反馈" size="md">
    <div class="feedback-modal">
      <div class="feedback-modal-head">
        <div class="feedback-modal-title">这张结果是否可用？</div>
        <div v-if="feedbackSavedAt" class="feedback-saved">已保存 {{ formatTime(feedbackSavedAt) }}</div>
      </div>
      <div class="feedback-rating" aria-label="结果评分">
        <button
          type="button"
          class="feedback-choice"
          :class="{ active: feedbackForm.rating === 'like' }"
          @click="setFeedbackRating('like')"
        >
          <ThumbsUpIcon :size="15" />
          <span>满意</span>
        </button>
        <button
          type="button"
          class="feedback-choice"
          :class="{ active: feedbackForm.rating === 'dislike' }"
          @click="setFeedbackRating('dislike')"
        >
          <ThumbsDownIcon :size="15" />
          <span>不满意</span>
        </button>
      </div>
      <label class="feedback-field">
        <span>问题类型</span>
        <SelectMenu v-model="feedbackForm.issueType" :options="feedbackIssueOptions" placeholder="无明显问题" size="sm" />
      </label>
      <label class="feedback-field">
        <span>备注</span>
        <textarea
          v-model="feedbackForm.note"
          class="feedback-note"
          maxlength="500"
          placeholder="可记录失败原因、想要的修改方向"
        ></textarea>
      </label>
    </div>
    <template #footer>
      <div class="feedback-actions">
        <Button variant="ghost" size="sm" :disabled="feedbackSaving || !hasFeedbackDraft" @click="clearFeedback">
          清空
        </Button>
        <Button size="sm" :disabled="feedbackSaving" @click="saveFeedback">
          {{ feedbackSaving ? '保存中...' : '保存反馈' }}
        </Button>
      </div>
    </template>
  </Modal>

</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, CopyIcon, DownloadIcon, ExpandIcon, FolderOpenIcon, LoaderIcon, MessageSquareIcon, PanelsTopLeftIcon, SparklesIcon, TagIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon, Wand2Icon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { useAuthStore } from '../../stores/auth'
import { useStyleBoardsStore } from '../../stores/styleBoards'
import { apiFetch } from '../../utils/api'
import { Button, Input, Modal, SelectMenu, confirmDanger, toastError, toastSuccess } from '../../components/common'
import ImageEditModal from '../../components/studio/ImageEditModal.vue'

const route = useRoute()
const router = useRouter()
const imagesStore = useImagesStore()
const authStore = useAuthStore()
const styleBoardsStore = useStyleBoardsStore()

const loading = ref(true)
const errorMsg = ref('')
const image = ref(null)
const sourceImage = ref(null)
const variants = ref([])
const dialogueChain = ref({
  chainId: '',
  images: [],
  messages: []
})
const tab = ref('result')
const currentIndex = ref(0)
const editorOpen = ref(false)
const editorInitialMode = ref('inpaint')
const describeLoading = ref(false)
const describeError = ref('')
const describePrompt = ref('')
const describeBilling = ref('')
const styleBoardModalOpen = ref(false)
const styleBoardSaving = ref(false)
const styleBoardTargetId = ref('')
const styleBoardNewName = ref('')
const feedbackPanelOpen = ref(false)
const feedbackSaving = ref(false)
const feedbackForm = ref({
  rating: 'none',
  issueType: '',
  note: ''
})

const feedbackIssueOptions = [
  { label: '画质/细节不好', value: 'bad_quality' },
  { label: '主体不符合', value: 'wrong_subject' },
  { label: '文字错误', value: 'bad_text' },
  { label: '构图问题', value: 'composition' },
  { label: '内容不合规', value: 'unsafe' },
  { label: '其他', value: 'other' }
]

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
const hasVariantContext = computed(() => Boolean(sourceImage.value || variants.value.length))
const variantCountLabel = computed(() => {
  const parts = []
  if (sourceImage.value) parts.push('有来源')
  if (variants.value.length) parts.push(`${variants.value.length} 个派生`)
  return parts.join(' · ') || '无变体'
})
const variantDiffRows = computed(() => {
  const base = sourceImage.value
  if (!base || !image.value) return [
    { key: 'current', label: '当前参数', value: paramSummaryForImage(image.value) || '无参数记录' }
  ]
  const rows = []
  const currentParams = image.value.generationParams || {}
  const baseParams = base.generationParams || {}
  if (base.prompt !== image.value.prompt) {
    rows.push({ key: 'prompt', label: '提示词', value: '已调整' })
  }
  if (base.aspectRatio !== image.value.aspectRatio) {
    rows.push({ key: 'ratio', label: '比例', value: `${base.aspectRatio || '-'} -> ${image.value.aspectRatio || '-'}` })
  }
  for (const key of ['qualityTier', 'count', 'outputFormat', 'background', 'moderation']) {
    if (String(baseParams[key] ?? '') !== String(currentParams[key] ?? '')) {
      rows.push({
        key,
        label: paramLabel(key),
        value: `${baseParams[key] ?? '-'} -> ${currentParams[key] ?? '-'}`
      })
    }
  }
  return rows.length ? rows : [{ key: 'same', label: '参数差异', value: '与来源记录基本一致' }]
})
const styleBoardOptions = computed(() => {
  return styleBoardsStore.boards.map((board) => ({
    label: `${board.name}${board.refs.length ? ` · ${board.refs.length}图` : ''}`,
    value: board.id
  }))
})
const hasFeedbackDraft = computed(() => {
  return feedbackForm.value.rating !== 'none' ||
    Boolean(feedbackForm.value.issueType) ||
    Boolean(String(feedbackForm.value.note || '').trim())
})
const feedbackSavedAt = computed(() => image.value?.feedback?.updatedAt || image.value?.feedback?.createdAt || '')
const hasSavedFeedback = computed(() => {
  const feedback = image.value?.feedback
  return feedback?.rating === 'like' ||
    feedback?.rating === 'dislike' ||
    Boolean(feedback?.issueType) ||
    Boolean(String(feedback?.note || '').trim())
})
const feedbackActionLabel = computed(() => hasSavedFeedback.value ? '已反馈' : '反馈')
const feedbackActionIcon = computed(() => {
  if (feedbackForm.value.rating === 'like') return ThumbsUpIcon
  if (feedbackForm.value.rating === 'dislike') return ThumbsDownIcon
  return MessageSquareIcon
})

onMounted(() => {
  loadDetail(route.params.id)
})

watch(() => route.params.id, (id) => {
  loadDetail(id)
})

async function loadDetail(id) {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await imagesStore.fetchImage(id)
    image.value = data?.image || null
    syncFeedbackForm(image.value?.feedback)
    sourceImage.value = data?.sourceImage || null
    variants.value = Array.isArray(data?.variants) ? data.variants : []
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
    await styleBoardsStore.fetchBoards()
  } catch (e) {
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/studio/history')
}

function syncFeedbackForm(feedback) {
  feedbackForm.value = {
    rating: feedback?.rating === 'like' || feedback?.rating === 'dislike'
      ? feedback.rating
      : 'none',
    issueType: String(feedback?.issueType || ''),
    note: String(feedback?.note || '')
  }
}

function setFeedbackRating(rating) {
  feedbackForm.value.rating = feedbackForm.value.rating === rating ? 'none' : rating
}

function openFeedbackPanel() {
  feedbackPanelOpen.value = true
}

async function saveFeedback() {
  if (!image.value?.id) return
  feedbackSaving.value = true
  try {
    const feedback = await imagesStore.updateImageFeedback(image.value.id, {
      rating: feedbackForm.value.rating,
      issueType: feedbackForm.value.issueType,
      note: feedbackForm.value.note
    })
    image.value = {
      ...image.value,
      feedback
    }
    syncFeedbackForm(feedback)
    feedbackPanelOpen.value = false
    toastSuccess('反馈已保存')
  } catch (error) {
    toastError(error.message || '反馈保存失败')
  } finally {
    feedbackSaving.value = false
  }
}

async function clearFeedback() {
  feedbackForm.value = { rating: 'none', issueType: '', note: '' }
  await saveFeedback()
}

async function openStyleBoardModal() {
  await styleBoardsStore.fetchBoards()
  styleBoardTargetId.value = styleBoardsStore.boards[0]?.id || ''
  styleBoardNewName.value = ''
  styleBoardModalOpen.value = true
}

function reuse() {
  if (!image.value) return
  if (image.value.mode === 'dialogue' || image.value.mode === 'continuous') {
    router.push({ path: '/studio/dialogue', query: { imageId: image.value.id } })
    return
  }
  const input = variantInputUrl(image.value)
  if (input) {
    router.push({
      path: '/studio',
      query: {
        ...reuseQueryForImage(image.value, 'image'),
        input: encodeURIComponent(input),
        sourceImageId: image.value.id
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

function variantInputUrl(source) {
  return source?.imageUrls?.[0] || ''
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

function paramLabel(key) {
  const labels = {
    qualityTier: '质量',
    count: '张数',
    outputFormat: '格式',
    background: '背景',
    moderation: '审核'
  }
  return labels[key] || key
}

function openImage(id) {
  if (!id) return
  router.push({ path: `/studio/history/${id}` })
}

function continueFromRound(round) {
  if (!round?.image?.id) return
  router.push({ path: '/studio/dialogue', query: { imageId: round.image.id } })
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

async function describeActiveImage() {
  const imageUrl = activeUrl.value
  if (!imageUrl || describeLoading.value) return
  describeLoading.value = true
  describeError.value = ''
  describeBilling.value = ''
  try {
    const data = await apiFetch('/api/prompts/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        sourcePrompt: image.value?.prompt || ''
      })
    })
    describePrompt.value = String(data?.prompt || '').trim()
    describeBilling.value = data?.billingPolicy
      ? `${data.billingPolicy}${Number.isFinite(Number(data?.cost)) ? `（本次 ${Number(data.cost)} 点）` : ''}`
      : ''
    await authStore.refreshUser()
    toastSuccess('已生成反推提示词')
  } catch (e) {
    describeError.value = e.message || '反推提示词失败'
  } finally {
    describeLoading.value = false
  }
}

async function copyDescribePrompt() {
  const text = String(describePrompt.value || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('已复制反推提示词')
  } catch {
    toastError('复制失败')
  }
}

function useDescribePrompt() {
  const prompt = String(describePrompt.value || '').trim()
  if (!prompt) return
  router.push({
    path: '/studio',
    query: {
      mode: 'text',
      prompt,
      ratio: image.value?.aspectRatio || '1:1'
    }
  })
}

async function saveToStyleBoard() {
  if (!image.value?.id) return
  styleBoardSaving.value = true
  try {
    let boardId = styleBoardTargetId.value
    const newName = String(styleBoardNewName.value || '').trim()
    if (newName) {
      const board = await styleBoardsStore.createBoard({
        name: newName,
        description: image.value.prompt || ''
      })
      boardId = board?.id || ''
    }
    if (!boardId) {
      throw new Error('请选择或新建一个风格板')
    }
    await styleBoardsStore.addRefFromImage(boardId, image.value.id, image.value.prompt || '')
    toastSuccess('已加入风格板')
    styleBoardModalOpen.value = false
  } catch (error) {
    toastError(error.message || '加入风格板失败')
  } finally {
    styleBoardSaving.value = false
  }
}

function selectDialogueRound(round) {
  if (!round?.image) return
  image.value = round.image
  currentIndex.value = 0
  tab.value = round.image.inputImageUrls?.[0] ? 'result' : 'result'
  describeError.value = ''
  describePrompt.value = ''
  describeBilling.value = ''
  syncFeedbackForm(round.image?.feedback)
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
  const ok = await confirmDanger({
    title: isDialogueDetail.value ? '删除对话记录' : '删除历史记录',
    objectName: image.value.prompt || '未命名作品',
    message: isDialogueDetail.value ? '确定删除整条对话记录吗？' : '确定删除这条记录吗？',
    details: isDialogueDetail.value ? '这会删除该对话链下的所有生成结果。' : '删除后将无法在灵感记录中找回。',
    confirmText: '删除'
  })
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
  border-color: rgba(220, 38, 38, 0.18);
  color: var(--accent);
  background: rgba(220, 38, 38, 0.06);
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

.variant-card {
  overflow: hidden;
}

.compare-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.compare-tile {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 7px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.68);
  color: var(--muted);
  text-align: left;
  cursor: pointer;
}

.compare-tile.current {
  border-color: rgba(37, 99, 235, 0.26);
  background: rgba(37, 99, 235, 0.07);
  cursor: default;
}

.compare-tile img,
.compare-empty {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 9px;
  object-fit: cover;
  background: rgba(15, 23, 42, 0.05);
}

.compare-empty {
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.compare-tile span {
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
}

.compare-diff-list {
  display: grid;
  gap: 2px;
  margin-bottom: 10px;
}

.compare-diff-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.055);
}

.compare-diff-row span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.compare-diff-row strong {
  min-width: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 850;
  word-break: break-word;
}

.variant-list {
  display: grid;
  gap: 7px;
  max-height: 220px;
  overflow: auto;
  padding-right: 2px;
}

.variant-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 7px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 11px;
  background: rgba(248, 250, 252, 0.68);
  cursor: pointer;
  text-align: left;
}

.variant-item:hover {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(255, 255, 255, 0.92);
}

.variant-item img {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
}

.variant-info {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.variant-info span {
  color: var(--text);
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.variant-info small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.variant-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
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
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
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
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 10px 26px rgba(37, 99, 235, 0.12);
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
  border-color: rgba(37, 99, 235, 0.22);
  background: #ffffff;
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.preview-action:disabled {
  opacity: 0.62;
  cursor: not-allowed;
  box-shadow: none;
}

.preview-action.primary {
  color: #ffffff;
  border-color: transparent;
  background: var(--primary);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.16);
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

.feedback-modal {
  display: grid;
  gap: 10px;
}

.feedback-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.feedback-modal-title {
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
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

.feedback-saved {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
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

.feedback-rating {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.feedback-choice {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.72);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.feedback-choice.active {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(37, 99, 235, 0.08);
}

.feedback-field {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.feedback-note {
  min-height: 86px;
  width: 100%;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.72);
  padding: 10px 11px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
}

.feedback-note:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.26);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
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
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: rgba(37, 99, 235, 0.06);
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

.style-board-form {
  display: grid;
  gap: 13px;
}

.style-board-preview {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 13px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(248, 250, 252, 0.72);
}

.style-board-preview img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.05);
}

.style-board-form-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.style-board-form-sub {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 750;
}

.style-board-field {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.style-board-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.billing-note {
  margin: -2px 0 8px;
  color: rgba(100, 116, 139, 0.88);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.45;
}

.describe-error {
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.16);
  background: rgba(254, 242, 242, 0.74);
  color: #b91c1c;
  padding: 8px 9px;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.45;
}

.describe-loading {
  min-height: 118px;
  display: grid;
  place-items: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(248, 250, 252, 0.72);
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
  text-align: center;
}

.describe-textarea {
  width: 100%;
  min-height: 156px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.72);
  color: var(--text);
  padding: 10px 11px;
  font: inherit;
  font-size: 13px;
  line-height: 1.58;
  outline: none;
}

.describe-textarea:focus {
  border-color: rgba(37, 99, 235, 0.32);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.09);
}

.loading-icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chain-count {
  height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
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
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.chain-round:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.48);
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
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.07);
  color: var(--primary);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.chain-continue:hover {
  background: rgba(37, 99, 235, 0.12);
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
