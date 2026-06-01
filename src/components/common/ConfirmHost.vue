<template>
  <ConfirmModal
    v-model:open="state.open"
    :title="state.title"
    :message="state.message"
    :details="state.details"
    :object-name="state.objectName"
    :tone="state.tone"
    :confirm-text="state.confirmText"
    :cancel-text="state.cancelText"
    :destructive="state.destructive"
    :loading="state.loading"
    @confirm="resolveConfirm(true)"
    @cancel="resolveConfirm(false)"
    @close="resolveConfirm(false)"
  />
</template>

<script setup>
import ConfirmModal from './ConfirmModal.vue'
import { resolveConfirm, useConfirmState } from './confirm.store'

const state = useConfirmState()
</script>
