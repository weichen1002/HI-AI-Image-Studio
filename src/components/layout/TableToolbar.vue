<template>
  <div class="toolbar">
    <div class="left">
      <slot name="left" />
    </div>
    <div class="right">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.right {
  margin-left: auto;
  justify-content: flex-end;
}

@media (max-width: 820px) {
  .right {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }
}
</style>
