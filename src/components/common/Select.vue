<template>
  <select
    class="input"
    :class="classes"
    :disabled="disabled"
    :value="modelValue"
    @change="$emit('update:modelValue', $event.target.value)"
  >
    <option v-if="placeholder" value="" :disabled="placeholderDisabled">
      {{ placeholder }}
    </option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value" :disabled="!!opt.disabled">
      {{ opt.label }}
    </option>
  </select>
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: ''
  },
  placeholderDisabled: {
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
  }
})

const classes = computed(() => {
  const out = []
  if (props.size === 'xs') out.push('select-xs')
  else if (props.size === 'sm') out.push('select-sm')
  return out
})
</script>

<style scoped>
.select-xs {
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  border-radius: 12px;
}

.select-sm {
  height: 42px;
  padding: 0 14px;
  font-size: 14px;
  border-radius: 12px;
}
</style>
