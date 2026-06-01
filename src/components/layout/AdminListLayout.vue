<template>
  <div class="admin-list">
    <div v-if="$slots.filterActions || $slots.tools" class="actions-row">
      <slot name="filterActions" />
      <slot name="tools" />
    </div>

    <div class="filter-card">
      <div class="filter-left">
        <slot name="filters" />
      </div>
    </div>

    <div class="table-card">
      <div class="table-scroll">
        <slot name="table" />
      </div>
      <div v-if="$slots.footer" class="table-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.admin-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-card {
  padding: 11px 12px 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  min-width: 0;
}

.filter-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.table-card {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.table-footer {
  padding: 10px 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

@media (max-width: 820px) {
  .actions-row {
    justify-content: flex-start;
  }
}
</style>
