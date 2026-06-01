<template>
  <div class="wrap">
    <div v-if="loading" class="state" :class="{ flat: variant === 'flat' }">加载中...</div>
    <div v-else-if="!rows?.length" class="state" :class="{ flat: variant === 'flat' }">{{ emptyText }}</div>
    <div v-else class="table-wrap" :class="{ flat: variant === 'flat' }">
      <table class="table">
        <colgroup>
          <col v-for="c in columns" :key="c.key" :style="{ width: c.width || 'auto' }" />
        </colgroup>
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :style="{ textAlign: c.align || 'left' }">
              {{ c.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="rowKeyValue(r)"
            class="row"
            :class="{ clickable, selected: selectedKey && selectedKey === rowKeyValue(r) }"
            :tabindex="clickable ? 0 : undefined"
            @click="onRowClick($event, r)"
            @keydown.enter.prevent="onRowClick($event, r)"
            @keydown.space.prevent="onRowClick($event, r)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              :style="{ textAlign: c.align || 'left' }"
              :class="{ nowrap: c.nowrap !== false, ellipsis: c.ellipsis !== false }"
            >
              <slot :name="`cell-${c.key}`" :row="r" :value="r?.[c.key]">
                <span>{{ r?.[c.key] }}</span>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['rowClick'])

const props = defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  rows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  selectedKey: {
    type: String,
    default: ''
  },
  clickable: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  variant: {
    type: String,
    default: 'card'
  }
})

function rowKeyValue(row) {
  if (typeof props.rowKey === 'function') return String(props.rowKey(row))
  return String(row?.[props.rowKey] ?? '')
}

function onRowClick(e, row) {
  if (!props.clickable) return
  const target = e?.target
  if (target?.closest?.('button, a, input, textarea, select, [role="button"], [role="link"], .btn')) return
  emit('rowClick', row)
}
</script>

<style scoped>
.wrap {
  min-width: 0;
}

.state {
  min-height: 140px;
  padding: 18px 18px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  color: var(--muted);
  font-weight: 850;
  display: grid;
  place-items: center;
}

.state.flat {
  padding: 18px 0;
  border: none;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
}

.table-wrap {
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.06);
  scroll-behavior: smooth;
}

.table-wrap.flat {
  overflow: visible;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 0;
  table-layout: fixed;
}

.table th,
.table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 13px;
  color: var(--text);
  vertical-align: middle;
  overflow: hidden;
}

.table th {
  font-size: 12px;
  color: var(--muted);
  font-weight: 900;
  letter-spacing: 0.06em;
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 2;
}

.table-wrap.flat .table th {
  background: #ffffff;
}

.table-wrap.flat .table th,
.table-wrap.flat .table td {
  padding-left: 14px;
  padding-right: 14px;
}

.row.clickable {
  cursor: pointer;
  transition: background 0.16s ease, box-shadow 0.16s ease;
}

.row.clickable:hover {
  background: rgba(37, 99, 235, 0.045);
}

.row.selected {
  background: rgba(37, 99, 235, 0.08);
}

.row:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.55);
  outline-offset: -2px;
}

.nowrap {
  white-space: nowrap;
}

.ellipsis {
  text-overflow: ellipsis;
}

.table-wrap::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-wrap::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.14);
  border-radius: 999px;
}

.table-wrap::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.22);
}
</style>
