<template>
  <div class="detail-shell">
    <div class="detail-hero">
      <div class="hero-left">
        <button class="btn btn-ghost hero-back" @click="goBack">
          <ArrowLeftIcon :size="16" />
          返回
        </button>

        <div class="hero-title">
          <div class="title-row">
            <h2 class="text-h2">记录详情</h2>
            <div class="chips" v-if="image">
              <span class="chip chip-primary">{{ image.mode === 'image' ? '图文生图' : '文生图' }}</span>
              <span class="chip">{{ image.aspectRatio }}</span>
            </div>
          </div>
          <p class="hero-subtitle">查看结果图与参考图，并可一键复现输入继续优化。</p>
        </div>
      </div>

      <div class="hero-actions">
        <button class="btn btn-primary hero-action" @click="reuse">
          <Wand2Icon :size="16" />
          再次创作
        </button>
        <button v-if="activeUrl" class="btn btn-ghost hero-action" @click="downloadActive">
          <DownloadIcon :size="16" />
          下载{{ tabLabel }}
        </button>
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
          <div class="segmented" v-if="hasInput">
            <button type="button" class="seg-btn" :class="{ active: tab === 'result' }" @click="tab = 'result'">结果图</button>
            <button type="button" class="seg-btn" :class="{ active: tab === 'input' }" @click="tab = 'input'">参考图</button>
          </div>
          <div class="preview-meta">
            <span class="preview-kicker">{{ tabLabel }}</span>
            <span class="preview-dot">·</span>
            <span class="preview-kicker">{{ formatTime(image.createdAt) }}</span>
          </div>
        </div>

        <div class="preview-stage">
          <div class="preview-frame" :style="{ aspectRatio: previewAspect }">
            <img v-if="activeUrl" :src="activeUrl" :alt="tabLabel" />
            <div v-else class="fallback-cover">无图片</div>
          </div>
        </div>
      </section>

      <aside class="meta-panel" aria-label="记录信息">
        <div class="meta-card">
          <div class="meta-head">
            <div class="meta-title">提示词</div>
          </div>
          <div class="prompt-box">{{ image.prompt }}</div>
        </div>

        <div class="meta-card">
          <div class="kv-grid">
            <div class="kv">
              <div class="kv-label">模式</div>
              <div class="kv-value">{{ image.mode === 'image' ? '图文生图' : '文生图' }}</div>
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
              <div class="kv-label">ID</div>
              <div class="kv-value mono">{{ image.id }}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, DownloadIcon, Wand2Icon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'

const route = useRoute()
const router = useRouter()
const imagesStore = useImagesStore()

const loading = ref(true)
const errorMsg = ref('')
const image = ref(null)
const tab = ref('result')

const hasInput = computed(() => !!image.value?.inputImageUrls?.[0])
const tabLabel = computed(() => (tab.value === 'input' ? '参考图' : '结果图'))
const activeUrl = computed(() => {
  if (!image.value) return ''
  if (tab.value === 'input') return image.value.inputImageUrls?.[0] || ''
  return image.value.imageUrls?.[0] || ''
})

const previewAspect = computed(() => {
  const ratio = image.value?.aspectRatio || '1:1'
  if (ratio === '16:9') return '16 / 9'
  if (ratio === '9:16') return '9 / 16'
  if (ratio === '4:3') return '4 / 3'
  if (ratio === '3:4') return '3 / 4'
  return '1 / 1'
})

onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await imagesStore.fetchImage(route.params.id)
    image.value = data
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
  if (image.value.mode === 'image' && image.value.inputImageUrls?.[0]) {
    router.push({ path: '/studio', query: { mode: 'image', prompt: image.value.prompt, input: encodeURIComponent(image.value.inputImageUrls[0]) } })
    return
  }
  router.push({ path: '/studio', query: { prompt: image.value.prompt } })
}

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
</script>

<style scoped>
.detail-shell {
  background: var(--bg-card);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: var(--radius-lg);
  padding: 26px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 18px 16px;
  border-radius: calc(var(--radius-md) + 8px);
  background:
    radial-gradient(1200px 400px at 10% 0%, rgba(99, 102, 241, 0.16), transparent 55%),
    radial-gradient(900px 360px at 95% 10%, rgba(236, 72, 153, 0.14), transparent 55%),
    rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 12px 30px rgba(99, 102, 241, 0.08);
}

.hero-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.hero-back {
  height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  flex: 0 0 auto;
}

.hero-title {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.chips {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chip {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
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

.hero-subtitle {
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.hero-action {
  height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 14px;
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
  gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background:
    radial-gradient(800px 260px at 10% 0%, rgba(99, 102, 241, 0.08), transparent 55%),
    radial-gradient(700px 220px at 95% 0%, rgba(236, 72, 153, 0.06), transparent 55%),
    rgba(255,255,255,0.5);
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

.preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.preview-kicker {
  white-space: nowrap;
}

.preview-dot {
  opacity: 0.6;
}

.preview-stage {
  width: 100%;
  padding: 16px;
  background:
    radial-gradient(900px 360px at 25% 0%, rgba(99, 102, 241, 0.10), transparent 55%),
    radial-gradient(800px 340px at 90% 20%, rgba(236, 72, 153, 0.08), transparent 55%),
    var(--bg-subtle);
}

.preview-frame {
  width: 100%;
  max-width: 980px;
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

.preview-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 10px;
}

.fallback-cover {
  color: var(--muted);
  font-size: 14px;
}

.meta-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.meta-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

.prompt-box {
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(99, 102, 241, 0.03);
  padding: 12px 12px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
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
  .hero-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .detail-hero {
    flex-direction: column;
  }
}
</style>
