<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-mask" :class="maskClass" @click="onMaskClick">
        <Transition name="modal-pop">
          <div v-if="open" class="modal" :class="sizeClass" role="dialog" aria-modal="true" @click.stop>
            <div v-if="title" class="modal-head">
              <div class="modal-title">{{ title }}</div>
              <slot name="actions" />
            </div>
            <div class="modal-body">
              <slot />
            </div>
            <div v-if="$slots.footer" class="modal-foot">
              <slot name="footer" />
            </div>
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
  title: {
    type: String,
    default: ''
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
  },
  placement: {
    type: String,
    default: 'center'
  }
})

const emit = defineEmits(['update:open', 'close'])

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'modal-sm'
  if (props.size === 'lg') return 'modal-lg'
  return 'modal-md'
})

const maskClass = computed(() => {
  if (props.placement === 'top') return 'modal-mask-top'
  return ''
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
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(6px);
  z-index: 100000020;
  display: grid;
  place-items: center;
  padding: 22px;
}

.modal-mask.modal-mask-top {
  place-items: start center;
  padding-top: 56px;
}

.modal {
  width: min(560px, 92vw);
  max-height: calc(100vh - 44px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(900px 340px at 10% 0%, rgba(37, 99, 235, 0.12), transparent 55%),
    radial-gradient(820px 340px at 95% 10%, rgba(14, 165, 233, 0.06), transparent 55%),
    rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 28px 90px rgba(15, 23, 42, 0.22);
  border-radius: 18px;
  backdrop-filter: blur(18px);
}

.modal-sm {
  width: min(420px, 92vw);
}

.modal-md {
  width: min(560px, 92vw);
}

.modal-lg {
  width: min(720px, 92vw);
}

.modal-head {
  padding: 16px 18px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  flex: 0 0 auto;
}

.modal-title {
  font-weight: 950;
  font-size: 16px;
  line-height: 1.2;
  color: var(--text);
}

.modal-body {
  padding: 16px 18px;
  min-height: 0;
  overflow: auto;
}

.modal-foot {
  padding: 14px 18px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  flex: 0 0 auto;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: transform 0.20s ease, opacity 0.20s ease;
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  transform: translateY(10px) scale(0.98);
  opacity: 0;
}
</style>
