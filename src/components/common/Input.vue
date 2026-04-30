<template>
  <input
    :type="type"
    class="input"
    :class="classes"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'text'
  },
  size: {
    type: String,
    default: 'md'
  }
})

const classes = computed(() => {
  const out = []
  if (props.size === 'xs') out.push('input-xs')
  else if (props.size === 'sm') out.push('input-sm')
  return out
})
</script>
