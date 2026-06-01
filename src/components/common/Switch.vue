<template>
  <button
    type="button"
    class="switch"
    :class="classes"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-label="label || '开关'"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="switch-track">
      <span class="switch-thumb"></span>
    </span>
    <span v-if="label" class="switch-label">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md'
  },
  label: {
    type: String,
    default: ''
  }
})

const classes = computed(() => {
  const out = []
  if (props.modelValue) out.push('is-checked')
  if (props.disabled) out.push('is-disabled')
  if (props.size === 'sm') out.push('switch-sm')
  if (props.size === 'xs') out.push('switch-xs')
  if (props.label) out.push('has-label')
  return out
})

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.switch:disabled,
.switch.is-disabled {
  cursor: not-allowed;
}

.switch-track {
  position: relative;
  width: 52px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.35);
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.16);
  transition: transform 0.2s ease;
}

.switch.is-checked .switch-track {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.92), rgba(59, 130, 246, 0.92));
}

.switch.is-checked .switch-thumb {
  transform: translateX(22px);
}

.switch.is-disabled .switch-track,
.switch:disabled .switch-track {
  opacity: 0.55;
}

.switch-label {
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}

.switch-sm .switch-track {
  width: 46px;
  height: 26px;
}

.switch-sm .switch-thumb {
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
}

.switch-sm.is-checked .switch-thumb {
  transform: translateX(20px);
}

.switch-xs .switch-track {
  width: 40px;
  height: 22px;
}

.switch-xs .switch-thumb {
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
}

.switch-xs.is-checked .switch-thumb {
  transform: translateX(18px);
}
</style>
