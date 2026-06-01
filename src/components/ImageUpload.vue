<template>
  <div class="upload-root">
    <div
      class="upload-dropzone"
      :class="{ dragging }"
      role="button"
      tabindex="0"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <template v-if="previewUrl">
        <img class="upload-preview" :src="previewUrl" alt="参考图预览" />
        <div class="upload-actions">
          <button type="button" class="btn btn-ghost upload-btn" @click.stop="openPicker">替换</button>
          <button type="button" class="btn btn-ghost upload-btn danger" @click.stop="clear">移除</button>
        </div>
      </template>
      <template v-else>
        <div class="upload-empty">
          <div class="upload-title">上传参考图</div>
          <div class="upload-subtitle">点击或拖拽图片到这里</div>
        </div>
      </template>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="upload-input"
      @change="onPick"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [File, Object, null],
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const dragging = ref(false)
const objectUrl = ref('')

const previewUrl = computed(() => objectUrl.value)

watch(
  () => props.modelValue,
  (val) => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = val instanceof File ? URL.createObjectURL(val) : ''
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})

function openPicker() {
  fileInput.value?.click()
}

function setFile(file) {
  emit('update:modelValue', file)
}

function clear() {
  setFile(null)
  if (fileInput.value) fileInput.value.value = ''
}

function onPick(e) {
  const file = e.target.files?.[0]
  if (file) setFile(file)
}

function onDragEnter() {
  dragging.value = true
}

function onDragOver() {
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onDrop(e) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) setFile(file)
}
</script>

<style scoped>
.upload-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-dropzone {
  border: 1px dashed rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.03);
  border-radius: 14px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
  position: relative;
  overflow: hidden;
}

.upload-dropzone.dragging {
  border-color: rgba(37, 99, 235, 0.7);
  background: rgba(37, 99, 235, 0.06);
  transform: translateY(-1px);
}

.upload-empty {
  display: grid;
  place-items: center;
  padding: 18px 10px;
  text-align: center;
  color: var(--muted);
}

.upload-title {
  font-weight: 800;
  color: var(--text);
  margin-bottom: 6px;
}

.upload-subtitle {
  font-size: 13px;
  color: var(--muted);
}

.upload-preview {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.06);
}

.upload-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}

.upload-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
}

.upload-btn.danger {
  color: var(--accent);
  border-color: rgba(220, 38, 38, 0.18);
}

.upload-input {
  display: none;
}
</style>
