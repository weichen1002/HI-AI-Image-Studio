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

        <div class="chips" v-if="image">
          <span class="chip chip-primary">{{ image.mode === 'image' ? '图文生图' : '文生图' }}</span>
          <span class="chip">{{ image.aspectRatio }}</span>
          <span class="chip chip-muted">{{ formatTime(image.createdAt) }}</span>
        </div>
      </div>

      <div class="hero-actions">
        <Button class="hero-action" @click="reuse">
          <template #icon>
            <Wand2Icon :size="16" />
          </template>
          再次创作
        </Button>
        <Button v-if="activeUrl" variant="ghost" class="hero-action" @click="downloadActive">
          <template #icon>
            <DownloadIcon :size="16" />
          </template>
          下载{{ tabLabel }}
        </Button>
        <Button v-if="image" variant="ghost" class="hero-action" @click="remove">
          <template #icon>
            <Trash2Icon :size="16" />
          </template>
          删除
        </Button>
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
          <div class="preview-frame" :class="{ result: tab === 'result' }" :style="{ aspectRatio: previewAspect }">
            <img v-if="activeUrl" :src="activeUrl" :alt="tabLabel" />
            <div v-else class="fallback-cover">无图片</div>
          </div>
        </div>
      </section>

      <aside class="meta-panel" aria-label="记录信息">
        <div class="meta-card">
          <div class="meta-head">
            <div class="meta-title">提示词</div>
            <div class="meta-actions">
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
import { ArrowLeftIcon, CopyIcon, DownloadIcon, Wand2Icon, Trash2Icon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'
import { Button, toastError, toastSuccess } from '../../components/common'

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

async function remove() {
  if (!image.value?.id) return
  const ok = window.confirm('确定删除这条记录吗？')
  if (!ok) return
  await imagesStore.deleteImage(image.value.id)
  router.push('/studio/history')
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
  background:
    radial-gradient(1200px 400px at 10% 0%, rgba(99, 102, 241, 0.16), transparent 55%),
    radial-gradient(900px 360px at 95% 10%, rgba(236, 72, 153, 0.14), transparent 55%),
    rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 14px 44px rgba(99, 102, 241, 0.10);
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

  .preview-frame.result {
    width: 100%;
    height: auto;
  }
}
</style>
