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

    <div v-if="imagesStore.isLoading" class="flex justify-center items-center" style="height: 300px;">
      <LoaderIcon class="animate-spin text-muted" :size="32" />
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
        </div>
        <div class="history-body">
          <p class="prompt-text">{{ img.prompt }}</p>
          <div class="meta">
            <span>{{ img.aspectRatio }}</span>
            <span>{{ formatTime(img.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { RefreshCwIcon, LoaderIcon, ImageOffIcon } from 'lucide-vue-next'
import { useImagesStore } from '../../stores/images'

const imagesStore = useImagesStore()

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
}

.history-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

.meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}

.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
