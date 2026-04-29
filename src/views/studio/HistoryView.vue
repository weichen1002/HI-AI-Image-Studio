<template>
  <div>
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-h2">灵感记录</h2>
        <p class="text-lead mt-2">每次生成都会保存到这里，方便回看提示词和继续优化方向。</p>
      </div>
      <button class="btn btn-ghost" @click="fetchImages" :disabled="imagesStore.isLoading">
        <RefreshCwIcon :size="18" />
        刷新
      </button>
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

    <div v-else-if="!imagesStore.images.length" class="panel flex flex-col items-center justify-center text-center gap-4" style="height: 400px;">
      <ImageOffIcon :size="48" class="text-muted" />
      <div class="text-lead">暂无历史记录</div>
      <router-link to="/studio" class="btn btn-primary">去创作</router-link>
    </div>

    <div v-else class="grid-history">
      <div v-for="img in imagesStore.images" :key="img.id" class="history-card">
        <div class="history-cover">
          <img v-if="img.imageUrls && img.imageUrls[0]" :src="img.imageUrls[0]" loading="lazy" />
          <div v-else class="fallback-cover">无图片</div>
          <button
            v-if="img.imageUrls && img.imageUrls[0]"
            class="cover-action"
            type="button"
            title="下载图片"
            @click="downloadImage(img)"
          >
            <DownloadIcon :size="16" />
          </button>
        </div>
        <div class="history-body">
          <p class="prompt-text">{{ img.prompt }}</p>
          <div class="meta">
            <span>{{ img.aspectRatio }}</span>
            <span>{{ formatTime(img.createdAt) }}</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-ghost action-btn" type="button" @click="reusePrompt(img)">
              <Wand2Icon :size="15" />
              再次创作
            </button>
            <button
              v-if="img.imageUrls && img.imageUrls[0]"
              class="btn btn-ghost action-btn"
              type="button"
              @click="downloadImage(img)"
            >
              <DownloadIcon :size="15" />
              下载
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { DownloadIcon, RefreshCwIcon, ImageOffIcon, Wand2Icon } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useImagesStore } from '../../stores/images'

const imagesStore = useImagesStore()
const router = useRouter()

onMounted(() => {
  fetchImages()
})

function fetchImages() {
  imagesStore.fetchImages()
}

function formatTime(val) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(val))
}

function reusePrompt(image) {
  router.push({ path: '/studio', query: { prompt: image.prompt } })
}

function downloadName(image) {
  const date = new Date(image.createdAt || Date.now()).toISOString().slice(0, 10)
  return `hi-image-${date}-${image.id || Date.now()}.png`
}

function triggerDownload(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadImage(image) {
  const url = image.imageUrls?.[0]
  if (!url) return

  if (url.startsWith('data:')) {
    triggerDownload(url, downloadName(image))
    return
  }

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, downloadName(image))
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<style scoped>
.grid-history {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.history-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 0;
}

.history-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.history-cover {
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  position: relative;
}

.history-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-action {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
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

.history-card:hover .cover-action,
.cover-action:focus-visible {
  opacity: 1;
  transform: translateY(0);
}

.cover-action:hover {
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
  padding: 16px;
  min-height: 132px;
  display: flex;
  flex-direction: column;
}

.prompt-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 63px;
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  font-size: 12px;
  color: var(--muted);
}

.meta span {
  min-width: 0;
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.action-btn {
  height: 36px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 13px;
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
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
