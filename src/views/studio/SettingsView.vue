<template>
  <div class="panel" style="max-width: 600px;">
    <div class="mb-6">
      <label class="label">账户名称</label>
      <Input :model-value="authStore.user?.username" disabled style="background: var(--bg-subtle);" />
    </div>

    <div class="mb-6">
      <label class="label">用户 ID</label>
      <Input :model-value="authStore.user?.id" disabled style="background: var(--bg-subtle);" />
    </div>

    <div class="mb-6">
      <label class="label">默认图片比例</label>
      <SelectMenu v-model="defaultRatio" :options="ratioOptions" placeholder="选择默认比例" />
      <p class="text-eyebrow mt-2" style="text-transform: none;">此设置将在未来的版本中生效</p>
    </div>

    <div class="flex justify-end mt-8">
      <Button disabled>保存设置</Button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { Button, Input, SelectMenu } from '../../components/common'

const authStore = useAuthStore()

const defaultRatio = ref('1:1')
const ratioOptions = [
  { label: '1:1 (正方形)', value: '1:1' },
  { label: '16:9 (横向)', value: '16:9' },
  { label: '9:16 (竖向)', value: '9:16' }
]
</script>
