<template>
  <div>
    <label class="label">参考图</label>
    <ImageUploadGallery v-model="files" :max-count="4" />
    <div class="field-hint">支持 1-4 张参考图，顺序越靠前权重越高。</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ImageUploadGallery from '../ImageUploadGallery.vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:modelValue'])

const files = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<style scoped>
.field-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}
</style>
