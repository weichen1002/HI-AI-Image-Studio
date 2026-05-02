<template>
  <div class="upload-gallery">
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
      <div class="upload-empty">
        <div class="upload-title">
          {{ files.length ? `已选择 ${files.length} 张参考图` : '上传参考图' }}
        </div>
        <div class="upload-subtitle">
          点击或拖拽图片到这里，最多 {{ maxCount }} 张。第一张会作为主参考图。
        </div>
      </div>
    </div>

    <div v-if="files.length" class="thumb-list">
      <div v-for="(item, index) in files" :key="item.key" class="thumb-card">
        <img class="thumb-image" :src="item.url" :alt="`参考图 ${index + 1}`" />
        <div class="thumb-meta">
          <div class="thumb-name">{{ item.file.name }}</div>
          <div class="thumb-badge">{{ index === 0 ? '主参考图' : `参考图 ${index + 1}` }}</div>
        </div>
        <div class="thumb-actions">
          <button
            type="button"
            class="btn btn-ghost upload-btn"
            :disabled="index === 0"
            @click.stop="moveLeft(index)"
          >
            左移
          </button>
          <button
            type="button"
            class="btn btn-ghost upload-btn danger"
            @click.stop="removeAt(index)"
          >
            移除
          </button>
        </div>
      </div>
    </div>

    <div v-if="files.length" class="gallery-footer">
      <button type="button" class="btn btn-ghost upload-btn" @click="openPicker">继续添加</button>
      <button type="button" class="btn btn-ghost upload-btn danger" @click="clear">清空全部</button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="upload-input"
      multiple
      @change="onPick"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  maxCount: {
    type: Number,
    default: 4
  }
})

const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const dragging = ref(false)
const objectUrls = ref([])

const files = computed(() => {
  return props.modelValue.map((file, index) => ({
    file,
    url: objectUrls.value[index] || '',
    key: `${file?.name || 'file'}-${file?.size || 0}-${index}`
  }))
})

watch(
  () => props.modelValue,
  (nextFiles) => {
    // 统一在这里管理 Object URL，避免频繁增删时泄漏。
    objectUrls.value.forEach((url) => {
      if (url) URL.revokeObjectURL(url)
    })
    objectUrls.value = nextFiles.map((file) =>
      file instanceof File ? URL.createObjectURL(file) : ''
    )
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  objectUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
})

function openPicker() {
  fileInput.value?.click()
}

function updateFiles(nextFiles) {
  emit('update:modelValue', nextFiles)
}

function normalizeIncomingFiles(fileList) {
  return Array.from(fileList || []).filter((file) => file instanceof File)
}

function appendFiles(nextFiles) {
  const merged = [...props.modelValue, ...nextFiles].slice(0, props.maxCount)
  updateFiles(merged)
  if (fileInput.value) fileInput.value.value = ''
}

function removeAt(index) {
  const nextFiles = props.modelValue.filter((_, currentIndex) => currentIndex !== index)
  updateFiles(nextFiles)
}

function moveLeft(index) {
  if (index <= 0) return
  const nextFiles = [...props.modelValue]
  const current = nextFiles[index]
  nextFiles[index] = nextFiles[index - 1]
  nextFiles[index - 1] = current
  updateFiles(nextFiles)
}

function clear() {
  updateFiles([])
  if (fileInput.value) fileInput.value.value = ''
}

function onPick(event) {
  const pickedFiles = normalizeIncomingFiles(event.target.files)
  if (pickedFiles.length) appendFiles(pickedFiles)
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

function onDrop(event) {
  dragging.value = false
  const droppedFiles = normalizeIncomingFiles(event.dataTransfer?.files)
  if (droppedFiles.length) appendFiles(droppedFiles)
}
</script>

<style scoped>
.upload-gallery {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-dropzone {
  border: 1px dashed rgba(99, 102, 241, 0.35);
  background: rgba(99, 102, 241, 0.03);
  border-radius: 14px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}

.upload-dropzone.dragging {
  border-color: rgba(99, 102, 241, 0.7);
  background: rgba(99, 102, 241, 0.06);
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

.thumb-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.thumb-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.thumb-image {
  width: 100%;
  height: 148px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.thumb-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.thumb-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  word-break: break-all;
}

.thumb-badge {
  font-size: 12px;
  color: var(--primary);
  font-weight: 800;
}

.thumb-actions,
.gallery-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.upload-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
}

.upload-btn.danger {
  color: var(--accent);
  border-color: rgba(236, 72, 153, 0.18);
}

.upload-input {
  display: none;
}

@media (max-width: 900px) {
  .thumb-list {
    grid-template-columns: 1fr;
  }
}
</style>
