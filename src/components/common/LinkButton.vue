<template>
  <component
    :is="tag"
    class="btn"
    :class="classes"
    v-bind="forwardedAttrs"
    :to="tag === RouterLink ? to : undefined"
    :href="tag === 'a' ? href : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    @click="onClick"
  >
    <slot name="icon" />
    <span class="label">
      <slot />
    </span>
  </component>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  to: {
    type: [String, Object],
    default: null
  },
  href: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const attrs = useAttrs()

const tag = computed(() => {
  if (props.to) return RouterLink
  if (props.href) return 'a'
  return 'button'
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

const forwardedAttrs = computed(() => {
  const out = { ...attrs }
  if (tag.value === 'button') {
    if (!out.type) out.type = 'button'
    out.disabled = props.disabled || out.disabled
  }
  return out
})

function onClick(e) {
  if (!props.disabled) return
  e.preventDefault()
  e.stopPropagation()
}
</script>

<style scoped>
.label {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
</style>

