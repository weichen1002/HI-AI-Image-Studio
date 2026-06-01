<template>
  <div class="presets-root">
    <div class="presets-wrap">
      <div
        ref="rowRef"
        class="presets-row"
        :class="{ dragging }"
        role="list"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <button
          v-for="preset in presets"
          :key="preset.key"
          type="button"
          class="preset-chip"
          :class="{ active: preset.key === activeKey }"
          role="listitem"
          @click="onPresetClick(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="edge-fade edge-fade-left" :class="{ show: canScrollLeft }"></div>
      <div class="edge-fade edge-fade-right" :class="{ show: canScrollRight }"></div>
    </div>

    <div class="preset-meta">
      <Popover v-if="activePreset?.hint" v-model:open="hintOpen" placement="bottom-start" :offset="10">
        <template #trigger>
          <button type="button" class="hint-btn" aria-label="查看留白建议">
            <span>留白建议</span>
            <InfoIcon :size="14" />
          </button>
        </template>
        <div class="hint-panel">
          <div class="hint-title">留白建议是什么</div>
          <div class="hint-desc">用于预留干净区域放标题/卖点/Logo，让图更“可用”。默认不写进提示词，避免干扰生成。</div>
          <div class="hint-divider"></div>
          <div class="hint-title">本场景建议</div>
          <div class="hint-desc">{{ activePreset.hint }}</div>
        </div>
      </Popover>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { InfoIcon } from 'lucide-vue-next'
import { Popover } from '../common'

const props = defineProps({
  presets: {
    type: Array,
    default: () => []
  },
  activeKey: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['select'])

const rowRef = ref(null)
const hintOpen = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const dragging = ref(false)
const dragPointerId = ref(null)
const dragStartX = ref(0)
const dragStartScrollLeft = ref(0)
const draggedDistance = ref(0)
const suppressClick = ref(false)

const activePreset = computed(() => {
  const key = props.activeKey
  if (!key) return null
  return props.presets.find((p) => p.key === key) || null
})

function updateScrollState() {
  const el = rowRef.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  const left = el.scrollLeft
  canScrollLeft.value = left > 1
  canScrollRight.value = max - left > 1
}

function onWheel(e) {
  const el = rowRef.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 1) return
  if (!e.shiftKey) return
  if (!e.deltaY) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}

function onPointerDown(e) {
  const el = rowRef.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 1) return
  if (dragPointerId.value !== null) return
  dragging.value = false
  suppressClick.value = false
  draggedDistance.value = 0
  dragPointerId.value = e.pointerId
  dragStartX.value = e.clientX
  dragStartScrollLeft.value = el.scrollLeft
}

function onPointerMove(e) {
  const el = rowRef.value
  if (!el) return
  if (dragPointerId.value !== e.pointerId) return
  const dx = e.clientX - dragStartX.value
  draggedDistance.value = Math.max(draggedDistance.value, Math.abs(dx))
  if (draggedDistance.value > 4 && !dragging.value) {
    dragging.value = true
    el.setPointerCapture?.(e.pointerId)
  }
  if (draggedDistance.value > 6) suppressClick.value = true
  if (!dragging.value) return
  el.scrollLeft = dragStartScrollLeft.value - dx
  updateScrollState()
}

function onPointerUp(e) {
  if (dragPointerId.value !== null && e.pointerId !== dragPointerId.value) return
  dragPointerId.value = null
  dragging.value = false
  if (suppressClick.value) {
    setTimeout(() => {
      suppressClick.value = false
    }, 0)
  }
}

function onPresetClick(key) {
  if (suppressClick.value) return
  draggedDistance.value = 0
  suppressClick.value = false
  emit('select', key)
}

function onResize() {
  updateScrollState()
}

onMounted(async () => {
  await nextTick()
  updateScrollState()
  rowRef.value?.addEventListener('scroll', updateScrollState, { passive: true })
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  rowRef.value?.removeEventListener('scroll', updateScrollState)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.presets-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.presets-wrap {
  position: relative;
}

.presets-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 0 2px;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  user-select: none;
}

.presets-row.dragging {
  cursor: grabbing;
}

.presets-row::-webkit-scrollbar {
  height: 0px;
}
.presets-row::-webkit-scrollbar-track {
  background: transparent;
}
.presets-row::-webkit-scrollbar-thumb {
  background: transparent;
}

.preset-chip {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.2s;
  scroll-snap-align: start;
}

.preset-chip:hover {
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--primary);
  background: rgba(37, 99, 235, 0.04);
}

.preset-chip.active {
  border-color: rgba(37, 99, 235, 0.38);
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
}

.edge-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 34px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.edge-fade.show {
  opacity: 1;
}

.edge-fade-left {
  left: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0));
}

.edge-fade-right {
  right: 0;
  background: linear-gradient(to left, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0));
}

.preset-meta {
  display: flex;
  justify-content: flex-end;
}

.hint-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.65);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.hint-btn:hover {
  border-color: rgba(37, 99, 235, 0.25);
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
}

.hint-panel {
  width: min(360px, 86vw);
  padding: 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint-title {
  font-size: 12px;
  font-weight: 950;
  color: var(--text);
}

.hint-desc {
  font-size: 13px;
  font-weight: 750;
  color: var(--muted);
  line-height: 1.5;
}

.hint-divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.08);
  margin: 2px 0;
}

@media (max-width: 760px) {
  .edge-fade {
    display: none;
  }
}
</style>
