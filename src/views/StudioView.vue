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

        <div v-if="isAdmin" class="nav-section">
          <div class="nav-section-title">管理中心</div>
          <router-link to="/studio/admin/users" class="nav-link">
            <UsersIcon :size="18" />
            用户管理
          </router-link>
          <router-link to="/studio/admin/ledger" class="nav-link">
            <ReceiptIcon :size="18" />
            账务流水
          </router-link>
        </div>
        
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
            <span
              style="background: var(--gradient-subtle); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;"
            >
              {{ authStore.user.plan === 'pro' ? 'PRO' : 'FREE' }}
            </span>
            <span style="background: rgba(15, 23, 42, 0.04); color: var(--text); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 800;">
              余额 {{ authStore.user.creditBalance ?? 0 }}
            </span>
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

      <div
        v-if="imagesStore.activeJob"
        class="generation-bar"
        :class="'generation-bar-' + imagesStore.activeJob.status"
      >
        <div class="generation-info">
          <LoaderIcon v-if="imagesStore.activeJob.status === 'running'" class="animate-spin" :size="16" />
          <ImageIcon v-else-if="imagesStore.activeJob.status === 'success'" :size="16" />
          <AlertCircleIcon v-else :size="16" />
          <div class="generation-copy">
            <strong>{{ generationTitle }}</strong>
            <span>{{ generationSubtitle }}</span>
          </div>
        </div>
        <div class="generation-actions">
          <button class="btn btn-ghost generation-btn" type="button" @click="goToGeneration">
            查看
          </button>
          <button
            v-if="imagesStore.activeJob.status !== 'running'"
            class="btn btn-ghost generation-btn"
            type="button"
            @click="imagesStore.clearJob()"
          >
            关闭
          </button>
        </div>
      </div>

      <div class="scroll-area">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useImagesStore } from '../stores/images'
import { AlertCircleIcon, ImageIcon, LoaderIcon, PenToolIcon, FolderIcon, LayoutTemplateIcon, SettingsIcon, UsersIcon, ReceiptIcon } from 'lucide-vue-next'
import logoUrl from '../hi-image-logo.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const imagesStore = useImagesStore()

const routeNames = {
  'studio-create': '工作台 / 创建',
  'studio-history': '灵感记录',
  'studio-history-detail': '灵感记录 / 详情',
  'studio-models': '灵感库',
  'studio-settings': '偏好设置',
  'studio-admin-users': '管理中心 / 用户管理',
  'studio-admin-ledger': '管理中心 / 账务流水'
}

const currentRouteName = computed(() => {
  return routeNames[route.name] || '工作台'
})

const isAdmin = computed(() => ['admin', 'superadmin'].includes(authStore.user?.role))

const generationTitle = computed(() => {
  const status = imagesStore.activeJob?.status
  if (status === 'running') return '图片正在生成'
  if (status === 'success') return '图片已生成'
  if (status === 'error') return '生成失败'
  return ''
})

const generationSubtitle = computed(() => {
  const job = imagesStore.activeJob
  if (!job) return ''
  if (job.status === 'running') return '可以继续浏览其他页面，完成后会自动保存到灵感记录'
  if (job.status === 'success') return '已保存到灵感记录，可回到工作台查看预览'
  return job.error || '请稍后重试'
})

function goToGeneration() {
  router.push(imagesStore.activeJob?.status === 'success' ? '/studio/history' : '/studio')
}

watch(
  () => imagesStore.activeJob?.status,
  async (status) => {
    if (status === 'success') {
      await authStore.fetchUser()
    }
  }
)

async function logout() {
  await authStore.logout()
  router.push('/auth')
}
</script>

<style scoped>
.nav-section {
  padding: 12px 0;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  margin: 12px 0;
}

.nav-section-title {
  padding: 0 14px 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.generation-bar {
  min-height: 58px;
  margin: 16px 40px 0;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(18px);
}

.generation-info,
.generation-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.generation-info {
  min-width: 0;
  color: var(--primary);
}

.generation-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.generation-copy strong {
  color: var(--text);
  font-size: 14px;
}

.generation-copy span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.generation-bar-success {
  border-color: rgba(16, 185, 129, 0.24);
}

.generation-bar-error {
  border-color: rgba(236, 72, 153, 0.24);
}

.generation-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 13px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .generation-bar {
    margin: 12px 20px 0;
    align-items: flex-start;
    flex-direction: column;
  }

  .generation-actions {
    width: 100%;
  }

  .generation-btn {
    flex: 1;
  }
}
</style>
