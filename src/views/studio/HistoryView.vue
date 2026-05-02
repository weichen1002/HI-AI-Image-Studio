<template>
  <div>
    <div class="history-toolbar">
      <div class="history-stats">
        <span v-if="imagesCount > 0" class="stat-pill">共 {{ imagesCount }} 条</span>
      </div>
      <div class="history-actions">
        <Button variant="ghost" @click="clearAll" :disabled="imagesStore.isLoading || !imagesStore.images.length">
          <template #icon>
            <Trash2Icon :size="18" />
          </template>
          清空
        </Button>
        <Button variant="ghost" @click="fetchImages" :disabled="imagesStore.isLoading">
          <template #icon>
            <RefreshCwIcon :size="18" />
          </template>
          刷新
        </Button>
      </div>
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

    <div v-else-if="!imagesCount" class="panel flex flex-col items-center justify-center text-center gap-4" style="height: 420px;">
      <ImageOffIcon :size="48" class="text-muted" />
      <div class="text-lead">暂无历史记录</div>
      <LinkButton to="/studio">去创作</LinkButton>
    </div>

    <div v-else class="grid-history">
      <div v-for="img in sortedImages" :key="img.id" class="history-card" role="button" tabindex="0" @click="openDetail(img)" @keydown.enter.prevent="openDetail(img)">
        <div class="history-cover">
          <img v-if="coverUrl(img)" :src="coverUrl(img)" loading="lazy" />
          <div v-else class="fallback-cover">无图片</div>

          <div v-if="(img.imageUrls || []).length > 1" class="count-badge">{{ img.imageUrls.length }} 张</div>

          <div v-if="img.inputImageUrls && img.inputImageUrls[0]" class="cover-toggle" @click.stop>
            <button type="button" class="toggle-btn" :class="{ active: coverMode[img.id] !== 'input' }" @click="setCoverMode(img, 'result')">结果</button>
            <button type="button" class="toggle-btn" :class="{ active: coverMode[img.id] === 'input' }" @click="setCoverMode(img, 'input')">参考</button>
          </div>

          <div class="cover-actions" @click.stop>
            <button
              v-if="coverUrl(img)"
              class="cover-action"
              type="button"
              title="下载图片"
              @click="downloadCover(img)"
            >
              <DownloadIcon :size="16" />
            </button>
            <button class="cover-action danger" type="button" title="删除" @click="removeOne(img)">
              <Trash2Icon :size="16" />
            </button>
          </div>
        </div>
        <div class="history-body">
          <p class="prompt-text">{{ img.prompt }}</p>
          <div class="meta">
            <span class="meta-pill">{{ modeLabel(img) }}</span>
            <span class="meta-pill">{{ img.aspectRatio }}</span>
            <span class="meta-time">{{ formatTime(img.createdAt) }}</span>
          </div>
          <div class="card-actions">
            <Button class="action-btn" type="button" @click.stop="reusePrompt(img)">
              <template #icon>
                <Wand2Icon :size="15" />
              </template>
              再次创作
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { DownloadIcon, RefreshCwIcon, ImageOffIcon, Wand2Icon, Trash2Icon } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useImagesStore } from '../../stores/images'
import { Button, LinkButton } from '../../components/common'

const imagesStore = useImagesStore()
const router = useRouter()

function modeLabel(image) {
  if (image?.mode === 'dialogue' || image?.mode === 'continuous') return '对话创作'
  if (image?.mode === 'tools') return '图片工具'
  if (image?.mode === 'image') return '图生图'
  return '文生图'
}
const coverMode = reactive({})
const imagesCount = computed(() => (imagesStore.images || []).length)
const sortedImages = computed(() => {
  const list = Array.isArray(imagesStore.images) ? imagesStore.images.slice() : []
  list.sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime()
    const tb = new Date(b?.createdAt || 0).getTime()
    return tb - ta
  })
  return list
})

onMounted(() => {
  fetchImages()
})

function fetchImages() {
  imagesStore.fetchImages()
}

async function removeOne(image) {
  if (!image?.id) return
  const ok = window.confirm('确定删除这条记录吗？')
  if (!ok) return
  await imagesStore.deleteImage(image.id)
}

async function clearAll() {
  const ok = window.confirm('确定清空全部灵感记录吗？该操作不可撤销。')
  if (!ok) return
  await imagesStore.clearImages()
}

function formatTime(val) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(val))
}

function reusePrompt(image) {
  if (image.mode === 'dialogue' || image.mode === 'continuous') {
    router.push({ path: '/studio', query: { mode: 'dialogue', imageId: image.id } })
    return
  }
  if (image.mode === 'tools') {
    router.push({ path: '/studio', query: { mode: 'tools' } })
    return
  }
  if (image.mode === 'image' && image.inputImageUrls?.[0]) {
    router.push({ path: '/studio', query: { mode: 'image', prompt: image.prompt, input: encodeURIComponent(image.inputImageUrls[0]) } })
    return
  }
  router.push({ path: '/studio', query: { prompt: image.prompt } })
}

function openDetail(image) {
  router.push({ path: `/studio/history/${image.id}` })
}

function setCoverMode(image, val) {
  coverMode[image.id] = val
}

function coverUrl(image) {
  const current = coverMode[image.id] === 'input' ? 'input' : 'result'
  if (current === 'input') return image.inputImageUrls?.[0] || image.imageUrls?.[0] || ''
  return image.imageUrls?.[0] || ''
}

function downloadName(image) {
  const date = new Date(image.createdAt || Date.now()).toISOString().slice(0, 10)
  const current = coverMode[image.id] === 'input' ? 'input' : 'result'
  return `hi-image-${date}-${current}-${image.id || Date.now()}.png`
}

function triggerDownload(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadCover(image) {
  const url = coverUrl(image)
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
.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.history-stats {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.grid-history {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.history-card {
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: calc(var(--radius-md) + 6px);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s;
  min-width: 0;
  backdrop-filter: blur(18px);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
}

.history-card:hover {
  transform: translateY(-3px);
  border-color: rgba(99, 102, 241, 0.18);
  box-shadow: 0 18px 46px rgba(99, 102, 241, 0.12);
}

.history-card:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.6);
  outline-offset: 2px;
}

.history-cover {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--bg-subtle);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
  position: relative;
}

.history-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.01);
  transition: transform 0.25s ease;
}

.history-card:hover .history-cover img {
  transform: scale(1.05);
}

.cover-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
}

.toggle-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.toggle-btn.active {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.35);
  background: var(--gradient-subtle);
}

.cover-action {
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

.cover-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
}

.count-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}

.history-card:hover .cover-action,
.cover-action:focus-visible {
  opacity: 1;
  transform: translateY(0);
}

.cover-action:hover {
  background: #ffffff;
}

.cover-action.danger {
  color: var(--accent);
}

.cover-action.danger:hover {
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
  font-size: 13px;
  line-height: 1.55;
  color: var(--text);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 62px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.meta-pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.72);
}

.meta-time {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

.card-actions {
  display: flex;
  margin-top: 12px;
}

.action-btn {
  height: 36px;
  width: 100%;
  border-radius: 10px;
  font-size: 13px;
}

@media (max-width: 520px) {
  .grid-history {
    grid-template-columns: 1fr;
  }
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
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
