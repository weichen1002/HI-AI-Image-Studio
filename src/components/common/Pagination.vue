<template>
  <div class="pager" :class="variantClass" v-if="totalPages > 1">
    <div v-if="showSummary" class="summary">
      <span class="summary-strong">{{ startIndex }}</span>
      <span class="summary-sep">-</span>
      <span class="summary-strong">{{ endIndex }}</span>
      <span class="summary-muted">/ 共 {{ total }} 条</span>
    </div>

    <div class="controls">
      <button type="button" class="nav-btn" :disabled="page <= 1" @click="setPage(page - 1)">上一页</button>
      <div class="pages">
        <button
          v-for="p in pageItems"
          :key="String(p.key)"
          type="button"
          class="page-btn"
          :class="{ active: p.type === 'page' && p.value === page, ellipsis: p.type === 'ellipsis' }"
          :disabled="p.type === 'ellipsis'"
          @click="p.type === 'page' && setPage(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
      <button type="button" class="nav-btn" :disabled="page >= totalPages" @click="setPage(page + 1)">下一页</button>

      <div class="size">
        <SelectMenu
          :model-value="pageSize"
          :options="pageSizeSelectOptions"
          size="xs"
          placeholder="每页"
          @update:modelValue="onPageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SelectMenu from './SelectMenu.vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  pageSizeOptions: { type: Array, default: () => [20, 50, 100] },
  variant: { type: String, default: 'card' },
  showSummary: { type: Boolean, default: true }
})

const emit = defineEmits(['update:page', 'update:pageSize'])

const page = computed(() => Math.max(1, Math.floor(Number(props.page) || 1)))
const pageSize = computed(() => Math.max(1, Math.floor(Number(props.pageSize) || 20)))
const total = computed(() => Math.max(0, Math.floor(Number(props.total) || 0)))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const showSummary = computed(() => props.showSummary)

const variantClass = computed(() => {
  if (props.variant === 'plain') return 'pager-plain'
  return 'pager-card'
})

const startIndex = computed(() => {
  if (total.value === 0) return 0
  return (page.value - 1) * pageSize.value + 1
})

const endIndex = computed(() => {
  if (total.value === 0) return 0
  return Math.min(total.value, page.value * pageSize.value)
})

function setPage(next) {
  const p = Math.max(1, Math.min(totalPages.value, Math.floor(Number(next) || 1)))
  if (p === page.value) return
  emit('update:page', p)
}

const pageSizeSelectOptions = computed(() => {
  return (props.pageSizeOptions || []).map((n) => ({ label: `${n} / 页`, value: n }))
})

function onPageSizeChange(next) {
  const n = Math.max(1, Math.floor(Number(next) || pageSize.value))
  if (n === pageSize.value) return
  emit('update:pageSize', n)
}

function makePageItems(current, totalPagesValue) {
  if (totalPagesValue <= 7) {
    return Array.from({ length: totalPagesValue }, (_, i) => {
      const v = i + 1
      return { type: 'page', value: v, label: String(v), key: `p-${v}` }
    })
  }

  const items = []
  const pushPage = (v) => items.push({ type: 'page', value: v, label: String(v), key: `p-${v}` })
  const pushEllipsis = (key) => items.push({ type: 'ellipsis', value: null, label: '…', key })

  pushPage(1)

  const left = Math.max(2, current - 1)
  const right = Math.min(totalPagesValue - 1, current + 1)

  if (left > 2) pushEllipsis('e-left')

  for (let v = left; v <= right; v += 1) pushPage(v)

  if (right < totalPagesValue - 1) pushEllipsis('e-right')

  pushPage(totalPagesValue)
  return items
}

const pageItems = computed(() => makePageItems(page.value, totalPages.value))
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pager-card {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
}

.pager-plain {
  margin-top: 0;
  padding: 0;
  border: 0;
  background: transparent;
  backdrop-filter: none;
}

.pager-plain .controls {
  margin-left: auto;
}

.summary {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.summary-strong {
  color: var(--text);
  font-weight: 950;
}

.summary-sep {
  opacity: 0.55;
}

.summary-muted {
  opacity: 0.75;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pages {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btn,
.page-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.nav-btn:disabled,
.page-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.nav-btn:hover:not(:disabled),
.page-btn:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.16);
}

.page-btn.active {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.10);
  color: var(--primary);
}

.page-btn.ellipsis {
  width: 34px;
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
}

.size {
  min-width: 110px;
}

@media (max-width: 820px) {
  .pager-card {
    justify-content: flex-start;
  }

  .pager-plain {
    justify-content: flex-start;
  }
}
</style>
