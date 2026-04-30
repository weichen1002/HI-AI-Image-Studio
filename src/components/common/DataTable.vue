<template>
  <div class="wrap">
    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="!rows?.length" class="state">{{ emptyText }}</div>
    <div v-else class="table-wrap">
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
            @click="onRowClick(r)"
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
  }
})

function rowKeyValue(row) {
  if (typeof props.rowKey === 'function') return String(props.rowKey(row))
  return String(row?.[props.rowKey] ?? '')
}

function onRowClick(row) {
  if (!props.clickable) return
  emit('rowClick', row)
}
</script>

<style scoped>
.wrap {
  min-width: 0;
}

.state {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.8);
  color: var(--muted);
  font-weight: 700;
}

.table-wrap {
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255,255,255,0.86);
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 0;
  table-layout: fixed;
}

.table th,
.table td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 13px;
  color: var(--text);
  vertical-align: middle;
  overflow: hidden;
}

.table th {
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  background: rgba(15, 23, 42, 0.02);
}

.row.clickable {
  cursor: pointer;
}

.row.clickable:hover {
  background: rgba(15, 23, 42, 0.02);
}

.row.selected {
  background: rgba(99, 102, 241, 0.06);
}

.nowrap {
  white-space: nowrap;
}

.ellipsis {
  text-overflow: ellipsis;
}
</style>
