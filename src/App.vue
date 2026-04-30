<template>
  <div v-if="authStore.isInitialized">
    <router-view />
    <Toast />
  </div>
  <div v-else class="loading-app">
    <div class="spinner"></div>
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import { Toast } from './components/common'

const authStore = useAuthStore()
authStore.fetchUser()
</script>

<style>
.loading-app {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s ease-in-out infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
