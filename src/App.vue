<template>
  <div v-if="authStore.isInitialized">
    <router-view />
    <Toast />
    <Transition name="route-loading-fade">
      <div v-if="routeLoading" class="route-loading" role="status" aria-live="polite" aria-label="页面加载中">
        <div class="route-loading-track"><span></span></div>
        <div class="route-loading-pill">加载中...</div>
      </div>
    </Transition>
  </div>
  <div v-else class="loading-app">
    <div class="spinner"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useAuthStore } from './stores/auth'
import { Toast } from './components/common'
import router from './router'

const authStore = useAuthStore()
authStore.fetchUser()

const routeLoading = ref(false)
let loadingTimer = 0

function startRouteLoading() {
  window.clearTimeout(loadingTimer)
  loadingTimer = window.setTimeout(() => {
    routeLoading.value = true
  }, 120)
}

function stopRouteLoading() {
  window.clearTimeout(loadingTimer)
  routeLoading.value = false
}

const removeBeforeEach = router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath) startRouteLoading()
})
const removeAfterEach = router.afterEach(() => {
  stopRouteLoading()
})
const removeOnError = router.onError(() => {
  stopRouteLoading()
})

onBeforeUnmount(() => {
  window.clearTimeout(loadingTimer)
  removeBeforeEach?.()
  removeAfterEach?.()
  removeOnError?.()
})
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

.route-loading {
  position: fixed;
  inset: 0 0 auto;
  z-index: 100000000;
  pointer-events: none;
}

.route-loading-track {
  width: 100%;
  height: 3px;
  overflow: hidden;
  background: rgba(99, 102, 241, 0.12);
}

.route-loading-track span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: 999px;
  background: var(--gradient-primary);
  box-shadow: 0 0 18px rgba(99, 102, 241, 0.36);
  animation: route-loading-slide 0.9s ease-in-out infinite;
}

.route-loading-pill {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  background: rgba(255, 255, 255, 0.86);
  color: var(--primary);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px);
  font-size: 12px;
  font-weight: 900;
}

.route-loading-fade-enter-active,
.route-loading-fade-leave-active {
  transition: opacity 0.14s ease;
}

.route-loading-fade-enter-from,
.route-loading-fade-leave-to {
  opacity: 0;
}

@keyframes route-loading-slide {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(250%); }
}

@media (max-width: 760px) {
  .route-loading-pill {
    top: calc(10px + env(safe-area-inset-top, 0px));
    height: 28px;
    font-size: 11px;
  }
}
</style>
