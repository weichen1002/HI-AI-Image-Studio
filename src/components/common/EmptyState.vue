<template>
  <div class="wrap" :class="[variantClass, sizeClass]">
    <div class="icon" aria-hidden="true">
      <component :is="iconComponent" :size="24" />
    </div>
    <div class="title">{{ resolvedTitle }}</div>
    <div v-if="description" class="desc">{{ description }}</div>
    <div v-if="actionLabel" class="actions">
      <Button size="sm" variant="ghost" :disabled="actionDisabled" @click="emit('action')">
        <template #icon>
          <ArrowRightIcon :size="16" />
        </template>
        {{ actionLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { AlertCircleIcon, ArrowRightIcon, LoaderIcon, PackageOpenIcon } from 'lucide-vue-next'
import Button from './Button.vue'

const props = defineProps({
  state: {
    type: String,
    default: 'empty'
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'card'
  },
  size: {
    type: String,
    default: 'md'
  },
  actionLabel: {
    type: String,
    default: ''
  },
  actionDisabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['action'])

const iconComponent = computed(() => {
  if (props.state === 'loading') return LoaderIcon
  if (props.state === 'error') return AlertCircleIcon
  return PackageOpenIcon
})

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  if (props.state === 'loading') return '正在加载'
  if (props.state === 'error') return '加载失败'
  return '暂无数据'
})

const variantClass = computed(() => {
  if (props.variant === 'flat') return 'flat'
  return 'card'
})

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'sm'
  return 'md'
})
</script>

<style scoped>
.wrap {
  width: 100%;
  min-height: 240px;
  padding: 26px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: var(--text);
}

.wrap.card {
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
}

.wrap.flat {
  border: none;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
}

.wrap.sm {
  min-height: 180px;
  padding: 18px 16px;
}

.icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.03);
  color: rgba(15, 23, 42, 0.70);
}

.title {
  font-size: 15px;
  font-weight: 950;
  letter-spacing: -0.01em;
}

.desc {
  max-width: 520px;
  font-size: 13px;
  font-weight: 800;
  color: var(--muted);
  line-height: 1.55;
}

.actions {
  margin-top: 4px;
}
</style>
