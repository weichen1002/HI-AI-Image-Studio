<template>
  <button
    :type="type"
    class="btn"
    :class="classes"
    :disabled="disabled || loading"
  >
    <slot name="icon" />
    <span class="label">
      <slot />
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  }
})

const classes = computed(() => {
  const out = []
  if (props.variant === 'ghost') out.push('btn-ghost')
  else if (props.variant === 'danger') out.push('btn-ghost', 'btn-danger')
  else out.push('btn-primary')
  if (props.size === 'xs') out.push('btn-xs')
  else if (props.size === 'sm') out.push('btn-sm')
  return out
})
</script>

<style scoped></style>
