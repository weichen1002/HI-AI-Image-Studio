<template>
  <div :class="['shell', variant === 'panel' ? 'panel' : '', variant === 'plain' ? 'plain' : '', { compact: density === 'compact' }]">
    <div v-if="title || subtitle || $slots.actions" class="head">
      <div v-if="title || subtitle" class="copy">
        <h2 v-if="title" :class="density === 'compact' ? 'title' : 'text-h2'">{{ title }}</h2>
        <p v-if="subtitle" :class="density === 'compact' ? 'subtitle' : 'text-lead mt-2'">{{ subtitle }}</p>
      </div>
      <div class="actions" :class="{ 'actions-only': !title && !subtitle }">
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
  },
  variant: {
    type: String,
    default: 'panel'
  }
})
</script>

<style scoped>
.shell {
  padding: 22px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.shell.compact {
  padding: 18px;
}

.shell.plain {
  padding: 0;
  flex: 1;
}

.shell.plain.compact {
  padding: 0;
}

.title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text);
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions.actions-only {
  margin-left: auto;
}

.toolbar {
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
  margin-bottom: 12px;
}

.shell.compact .toolbar {
  padding: 10px;
}

.content {
  min-width: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 820px) {
  .shell {
    padding: 18px;
  }

  .shell.compact {
    padding: 18px;
  }

  .shell.plain,
  .shell.plain.compact {
    padding: 0;
  }
}
</style>
