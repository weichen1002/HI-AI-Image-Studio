<template>
  <div class="mode-switch" :class="{ compact }" role="tablist" :aria-label="label">
    <button
      type="button"
      v-for="item in normalizedOptions"
      :key="item.value"
      class="mode-btn"
      :class="{ active: modelValue === item.value }"
      role="tab"
      :aria-selected="modelValue === item.value"
      @click="$emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => ([
      { label: '文生图', value: 'text' },
      { label: '图文生图', value: 'image' }
    ])
  },
  label: {
    type: String,
    default: '生成模式'
  },
  compact: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue'])

const normalizedOptions = computed(() => {
  return Array.isArray(props.options) && props.options.length
    ? props.options
    : [
        { label: '文生图', value: 'text' },
        { label: '图文生图', value: 'image' }
      ]
})
</script>

<style scoped>
.mode-switch {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  border: 1px solid var(--line);
  background: #ffffff;
  border-radius: 999px;
  padding: 4px;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.mode-switch.compact {
  padding: 3px;
  gap: 3px;
}

.mode-btn {
  min-width: 0;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.mode-switch.compact .mode-btn {
  height: 32px;
  font-size: 12px;
}

.mode-btn.active {
  background: var(--gradient-subtle);
  color: var(--primary);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.14);
}
</style>
