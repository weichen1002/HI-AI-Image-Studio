<template>
  <div class="mode-switch" role="tablist" aria-label="生成模式">
    <button
      type="button"
      class="mode-btn"
      :class="{ active: modelValue === 'text' }"
      role="tab"
      :aria-selected="modelValue === 'text'"
      @click="$emit('update:modelValue', 'text')"
    >
      文生图
    </button>
    <button
      type="button"
      class="mode-btn"
      :class="{ active: modelValue === 'image' }"
      role="tab"
      :aria-selected="modelValue === 'image'"
      @click="$emit('update:modelValue', 'image')"
    >
      图文生图
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line);
  background: #ffffff;
  border-radius: 999px;
  padding: 4px;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.mode-btn {
  height: 34px;
  border-radius: 999px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.mode-btn.active {
  background: var(--gradient-subtle);
  color: var(--primary);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.14);
}
</style>
