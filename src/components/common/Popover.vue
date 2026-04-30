<template>
  <span ref="containerRef" class="popover-container">
    <span ref="triggerRef" class="popover-trigger" @click="toggle" @keydown="onTriggerKeydown" tabindex="0" role="button" aria-haspopup="true" :aria-expanded="open ? 'true' : 'false'">
      <slot name="trigger" />
    </span>

    <Teleport to="body">
      <Transition name="popover-dd">
        <div
          v-if="open"
          ref="panelRef"
          class="popover-panel"
          :class="[instanceId]"
          :style="panelStyle"
          role="dialog"
          tabindex="-1"
          @keydown="onPanelKeydown"
          @mousedown.stop
          @click.stop
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  placement: {
    type: String,
    default: 'bottom-end'
  },
  offset: {
    type: Number,
    default: 8
  },
  matchWidth: {
    type: Boolean,
    default: false
  },
  closeOnEsc: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:open', 'close'])

const instanceId = `popover-${Math.random().toString(36).slice(2, 9)}`

const containerRef = ref(null)
const triggerRef = ref(null)
const panelRef = ref(null)
const triggerRect = ref(null)
const position = ref('bottom-end')

const panelStyle = computed(() => {
  if (!triggerRect.value) return {}
  const rect = triggerRect.value
  const style = {
    position: 'fixed',
    zIndex: '100000030',
    top: '0px',
    left: '0px'
  }

  const offset = props.offset || 0
  const panelWidth = props.matchWidth ? rect.width : undefined

  if (panelWidth) style.minWidth = `${panelWidth}px`

  if (position.value === 'bottom-end') {
    style.top = `${rect.bottom + offset}px`
    style.left = `${rect.right}px`
    style.transform = 'translateX(-100%)'
  } else if (position.value === 'bottom-start') {
    style.top = `${rect.bottom + offset}px`
    style.left = `${rect.left}px`
  } else if (position.value === 'top-end') {
    style.top = `${rect.top - offset}px`
    style.left = `${rect.right}px`
    style.transform = 'translate(-100%, -100%)'
  } else {
    style.top = `${rect.top - offset}px`
    style.left = `${rect.left}px`
    style.transform = 'translateY(-100%)'
  }

  return style
})

function updateTriggerRect() {
  const el = triggerRef.value
  if (!el) return
  triggerRect.value = el.getBoundingClientRect()
}

function normalizePlacement() {
  const p = props.placement
  if (p === 'bottom-start' || p === 'top-start' || p === 'top-end') return p
  return 'bottom-end'
}

function openPopover() {
  emit('update:open', true)
}

function closePopover() {
  emit('update:open', false)
  emit('close')
}

function toggle() {
  if (props.open) closePopover()
  else openPopover()
}

function onTriggerKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggle()
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    openPopover()
  }
}

function onPanelKeydown(e) {
  if (!props.closeOnEsc) return
  if (e.key === 'Escape') closePopover()
}

function onClickOutside(event) {
  const target = event.target
  const inPanel = target?.closest?.(`.${instanceId}`)
  const inTrigger = triggerRef.value?.contains?.(target)
  if (!inPanel && !inTrigger && props.open) closePopover()
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      position.value = normalizePlacement()
      updateTriggerRect()
      nextTick(() => panelRef.value?.focus?.())
      window.addEventListener('scroll', updateTriggerRect, { capture: true, passive: true })
      window.addEventListener('resize', updateTriggerRect)
      document.addEventListener('click', onClickOutside)
    } else {
      window.removeEventListener('scroll', updateTriggerRect, { capture: true })
      window.removeEventListener('resize', updateTriggerRect)
      document.removeEventListener('click', onClickOutside)
    }
  },
  { immediate: true }
)

onMounted(() => {
  position.value = normalizePlacement()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateTriggerRect, { capture: true })
  window.removeEventListener('resize', updateTriggerRect)
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.popover-container {
  display: inline-flex;
}

.popover-trigger {
  display: inline-flex;
  outline: none;
}

.popover-panel {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.popover-dd-enter-active,
.popover-dd-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.popover-dd-enter-from,
.popover-dd-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}
</style>

