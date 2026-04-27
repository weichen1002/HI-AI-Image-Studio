<template>
  <div class="studio-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="header" style="padding: 0 16px;">
        <router-link to="/studio" class="brand">
          <div class="brand-icon">
            <img :src="logoUrl" alt="Hi AI Image Studio logo" width="20" height="20" loading="eager" fetchpriority="high" />
          </div>
          <span>Hi AI Image Studio</span>
        </router-link>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/studio" exact-active-class="router-link-active" class="nav-link">
          <PenToolIcon :size="18" />
          创作工作台
        </router-link>
        <router-link to="/studio/history" class="nav-link">
          <FolderIcon :size="18" />
          灵感记录
        </router-link>
        <router-link to="/studio/models" class="nav-link">
          <LayoutTemplateIcon :size="18" />
          灵感库
        </router-link>
        
        <div style="flex: 1"></div>
        
        <router-link to="/studio/settings" class="nav-link">
          <SettingsIcon :size="18" />
          偏好设置
        </router-link>
      </nav>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <header class="topbar">
        <div class="text-h3">{{ currentRouteName }}</div>
        
        <div class="flex items-center gap-4" v-if="authStore.user">
          <div class="flex items-center gap-3" style="font-size: 14px; font-weight: 600; color: var(--text)">
            <span style="background: var(--gradient-subtle); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">PRO</span>
            <div class="flex items-center gap-2">
              <div style="width: 32px; height: 32px; background: var(--gradient-primary); color: #fff; border-radius: 50%; display: grid; place-items: center; font-weight: 700; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);">
                {{ authStore.user.username.charAt(0).toUpperCase() }}
              </div>
              <span>{{ authStore.user.username }}</span>
            </div>
          </div>
          <div style="width: 1px; height: 20px; background: var(--line); margin: 0 8px;"></div>
          <button @click="logout" class="btn btn-ghost" style="height: 36px; padding: 0 16px; font-size: 14px; border-radius: 8px;">
            退出
          </button>
        </div>
        <div class="flex items-center gap-4" v-else>
          <router-link to="/auth" class="btn btn-primary" style="height: 36px; padding: 0 16px; font-size: 14px; border-radius: 8px;">
            登录
          </router-link>
        </div>
      </header>

      <div class="scroll-area">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { PenToolIcon, FolderIcon, LayoutTemplateIcon, SettingsIcon } from 'lucide-vue-next'
import logoUrl from '../hi-image-logo.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const routeNames = {
  'studio-create': '工作台 / 创建',
  'studio-history': '灵感记录',
  'studio-models': '灵感库',
  'studio-settings': '偏好设置'
}

const currentRouteName = computed(() => {
  return routeNames[route.name] || '工作台'
})

async function logout() {
  await authStore.logout()
  router.push('/auth')
}
</script>
