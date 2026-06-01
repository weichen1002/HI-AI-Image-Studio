<template>
  <div
    class="mode-switch"
    :class="{ compact }"
    role="tablist"
    :aria-label="label"
    :style="{ '--mode-count': normalizedOptions.length, '--mode-index': activeIndex }"
  >
    <span class="mode-indicator" aria-hidden="true"></span>
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

const activeIndex = computed(() => {
  const index = normalizedOptions.value.findIndex((item) => item.value === props.modelValue)
  return Math.max(0, index)
})
</script>

<style scoped>
.mode-switch {
  --mode-gap: 4px;
  --mode-pad: 4px;
  display: grid;
  grid-template-columns: repeat(var(--mode-count), minmax(0, 1fr));
  position: relative;
  border: 1px solid var(--line);
  background: #ffffff;
  border-radius: 999px;
  padding: var(--mode-pad);
  gap: var(--mode-gap);
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  isolation: isolate;
  overflow: hidden;
}

.mode-switch.compact {
  --mode-gap: 3px;
  --mode-pad: 3px;
}

.mode-indicator {
  position: absolute;
  top: var(--mode-pad);
  bottom: var(--mode-pad);
  left: var(--mode-pad);
  z-index: 0;
  width: calc((100% - (var(--mode-pad) * 2) - (var(--mode-gap) * (var(--mode-count) - 1))) / var(--mode-count));
  border-radius: 999px;
  background: var(--gradient-subtle);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.14);
  transform: translateX(calc(var(--mode-index) * (100% + var(--mode-gap))));
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.2s ease;
}

.mode-btn {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 36px;
  height: auto;
  border-radius: 999px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
  line-height: 1.2;
  padding: 7px 10px;
  overflow-wrap: anywhere;
}

.mode-switch.compact .mode-btn {
  min-height: 32px;
  font-size: 12px;
}

.mode-btn.active {
  color: var(--primary);
}

.mode-btn:active {
  transform: scale(0.98);
}

@media (max-width: 520px) {
  .mode-switch {
    grid-template-columns: repeat(var(--mode-count), minmax(84px, 1fr));
    border-radius: 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .mode-switch::-webkit-scrollbar {
    display: none;
  }

  .mode-btn {
    border-radius: 12px;
    white-space: nowrap;
  }

  .mode-indicator {
    border-radius: 12px;
  }
}
</style>
