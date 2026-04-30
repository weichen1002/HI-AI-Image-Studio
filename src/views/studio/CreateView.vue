<template>
  <div class="creator-grid">
    <!-- Left Panel: Prompt -->
    <div class="panel flex flex-col gap-6">
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

      <form @submit.prevent="submitGenerate" class="flex flex-col gap-6">
        <div>
          <label class="label">灵感库</label>
          <div class="flex gap-2 flex-wrap mb-4">
            <button
              type="button"
              class="template-chip"
              v-for="tpl in templates"
              :key="tpl"
              @click="insertTemplate(tpl)"
            >
              {{ tpl.slice(0, 16) }}...
            </button>
          </div>
          
          <div v-if="mode === 'image'" class="mb-4">
            <label class="label">参考图</label>
            <ImageUpload v-model="inputFile" />
          </div>

          <label class="label">提示词 (Prompt)</label>
          <div class="textarea-wrapper">
            <textarea
              v-model="form.prompt"
              class="textarea custom-scrollbar"
              required
              maxlength="4000"
              placeholder="例如：生成一张适合小红书封面的咖啡新品海报，温暖自然光，产品在画面中心，文字区域干净..."
            ></textarea>
            <div class="textarea-footer">
              <span>{{ form.prompt.length }} / 4000</span>
              <button
                type="button"
                class="btn btn-ghost"
                style="height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 800;"
                :disabled="loading || isEnhancing || !form.prompt"
                @click="enhancePrompt"
              >
                {{ isEnhancing ? '润色中...' : 'AI 润色' }}
              </button>
              <button type="button" class="btn btn-ghost btn-icon" @click="form.prompt = ''" v-if="form.prompt" title="清空">
                <Trash2Icon :size="14" />
              </button>
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
          <input class="input disabled-input" value="PNG / URL" disabled />
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
    <div class="panel flex flex-col h-full" style="padding: 32px; min-height: 540px;">
      <div class="flex justify-between items-center mb-4 px-2">
        <div>
          <h2 class="text-h3">生成预览</h2>
          <p class="text-eyebrow mt-1" style="color: var(--muted); letter-spacing: 0; text-transform: none;">{{ form.aspectRatio }} · {{ statusText }}</p>
        </div>
        <button class="btn btn-ghost" style="height: 36px; padding: 0 16px;" @click="clearPreview" :disabled="!previewUrl && !loading">
          <RefreshCcwIcon :size="16" />
          重置
        </button>
      </div>

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
            <p style="font-size: 13px; color: var(--muted); margin-top: 8px; max-width: 200px; text-align: center;">在左侧输入提示词，点击生成按钮开始创作</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SparklesIcon, LoaderIcon, Wand2Icon, Trash2Icon, RefreshCcwIcon, ImageIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { useAuthStore } from '../../stores/auth'
import ModeSwitch from '../../components/ModeSwitch.vue'
import ImageUpload from '../../components/ImageUpload.vue'
import { apiFetch } from '../../utils/api'

const imagesStore = useImagesStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const templates = [
  "生成一张适合小红书封面的生活方式视觉，白色科技感排版...",
  "为一款高端香氛产品生成电商商品主图，纯白科技感背景...",
  "Vintage 1920s style jazz music festival poster...",
  "A lush green forest with a small clear stream..."
]

const ratios = ["1:1", "16:9", "9:16", "4:3", "3:4"]

const mode = ref('text')
const inputFile = ref(null)

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
const isEnhancing = ref(false)
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

function getRatioValue(ratio) {
  if (ratio === 'auto') return '1 / 1'
  const [w, h] = ratio.split(':')
  return `${w} / ${h}`
}

function insertTemplate(tpl) {
  const cleanTpl = tpl.replace('...', '')
  form.prompt = cleanTpl
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

async function enhancePrompt() {
  if (!form.prompt || isEnhancing.value) return
  errorMsg.value = ''
  isEnhancing.value = true
  try {
    const data = await apiFetch('/api/prompts/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: form.prompt })
    })
    form.prompt = data?.prompt || form.prompt
    await authStore.fetchUser()
  } catch (e) {
    errorMsg.value = e.message || '润色失败'
  } finally {
    isEnhancing.value = false
  }
}
</script>

<style scoped>
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

.template-chip {
  background: #ffffff;
  border: 1px solid var(--line);
  color: var(--muted);
  padding: 8px 14px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.template-chip:hover {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.05);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
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
  padding-bottom: 48px;
  border-radius: var(--radius-sm);
  max-height: 300px;
}
.textarea:focus {
  background: #ffffff;
  border-color: var(--primary);
  box-shadow: var(--shadow-glow);
}
.textarea-footer {
  position: absolute;
  bottom: 8px;
  right: 12px;
  left: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  pointer-events: none;
}
.btn-icon {
  pointer-events: auto;
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

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.ratio-btn {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  height: 72px;
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
  height: 60px;
  font-size: 16px;
  position: relative;
  overflow: hidden;
  margin-top: 12px;
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
  background: #ffffff;
  border-radius: var(--radius-md);
  padding: 24px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);
  min-height: clamp(320px, 52vh, 620px);
}

.preview-box {
  width: 100%;
  max-height: 100%;
  max-width: min(100%, 760px);
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
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
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
  border: 2px dashed var(--line);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  transition: all 0.3s;
  min-height: 280px;
}

.loading-state {
  border-color: rgba(99, 102, 241, 0.3);
  background: var(--gradient-subtle);
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
    padding: 16px;
  }

  .generate-btn {
    height: 56px;
  }
}

@media (max-width: 420px) {
  .ratio-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
