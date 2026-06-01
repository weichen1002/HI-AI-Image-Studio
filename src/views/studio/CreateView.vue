<template>
  <div class="workspace-shell">
    <div v-if="!isDialogueRoute" class="workspace-mode-row">
      <ModeSwitch
        v-model="primaryMode"
        :options="primaryModes"
        label="工作台模式"
        class="workspace-mode-switch"
      />
    </div>

    <DialoguePanel
      v-if="primaryMode === 'dialogue'"
      v-model="dialoguePrompt"
      :sessions="dialogueSessions"
      :active-session="activeDialogueSession"
      :chain-id="dialogueChainId"
      :active-title="activeDialogueTitle"
      :round-label="dialogueRoundLabel"
      :advanced-summary="advancedSummary"
      :source-label="dialogueSourceLabel"
      :source-preview-url="dialogueSourcePreviewUrl"
      :thread-items="dialogueThreadItems"
      :pending-prompt="dialoguePendingPrompt"
      :display-preview-urls="displayPreviewUrls"
      :preview-aspect-ratio="previewAspectRatio"
      :has-source="hasDialogueSource"
      :loading="loading"
      :loading-text="loadingText"
      :prompt-placeholder="dialoguePromptPlaceholder"
      :input-file-count="dialogueInputFiles.length"
      :form="generationForm"
      :ratio-options="ratioOptions"
      :quality-tier-options="qualityTierOptions"
      :count-options="countOptions"
      :output-format-options="outputFormatOptions"
      :background-options="backgroundOptions"
      :moderation-options="moderationOptions"
      :supports-compression="supportsCompression"
      :prompt-quality="dialoguePromptQuality"
      :prompt-checking="promptChecking"
      :submit-disabled="submitDisabled"
      :submit-button-text="submitButtonText"
      :can-reset-preview="canResetPreview"
      :error-msg="errorMsg"
      :format-time="formatDialogueTime"
      @submit="submitCurrentMode"
      @new-dialogue="startBlankDialogue"
      @delete-dialogue="deleteActiveDialogueSession"
      @select-session="selectDialogueSession"
      @reset-preview="clearPreview"
      @open-picker="openDialoguePicker"
      @enhance="openEnhancePreview('dialogue')"
      @check-prompt="checkPromptQuality('dialogue')"
      @apply-prompt-suggestion="applyPromptSuggestion('dialogue', $event)"
      @shortcut="submitDialogueShortcut"
    />

    <div v-else class="creator-grid">
      <div class="panel flex flex-col gap-4 creator-left">
        <form @submit.prevent="submitCurrentMode" class="flex flex-col gap-4">
          <Transition name="mode-panel" mode="out-in">
            <div :key="primaryMode" class="mode-panel-body">
          <template v-if="primaryMode === 'text' || primaryMode === 'image'">
            <ImageReferencePanel
              v-if="primaryMode === 'image'"
              v-model="generationInputFiles"
            />
            <TextCreatePanel
              :form="generationForm"
              :show-presets="primaryMode === 'text'"
              :quick-presets="quickPresets"
              :active-preset-key="activePresetKey"
              :ratios="ratios"
              :quality-tier-options="qualityTierOptions"
              :count-options="countOptions"
              :output-format-options="outputFormatOptions"
              :background-options="backgroundOptions"
              :moderation-options="moderationOptions"
              :supports-compression="supportsCompression"
              :advanced-summary="advancedSummary"
              :prompt-quality="generationPromptQuality"
              :prompt-checking="promptChecking"
              :loading="loading"
              :reset-key="primaryMode"
              @select-preset="applyPreset"
              @enhance="openEnhancePreview"
              @check-prompt="checkPromptQuality('generation')"
              @apply-prompt-suggestion="applyPromptSuggestion('generation', $event)"
              @clear-prompt="clearGenerationPrompt"
            />
          </template>

          <ToolPanel
            v-else
            v-model:selected-tool="selectedTool"
            v-model:tool-prompt="toolPrompt"
            :tool-options="toolOptions"
            :current-tool-meta="currentToolMeta"
            :prompt-hint="toolPromptHint"
            :prompt-placeholder="toolPromptPlaceholder"
            :has-source="hasToolSource"
            :can-clear-source="Boolean(toolSourceFile)"
            :source-hint="toolSourceHint"
            :source-tag="toolSourceTag"
            :source-summary="toolSourceSummary"
            @open-source-picker="openSourcePicker('tool')"
            @clear-source="clearToolSource"
            @clear-prompt="toolPrompt = ''"
          />
            </div>
          </Transition>

          <section class="style-board-panel" :class="{ open: styleBoardPanelOpen }">
            <button
              type="button"
              class="style-board-toggle"
              :class="{ open: styleBoardPanelOpen }"
              @click="styleBoardPanelOpen = !styleBoardPanelOpen"
            >
              <div>
                <div class="style-board-title">项目风格板</div>
                <div class="style-board-sub">{{ styleBoardSummaryText }}</div>
              </div>
              <span class="style-board-arrow">{{ styleBoardPanelOpen ? '收起' : '展开' }}</span>
            </button>
            <div v-if="styleBoardPanelOpen" class="style-board-controls">
              <SelectMenu
                v-model="selectedStyleBoardId"
                :options="styleBoardOptions"
                placeholder="不使用风格板"
                size="sm"
              />
              <div v-if="selectedStyleBoard" class="style-board-summary">
                <div class="style-board-desc">{{ selectedStyleBoard.description || '无风格描述' }}</div>
                <div v-if="selectedStyleBoard.refs.length" class="style-board-refs">
                  <img
                    v-for="ref in selectedStyleBoard.refs.slice(0, 4)"
                    :key="ref.id"
                    :src="ref.imageUrl"
                    :alt="ref.note || selectedStyleBoard.name"
                  />
                </div>
              </div>
              <button type="button" class="style-board-link" @click="router.push('/studio/style-boards')">
                管理风格板
              </button>
            </div>
          </section>

          <button type="submit" class="btn btn-primary generate-btn" :disabled="submitDisabled">
            <div class="glow-effect" v-if="!loading && canShowGlow"></div>
            <SparklesIcon v-if="!loading" :size="20" style="position: relative; z-index: 1" />
            <LoaderIcon v-else class="animate-spin" :size="20" style="position: relative; z-index: 1" />
            <span style="position: relative; z-index: 1">{{ submitButtonText }}</span>
          </button>

          <p v-if="errorMsg" class="error-text text-center">{{ errorMsg }}</p>
        </form>
      </div>

      <div class="panel flex flex-col h-full creator-right creator-preview-panel" style="padding: 18px;">
        <div class="preview-panel-head">
          <div class="preview-panel-title-row">
            <div class="preview-panel-title">{{ previewPanelTitle }}</div>
            <div class="preview-panel-actions">
              <div v-if="usesImage2Model" class="model-badge" aria-label="当前生成模型">
                <SparklesIcon :size="14" />
                <span>gpt-image-2</span>
              </div>
              <button
                v-if="canResetPreview"
                type="button"
                class="btn btn-ghost btn-xs preview-reset-btn"
                :disabled="loading"
                @click="clearPreview"
              >
                <RefreshCcwIcon :size="15" />
                <span>重置预览</span>
              </button>
            </div>
          </div>
          <div class="preview-panel-subtitle">{{ previewPanelSubtitle }}</div>
        </div>
        <div class="preview-container">
          <div class="preview-box" :style="{ aspectRatio: previewAspectRatio }">
            <div v-if="displayPreviewUrls.length > 1" class="preview-grid">
              <img
                v-for="(url, index) in displayPreviewUrls"
                :key="`${url}-${index}`"
                :src="url"
                :alt="`${previewPanelTitle} ${index + 1}`"
              />
            </div>
            <img v-else-if="displayPreviewUrls[0]" :src="displayPreviewUrls[0]" :alt="previewPanelTitle" />
            <div v-else-if="loading" class="loading-state">
              <div class="loader-core">
                <SparklesIcon :size="32" class="pulse-icon" />
              </div>
              <span class="loading-text">{{ loadingText }}</span>
            </div>
            <div v-else class="empty-state">
              <div class="empty-icon-wrapper">
                <ImageIcon :size="48" style="color: var(--primary);" />
              </div>
              <div class="empty-text">{{ previewEmptyTitle }}</div>
              <p class="empty-subtext">{{ previewEmptySubtitle }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <PromptEnhanceModal
    v-model:open="enhanceModalOpen"
    :original-prompt="enhanceOriginalPrompt"
    @apply="applyEnhancedPrompt"
  />
  <ImageEditModal
    v-model:open="editorOpen"
    :source-url="editorSourceUrl"
    :source-file="editorSourceFile"
    :source-image-id="editorSourceImageId"
    :source-prompt="editorPrompt"
    :aspect-ratio="generationForm.aspectRatio"
    :initial-mode="editorInitialMode"
    @completed="handleEditorCompleted"
  />
  <input
    ref="sourceInputRef"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    class="upload-input"
    @change="onSourcePick"
  />
</template>

<script setup>
import { computed, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SparklesIcon, LoaderIcon, RefreshCcwIcon, ImageIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { useSiteStore } from '../../stores/site'
import { usePreferencesStore } from '../../stores/preferences'
import { useStyleBoardsStore } from '../../stores/styleBoards'
import { useModelCapabilitiesStore } from '../../stores/modelCapabilities'
import ModeSwitch from '../../components/ModeSwitch.vue'
import PromptEnhanceModal from '../../components/studio/PromptEnhanceModal.vue'
import ImageEditModal from '../../components/studio/ImageEditModal.vue'
import DialoguePanel from '../../components/studio/DialoguePanel.vue'
import ImageReferencePanel from '../../components/studio/ImageReferencePanel.vue'
import TextCreatePanel from '../../components/studio/TextCreatePanel.vue'
import ToolPanel from '../../components/studio/ToolPanel.vue'
import { quickPresets } from './create.presets'
import { getRatioValue, hasGenerationRouteOptions, useGenerationOptions } from './composables/useGenerationOptions'
import { SelectMenu, confirmDanger } from '../../components/common'
import { apiFetch } from '../../utils/api'

const imagesStore = useImagesStore()
const siteStore = useSiteStore()
const preferencesStore = usePreferencesStore()
const styleBoardsStore = useStyleBoardsStore()
const modelCapabilitiesStore = useModelCapabilitiesStore()
const route = useRoute()
const router = useRouter()

const primaryModes = [
  { label: '文生图', value: 'text' },
  { label: '图生图', value: 'image' },
  { label: '工具', value: 'tools' }
]
const toolOptions = [
  {
    label: '局部重绘',
    value: 'inpaint',
    description: '涂抹局部后重新生成',
    detail: '适合修手部、脸部、边缘和局部瑕疵。进入后先涂抹要改的位置。'
  },
  {
    label: '扩图',
    value: 'outpaint',
    description: '扩展画布并补全内容',
    detail: '适合补背景、扩构图和增加留白。进入后选择扩展方向。'
  },
  {
    label: '高清增强',
    value: 'upscale',
    description: '提升清晰度和细节',
    detail: '适合把历史结果、商品图和头像进一步锐化、增强纹理并保存为新资产。'
  }
]
const {
  generationForm,
  ratios,
  ratioOptions,
  qualityTierOptions,
  countOptions,
  outputFormatOptions,
  backgroundOptions,
  moderationOptions,
  supportsCompression,
  previewAspectRatio,
  advancedSummary,
  generationOptions,
  applyRouteGenerationOptions
} = useGenerationOptions(preferencesStore.createSettings, modelCapabilitiesStore.capabilities)

const primaryMode = ref('text')
const isDialogueRoute = computed(() => route.name === 'studio-dialogue')
const activePresetKey = ref('')
const enhanceModalOpen = ref(false)
const enhanceTarget = ref('generation')
const promptChecking = ref(false)
const generationPromptQuality = ref(null)
const dialoguePromptQuality = ref(null)
const sourceInputRef = ref(null)
const sourcePickerTarget = ref('')
const selectedStyleBoardId = ref('')
const styleBoardPanelOpen = ref(false)

const generationInputFiles = ref([])
const generationInputPreviewUrl = ref('')
const dialogueInputFiles = ref([])
const dialogueInputPreviewUrl = ref('')

const dialoguePrompt = ref('')
const dialoguePendingPrompt = ref('')
const dialogueChainId = ref('')
const dialogueMessages = ref([])
const dialogueChainImages = ref([])
const dialogueSourceImage = ref(null)

const selectedTool = ref('inpaint')
const toolPrompt = ref('')
const editorOpen = ref(false)
const editorInitialMode = ref('inpaint')
const editorSourceUrl = ref('')
const editorSourceFile = ref(null)
const editorSourceImageId = ref('')
const toolSourceFile = ref(null)
const toolSourcePreviewUrl = ref('')
const toolSourceImageId = ref('')
const toolSourceRemoteUrl = ref('')

function revokeObjectUrl(urlValue) {
  if (!urlValue) return
  URL.revokeObjectURL(urlValue)
}

function setPreviewUrl(targetRef, file) {
  revokeObjectUrl(targetRef.value)
  targetRef.value = file instanceof File ? URL.createObjectURL(file) : ''
}

async function fileFromUrl(url, fallbackName = 'source.png') {
  const response = await fetch(url)
  if (!response.ok) throw new Error('来源图片加载失败')
  const blob = await response.blob()
  return new File([blob], fallbackName, { type: blob.type || 'image/png' })
}

function promptWithStyleBoard(prompt) {
  const board = selectedStyleBoard.value
  const base = String(prompt || '').trim()
  if (!board) return base
  const parts = [base]
  if (board.description) {
    parts.push(`参考项目风格板「${board.name}」：${board.description}`)
  } else {
    parts.push(`参考项目风格板「${board.name}」的视觉风格。`)
  }
  if (board.refs.length) {
    parts.push('参考图只用于风格、构图、色彩和材质方向，不要直接复制其中的文字、水印或 Logo。')
  }
  return parts.filter(Boolean).join('\n\n')
}

async function styleBoardReferenceFiles(limit = 4) {
  const refs = selectedStyleBoard.value?.refs || []
  const files = []
  for (const ref of refs.slice(0, limit)) {
    if (!ref.imageUrl) continue
    files.push(await fileFromUrl(ref.imageUrl, `style-${ref.id || files.length + 1}.png`))
  }
  return files
}

async function loadInputFromUrl(value, targetRef) {
  const url = decodeURIComponent(String(value || ''))
  if (!url) return
  const file = await fileFromUrl(url, url.split('/').pop() || 'input.png')
  targetRef.value = [file]
}

async function loadToolSourceFromUrl(value, sourceImageId = '') {
  const url = decodeURIComponent(String(value || ''))
  if (!url) return
  toolSourceFile.value = await fileFromUrl(url, url.split('/').pop() || 'tool-source.png')
  toolSourceImageId.value = String(sourceImageId || '').trim()
  toolSourceRemoteUrl.value = url
  setPreviewUrl(toolSourcePreviewUrl, toolSourceFile.value)
}

function clearPreview() {
  imagesStore.clearJob()
  errorMsg.value = ''
}

function clearGenerationPrompt() {
  generationForm.prompt = ''
  activePresetKey.value = ''
  generationPromptQuality.value = null
}

function applyPreset(key) {
  const preset = quickPresets.find((item) => item.key === key)
  if (!preset) return
  activePresetKey.value = preset.key
  generationForm.prompt = preset.prompt
  generationForm.aspectRatio = preset.aspectRatio
}

function openEnhancePreview(target = 'generation') {
  enhanceTarget.value = target
  enhanceModalOpen.value = true
}

function applyEnhancedPrompt(val) {
  const nextPrompt = String(val || '').trim()
  if (!nextPrompt) return
  if (enhanceTarget.value === 'dialogue') {
    dialoguePrompt.value = nextPrompt
    dialoguePromptQuality.value = null
    return
  }
  generationForm.prompt = nextPrompt
  generationPromptQuality.value = null
}

async function checkPromptQuality(target = 'generation') {
  if (promptChecking.value) return
  const prompt = target === 'dialogue' ? dialoguePrompt.value : generationForm.prompt
  if (!String(prompt || '').trim()) return
  promptChecking.value = true
  errorMsg.value = ''
  try {
    const result = await apiFetch('/api/prompts/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    }, { toast: false })
    if (target === 'dialogue') dialoguePromptQuality.value = result
    else generationPromptQuality.value = result
  } catch (error) {
    errorMsg.value = error?.message || '提示词检查失败'
  } finally {
    promptChecking.value = false
  }
}

function applyPromptSuggestion(target, value) {
  const prompt = String(value || '').trim()
  if (!prompt) return
  if (target === 'dialogue') {
    dialoguePrompt.value = prompt
    dialoguePromptQuality.value = null
    return
  }
  generationForm.prompt = prompt
  generationPromptQuality.value = null
}

function openSourcePicker(target) {
  sourcePickerTarget.value = target
  sourceInputRef.value?.click()
}

function openDialoguePicker() {
  sourcePickerTarget.value = 'dialogue'
  sourceInputRef.value?.click()
}

function resetEditorSource() {
  editorSourceUrl.value = ''
  editorSourceFile.value = null
  editorSourceImageId.value = ''
}

function clearToolSource() {
  toolSourceFile.value = null
  toolSourceImageId.value = ''
  toolSourceRemoteUrl.value = ''
  revokeObjectUrl(toolSourcePreviewUrl.value)
  toolSourcePreviewUrl.value = ''
}

function clearDialogueSource() {
  dialogueSourceImage.value = null
  dialogueInputFiles.value = []
  revokeObjectUrl(dialogueInputPreviewUrl.value)
  dialogueInputPreviewUrl.value = ''
  dialogueChainId.value = ''
  dialogueMessages.value = []
  dialogueChainImages.value = []
  dialoguePendingPrompt.value = ''
  clearPreview()
}

async function startBlankDialogue() {
  const hasContext = Boolean(
    dialoguePrompt.value ||
      dialogueChainId.value ||
      dialogueMessages.value.length ||
      currentDialogueSource() ||
      previewUrls.value.length
  )
  if (hasContext) {
    const ok = await confirmDanger({
      title: '新建空白对话',
      objectName: dialoguePrompt.value || '当前对话',
      message: '确定新建空白对话吗？',
      details: '当前输入、上下文和预览会清空，不再沿旧记录继续生成。',
      confirmText: '新建'
    })
    if (!ok) return
  }
  clearDialogueSource()
  dialoguePrompt.value = ''
}

async function loadDialogueChain(params = {}) {
  const data = await imagesStore.fetchDialogueChain({
    chainId: params.chainId || '',
    imageId: params.imageId || ''
  })
  dialogueChainId.value = data.chainId || dialogueChainId.value
  dialogueMessages.value = Array.isArray(data.messages) ? data.messages : []
  dialogueChainImages.value = Array.isArray(data.images) ? data.images : []
  const latestImage = dialogueChainImages.value[dialogueChainImages.value.length - 1]
  dialogueSourceImage.value = latestImage || null
  dialogueInputFiles.value = []
  revokeObjectUrl(dialogueInputPreviewUrl.value)
  dialogueInputPreviewUrl.value = ''
  return data
}

async function selectDialogueSession(session) {
  if (!session?.chainId || session.chainId === dialogueChainId.value) return
  errorMsg.value = ''
  dialoguePrompt.value = ''
  dialoguePendingPrompt.value = ''
  await loadDialogueChain({ chainId: session.chainId })
  clearPreview()
}

async function deleteActiveDialogueSession() {
  if (!activeDialogueSession.value?.chainId) return
  const ok = await confirmDanger({
    title: '删除会话',
    objectName: activeDialogueSession.value.title || '当前会话',
    message: '确定删除当前会话吗？',
    details: '该操作会删除这条会话下的所有结果。',
    confirmText: '删除'
  })
  if (!ok) return
  const ids = activeDialogueSession.value.images.map((image) => image.id).filter(Boolean)
  await imagesStore.deleteDialogueChain(activeDialogueSession.value.chainId)
  preferencesStore.removeImagePreferences(ids)
  clearDialogueSource()
  dialoguePrompt.value = ''
}

function isDialogueImage(image) {
  return image?.mode === 'dialogue' || image?.mode === 'continuous'
}

function currentDialogueSource() {
  const file = dialogueInputFiles.value[0]
  if (file instanceof File) {
    return { type: 'reference', file, previewUrl: dialogueInputPreviewUrl.value }
  }
  if (dialogueSourceImage.value?.imageUrls?.[0]) {
    return {
      type: 'result',
      url: dialogueSourceImage.value.imageUrls[0],
      imageId: dialogueSourceImage.value.id || '',
      continuationChainId: dialogueSourceImage.value.continuationChainId || '',
      previewUrl: dialogueSourceImage.value.imageUrls[0]
    }
  }
  return null
}

function resolveToolSource() {
  if (toolSourceFile.value instanceof File) {
    return {
      type: toolSourceImageId.value ? 'result' : 'manual',
      file: toolSourceFile.value,
      imageId: toolSourceImageId.value,
      url: toolSourceRemoteUrl.value,
      previewUrl: toolSourcePreviewUrl.value
    }
  }
  if (currentImage.value?.imageUrls?.[0]) {
    return {
      type: 'result',
      url: currentImage.value.imageUrls[0],
      imageId: currentImage.value.id || '',
      previewUrl: currentImage.value.imageUrls[0]
    }
  }
  if (generationInputFiles.value[0] instanceof File) {
    return { type: 'reference', file: generationInputFiles.value[0], previewUrl: generationInputPreviewUrl.value }
  }
  return null
}

async function submitGenerateMode() {
  const styledPrompt = promptWithStyleBoard(generationForm.prompt)
  const styleFiles = await styleBoardReferenceFiles(4)
  if (primaryMode.value === 'text') {
    if (styleFiles.length) {
      await imagesStore.generateFromImages(
        styleFiles,
        styledPrompt,
        generationForm.aspectRatio,
        generationOptions({ mode: 'image' })
      )
    } else {
      await imagesStore.generate(
        styledPrompt,
        generationForm.aspectRatio,
        generationOptions({ mode: 'text' })
      )
    }
    return
  }
  const validFiles = Array.isArray(generationInputFiles.value)
    ? generationInputFiles.value.filter((file) => file instanceof File)
    : []
  const allFiles = [...validFiles, ...styleFiles].slice(0, 4)
  if (!allFiles.length) {
    throw new Error('请先上传参考图')
  }
  await imagesStore.generateFromImages(
    allFiles,
    styledPrompt,
    generationForm.aspectRatio,
    generationOptions({ mode: 'image' })
  )
}

async function submitDialogueMode() {
  const prompt = String(dialoguePrompt.value || '').trim()
  const source = currentDialogueSource()
  dialoguePendingPrompt.value = prompt
  await imagesStore.continueDialogue({
    prompt,
    aspectRatio: generationForm.aspectRatio,
    chainId:
      source?.type === 'reference'
        ? ''
        : source?.continuationChainId || dialogueChainId.value || '',
    sourceImageId: source?.type === 'result' ? source.imageId || '' : '',
    imageFile: source?.type === 'reference' ? source.file : null,
    qualityTier: generationForm.qualityTier,
    count: generationForm.count,
    outputFormat: generationForm.outputFormat,
    outputCompression: generationForm.outputCompression,
    background: generationForm.background,
    moderation: generationForm.moderation
  })
  dialoguePrompt.value = ''
}

async function submitToolMode() {
  const source = resolveToolSource()
  if (!source) {
    throw new Error('请先为工具选择一张图片')
  }
  if (currentToolMeta.value.disabled) {
    throw new Error(`${currentToolMeta.value.label} 即将上线`)
  }

  const sourceFile =
    source.file instanceof File
      ? source.file
      : await fileFromUrl(source.url, 'tool-source.png')

  if (currentToolMeta.value.value === 'cutout' || currentToolMeta.value.value === 'upscale') {
    await imagesStore.editImage({
      imageFile: sourceFile,
      prompt: toolPrompt.value.trim() || defaultToolPrompt.value,
      aspectRatio: generationForm.aspectRatio,
      operationType: currentToolMeta.value.value,
      sourceImageId: source.imageId || '',
      sourceImageUrl: source.url || ''
    })
    return
  }

  resetEditorSource()
  editorInitialMode.value = currentToolMeta.value.value === 'outpaint' ? 'outpaint' : 'inpaint'

  if (source.file instanceof File) {
    editorSourceFile.value = source.file
  } else {
    editorSourceUrl.value = source.url || ''
    editorSourceImageId.value = source.imageId || ''
  }
  editorOpen.value = true
}

async function submitCurrentMode() {
  errorMsg.value = ''
  try {
    if (primaryMode.value === 'dialogue') {
      await submitDialogueMode()
      return
    }
    if (primaryMode.value === 'text' || primaryMode.value === 'image') {
      await submitGenerateMode()
      return
    }
    await submitToolMode()
  } catch (error) {
    if (primaryMode.value === 'dialogue') {
      dialoguePendingPrompt.value = ''
    }
    errorMsg.value = error?.message || '操作失败'
  }
}

function submitDialogueShortcut() {
  if (submitDisabled.value) return
  void submitCurrentMode()
}

function onSourcePick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (sourcePickerTarget.value === 'tool') {
    toolSourceFile.value = file
    toolSourceImageId.value = ''
    toolSourceRemoteUrl.value = ''
    setPreviewUrl(toolSourcePreviewUrl, file)
  } else if (sourcePickerTarget.value === 'dialogue') {
    dialogueInputFiles.value = [file]
    setPreviewUrl(dialogueInputPreviewUrl, file)
  }
  sourcePickerTarget.value = ''
}

function handleEditorCompleted(image) {
  if (!image?.imageUrls?.[0]) return
  primaryMode.value = 'tools'
  generationForm.aspectRatio = image.aspectRatio || generationForm.aspectRatio
}

async function hydrateDialogueFromImage(imageId) {
  primaryMode.value = 'dialogue'
  if (!imageId) return
  const data = await imagesStore.fetchImage(imageId)
  if (!data?.image) return
  await loadDialogueChain({
    chainId: data.image.continuationChainId || '',
    imageId: data.image.id || imageId
  })
}

onMounted(async () => {
  const routeMode = String(route.query.mode || '')
  try {
    await modelCapabilitiesStore.fetchCapabilities()

    if (routeMode === 'tools') {
      primaryMode.value = 'tools'
    } else if (isDialogueRoute.value || routeMode === 'dialogue') {
      primaryMode.value = 'dialogue'
    } else {
      primaryMode.value = routeMode === 'image' ? 'image' : 'text'
    }

    if (route.query.prompt) {
      if (primaryMode.value === 'dialogue') {
        dialoguePrompt.value = String(route.query.prompt)
      } else {
        generationForm.prompt = String(route.query.prompt)
      }
    }

    applyRouteGenerationOptions(route.query)

    if (route.query.input) {
      if (primaryMode.value === 'dialogue') {
        dialogueSourceImage.value = null
        dialogueChainId.value = ''
        dialogueMessages.value = []
        await loadInputFromUrl(route.query.input, dialogueInputFiles)
      } else if (primaryMode.value === 'tools') {
        await loadToolSourceFromUrl(route.query.input, String(route.query.sourceImageId || ''))
      } else {
        primaryMode.value = 'image'
        await loadInputFromUrl(route.query.input, generationInputFiles)
      }
    }

    if (route.query.tool && toolOptions.some((item) => item.value === route.query.tool)) {
      selectedTool.value = String(route.query.tool)
    }

    if (route.query.imageId) {
      await hydrateDialogueFromImage(String(route.query.imageId))
    }

    await styleBoardsStore.fetchBoards()

    if (primaryMode.value === 'dialogue') {
      void imagesStore.fetchDialogueChains({ limit: 100 })
    }
  } catch (error) {
    errorMsg.value = error?.message || '初始化失败'
  } finally {
    if (
      route.query.prompt ||
      route.query.mode ||
      route.query.input ||
      route.query.tool ||
      route.query.sourceImageId ||
      route.query.imageId ||
      hasGenerationRouteOptions(route.query)
    ) {
      if (routeMode === 'dialogue' && !isDialogueRoute.value) {
        router.replace({ path: '/studio/dialogue' })
      } else {
        router.replace({ query: {} })
      }
    }
  }
})

watch(
  () => generationInputFiles.value[0],
  (file) => {
    setPreviewUrl(generationInputPreviewUrl, file)
  },
  { immediate: true }
)

watch(
  () => dialogueInputFiles.value[0],
  (file) => {
    setPreviewUrl(dialogueInputPreviewUrl, file)
    if (file instanceof File) {
      dialogueSourceImage.value = null
      dialogueChainId.value = ''
      dialogueMessages.value = []
      dialogueChainImages.value = []
      dialoguePendingPrompt.value = ''
    }
  },
  { immediate: true }
)

watch(
  () => generationForm.prompt,
  () => {
    generationPromptQuality.value = null
  }
)

watch(
  () => dialoguePrompt.value,
  () => {
    dialoguePromptQuality.value = null
  }
)

watch(primaryMode, (mode) => {
  errorMsg.value = ''
  if (mode === 'dialogue') {
    void imagesStore.fetchDialogueChains({ limit: 100 })
  }
})

watch(
  isDialogueRoute,
  (enabled) => {
    if (enabled) {
      primaryMode.value = 'dialogue'
      void imagesStore.fetchDialogueChains({ limit: 100 })
    } else if (primaryMode.value === 'dialogue') {
      primaryMode.value = 'text'
    }
  }
)

watch(
  () => [
    imagesStore.activeJob?.status,
    imagesStore.activeJob?.id,
    imagesStore.activeJob?.image?.id,
    imagesStore.activeJob?.chainId
  ],
  async ([status]) => {
    if (primaryMode.value !== 'dialogue') return
    if (status !== 'success') return
    const image = imagesStore.activeJob?.image || null
    const chainId = imagesStore.activeJob?.chainId || image?.continuationChainId || dialogueChainId.value || ''
    dialoguePendingPrompt.value = ''
    if (!chainId) return
    dialogueChainId.value = chainId
    await loadDialogueChain({ chainId, imageId: image?.id || '' })
    await imagesStore.fetchDialogueChains({ limit: 100 })
  }
)

onBeforeUnmount(() => {
  revokeObjectUrl(generationInputPreviewUrl.value)
  revokeObjectUrl(dialogueInputPreviewUrl.value)
  revokeObjectUrl(toolSourcePreviewUrl.value)
})

const errorMsg = ref('')
const loading = computed(() => imagesStore.isGenerating)
const currentImage = computed(() => imagesStore.activeJob?.image || null)
const previewUrls = computed(() => (currentImage.value?.imageUrls || []).filter(Boolean))
const canResetPreview = computed(() => Boolean(imagesStore.activeJob && !loading.value))
const enhanceOriginalPrompt = computed(() => {
  return enhanceTarget.value === 'dialogue' ? dialoguePrompt.value : generationForm.prompt
})
const hasDialogueSource = computed(() => Boolean(currentDialogueSource()))
const dialogueSessions = computed(() => {
  return (Array.isArray(imagesStore.dialogueChains) ? imagesStore.dialogueChains : [])
    .map((chain) => ({
      ...chain,
      title: chain.title || `会话 ${formatDialogueTime(chain.updatedAt)}`,
      images: [chain.firstImage, chain.lastImage].filter(Boolean)
    }))
})
const activeDialogueSession = computed(() => {
  if (!dialogueChainId.value) return null
  const session = dialogueSessions.value.find((item) => item.chainId === dialogueChainId.value)
  if (session) return session
  if (!dialogueChainImages.value.length) return null
  const latestImage = dialogueChainImages.value[dialogueChainImages.value.length - 1]
  return {
    chainId: dialogueChainId.value,
    title: `会话 ${formatDialogueTime(latestImage?.createdAt)}`,
    updatedAt: latestImage?.createdAt || new Date().toISOString(),
    roundCount: dialogueChainImages.value.length,
    coverUrl: latestImage?.imageUrls?.[0] || '',
    images: dialogueChainImages.value.slice()
  }
})
const dialogueImagesById = computed(() => {
  return new Map(dialogueChainImages.value.map((image) => [String(image.id || ''), image]))
})
const dialogueThreadItems = computed(() => {
  const messages = Array.isArray(dialogueMessages.value) ? dialogueMessages.value.slice() : []
  if (messages.length) {
    return messages.map((message, index) => {
      const image = dialogueImagesById.value.get(String(message.imageId || '')) || dialogueChainImages.value[index] || null
      return {
        ...message,
        image,
        imageUrls: (image?.imageUrls || []).filter(Boolean),
        aspectRatioValue: getRatioValue(image?.aspectRatio || generationForm.aspectRatio)
      }
    })
  }
  return dialogueChainImages.value.map((image) => ({
    id: image.id,
    imageId: image.id,
    prompt: image.prompt || '继续生成',
    createdAt: image.createdAt,
    image,
    imageUrls: (image.imageUrls || []).filter(Boolean),
    aspectRatioValue: getRatioValue(image.aspectRatio || generationForm.aspectRatio)
  }))
})
const dialogueRoundCount = computed(() => dialogueThreadItems.value.length)
const dialogueRoundLabel = computed(() => {
  if (loading.value) return '正在生成新版本'
  if (dialogueRoundCount.value) return `第 ${dialogueRoundCount.value} 轮结果`
  return hasDialogueSource.value ? '已有起始图' : '空白开始'
})
const activeDialogueTitle = computed(() => activeDialogueSession.value?.title || '新建对话')
const dialogueSourcePreviewUrl = computed(() => {
  if (dialogueInputPreviewUrl.value) return dialogueInputPreviewUrl.value
  return dialogueSourceImage.value?.imageUrls?.[0] || ''
})
const dialogueSourceLabel = computed(() => {
  if (dialogueInputFiles.value[0] instanceof File) return '参考图'
  if (dialogueSourceImage.value?.imageUrls?.[0]) return '当前结果'
  return ''
})
const toolSource = computed(() => resolveToolSource())
const hasToolSource = computed(() => Boolean(toolSource.value))
const currentToolMeta = computed(() => toolOptions.find((item) => item.value === selectedTool.value) || toolOptions[0])
const usesImage2Model = computed(() => primaryMode.value === 'text' || primaryMode.value === 'image')
const toolPromptHint = computed(() => {
  if (currentToolMeta.value.value === 'cutout') return '可补充主体边缘、阴影和输出细节要求。'
  if (currentToolMeta.value.value === 'upscale') return '可补充清晰度、质感、保真和细节增强要求。'
  if (currentToolMeta.value.value === 'outpaint') return '会带入扩图弹窗，你可以先写扩展方向和留白诉求。'
  return '会带入局部重绘弹窗，你可以先写想修的内容。'
})
const toolPromptPlaceholder = computed(() => {
  if (currentToolMeta.value.value === 'cutout') {
    return '例如：保留人物完整轮廓，边缘干净自然，不要投影，适合后续海报排版。'
  }
  if (currentToolMeta.value.value === 'outpaint') {
    return '例如：向左右补全背景，延续原有光影，留出更干净的版式留白。'
  }
  if (currentToolMeta.value.value === 'upscale') {
    return '例如：保持原构图和风格，提升主体边缘、皮肤/材质纹理和整体清晰度，不要改变文字。'
  }
  return '例如：修复手部细节和脸部边缘，保持整体风格不变。'
})
const defaultToolPrompt = computed(() => {
  if (currentToolMeta.value.value === 'cutout') return '抠出主体，边缘自然干净，不要阴影、地面、文字和额外元素。'
  if (currentToolMeta.value.value === 'upscale') return '高清增强图片，保持原始主体、构图和风格，提升清晰度、纹理细节和边缘质量，不要新增文字或水印。'
  return toolPrompt.value.trim()
})
const displayPreviewUrls = computed(() => {
  if (previewUrls.value.length) return previewUrls.value
  if (primaryMode.value === 'dialogue') {
    const source = currentDialogueSource()
    if (source?.previewUrl) return [source.previewUrl]
  }
  if (primaryMode.value === 'tools' && toolSource.value?.previewUrl) {
    return [toolSource.value.previewUrl]
  }
  if (primaryMode.value === 'image' && generationInputPreviewUrl.value) {
    return [generationInputPreviewUrl.value]
  }
  return []
})
const canShowGlow = computed(() => {
  if (primaryMode.value === 'dialogue') return Boolean(dialoguePrompt.value)
  if (primaryMode.value !== 'tools') return Boolean(generationForm.prompt)
  return !currentToolMeta.value.disabled
})
const workspaceTitle = computed(() => {
  if (primaryMode.value === 'dialogue') return '对话创作'
  if (primaryMode.value === 'tools') return '工具'
  return primaryMode.value === 'image' ? '图生图' : '文生图'
})
const workspaceSubtitle = computed(() => {
  if (primaryMode.value === 'dialogue') {
    return '从空白、参考图或已有结果开始，逐轮调整。'
  }
  if (primaryMode.value === 'tools') {
    return '选择来源图，进入局部重绘或扩图。'
  }
  return primaryMode.value === 'image'
    ? '上传参考图，延续主体、风格和构图。'
    : '输入提示词，直接生成图片。'
})
const workspaceIcon = computed(() => {
  if (primaryMode.value === 'image') return 'image'
  if (primaryMode.value === 'dialogue') return 'dialogue'
  if (primaryMode.value === 'tools') return 'tools'
  return 'wand'
})
const loadingText = computed(() => {
  if (primaryMode.value === 'dialogue') return '正在继续生成...'
  if (primaryMode.value === 'tools') return '正在打开工具...'
  return '正在生成图片...'
})
const submitButtonText = computed(() => {
  if (primaryMode.value === 'dialogue') {
    return loading.value ? '生成中...' : '继续生成'
  }
  if (primaryMode.value === 'tools') {
    if (currentToolMeta.value.value === 'cutout' || currentToolMeta.value.value === 'upscale') {
      return loading.value ? '处理中...' : `开始${currentToolMeta.value.label}`
    }
    return `打开${currentToolMeta.value.label}`
  }
  return loading.value ? '生成中...' : '生成图片'
})
const submitDisabled = computed(() => {
  if (loading.value) return true
  if (primaryMode.value === 'dialogue') {
    return !dialoguePrompt.value
  }
  if (primaryMode.value !== 'tools') {
    if (!generationForm.prompt) return true
    if (primaryMode.value === 'image') {
      return !(generationInputFiles.value[0] instanceof File)
    }
    return false
  }
  return !hasToolSource.value || currentToolMeta.value.disabled
})
const previewPanelTitle = computed(() => {
  if (primaryMode.value === 'dialogue' && !previewUrls.value.length) return '对话预览'
  if (primaryMode.value === 'tools' && !previewUrls.value.length) return '工具来源图预览'
  return '生成结果预览'
})
const previewPanelSubtitle = computed(() => {
  if (primaryMode.value === 'dialogue') {
    return hasDialogueSource.value
      ? '沿当前图片和历史继续。'
      : '可直接从文字开始。'
  }
  if (primaryMode.value === 'tools') {
    return hasToolSource.value
      ? '将基于这张图处理。'
      : '先选择来源图。'
  }
  return '结果会自动保存到灵感记录。'
})
const previewEmptyTitle = computed(() => {
  if (primaryMode.value === 'dialogue') return '从这里开始'
  if (primaryMode.value === 'tools') return '选择来源图'
  return '预览区'
})
const previewEmptySubtitle = computed(() => {
  if (primaryMode.value === 'dialogue') {
    return '描述本轮要求；需要图片时可上传。'
  }
  if (primaryMode.value === 'tools') {
    return '局部重绘、扩图和高清增强会基于来源图处理。'
  }
  return '输入提示词后生成。'
})
const dialoguePromptPlaceholder = computed(() => {
  return '例如：方向正确，表情更自然，背景层次更丰富，不要多余文字。'
})
const toolSourceTag = computed(() => {
  if (toolSource.value?.type === 'manual') return '手动选择'
  if (toolSource.value?.type === 'result') return '最近结果'
  if (toolSource.value?.type === 'reference') return '参考图'
  return '未选择'
})
const toolSourceSummary = computed(() => {
  if (toolSource.value?.type === 'manual') return '会优先使用你手动选择的图片进入工具。'
  if (toolSource.value?.type === 'result') return '使用最近结果图。'
  if (toolSource.value?.type === 'reference') return '使用当前参考图。'
  return '请选择一张图片。'
})
const toolSourceHint = computed(() => {
  if (toolSource.value?.type === 'manual') return '使用手动选择的图片。'
  if (toolSource.value?.type === 'result') return '使用最近生成结果。'
  if (toolSource.value?.type === 'reference') return '使用当前参考图。'
  return '先选择一张图片。'
})
const editorPrompt = computed(() => toolPrompt.value || generationForm.prompt || dialoguePrompt.value || '')
const selectedStyleBoard = computed(() => {
  if (!selectedStyleBoardId.value) return null
  return styleBoardsStore.boards.find((board) => board.id === selectedStyleBoardId.value) || null
})
const styleBoardSummaryText = computed(() => {
  if (!selectedStyleBoard.value) return '不使用风格板，可选项目参考图辅助本次生成。'
  const count = selectedStyleBoard.value.refs?.length || 0
  return `${selectedStyleBoard.value.name}${count ? ` · ${count} 张参考图` : ''}`
})
const styleBoardOptions = computed(() => [
  { label: '不使用风格板', value: '' },
  ...styleBoardsStore.boards.map((board) => ({
    label: `${board.name}${board.refs.length ? ` · ${board.refs.length}图` : ''}`,
    value: board.id,
  })),
])

watch(
  [workspaceTitle, workspaceSubtitle, workspaceIcon],
  ([title, subtitle, icon]) => {
    siteStore.setCreateHeader(title, subtitle, icon)
  },
  { immediate: true }
)

function formatDialogueTime(val) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(val))
}
</script>

<style scoped>
.workspace-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.workspace-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 600;
}

.workspace-mode-row {
  width: 100%;
}

.workspace-mode-switch {
  max-width: 820px;
}

.mode-panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.mode-panel-enter-active,
.mode-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.mode-panel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.mode-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.model-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.07);
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: default;
  user-select: none;
}

.style-board-panel {
  display: grid;
  gap: 0;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.68);
  overflow: hidden;
}

.style-board-toggle {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  background: transparent;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.style-board-toggle:hover {
  background: rgba(255, 255, 255, 0.54);
}

.style-board-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.style-board-sub,
.style-board-desc {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 750;
}

.style-board-sub {
  margin-top: 2px;
}

.style-board-link {
  width: fit-content;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
  cursor: pointer;
  padding: 7px 10px;
}

.style-board-arrow {
  flex: 0 0 auto;
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
  line-height: 1.4;
}

.style-board-controls {
  display: grid;
  gap: 10px;
  padding: 0 12px 12px;
}

.style-board-summary {
  display: grid;
  gap: 9px;
}

.style-board-refs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
}

.style-board-refs img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 9px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(15, 23, 42, 0.05);
}

.dialogue-workspace {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  min-height: min(660px, calc(100dvh - 188px));
  flex: 1;
  min-width: 0;
}

.dialogue-rail,
.dialogue-main {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
}

.dialogue-rail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
}

.dialogue-rail-head,
.dialogue-main-head,
.dialogue-composer-footer,
.dialogue-composer-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dialogue-rail-head {
  min-height: 38px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.dialogue-rail-title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.dialogue-rail-title span {
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
  line-height: 1.1;
}

.dialogue-rail-title small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
}

.dialogue-rail-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.dialogue-new-btn {
  height: 32px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.dialogue-new-btn:hover {
  background: rgba(37, 99, 235, 0.12);
}

.dialogue-clear-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}

.dialogue-clear-btn:hover:not(:disabled) {
  border-color: rgba(15, 23, 42, 0.16);
  color: var(--text);
}

.dialogue-clear-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dialogue-rail-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  padding-right: 1px;
}

.dialogue-session-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.dialogue-session-card:hover,
.dialogue-session-card.active {
  border-color: rgba(37, 99, 235, 0.14);
  background: rgba(37, 99, 235, 0.06);
}

.dialogue-session-card.active {
  box-shadow: inset 3px 0 0 rgba(37, 99, 235, 0.72);
}

.dialogue-session-thumb {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
}

.dialogue-session-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-session-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dialogue-session-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialogue-session-meta {
  color: var(--muted);
  font-size: 11px;
  font-weight: 650;
}

.dialogue-rail-empty {
  padding: 16px 8px;
  border: 1px dashed rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.55;
  text-align: center;
}

.dialogue-main {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas:
    "head"
    "context"
    "thread"
    "composer";
  gap: 12px;
  padding: 14px;
  overflow: hidden;
}

.dialogue-main-head {
  grid-area: head;
  min-height: 40px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.dialogue-title-block {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.dialogue-main-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
  line-height: 1.2;
}

.dialogue-main-meta {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.dialogue-main-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.dialogue-source-chip,
.dialogue-context-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.dialogue-source-chip {
  height: 30px;
  padding: 0 9px;
  border-radius: 999px;
}

.dialogue-context-row {
  grid-area: context;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
}

.dialogue-context-source {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 10px 0 6px;
  border-radius: 999px;
}

.dialogue-context-source img {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  object-fit: cover;
}

.dialogue-thread {
  grid-area: thread;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 22px;
  padding: 8px 8px 10px;
}

.dialogue-thread.empty {
  justify-content: center;
}

.dialogue-turn {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialogue-message {
  max-width: min(560px, 88%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialogue-message.user {
  align-self: flex-end;
  align-items: flex-end;
}

.dialogue-message-bubble {
  padding: 11px 14px;
  border-radius: 16px 16px 6px 16px;
  border: 1px solid rgba(37, 99, 235, 0.10);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.55;
  overflow-wrap: anywhere;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
}

.dialogue-result-card {
  width: 100%;
  max-width: min(560px, 86%);
  align-self: flex-start;
  padding: 0 0 0 14px;
  border-left: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  box-shadow: none;
}

.dialogue-preview-box {
  width: 100%;
  min-height: 220px;
  max-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 250, 252, 0.72)),
    radial-gradient(520px 240px at 50% 0%, rgba(37, 99, 235, 0.07), transparent 58%);
  overflow: hidden;
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
}

.dialogue-preview-box.has-image {
  padding: 2px;
  border-color: rgba(15, 23, 42, 0.045);
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
}

.dialogue-preview-box.loading-box {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 250, 252, 0.72)),
    radial-gradient(520px 240px at 50% 0%, rgba(37, 99, 235, 0.07), transparent 58%);
}

.dialogue-preview-box > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 16px;
  box-shadow: none;
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.dialogue-preview-box .loading-state,
.dialogue-empty-state {
  min-height: 220px;
  border-radius: 14px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.dialogue-empty-state {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
  text-align: center;
}

.dialogue-empty-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
}

.dialogue-empty-title {
  color: rgba(15, 23, 42, 0.88);
  font-size: 15px;
  font-weight: 950;
}

.dialogue-empty-copy {
  max-width: 220px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.dialogue-result-footer {
  min-height: 28px;
  margin-top: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: rgba(100, 116, 139, 0.84);
  font-size: 11px;
  font-weight: 800;
}

.dialogue-result-label {
  letter-spacing: 0.02em;
}

.dialogue-result-status {
  color: rgba(100, 116, 139, 0.72);
  font-size: 11px;
  font-weight: 800;
}

.dialogue-pill-btn,
.dialogue-upload-btn {
  height: 30px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.dialogue-upload-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dialogue-pill-btn:hover,
.dialogue-upload-btn:hover {
  border-color: rgba(15, 23, 42, 0.16);
  background: rgba(15, 23, 42, 0.03);
}

.dialogue-preview-box .preview-grid {
  gap: 8px;
}

.dialogue-preview-box .preview-grid img {
  border-radius: 14px;
  box-shadow: none;
}

.dialogue-composer {
  grid-area: composer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.07);
}

.dialogue-composer-input {
  width: 100%;
  min-height: 72px;
  max-height: 132px;
  resize: vertical;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.55;
}

.dialogue-composer-input::placeholder {
  color: rgba(100, 116, 139, 0.78);
}

.dialogue-composer-tools {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(220px, auto) minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.dialogue-tool-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dialogue-tool-group.material {
  padding-right: 8px;
  border-right: 1px solid rgba(15, 23, 42, 0.06);
}

.dialogue-tool-group.settings {
  justify-content: flex-end;
}

.dialogue-project-select {
  width: auto;
  min-width: 120px;
  flex: 0 0 auto;
}

.dialogue-compact-select {
  width: auto;
  min-width: 78px;
  flex: 0 0 auto;
}

.dialogue-project-select :deep(.input-xs),
.dialogue-compact-select :deep(.input-xs) {
  height: 30px;
  min-height: 30px;
  padding: 0 9px;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-weight: 750;
}

.dialogue-compression-control {
  height: 30px;
  min-width: 124px;
  padding: 0 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 750;
}

.dialogue-compression-control input {
  width: 68px;
  accent-color: var(--primary);
}

.dialogue-composer-status {
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  gap: 8px;
}

.dialogue-send-btn {
  min-width: 108px;
  width: auto;
  height: 42px;
  gap: 7px;
  padding: 0 16px;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}

.dialogue-send-btn span {
  display: inline;
  font-size: 13px;
  font-weight: 900;
}

.submode-switch {
  max-width: 420px;
}

.label {
  display: inline-flex;
  margin-bottom: 10px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
}

.prompt-label-row .label {
  margin-bottom: 0;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-subtle);
}

.badge {
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(37, 99, 235, 0.2);
  letter-spacing: 0.05em;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-head > div:first-child {
  min-width: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
  line-height: 1.25;
}

.section-desc {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
}

.field-caption {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  text-align: right;
}

.prompt-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.prompt-help {
  height: 30px;
  width: 30px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.6);
  color: var(--muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.prompt-help:hover {
  border-color: rgba(37, 99, 235, 0.25);
  color: var(--primary);
  background: rgba(37, 99, 235, 0.06);
}

.upload-input {
  display: none;
}

.prompt-help-panel {
  width: min(380px, 86vw);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompt-help-title {
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
}

.prompt-help-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.5;
}

.prompt-help-example {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.65);
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.5;
}

.textarea-wrapper {
  position: relative;
  background: #ffffff;
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.textarea {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  max-height: 240px;
}

.textarea:focus {
  background: #ffffff;
  border-color: var(--primary);
  box-shadow: var(--shadow-glow);
}

.prompt-toolbar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.prompt-count {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-icon {
  height: 28px;
  width: 28px;
  padding: 0;
  border-radius: 6px;
  background: rgba(0,0,0,0.03);
}

.btn-icon:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--accent);
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.ratio-btn {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  min-height: 58px;
  padding: 9px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  user-select: none;
}

.ratio-btn:hover {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.02);
}

.ratio-btn.active {
  background: rgba(37, 99, 235, 0.05);
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: 0 5px 14px rgba(37, 99, 235, 0.14);
}

.ratio-icon {
  border: 2px solid currentColor;
  border-radius: 3px;
  opacity: 0.6;
  transition: all 0.2s;
}

.ratio-btn.active .ratio-icon {
  opacity: 1;
}

.ratio-1-1 { width: 18px; height: 18px; }
.ratio-16-9 { width: 22px; height: 14px; }
.ratio-9-16 { width: 14px; height: 22px; }
.ratio-4-3 { width: 20px; height: 16px; }
.ratio-3-4 { width: 16px; height: 20px; }

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
}

.settings-grid {
  padding-top: 16px;
}

.field-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.range-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.range-value {
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
}

.field-range {
  width: 100%;
  margin-top: 10px;
  accent-color: var(--primary);
}

.field-range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.advanced-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  padding: 14px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.advanced-title {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
}

.advanced-summary {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.advanced-arrow {
  font-size: 12px;
  color: var(--primary);
  font-weight: 900;
}

.preview-panel-head {
  margin-bottom: 16px;
}

.preview-panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-panel-title {
  font-size: 15px;
  font-weight: 900;
  color: var(--text);
}

.preview-reset-btn {
  flex: none;
}

.preview-panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.generate-btn {
  height: 44px;
  font-size: 14px;
  position: relative;
  overflow: hidden;
  margin-top: 8px;
  border-radius: 12px;
}

.glow-effect {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: rotate(45deg);
  animation: sweep 3s infinite;
  z-index: 0;
}

@keyframes sweep {
  0% { transform: translateX(-100%) rotate(45deg); }
  50%, 100% { transform: translateX(100%) rotate(45deg); }
}

.preview-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: transparent;
  border-radius: var(--radius-md);
  padding: 0;
  border: none;
  box-shadow: none;
  min-height: 0;
}

.preview-box {
  width: 100%;
  max-height: 100%;
  max-width: 100%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.preview-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.preview-grid img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.loading-state,
.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(15, 23, 42, 0.14);
  border-radius: var(--radius-md);
  background: transparent;
  transition: all 0.3s;
  min-height: 280px;
}

.loading-state {
  border-color: rgba(37, 99, 235, 0.3);
  border-style: solid;
}

.loader-core {
  color: var(--primary);
  margin-bottom: 16px;
  background: #ffffff;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.2);
}

.pulse-icon {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.loading-text {
  font-size: 14px;
  color: var(--primary);
  font-weight: 600;
  letter-spacing: 0.05em;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}

.empty-text {
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
}

.empty-subtext {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
  max-width: 260px;
  text-align: center;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.2);
}

@media (max-width: 760px) {
  .workspace-shell {
    gap: 12px;
    width: 100%;
  }

  .workspace-header {
    flex-direction: column;
  }

  .workspace-mode-switch {
    max-width: none;
  }

  .dialogue-workspace {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 14px;
  }

  .dialogue-rail {
    max-height: none;
    overflow: visible;
    padding: 12px;
  }

  .dialogue-main-head,
  .dialogue-composer-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .dialogue-main {
    min-height: 520px;
    padding: 14px;
  }

  .dialogue-main-actions,
  .dialogue-composer-status {
    justify-content: flex-start;
    width: 100%;
  }

  .dialogue-thread {
    overflow: visible;
  }

  .dialogue-preview-box,
  .dialogue-preview-box .loading-state,
  .dialogue-empty-state {
    min-height: 190px;
  }

  .dialogue-message {
    max-width: 100%;
  }

  .dialogue-composer-tools {
    width: 100%;
    grid-template-columns: 1fr;
    justify-content: flex-start;
  }

  .dialogue-tool-group.material {
    padding-right: 0;
    padding-bottom: 8px;
    border-right: 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  .dialogue-tool-group.settings {
    justify-content: flex-start;
  }

  .dialogue-upload-btn {
    justify-content: center;
  }

  .dialogue-send-btn {
    flex: none;
    width: 100%;
  }

  .creator-grid {
    gap: 14px;
  }

  .creator-left,
  .creator-right {
    min-width: 0;
    width: 100%;
  }

  .creator-preview-panel {
    padding: 14px !important;
  }

  .preview-panel-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .preview-panel-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .preview-panel-actions .model-badge {
    min-height: 30px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .section-head,
  .prompt-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .field-caption {
    text-align: left;
  }

  .textarea {
    min-height: 132px;
    max-height: 46dvh;
  }

  .prompt-actions {
    width: 100%;
  }

  .prompt-actions .btn:not(.btn-icon) {
    flex: 1 1 132px;
  }

  .prompt-actions .btn-icon {
    flex: 0 0 32px;
    height: 32px;
    width: 32px;
  }

  .prompt-actions {
    justify-content: flex-start;
  }

  .ratio-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .ratio-btn {
    height: 54px;
    gap: 6px;
    font-size: 12px;
  }

  .advanced-card {
    border-radius: 14px;
    padding: 12px;
  }

  .advanced-toggle {
    align-items: flex-start;
  }

  .advanced-arrow {
    flex: 0 0 auto;
  }

  .preview-container {
    min-height: 240px;
    padding: 0;
  }

  .preview-box {
    max-height: none;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .loading-state,
  .empty-state {
    min-height: 230px;
  }

  .empty-icon-wrapper {
    width: 58px;
    height: 58px;
    margin-bottom: 14px;
    border-radius: 18px;
  }

  .empty-subtext {
    max-width: 220px;
  }

  .generate-btn {
    height: 48px;
    margin-top: 4px;
  }
}

@media (max-width: 420px) {
  .ratio-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .prompt-actions .btn:not(.btn-icon) {
    flex-basis: calc(50% - 6px);
    padding: 0 8px;
  }

  .preview-reset-btn span {
    display: none;
  }
}
</style>
