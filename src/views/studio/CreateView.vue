<template>
  <div class="workspace-shell">
    <div class="workspace-mode-row">
      <ModeSwitch
        v-model="primaryMode"
        :options="primaryModes"
        label="工作台模式"
        class="workspace-mode-switch"
      />
    </div>

    <div class="creator-grid">
      <div class="panel flex flex-col gap-4 creator-left">
        <form @submit.prevent="submitCurrentMode" class="flex flex-col gap-4">
          <template v-if="primaryMode === 'text' || primaryMode === 'image'">
            <div v-if="primaryMode === 'text'">
              <label class="label">快捷预设</label>
              <QuickPresetsBar
                :presets="quickPresets"
                :active-key="activePresetKey"
                @select="applyPreset"
              />
            </div>

            <div v-if="primaryMode === 'image'">
              <label class="label">参考图</label>
              <ImageUploadGallery v-model="generationInputFiles" :max-count="4" />
              <div class="field-hint">支持 1-4 张参考图，顺序越靠前权重越高。</div>
            </div>

            <div>
              <div class="prompt-label-row">
                <label class="label">提示词</label>
                <Popover v-model:open="promptHelpOpen" placement="bottom-start" :offset="10">
                  <template #trigger>
                    <button type="button" class="prompt-help" aria-label="提示词写法说明" title="提示词写法说明">
                      <InfoIcon :size="16" />
                    </button>
                  </template>
                  <div class="prompt-help-panel">
                    <div class="prompt-help-title">提示词要点</div>
                    <ul class="prompt-help-list">
                      <li>主体：对象、场景、动作</li>
                      <li>风格：写实、插画、3D 或摄影</li>
                      <li>构图：位置、留白、前后景</li>
                      <li>光线：自然光、棚拍、逆光</li>
                      <li>限制：不要文字、水印、Logo</li>
                    </ul>
                    <div class="prompt-help-example">
                      示例：单个香水瓶居中，纯白背景，柔光棚拍，自然阴影，高清细节，不要文字和水印
                    </div>
                  </div>
                </Popover>
              </div>
              <div class="textarea-wrapper">
                <textarea
                  v-model="generationForm.prompt"
                  class="textarea custom-scrollbar"
                  required
                  maxlength="4000"
                  placeholder="例如：咖啡新品海报，温暖自然光，产品居中，背景干净，预留标题区域。"
                ></textarea>
              </div>
              <div class="prompt-toolbar">
                <span class="prompt-count">{{ generationForm.prompt.length }} / 4000</span>
                <div class="prompt-actions">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="loading || !generationForm.prompt"
                    @click="openEnhancePreview"
                  >
                    <Wand2Icon :size="16" />
                    <span>润色预览</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="!generationForm.prompt"
                    @click="clearGenerationPrompt"
                  >
                    <Trash2Icon :size="16" />
                    <span>清空</span>
                  </button>
                  <Popover v-model:open="moreOpen" placement="bottom-end" :offset="10">
                    <template #trigger>
                      <button type="button" class="btn btn-ghost btn-icon" aria-label="更多操作" title="更多">
                        <MoreHorizontalIcon :size="16" />
                      </button>
                    </template>
                    <div class="more-menu">
                      <button
                        type="button"
                        class="more-item"
                        :disabled="!displayPreviewUrls[0] && !loading"
                        @click="clearPreviewFromMenu"
                      >
                        <RefreshCcwIcon :size="16" />
                        <span>重置预览</span>
                      </button>
                    </div>
                  </Popover>
                </div>
              </div>
            </div>

            <div>
              <label class="label">图片比例</label>
              <div class="ratio-grid">
                <button
                  v-for="ratio in ratios"
                  :key="ratio"
                  type="button"
                  class="ratio-btn"
                  :class="{ active: generationForm.aspectRatio === ratio }"
                  @click="generationForm.aspectRatio = ratio"
                >
                  <div class="ratio-icon" :class="'ratio-' + ratio.replace(':', '-')"></div>
                  <span>{{ ratio }}</span>
                </button>
              </div>
            </div>

            <div class="advanced-card">
              <button
                type="button"
                class="advanced-toggle"
                :class="{ open: advancedOpen }"
                @click="advancedOpen = !advancedOpen"
              >
                <div>
                  <div class="advanced-title">更多设置</div>
                  <div class="advanced-summary">{{ advancedSummary }}</div>
                </div>
                <span class="advanced-arrow">{{ advancedOpen ? '收起' : '展开' }}</span>
              </button>

              <div v-if="advancedOpen" class="settings-grid">
                <div>
                  <label class="label">生成质量</label>
                  <SelectMenu
                    v-model="generationForm.qualityTier"
                    size="sm"
                    :options="qualityTierOptions"
                    placeholder="选择生成质量"
                  />
                </div>

                <div>
                  <label class="label">一次生成</label>
                  <SelectMenu
                    v-model="generationForm.count"
                    size="sm"
                    :options="countOptions"
                    placeholder="选择生成张数"
                  />
                </div>

                <div>
                  <label class="label">输出格式</label>
                  <SelectMenu
                    v-model="generationForm.outputFormat"
                    size="sm"
                    :options="outputFormatOptions"
                    placeholder="选择输出格式"
                  />
                  <div class="field-hint">PNG 画质稳，JPEG/WEBP 体积小。</div>
                </div>

                <div>
                  <div class="range-label-row">
                    <label class="label">压缩率</label>
                    <span class="range-value">{{ supportsCompression ? `${generationForm.outputCompression}%` : 'PNG 无损' }}</span>
                  </div>
                  <input
                    v-model="generationForm.outputCompression"
                    class="field-range"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    :disabled="!supportsCompression"
                  />
                  <div class="field-hint">
                    {{ supportsCompression ? '仅 JPEG / WEBP 生效，数值越低体积越小。' : 'PNG 无损，不需要压缩率。' }}
                  </div>
                </div>

                <div>
                  <label class="label">背景策略</label>
                  <SelectMenu
                    v-model="generationForm.background"
                    size="sm"
                    :options="backgroundOptions"
                    placeholder="选择背景策略"
                  />
                  <div class="field-hint">透明背景支持 PNG / WEBP。</div>
                </div>

                <div>
                  <label class="label">审核等级</label>
                  <SelectMenu
                    v-model="generationForm.moderation"
                    size="sm"
                    :options="moderationOptions"
                    placeholder="选择审核等级"
                  />
                  <div class="field-hint">默认推荐自动；测试可用低限制。</div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="primaryMode === 'dialogue'">
            <div class="source-card dialogue-context-card">
              <div class="section-head">
                <div>
                  <div class="section-title">上下文</div>
                  <div class="section-desc">{{ dialogueSourceHint }}</div>
                </div>
                <div class="dialogue-source-actions">
                  <button
                    v-if="currentImage?.imageUrls?.[0]"
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="adoptActiveResultAsDialogueSource"
                  >
                    用结果继续
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="startBlankDialogue">
                    新建
                  </button>
                  <button
                    v-if="hasDialogueSource"
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="clearDialogueSource"
                  >
                    断开
                  </button>
                </div>
              </div>
              <div class="source-summary" :class="{ empty: !hasDialogueSource }">
                <span class="source-chip">{{ dialogueSourceTag }}</span>
                <span class="source-text">{{ dialogueSourceSummary }}</span>
              </div>
              <div class="dialogue-context-upload">
                <div class="dialogue-upload-label-row">
                  <label class="label">起始图片（选填）</label>
                  <span class="field-caption">上传后作为新起点</span>
                </div>
                <ImageUploadGallery v-model="dialogueInputFiles" :max-count="1" />
              </div>
            </div>

            <div class="dialogue-prompt-card">
              <div class="prompt-label-row">
                <label class="label">本轮要求</label>
                <span class="field-caption">逐轮调整，不必一次写完。</span>
              </div>
              <div class="textarea-wrapper">
                <textarea
                  v-model="dialoguePrompt"
                  class="textarea custom-scrollbar"
                  required
                  maxlength="4000"
                  :placeholder="dialoguePromptPlaceholder"
                ></textarea>
              </div>
              <div class="prompt-toolbar">
                <span class="prompt-count">{{ dialoguePrompt.length }} / 4000</span>
                <div class="prompt-actions">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="loading || !dialoguePrompt"
                    @click="openEnhancePreview('dialogue')"
                  >
                    <Wand2Icon :size="16" />
                    <span>润色预览</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="!dialoguePrompt"
                    @click="dialoguePrompt = ''"
                  >
                    <Trash2Icon :size="16" />
                    <span>清空</span>
                  </button>
                  <Popover v-model:open="moreOpen" placement="bottom-end" :offset="10">
                    <template #trigger>
                      <button type="button" class="btn btn-ghost btn-icon" aria-label="更多操作" title="更多">
                        <MoreHorizontalIcon :size="16" />
                      </button>
                    </template>
                    <div class="more-menu">
                      <button
                        type="button"
                        class="more-item"
                        :disabled="!displayPreviewUrls[0] && !loading"
                        @click="clearPreviewFromMenu"
                      >
                        <RefreshCcwIcon :size="16" />
                        <span>重置预览</span>
                      </button>
                    </div>
                  </Popover>
                </div>
              </div>
            </div>

            <div class="dialogue-history-card">
              <div class="section-head">
                <div>
                  <div class="section-title">历史</div>
                  <div class="section-desc">保留最近几轮，点击复用。</div>
                </div>
              </div>
              <div v-if="dialogueTimelineMessages.length" class="dialogue-history-list">
                <button
                  v-for="(item, index) in dialogueTimelineMessages"
                  :key="item.id"
                  type="button"
                  class="dialogue-history-item"
                  @click="dialoguePrompt = item.prompt"
                >
                  <div class="dialogue-history-content">
                    <div class="dialogue-history-meta">
                      <span>第 {{ index + 1 }} 轮</span>
                      <span>{{ formatDialogueTime(item.createdAt) }}</span>
                    </div>
                    <div class="dialogue-history-text">{{ item.prompt }}</div>
                  </div>
                </button>
              </div>
              <div v-else class="dialogue-history-empty">
                暂无记录。生成后会保留在这里。
              </div>
            </div>
          </template>

          <template v-else>
            <div class="source-card tool-source-card">
              <div class="section-head">
                <div>
                  <div class="section-title">来源图</div>
                  <div class="section-desc">{{ toolSourceHint }}</div>
                </div>
                <div class="tool-source-actions">
                  <button type="button" class="btn btn-ghost btn-xs" @click="openSourcePicker('tool')">
                    {{ hasToolSource ? '更换图片' : '选择图片' }}
                  </button>
                  <button
                    v-if="toolSourceFile"
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="clearToolSource"
                  >
                    清除
                  </button>
                </div>
              </div>
              <div class="source-summary" :class="{ empty: !hasToolSource }">
                <span class="source-chip">{{ toolSourceTag }}</span>
                <span class="source-text">{{ toolSourceSummary }}</span>
              </div>
            </div>

            <div class="tool-card">
              <div class="section-head">
                <div>
                  <div class="section-title">选择工具</div>
                  <div class="section-desc">选择工具后进入编辑器。</div>
                </div>
              </div>
              <div class="tool-grid">
                <button
                  v-for="item in toolOptions"
                  :key="item.value"
                  type="button"
                  class="tool-btn"
                  :class="{ active: selectedTool === item.value, disabled: item.disabled }"
                  :disabled="item.disabled"
                  @click="selectedTool = item.value"
                >
                  <span class="tool-name">{{ item.label }}</span>
                  <span class="tool-desc">{{ item.description }}</span>
                  <span class="tool-status">{{ toolStatusText(item) }}</span>
                </button>
              </div>
              <div class="tool-current-note">
                {{ currentToolMeta.detail }}
              </div>
            </div>

            <div class="tool-prompt-card">
              <div class="prompt-label-row">
                <label class="label">补充要求</label>
                <span class="field-caption">{{ toolPromptHint }}</span>
              </div>
              <div class="textarea-wrapper">
                <textarea
                  v-model="toolPrompt"
                  class="textarea custom-scrollbar"
                  maxlength="4000"
                  :placeholder="toolPromptPlaceholder"
                ></textarea>
              </div>
              <div class="prompt-toolbar">
                <span class="prompt-count">{{ toolPrompt.length }} / 4000</span>
                <div class="prompt-actions">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="!toolPrompt"
                    @click="toolPrompt = ''"
                  >
                    <Trash2Icon :size="16" />
                    <span>清空</span>
                  </button>
                </div>
              </div>
            </div>
          </template>

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
import { computed, reactive, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SparklesIcon, LoaderIcon, Wand2Icon, Trash2Icon, RefreshCcwIcon, ImageIcon, MoreHorizontalIcon, InfoIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { useSiteStore } from '../../stores/site'
import ModeSwitch from '../../components/ModeSwitch.vue'
import ImageUploadGallery from '../../components/ImageUploadGallery.vue'
import QuickPresetsBar from '../../components/studio/QuickPresetsBar.vue'
import PromptEnhanceModal from '../../components/studio/PromptEnhanceModal.vue'
import ImageEditModal from '../../components/studio/ImageEditModal.vue'
import { Popover, SelectMenu } from '../../components/common'
import { quickPresets } from './create.presets'

const imagesStore = useImagesStore()
const siteStore = useSiteStore()
const route = useRoute()
const router = useRouter()

const primaryModes = [
  { label: '文生图', value: 'text' },
  { label: '图生图', value: 'image' },
  { label: '对话创作', value: 'dialogue' },
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
  }
]
const ratios = ['1:1', '16:9', '9:16', '4:3', '3:4']
const qualityTierOptions = [
  { label: '1K 标准', value: '1k' },
  { label: '2K 高清', value: '2k' },
  { label: '4K 超清', value: '4k' }
]
const countOptions = [
  { label: '1 张', value: 1 },
  { label: '2 张', value: 2 },
  { label: '4 张', value: 4 }
]
const outputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WEBP', value: 'webp' }
]
const backgroundOptions = [
  { label: '自动', value: 'auto' },
  { label: '透明背景', value: 'transparent' },
  { label: '纯色背景', value: 'opaque' }
]
const moderationOptions = [
  { label: '自动', value: 'auto' },
  { label: '低限制', value: 'low' }
]

const primaryMode = ref('text')
const activePresetKey = ref('')
const moreOpen = ref(false)
const advancedOpen = ref(false)
const enhanceModalOpen = ref(false)
const enhanceTarget = ref('generation')
const promptHelpOpen = ref(false)
const sourceInputRef = ref(null)
const sourcePickerTarget = ref('')

const generationInputFiles = ref([])
const generationInputPreviewUrl = ref('')
const dialogueInputFiles = ref([])
const dialogueInputPreviewUrl = ref('')

const dialoguePrompt = ref('')
const dialogueChainId = ref('')
const dialogueMessages = ref([])
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

const generationForm = reactive({
  prompt: '',
  aspectRatio: '1:1',
  qualityTier: '1k',
  count: 1,
  outputFormat: 'png',
  outputCompression: 100,
  background: 'auto',
  moderation: 'auto'
})

function getRatioValue(ratio) {
  if (ratio === 'auto') return '1 / 1'
  const [w, h] = String(ratio || '1:1').split(':')
  return `${w} / ${h}`
}

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

async function loadInputFromUrl(value, targetRef) {
  const url = decodeURIComponent(String(value || ''))
  if (!url) return
  const file = await fileFromUrl(url, url.split('/').pop() || 'input.png')
  targetRef.value = [file]
}

function generationOptions(extra = {}) {
  return {
    qualityTier: generationForm.qualityTier,
    count: generationForm.count,
    outputFormat: generationForm.outputFormat,
    outputCompression: generationForm.outputCompression,
    background: generationForm.background,
    moderation: generationForm.moderation,
    ...extra
  }
}

function clearPreview() {
  imagesStore.clearJob()
  errorMsg.value = ''
}

function clearPreviewFromMenu() {
  clearPreview()
  moreOpen.value = false
}

function clearGenerationPrompt() {
  generationForm.prompt = ''
  activePresetKey.value = ''
  moreOpen.value = false
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
  moreOpen.value = false
  enhanceModalOpen.value = true
}

function applyEnhancedPrompt(val) {
  const nextPrompt = String(val || '').trim()
  if (!nextPrompt) return
  if (enhanceTarget.value === 'dialogue') {
    dialoguePrompt.value = nextPrompt
    return
  }
  generationForm.prompt = nextPrompt
}

function openSourcePicker(target) {
  sourcePickerTarget.value = target
  sourceInputRef.value?.click()
}

function resetEditorSource() {
  editorSourceUrl.value = ''
  editorSourceFile.value = null
  editorSourceImageId.value = ''
}

function clearToolSource() {
  toolSourceFile.value = null
  revokeObjectUrl(toolSourcePreviewUrl.value)
  toolSourcePreviewUrl.value = ''
}

function adoptActiveResultAsDialogueSource() {
  if (!currentImage.value?.imageUrls?.[0]) return
  dialogueSourceImage.value = currentImage.value
  dialogueInputFiles.value = []
  revokeObjectUrl(dialogueInputPreviewUrl.value)
  dialogueInputPreviewUrl.value = ''
  dialogueChainId.value = currentImage.value.continuationChainId || ''
  void fetchDialogueMessages({
    chainId: dialogueChainId.value,
    imageId: currentImage.value.id || ''
  })
}

function clearDialogueSource() {
  dialogueSourceImage.value = null
  dialogueInputFiles.value = []
  revokeObjectUrl(dialogueInputPreviewUrl.value)
  dialogueInputPreviewUrl.value = ''
  dialogueChainId.value = ''
  dialogueMessages.value = []
  clearPreview()
}

function startBlankDialogue() {
  const hasContext = Boolean(
    dialoguePrompt.value ||
      dialogueChainId.value ||
      dialogueMessages.value.length ||
      currentDialogueSource() ||
      previewUrls.value.length
  )
  if (hasContext) {
    const ok = window.confirm('确定新建空白对话吗？当前输入、上下文和预览会清空，不再沿旧记录继续生成。')
    if (!ok) return
  }
  clearDialogueSource()
  dialoguePrompt.value = ''
  moreOpen.value = false
}

async function fetchDialogueMessages(params = {}) {
  const data = await imagesStore.fetchDialogueHistory({
    chainId: params.chainId || '',
    imageId: params.imageId || '',
    limit: 5
  })
  dialogueChainId.value = data.chainId || dialogueChainId.value
  dialogueMessages.value = Array.isArray(data.messages) ? data.messages : []
}

function currentDialogueSource() {
  if (dialogueSourceImage.value?.imageUrls?.[0]) {
    return {
      type: 'result',
      url: dialogueSourceImage.value.imageUrls[0],
      imageId: dialogueSourceImage.value.id || '',
      continuationChainId: dialogueSourceImage.value.continuationChainId || '',
      previewUrl: dialogueSourceImage.value.imageUrls[0]
    }
  }
  const file = dialogueInputFiles.value[0]
  if (file instanceof File) {
    return { type: 'reference', file, previewUrl: dialogueInputPreviewUrl.value }
  }
  return null
}

function resolveToolSource() {
  if (toolSourceFile.value instanceof File) {
    return { type: 'manual', file: toolSourceFile.value, previewUrl: toolSourcePreviewUrl.value }
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
  if (primaryMode.value === 'text') {
    await imagesStore.generate(
      generationForm.prompt,
      generationForm.aspectRatio,
      generationOptions({ mode: 'text' })
    )
    return
  }
  const validFiles = Array.isArray(generationInputFiles.value)
    ? generationInputFiles.value.filter((file) => file instanceof File)
    : []
  if (!validFiles.length) {
    throw new Error('请先上传参考图')
  }
  await imagesStore.generateFromImages(
    validFiles,
    generationForm.prompt,
    generationForm.aspectRatio,
    generationOptions({ mode: 'image' })
  )
}

async function submitDialogueMode() {
  const source = currentDialogueSource()
  const result = await imagesStore.continueDialogue({
    prompt: dialoguePrompt.value,
    aspectRatio: generationForm.aspectRatio,
    chainId:
      source?.type === 'reference'
        ? ''
        : source?.continuationChainId || dialogueChainId.value || '',
    sourceImageId: source?.type === 'result' ? source.imageId || '' : '',
    imageFile: source?.type === 'reference' ? source.file : null,
    qualityTier: generationForm.qualityTier,
    background: generationForm.background
  })
  dialogueChainId.value = result.chainId || result.image?.continuationChainId || ''
  dialogueSourceImage.value = result.image || null
  dialogueMessages.value = Array.isArray(result.messages) ? result.messages : []
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

  if (currentToolMeta.value.value === 'cutout') {
    await imagesStore.editImage({
      imageFile: sourceFile,
      prompt: toolPrompt.value.trim() || '抠出主体，边缘自然干净，不要阴影、地面、文字和额外元素。',
      aspectRatio: generationForm.aspectRatio,
      operationType: 'cutout',
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
    errorMsg.value = error?.message || '操作失败'
  }
}

function onSourcePick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (sourcePickerTarget.value === 'tool') {
    toolSourceFile.value = file
    setPreviewUrl(toolSourcePreviewUrl, file)
  }
  sourcePickerTarget.value = ''
}

function toolStatusText(item) {
  if (item.disabled) return '即将上线'
  if (selectedTool.value === item.value) return '当前选择'
  return '可用'
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
  dialogueSourceImage.value = data.image
  dialogueChainId.value = data.image.continuationChainId || ''
  dialogueMessages.value = Array.isArray(data.dialogueMessages) ? data.dialogueMessages : []
}

onMounted(async () => {
  try {
    const routeMode = String(route.query.mode || '')
    if (routeMode === 'tools') {
      primaryMode.value = 'tools'
    } else if (routeMode === 'dialogue') {
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

    if (route.query.input) {
      if (primaryMode.value === 'dialogue') {
        dialogueSourceImage.value = null
        dialogueChainId.value = ''
        dialogueMessages.value = []
        await loadInputFromUrl(route.query.input, dialogueInputFiles)
      } else {
        primaryMode.value = 'image'
        await loadInputFromUrl(route.query.input, generationInputFiles)
      }
    }

    if (route.query.imageId) {
      await hydrateDialogueFromImage(String(route.query.imageId))
    }
  } catch (error) {
    errorMsg.value = error?.message || '初始化失败'
  } finally {
    if (route.query.prompt || route.query.mode || route.query.input || route.query.imageId) {
      router.replace({ query: {} })
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
    }
  },
  { immediate: true }
)

watch(
  () => generationForm.background,
  (value) => {
    // 透明背景不支持 JPEG，优先保留透明需求。
    if (value === 'transparent' && generationForm.outputFormat === 'jpeg') {
      generationForm.outputFormat = 'png'
    }
  }
)

watch(
  () => generationForm.outputFormat,
  (value) => {
    if (value === 'jpeg' && generationForm.background === 'transparent') {
      generationForm.background = 'auto'
    }
  }
)

watch(primaryMode, () => {
  moreOpen.value = false
  promptHelpOpen.value = false
  errorMsg.value = ''
})

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
const supportsCompression = computed(() => generationForm.outputFormat === 'jpeg' || generationForm.outputFormat === 'webp')
const hasDialogueSource = computed(() => Boolean(currentDialogueSource()))
const dialogueTimelineMessages = computed(() => {
  return Array.isArray(dialogueMessages.value) ? dialogueMessages.value.slice().reverse() : []
})
const toolSource = computed(() => resolveToolSource())
const hasToolSource = computed(() => Boolean(toolSource.value))
const currentToolMeta = computed(() => toolOptions.find((item) => item.value === selectedTool.value) || toolOptions[0])
const usesImage2Model = computed(() => primaryMode.value === 'text' || primaryMode.value === 'image')
const toolPromptHint = computed(() => {
  if (currentToolMeta.value.value === 'cutout') return '可补充主体边缘、阴影和输出风格要求。'
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
  return '例如：修复手部细节和脸部边缘，保持整体风格不变。'
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
const previewAspectRatio = computed(() => getRatioValue(generationForm.aspectRatio))
const advancedSummary = computed(() => {
  const qualityLabel = qualityTierOptions.find((item) => item.value === generationForm.qualityTier)?.label || '标准'
  const countLabel = countOptions.find((item) => item.value === generationForm.count)?.label || '1 张'
  const formatLabel = String(generationForm.outputFormat || 'png').toUpperCase()
  const backgroundLabel = backgroundOptions.find((item) => item.value === generationForm.background)?.label || '自动'
  const moderationLabel = moderationOptions.find((item) => item.value === generationForm.moderation)?.label || '自动'
  const summaryParts = [qualityLabel, countLabel, formatLabel, backgroundLabel, `${moderationLabel}审核`]
  if (supportsCompression.value) {
    summaryParts.push(`压缩 ${generationForm.outputCompression}%`)
  }
  return summaryParts.join(' · ')
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
    return '局部重绘和扩图会基于来源图处理。'
  }
  return '输入提示词后生成。'
})
const dialogueSourceTag = computed(() => {
  const source = currentDialogueSource()
  if (source?.type === 'reference') return '参考图起点'
  if (source?.type === 'result') return dialogueChainId.value ? '当前对话链' : '已有结果'
  return '空白开始'
})
const dialogueSourceSummary = computed(() => {
  const source = currentDialogueSource()
  if (source?.type === 'reference') return '从这张图开始，后续会保留为同一条对话。'
  if (source?.type === 'result') return '沿这张结果继续。'
  return '直接从文字开始。'
})
const dialogueSourceHint = computed(() => {
  if (dialogueChainId.value) return '沿当前对话继续。'
  return '空白开始，或选择图片起点。'
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

.model-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.07);
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: default;
  user-select: none;
}

.submode-switch {
  max-width: 420px;
}

.label {
  margin-bottom: 8px;
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
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(99, 102, 241, 0.2);
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

.dialogue-source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  border-color: rgba(99, 102, 241, 0.25);
  color: var(--primary);
  background: rgba(99, 102, 241, 0.06);
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
  background: rgba(236, 72, 153, 0.1);
  color: var(--accent);
}

.more-menu {
  min-width: 200px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.more-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  text-align: left;
}

.more-item:hover:not(:disabled) {
  border-color: rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
}

.more-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.source-card,
.tool-card,
.tool-prompt-card,
.dialogue-history-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  padding: 14px;
}

.tool-source-card,
.tool-card,
.tool-prompt-card {
  padding: 12px;
}

.tool-source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dialogue-context-card {
  padding: 12px;
}

.dialogue-context-card .section-head,
.dialogue-history-card .section-head {
  margin-bottom: 10px;
}

.dialogue-context-upload {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.07);
}

.dialogue-upload-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.dialogue-upload-label-row .label {
  margin-bottom: 0;
}

.dialogue-prompt-card {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.16);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
}

.dialogue-prompt-card .textarea {
  min-height: 150px;
}

.source-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.75);
  padding: 12px 14px;
  min-width: 0;
}

.source-summary.empty {
  border-style: dashed;
}

.source-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
}

.source-text {
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.dialogue-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  padding-right: 2px;
}

.dialogue-history-item {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 11px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.dialogue-history-item:hover {
  border-color: rgba(99, 102, 241, 0.28);
  background: rgba(99, 102, 241, 0.04);
}

.dialogue-history-text {
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dialogue-history-meta {
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dialogue-history-empty {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 700;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tool-btn {
  min-height: 88px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover:not(:disabled) {
  border-color: rgba(99, 102, 241, 0.22);
  background: rgba(255, 255, 255, 1);
}

.tool-btn.active {
  border-color: rgba(99, 102, 241, 0.32);
  background: rgba(99, 102, 241, 0.04);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.08);
}

.tool-btn.disabled {
  opacity: 0.56;
}

.tool-name {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
}

.tool-desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
  font-weight: 600;
}

.tool-status {
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.tool-btn.active .tool-status {
  background: rgba(99, 102, 241, 0.10);
  color: var(--primary);
}

.tool-current-note {
  margin-top: 10px;
  padding: 10px 11px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.035);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  font-weight: 700;
}

.tool-prompt-card .textarea {
  min-height: 112px;
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.ratio-btn {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  user-select: none;
}

.ratio-btn:hover {
  border-color: rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.02);
}

.ratio-btn.active {
  background: rgba(99, 102, 241, 0.05);
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
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
  gap: 14px;
}

.settings-grid {
  padding-top: 12px;
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
  margin-top: 2px;
  accent-color: var(--primary);
}

.field-range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.advanced-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  padding: 12px 14px;
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
  height: 52px;
  font-size: 16px;
  position: relative;
  overflow: hidden;
  margin-top: 8px;
  border-radius: 14px;
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
  border-color: rgba(99, 102, 241, 0.3);
  border-style: solid;
}

.loader-core {
  color: var(--primary);
  margin-bottom: 20px;
  background: #ffffff;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
}

.pulse-icon {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.loading-text {
  font-size: 15px;
  color: var(--primary);
  font-weight: 600;
  letter-spacing: 0.05em;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}

.empty-text {
  color: var(--text);
  font-size: 16px;
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

  .tool-grid,
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

  .dialogue-prompt-card .textarea,
  .tool-prompt-card .textarea {
    min-height: 126px;
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

  .source-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  .source-chip {
    min-width: 0;
  }

  .dialogue-source-actions,
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

  .advanced-card,
  .source-card,
  .tool-card,
  .tool-prompt-card,
  .dialogue-history-card,
  .dialogue-prompt-card {
    border-radius: 14px;
    padding: 12px;
  }

  .advanced-toggle {
    align-items: flex-start;
  }

  .advanced-arrow {
    flex: 0 0 auto;
  }

  .tool-btn {
    min-height: 82px;
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
