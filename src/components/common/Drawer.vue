<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="drawer-mask" @click="onMaskClick">
        <Transition name="drawer-slide">
          <div v-if="open" class="drawer" :class="sizeClass" role="dialog" aria-modal="true" @click.stop>
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md'
  },
  closeOnEsc: {
    type: Boolean,
    default: true
  },
  closeOnMask: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:open', 'close'])

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'drawer-sm'
  if (props.size === 'lg') return 'drawer-lg'
  return 'drawer-md'
})

let restoreBody = null

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

function close() {
  emit('update:open', false)
  emit('close')
}

function onMaskClick() {
  if (!props.closeOnMask) return
  close()
}

function onKeydown(e) {
  if (!props.closeOnEsc) return
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      lockBodyScroll()
      window.addEventListener('keydown', onKeydown)
    } else {
      unlockBodyScroll()
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  unlockBodyScroll()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(6px);
  z-index: 100000010;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  height: 100%;
  background:
    radial-gradient(900px 340px at 10% 0%, rgba(37, 99, 235, 0.12), transparent 55%),
    radial-gradient(820px 340px at 95% 10%, rgba(14, 165, 233, 0.06), transparent 55%),
    rgba(255, 255, 255, 0.94);
  border-left: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: -24px 0 70px rgba(15, 23, 42, 0.20);
  backdrop-filter: blur(18px);
  overflow: auto;
}

.drawer-sm {
  width: min(420px, 100vw);
}

.drawer-md {
  width: min(560px, 100vw);
}

.drawer-lg {
  width: min(720px, 100vw);
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.18s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
