<template>
  <div class="toast-wrap" aria-live="polite" aria-relevant="additions">
    <div v-for="t in items" :key="t.id" class="toast" :class="t.type">
      <div class="toast-icon" aria-hidden="true">
        <CheckCircleIcon v-if="t.type === 'success'" :size="16" />
        <AlertCircleIcon v-else-if="t.type === 'error'" :size="16" />
        <InfoIcon v-else :size="16" />
      </div>
      <div class="toast-message">{{ t.message }}</div>
      <button v-if="t.action?.label" type="button" class="toast-action" @click="runAction(t)">
        {{ t.action.label }}
      </button>
      <button v-if="t.closable" type="button" class="toast-close" @click="closeToast(t.id)" aria-label="关闭">
        <XIcon :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useToastState, closeToast } from './toast.store'
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XIcon } from 'lucide-vue-next'

const state = useToastState()
const items = computed(() => state.items)

function runAction(t) {
  const fn = t?.action?.onClick
  closeToast(t.id)
  if (typeof fn === 'function') fn()
}
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 200;
}

.toast {
  min-width: min(360px, calc(100vw - 24px));
  max-width: min(420px, calc(100vw - 24px));
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14);
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.toast.success {
  border-color: rgba(16, 185, 129, 0.25);
}

.toast.error {
  border-color: rgba(236, 72, 153, 0.25);
}

.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.03);
  color: rgba(15, 23, 42, 0.72);
  flex: 0 0 auto;
}

.toast.success .toast-icon {
  color: rgba(16, 185, 129, 0.95);
  background: rgba(16, 185, 129, 0.08);
}

.toast.error .toast-icon {
  color: rgba(236, 72, 153, 0.95);
  background: rgba(236, 72, 153, 0.08);
}

.toast-message {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.4;
  word-break: break-word;
}

.toast-action {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 900;
  color: var(--primary);
  cursor: pointer;
  flex: 0 0 auto;
}

.toast-action:hover {
  background: #ffffff;
}

.toast-close {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.8);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.70);
  flex: 0 0 auto;
}

.toast-close:hover {
  background: #ffffff;
}
</style>
