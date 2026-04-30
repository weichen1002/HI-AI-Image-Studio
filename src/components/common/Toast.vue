<template>
  <div class="toast-wrap" aria-live="polite" aria-relevant="additions">
    <div v-for="t in items" :key="t.id" class="toast" :class="t.type">
      {{ t.message }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useToastState } from './toast.store'

const state = useToastState()
const items = computed(() => state.items)
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 200;
}

.toast {
  min-width: 220px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14);
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
  backdrop-filter: blur(18px);
}

.toast.success {
  border-color: rgba(16, 185, 129, 0.25);
}

.toast.error {
  border-color: rgba(236, 72, 153, 0.25);
}
</style>

