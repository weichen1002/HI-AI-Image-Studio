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
    <Transition name="app-loading-fade">
      <div
        v-if="routeLoadingOverlay"
        class="app-loading-screen app-loading-screen-overlay"
        role="status"
        aria-live="polite"
        aria-label="页面切换中"
      >
        <div class="app-loading-ambient"></div>
        <div class="app-loading-grid"></div>
        <div class="app-loading-content">
          <div class="app-loading-mark">
            <div class="app-loading-ring app-loading-ring-outer"></div>
            <div class="app-loading-ring app-loading-ring-inner"></div>
            <div class="app-loading-core"></div>
          </div>
          <div class="app-loading-eyebrow">SWITCHING WORKSPACE</div>
          <h1 class="app-loading-title">正在切换页面</h1>
          <p class="app-loading-copy">正在同步当前工作区状态，准备好后立即进入。</p>
        </div>
      </div>
    </Transition>
  </div>
  <div v-else class="app-loading-screen" role="status" aria-live="polite" aria-label="应用初始化中">
    <div class="app-loading-ambient"></div>
    <div class="app-loading-grid"></div>
    <div class="app-loading-content">
      <div class="app-loading-mark">
        <div class="app-loading-ring app-loading-ring-outer"></div>
        <div class="app-loading-ring app-loading-ring-inner"></div>
        <div class="app-loading-core"></div>
      </div>
      <div class="app-loading-eyebrow">SYNCING GALLERY STATE</div>
      <h1 class="app-loading-title">正在唤醒艺术引擎</h1>
      <p class="app-loading-copy">正在同步身份、额度与画廊数据，准备稳定状态后一并入场。</p>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { usePreferencesStore } from './stores/preferences'
import { Toast } from './components/common'
import router from './router'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
authStore.fetchUser()

watch(
  () => authStore.user?.id,
  (userId) => {
    preferencesStore.loadScope(userId ? `user:${userId}` : 'anonymous')
  },
  { immediate: true },
)

const routeLoading = ref(false)
const routeLoadingOverlay = ref(false)
let loadingTimer = 0
let overlayTimer = 0

function startRouteLoading() {
  window.clearTimeout(loadingTimer)
  window.clearTimeout(overlayTimer)
  loadingTimer = window.setTimeout(() => {
    routeLoading.value = true
  }, 120)
  overlayTimer = window.setTimeout(() => {
    routeLoadingOverlay.value = true
  }, 420)
}

function stopRouteLoading() {
  window.clearTimeout(loadingTimer)
  window.clearTimeout(overlayTimer)
  routeLoading.value = false
  routeLoadingOverlay.value = false
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
  window.clearTimeout(overlayTimer)
  removeBeforeEach?.()
  removeAfterEach?.()
  removeOnError?.()
})
</script>

<style>
.app-loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    var(--bg-mesh),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), var(--bg));
}

.app-loading-screen-overlay {
  z-index: 99999999;
  backdrop-filter: blur(18px);
}

.app-loading-ambient {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(circle at 22% 24%, rgba(99, 102, 241, 0.16), transparent 24%),
    radial-gradient(circle at 78% 20%, rgba(236, 72, 153, 0.12), transparent 20%),
    radial-gradient(circle at 50% 82%, rgba(14, 165, 233, 0.08), transparent 26%);
  filter: blur(32px);
  opacity: 0.86;
}

.app-loading-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.06) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.9), transparent 80%);
  opacity: 0.32;
  transform: perspective(900px) rotateX(67deg) scale(1.7) translateY(14%);
  transform-origin: center;
}

.app-loading-content {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(720px, calc(100vw - 48px));
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.app-loading-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 224px;
  height: 224px;
  margin-bottom: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.34) 66%, transparent 72%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.62),
    0 30px 70px rgba(99, 102, 241, 0.12);
}

.app-loading-ring {
  position: absolute;
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
}

.app-loading-ring-outer {
  width: 140px;
  height: 140px;
  border-width: 2px;
  border-top-color: rgba(99, 102, 241, 0.95);
  border-right-color: rgba(99, 102, 241, 0.95);
  animation: app-loading-spin 2.6s linear infinite;
}

.app-loading-ring-inner {
  width: 104px;
  height: 104px;
  border-width: 2px;
  border-bottom-color: rgba(236, 72, 153, 0.88);
  border-left-color: rgba(236, 72, 153, 0.88);
  animation: app-loading-spin-reverse 1.8s linear infinite;
}

.app-loading-core {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.98) 0 22%, rgba(238, 242, 255, 0.94) 22% 58%, rgba(224, 231, 255, 0.84) 58% 100%);
  box-shadow:
    0 0 0 22px rgba(99, 102, 241, 0.08),
    0 0 50px rgba(99, 102, 241, 0.18);
  animation: app-loading-pulse 2.4s ease-in-out infinite;
}

.app-loading-eyebrow {
  margin-bottom: 16px;
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.62em;
  text-transform: uppercase;
  padding-left: 0.62em;
}

.app-loading-title {
  margin: 0;
  color: var(--text);
  font-size: clamp(32px, 3.2vw, 50px);
  font-weight: 800;
  letter-spacing: -0.04em;
}

.app-loading-copy {
  max-width: 560px;
  margin-top: 22px;
  color: var(--muted);
  font-size: clamp(15px, 1.6vw, 20px);
  line-height: 1.75;
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

@keyframes app-loading-spin {
  to { transform: rotate(360deg); }
}

@keyframes app-loading-spin-reverse {
  to { transform: rotate(-360deg); }
}

@keyframes app-loading-pulse {
  0%, 100% {
    transform: scale(0.96);
    box-shadow:
      0 0 0 22px rgba(99, 102, 241, 0.07),
      0 0 36px rgba(99, 102, 241, 0.16);
  }
  50% {
    transform: scale(1);
    box-shadow:
      0 0 0 28px rgba(236, 72, 153, 0.08),
      0 0 60px rgba(99, 102, 241, 0.22);
  }
}

@keyframes app-loading-fade-in {
  from {
    opacity: 0;
    transform: scale(1.02);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes app-loading-fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.99);
  }
}

.app-loading-fade-enter-active {
  animation: app-loading-fade-in 0.24s ease-out;
}

.app-loading-fade-leave-active {
  animation: app-loading-fade-out 0.18s ease-in forwards;
}

@keyframes route-loading-slide {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(250%); }
}

@media (max-width: 760px) {
  .app-loading-content {
    width: min(100vw - 32px, 520px);
  }

  .app-loading-mark {
    width: 188px;
    height: 188px;
    margin-bottom: 22px;
  }

  .app-loading-ring-outer {
    width: 122px;
    height: 122px;
  }

  .app-loading-ring-inner {
    width: 92px;
    height: 92px;
  }

  .app-loading-core {
    width: 62px;
    height: 62px;
  }

  .app-loading-eyebrow {
    font-size: 11px;
    letter-spacing: 0.42em;
    padding-left: 0.42em;
  }

  .app-loading-title {
    font-size: 30px;
  }

  .app-loading-copy {
    margin-top: 16px;
    font-size: 15px;
    line-height: 1.65;
  }

  .route-loading-pill {
    top: calc(10px + env(safe-area-inset-top, 0px));
    height: 28px;
    font-size: 11px;
  }
}
</style>
