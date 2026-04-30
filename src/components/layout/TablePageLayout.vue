<template>
  <div class="panel shell" :class="{ compact: density === 'compact' }">
    <div class="head">
      <div class="copy">
        <h2 :class="density === 'compact' ? 'title' : 'text-h2'">{{ title }}</h2>
        <p v-if="subtitle" :class="density === 'compact' ? 'subtitle' : 'text-lead mt-2'">{{ subtitle }}</p>
      </div>
      <div class="actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.toolbar" class="toolbar">
      <slot name="toolbar" />
    </div>

    <div class="content">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  density: {
    type: String,
    default: 'default'
  }
})
</script>

<style scoped>
.shell {
  padding: 28px;
}

.shell.compact {
  padding: 22px;
}

.title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text);
}

.subtitle {
  margin-top: 8px;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar {
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
  margin-bottom: 14px;
}

.shell.compact .toolbar {
  padding: 12px;
}

.content {
  min-width: 0;
}

@media (max-width: 820px) {
  .shell {
    padding: 18px;
  }

  .shell.compact {
    padding: 18px;
  }
}
</style>
