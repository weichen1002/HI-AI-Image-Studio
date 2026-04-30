<template>
  <div class="search-wrap">
    <SearchIcon class="search-icon" :size="18" aria-hidden="true" />
    <Input v-bind="$attrs" :model-value="modelValue" :size="size" class="search-input" @update:modelValue="$emit('update:modelValue', $event)" />
  </div>
</template>

<script setup>
import { SearchIcon } from 'lucide-vue-next'
import Input from './Input.vue'

defineEmits(['update:modelValue'])

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  size: {
    type: String,
    default: 'sm'
  }
})
</script>

<style scoped>
.search-wrap {
  position: relative;
  width: min(380px, 100%);
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(15, 23, 42, 0.45);
  pointer-events: none;
}

.search-input {
  padding-left: 44px;
}
</style>

