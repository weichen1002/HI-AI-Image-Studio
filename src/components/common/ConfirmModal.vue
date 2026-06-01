<template>
  <Modal
    :open="open"
    :title="title"
    size="sm"
    :close-on-mask="!loading"
    :close-on-esc="!loading"
    @update:open="emit('update:open', $event)"
    @close="emit('cancel')"
  >
    <div class="confirm-shell" :class="'confirm-' + tone">
      <div class="confirm-icon">
        <component :is="iconComponent" :size="20" />
      </div>
      <div class="confirm-copy">
        <div v-if="objectName" class="confirm-object">{{ objectName }}</div>
        <p>{{ message }}</p>
        <div v-if="details" class="confirm-details">{{ details }}</div>
        <div v-if="destructive" class="confirm-warning">该操作不可撤销，请确认后继续。</div>
      </div>
    </div>

    <template #footer>
      <div class="confirm-actions">
        <Button variant="ghost" :disabled="loading" @click="emit('cancel')">
          {{ cancelText }}
        </Button>
        <Button :variant="confirmVariant" :loading="loading" @click="emit('confirm')">
          {{ confirmText }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import { AlertTriangleIcon, InfoIcon, Trash2Icon } from 'lucide-vue-next'
import Button from './Button.vue'
import Modal from './Modal.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: '确定要继续吗？'
  },
  details: {
    type: String,
    default: ''
  },
  objectName: {
    type: String,
    default: ''
  },
  tone: {
    type: String,
    default: 'danger'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  loading: {
    type: Boolean,
    default: false
  },
  destructive: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:open', 'confirm', 'cancel'])

const iconComponent = computed(() => {
  if (props.tone === 'info') return InfoIcon
  if (props.tone === 'warning') return AlertTriangleIcon
  return Trash2Icon
})

const confirmVariant = computed(() => (props.tone === 'danger' ? 'danger' : 'primary'))
</script>

<style scoped>
.confirm-shell {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
}

.confirm-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary);
}

.confirm-danger .confirm-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.confirm-warning .confirm-icon {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.confirm-copy {
  min-width: 0;
}

.confirm-object {
  margin-bottom: 6px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
  font-weight: 950;
  overflow-wrap: anywhere;
}

.confirm-copy p {
  margin: 0;
  color: rgba(15, 23, 42, 0.82);
  font-size: 14px;
  line-height: 1.55;
  font-weight: 800;
}

.confirm-details,
.confirm-warning {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 800;
}

.confirm-warning {
  display: inline-flex;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
