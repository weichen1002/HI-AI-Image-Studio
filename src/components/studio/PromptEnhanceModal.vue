<template>
  <Modal v-model:open="openProxy" title="润色预览" size="lg">
    <div class="modal-shell">
      <div class="direction-row" role="tablist" aria-label="润色方向">
        <button
          v-for="item in directions"
          :key="item.value"
          type="button"
          class="direction-btn"
          :class="{ active: direction === item.value }"
          :disabled="loading"
          role="tab"
          :aria-selected="direction === item.value"
          @click="direction = item.value"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="compare-grid">
        <div class="compare-col">
          <div class="compare-title">原提示词</div>
          <textarea class="textarea compare-text" :value="originalPrompt" disabled></textarea>
        </div>
        <div class="compare-col">
          <div class="compare-title">润色后</div>
          <div v-if="loading" class="compare-loading">
            <LoaderIcon :size="18" class="loading-icon" />
            <div class="loading-text">正在生成润色结果...</div>
          </div>
          <textarea v-else class="textarea compare-text" :value="enhancedPrompt" disabled></textarea>
        </div>
      </div>

      <div v-if="errorMsg" class="error-text">{{ errorMsg }}</div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <Button variant="ghost" @click="openProxy = false">取消</Button>
        <Button
          variant="ghost"
          :disabled="loading || !originalPrompt"
          @click="preview"
        >
          <template #icon>
            <LoaderIcon v-if="loading" :size="16" class="loading-icon" />
          </template>
          {{ loading ? '预览中...' : '预览润色' }}
        </Button>
        <Button :disabled="loading || !enhancedPrompt" @click="apply">应用润色</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Modal, Button } from '../common'
import { LoaderIcon } from 'lucide-vue-next'
import { apiFetch } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  originalPrompt: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open', 'apply'])

const openProxy = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const authStore = useAuthStore()

const directions = [
  { value: 'ecommerce', label: '电商主图' },
  { value: 'xiaohongshu', label: '小红书封面' },
  { value: 'poster', label: '海报排版' },
  { value: 'wallpaper', label: '壁纸/头像' }
]

const direction = ref('ecommerce')
const enhancedPrompt = ref('')
const loading = ref(false)
const errorMsg = ref('')
const hasPreviewed = ref(false)

let directionPreviewTimer = null

watch(
  () => props.open,
  (v) => {
    if (!v) return
    enhancedPrompt.value = ''
    errorMsg.value = ''
    direction.value = 'ecommerce'
    hasPreviewed.value = false
  }
)

watch(
  () => direction.value,
  () => {
    if (!props.open || !hasPreviewed.value) return
    if (!props.originalPrompt || loading.value) return
    if (directionPreviewTimer) window.clearTimeout(directionPreviewTimer)
    directionPreviewTimer = window.setTimeout(() => {
      preview()
    }, 250)
  }
)

async function preview() {
  if (!props.originalPrompt || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch('/api/prompts/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: props.originalPrompt,
        direction: direction.value
      })
    })
    enhancedPrompt.value = String(data?.prompt || '').trim()
    hasPreviewed.value = true
    await authStore.fetchUser()
  } catch (e) {
    errorMsg.value = e.message || '润色失败'
  } finally {
    loading.value = false
  }
}

function apply() {
  if (!enhancedPrompt.value) return
  emit('apply', enhancedPrompt.value)
  openProxy.value = false
}
</script>

<style scoped>
.modal-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.direction-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.direction-btn {
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.direction-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.direction-btn:hover {
  border-color: rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.06);
  color: var(--primary);
}

.direction-btn.active {
  border-color: rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.10);
  color: var(--primary);
  box-shadow: 0 10px 26px rgba(99, 102, 241, 0.12);
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.compare-title {
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
  margin-bottom: 8px;
}

.compare-text {
  min-height: 220px;
  resize: none;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
}

.compare-text:disabled {
  opacity: 1;
}

.compare-loading {
  min-height: 220px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

.loading-text {
  color: var(--muted);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .direction-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .compare-grid {
    grid-template-columns: 1fr;
  }
  .compare-text {
    min-height: 160px;
  }
  .compare-loading {
    min-height: 160px;
  }
}
</style>
