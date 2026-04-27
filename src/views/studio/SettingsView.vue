<template>
  <div class="panel" style="max-width: 600px;">
    <h2 class="text-h2 mb-4">偏好设置</h2>
    <p class="text-lead mb-8">在这里管理您的账户和生成偏好。</p>

    <div class="mb-6">
      <label class="label">账户名称</label>
      <input type="text" class="input" :value="authStore.user?.username" disabled style="background: var(--bg-subtle);" />
    </div>

    <div class="mb-6">
      <label class="label">默认图片比例</label>
      <select class="input">
        <option>1:1 (正方形)</option>
        <option>16:9 (横向)</option>
        <option>9:16 (竖向)</option>
      </select>
      <p class="text-eyebrow mt-2" style="text-transform: none;">此设置将在未来的版本中生效</p>
    </div>

    <div class="flex justify-end mt-8">
      <button class="btn btn-primary" disabled>保存设置</button>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
</script>