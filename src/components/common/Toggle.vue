<template>
  <label class="toggle" :class="classes">
    <input
      type="checkbox"
      :checked="!!modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="label">{{ label }}</span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md'
  }
})

const classes = computed(() => {
  const out = []
  if (props.size === 'xs') out.push('toggle-xs')
  else if (props.size === 'sm') out.push('toggle-sm')
  return out
})
</script>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  user-select: none;
}

.toggle-sm {
  min-height: 42px;
  padding: 0 12px;
  font-size: 13px;
}

.toggle-xs {
  min-height: 36px;
  padding: 0 10px;
  font-size: 12px;
}

.toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.label {
  line-height: 1;
}
</style>
