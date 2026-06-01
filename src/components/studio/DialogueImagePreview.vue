<template>
  <div
    class="dialogue-image-preview"
    :class="{ grid: normalizedUrls.length > 1 }"
    :style="{ aspectRatio }"
  >
    <button
      v-for="(url, index) in normalizedUrls"
      :key="`${url}-${index}`"
      type="button"
      class="dialogue-image-tile"
      :aria-label="`放大预览${altBase} ${index + 1}`"
      @click="openAt(index)"
    >
      <img :src="url" :alt="`${altBase} ${index + 1}`" />
      <span class="dialogue-image-zoom">
        <Maximize2Icon :size="14" />
      </span>
    </button>
  </div>

  <Teleport to="body">
    <Transition name="dialogue-lightbox-fade">
      <div
        v-if="activeUrl"
        class="dialogue-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="图片放大预览"
        @click="close"
      >
        <button type="button" class="dialogue-lightbox-close" aria-label="关闭预览" @click.stop="close">
          <XIcon :size="18" />
        </button>
        <button
          v-if="normalizedUrls.length > 1"
          type="button"
          class="dialogue-lightbox-nav prev"
          aria-label="上一张"
          @click.stop="move(-1)"
        >
          <ChevronLeftIcon :size="22" />
        </button>
        <img class="dialogue-lightbox-image" :src="activeUrl" :alt="`${altBase} 放大预览`" @click.stop />
        <button
          v-if="normalizedUrls.length > 1"
          type="button"
          class="dialogue-lightbox-nav next"
          aria-label="下一张"
          @click.stop="move(1)"
        >
          <ChevronRightIcon :size="22" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon, Maximize2Icon, XIcon } from 'lucide-vue-next'

const props = defineProps({
  urls: { type: Array, default: () => [] },
  aspectRatio: { type: String, default: '1 / 1' },
  altBase: { type: String, default: '对话图片' }
})

const activeIndex = ref(-1)

const normalizedUrls = computed(() => props.urls.filter(Boolean))
const activeUrl = computed(() => normalizedUrls.value[activeIndex.value] || '')

let restoreBody = null

function openAt(index) {
  activeIndex.value = index
}

function close() {
  activeIndex.value = -1
}

function lockBodyScroll() {
  if (restoreBody) return
  const body = document.body
  const prevOverflow = body.style.overflow
  const prevPaddingRight = body.style.paddingRight
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
  restoreBody = () => {
    body.style.overflow = prevOverflow
    body.style.paddingRight = prevPaddingRight
    restoreBody = null
  }
}

function unlockBodyScroll() {
  restoreBody?.()
}

function move(offset) {
  const count = normalizedUrls.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + offset + count) % count
}

function onKeydown(event) {
  if (!activeUrl.value) return
  if (event.key === 'Escape') close()
  if (event.key === 'ArrowLeft') move(-1)
  if (event.key === 'ArrowRight') move(1)
}

watch(
  activeUrl,
  (url) => {
    if (url) {
      lockBodyScroll()
      window.addEventListener('keydown', onKeydown)
    } else {
      unlockBodyScroll()
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true }
)

watch(
  normalizedUrls,
  (urls) => {
    if (activeIndex.value >= urls.length) close()
  }
)

onBeforeUnmount(() => {
  unlockBodyScroll()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.dialogue-image-preview {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.dialogue-image-preview.grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dialogue-image-tile {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.72);
  cursor: zoom-in;
}

.dialogue-image-tile img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dialogue-image-zoom {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: rgba(15, 23, 42, 0.62);
  opacity: 0;
  transform: translateY(3px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  backdrop-filter: blur(10px);
}

.dialogue-image-tile:hover .dialogue-image-zoom,
.dialogue-image-tile:focus-visible .dialogue-image-zoom {
  opacity: 1;
  transform: translateY(0);
}

.dialogue-image-tile:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.42);
  outline-offset: 3px;
}

.dialogue-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100000040;
  display: grid;
  place-items: center;
  padding: 48px;
  background: rgba(248, 250, 252, 0.88);
  backdrop-filter: blur(18px);
}

.dialogue-lightbox-image {
  max-width: min(1120px, 86vw);
  max-height: 86vh;
  object-fit: contain;
  border-radius: 18px;
  box-shadow: 0 28px 90px rgba(15, 23, 42, 0.22);
}

.dialogue-lightbox-close,
.dialogue-lightbox-nav {
  position: fixed;
  display: grid;
  place-items: center;
  border: 1px solid rgba(203, 213, 225, 0.78);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #111827;
  cursor: pointer;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12);
}

.dialogue-lightbox-close {
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
}

.dialogue-lightbox-nav {
  top: 50%;
  width: 42px;
  height: 42px;
  transform: translateY(-50%);
}

.dialogue-lightbox-nav.prev {
  left: 24px;
}

.dialogue-lightbox-nav.next {
  right: 24px;
}

.dialogue-lightbox-fade-enter-active,
.dialogue-lightbox-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialogue-lightbox-fade-enter-from,
.dialogue-lightbox-fade-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .dialogue-lightbox {
    padding: 18px;
  }

  .dialogue-lightbox-image {
    max-width: 94vw;
    max-height: 82vh;
    border-radius: 14px;
  }

  .dialogue-lightbox-close {
    top: 14px;
    right: 14px;
  }

  .dialogue-lightbox-nav.prev {
    left: 12px;
  }

  .dialogue-lightbox-nav.next {
    right: 12px;
  }
}
</style>
