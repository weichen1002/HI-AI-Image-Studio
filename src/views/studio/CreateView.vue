<template>
  <div class="creator-grid">
    <!-- Left Panel: Prompt -->
    <div class="panel flex flex-col gap-4 creator-left">
      <div class="flex justify-between items-center">
        <h2 class="text-h3 flex items-center gap-2">
          <div class="icon-wrapper">
            <Wand2Icon :size="20" style="color: var(--primary)" />
          </div>
          描述你的画面
        </h2>
        <span class="badge">gpt-image-2</span>
      </div>

      <ModeSwitch v-model="mode" />

      <div>
        <label class="label">快捷预设</label>
        <QuickPresetsBar
          :presets="quickPresets"
          :active-key="activePresetKey"
          @select="applyPreset"
        />
      </div>

      <form @submit.prevent="submitGenerate" class="flex flex-col gap-4">
        <div>
          <div v-if="mode === 'image'" class="mb-4">
            <label class="label">参考图</label>
            <ImageUpload v-model="inputFile" />
          </div>

          <div class="prompt-label-row">
            <label class="label">提示词 (Prompt)</label>
            <Popover v-model:open="promptHelpOpen" placement="bottom-start" :offset="10">
              <template #trigger>
                <button type="button" class="prompt-help" aria-label="提示词写法说明" title="提示词写法说明">
                  <InfoIcon :size="16" />
                </button>
              </template>
              <div class="prompt-help-panel">
                <div class="prompt-help-title">怎么写更容易出好图</div>
                <ul class="prompt-help-list">
                  <li>主体：是什么、在哪里、在做什么</li>
                  <li>风格：写实/插画/3D/摄影、氛围关键词</li>
                  <li>构图：居中/偏左/留白、前景/背景层次</li>
                  <li>光线：自然光/棚拍/逆光、柔和或强对比</li>
                  <li>限制：不要文字/水印/Logo（需要留白也建议写出来）</li>
                </ul>
                <div class="prompt-help-example">
                  示例：电商主图，单个香水瓶居中，极简纯白背景，柔光棚拍，阴影自然，高清细节，不要文字与水印
                </div>
              </div>
            </Popover>
          </div>
          <div class="textarea-wrapper">
            <textarea
              v-model="form.prompt"
              class="textarea custom-scrollbar"
              required
              maxlength="4000"
              placeholder="例如：生成一张适合小红书封面的咖啡新品海报，温暖自然光，产品在画面中心，文字区域干净..."
            ></textarea>
          </div>
          <div class="prompt-toolbar">
            <span class="prompt-count">{{ form.prompt.length }} / 4000</span>
            <div class="prompt-actions">
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="loading || !form.prompt"
                @click="openEnhancePreview"
              >
                <Wand2Icon :size="16" />
                <span>润色预览</span>
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="!form.prompt"
                @click="clearPrompt"
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
                    :disabled="!previewUrl && !loading"
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
              type="button"
              v-for="ratio in ratios" 
              :key="ratio"
              class="ratio-btn"
              :class="{ active: form.aspectRatio === ratio }"
              @click="form.aspectRatio = ratio"
            >
              <div class="ratio-icon" :class="'ratio-' + ratio.replace(':', '-')"></div>
              <span>{{ ratio }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="label">输出格式</label>
          <Input class="disabled-input" model-value="PNG / URL" disabled />
        </div>

        <button type="submit" class="btn btn-primary generate-btn" :disabled="loading || !form.prompt">
          <div class="glow-effect" v-if="!loading && form.prompt"></div>
          <SparklesIcon v-if="!loading" :size="20" style="position: relative; z-index: 1" />
          <LoaderIcon v-else class="animate-spin" :size="20" style="position: relative; z-index: 1" />
          <span style="position: relative; z-index: 1">{{ loading ? 'AI 正在绘制...' : '生成图片' }}</span>
        </button>

        <p v-if="errorMsg" class="error-text text-center">{{ errorMsg }}</p>
      </form>
    </div>

    <!-- Right Panel: Preview -->
    <div class="panel flex flex-col h-full creator-right creator-preview-panel" style="padding: 18px;">
      <div class="preview-container">
        <div class="preview-box" :style="{ aspectRatio: getRatioValue(form.aspectRatio) }">
          <img v-if="previewUrl" :src="previewUrl" alt="生成预览" />
          <div v-else-if="loading" class="loading-state">
            <div class="loader-core">
              <SparklesIcon :size="32" class="pulse-icon" />
            </div>
            <span class="loading-text">正在构思画面细节...</span>
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon-wrapper">
              <ImageIcon :size="48" style="color: var(--primary);" />
            </div>
            <div class="empty-text">您的作品将在这里呈现</div>
            <p style="font-size: 13px; color: var(--muted); margin-top: 8px; max-width: 220px; text-align: center;">输入提示词并点击生成开始创作</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <PromptEnhanceModal
    v-model:open="enhanceModalOpen"
    :original-prompt="form.prompt"
    @apply="applyEnhancedPrompt"
  />
</template>

<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SparklesIcon, LoaderIcon, Wand2Icon, Trash2Icon, RefreshCcwIcon, ImageIcon, MoreHorizontalIcon, InfoIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import ModeSwitch from '../../components/ModeSwitch.vue'
import ImageUpload from '../../components/ImageUpload.vue'
import QuickPresetsBar from '../../components/studio/QuickPresetsBar.vue'
import PromptEnhanceModal from '../../components/studio/PromptEnhanceModal.vue'
import { Button, Input, Popover } from '../../components/common'
import { quickPresets } from './create.presets'

const imagesStore = useImagesStore()
const route = useRoute()
const router = useRouter()

const ratios = ["1:1", "16:9", "9:16", "4:3", "3:4"]

const mode = ref('text')
const inputFile = ref(null)
const moreOpen = ref(false)
const enhanceModalOpen = ref(false)
const promptHelpOpen = ref(false)
const activePresetKey = ref('')

const form = reactive({
  prompt: '',
  aspectRatio: '1:1'
})

async function loadInputFromUrl(value) {
  const url = decodeURIComponent(String(value || ''))
  if (!url) return
  const response = await fetch(url)
  if (!response.ok) throw new Error('参考图加载失败')
  const blob = await response.blob()
  const name = url.split('/').pop() || 'input.png'
  inputFile.value = new File([blob], name, { type: blob.type || 'image/png' })
}

onMounted(async () => {
  const nextMode = route.query.mode === 'image' ? 'image' : 'text'
  mode.value = nextMode

  if (route.query.prompt) {
    form.prompt = String(route.query.prompt)
  }

  if (route.query.input) {
    mode.value = 'image'
    try {
      await loadInputFromUrl(route.query.input)
    } catch (e) {
      errorMsg.value = e.message || '参考图加载失败'
    }
  }

  if (route.query.prompt || route.query.mode || route.query.input) {
    router.replace({ query: {} })
  }
})

watch(mode, (val) => {
  if (val === 'text') inputFile.value = null
})

const errorMsg = ref('')
const loading = computed(() => imagesStore.isGenerating)
const previewUrl = computed(() => imagesStore.activeJob?.image?.imageUrls?.[0] || '')
const statusText = computed(() => {
  const job = imagesStore.activeJob
  if (!job) return '准备就绪'
  if (job.status === 'running') return '正在请求 gpt-image-2...'
  if (job.status === 'success') return '生成完成'
  if (job.status === 'error') return '生成失败'
  return '准备就绪'
})

function clearPreview() {
  imagesStore.clearJob()
  errorMsg.value = ''
}

function clearPreviewFromMenu() {
  clearPreview()
  moreOpen.value = false
}

function clearPrompt() {
  form.prompt = ''
  activePresetKey.value = ''
  moreOpen.value = false
}

function getRatioValue(ratio) {
  if (ratio === 'auto') return '1 / 1'
  const [w, h] = ratio.split(':')
  return `${w} / ${h}`
}

function applyPreset(key) {
  const preset = quickPresets.find((p) => p.key === key)
  if (!preset) return
  activePresetKey.value = preset.key
  form.aspectRatio = preset.aspectRatio
  form.prompt = preset.prompt
}

async function submitGenerate() {
  if (!form.prompt) return
  
  errorMsg.value = ''

  try {
    if (mode.value === 'text') {
      await imagesStore.generate(form.prompt, form.aspectRatio)
      return
    }

    await imagesStore.generateFromImage(inputFile.value, form.prompt, form.aspectRatio)
  } catch (e) {
    errorMsg.value = e.message || '生成失败'
  }
}

function openEnhancePreview() {
  moreOpen.value = false
  enhanceModalOpen.value = true
}

function applyEnhancedPrompt(val) {
  form.prompt = String(val || '').trim() || form.prompt
}
</script>

<style scoped>
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

.prompt-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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

.prompt-help-panel {
  width: min(380px, 86vw);
  padding: 12px 12px;
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
  padding: 10px 10px;
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
  padding: 10px 10px;
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

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
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

.disabled-input {
  background: var(--bg-subtle);
  color: var(--muted);
  border-color: var(--line);
  cursor: not-allowed;
  box-shadow: none;
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

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.loading-state, .empty-state {
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
  .ratio-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .preview-container {
    min-height: 300px;
    padding: 0;
  }

  .generate-btn {
    height: 52px;
  }
}

@media (max-width: 420px) {
  .ratio-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
