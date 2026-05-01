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
          <router-link to="/studio/admin/announcements" class="nav-link">
            <BellIcon :size="18" />
            公告中心
          </router-link>
        </div>
        
        <router-link to="/studio/settings" class="nav-link">
          <SettingsIcon :size="18" />
          偏好设置
        </router-link>
      </nav>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content" :class="{ 'admin-bg': isAdminRoute }">
      <header class="topbar">
        <div class="topbar-title">
          <div class="text-h3">{{ currentRouteName }}</div>
          <div v-if="currentRouteDesc" class="topbar-sub">{{ currentRouteDesc }}</div>
        </div>
        
        <div class="topbar-right" v-if="authStore.user">
          <div class="topbar-meta">
            <span class="meta-tag plan">{{ authStore.user.plan === 'pro' ? 'PRO' : 'FREE' }}</span>
            <span class="meta-tag balance">余额 {{ authStore.user.creditBalance ?? 0 }}</span>
          </div>
          <Popover v-model:open="noticeOpen" placement="bottom-end">
            <template #trigger>
              <button class="notice-trigger" type="button" aria-label="公告">
                <BellIcon :size="18" />
                <span v-if="unreadCount > 0" class="notice-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
              </button>
            </template>

            <div class="notice-panel">
              <div class="notice-head">
                <div class="notice-title">公告</div>
                <LinkButton to="/studio/announcements" variant="ghost" class="notice-link">查看全部</LinkButton>
              </div>
              <div class="notice-list">
                <button
                  v-for="a in recentAnnouncements"
                  :key="a.id"
                  type="button"
                  class="notice-item"
                  @click="openAnnouncement(a)"
                >
                  <div class="notice-item-top">
                    <span class="notice-item-title">{{ a.title }}</span>
                    <span v-if="a.repeatMode === 'always'" class="notice-pill sticky">必读</span>
                    <span v-else-if="!a.readAt" class="notice-pill unread">未读</span>
                  </div>
                  <div class="notice-item-sub">{{ formatTime(a.createdAt) }}</div>
                </button>
                <div v-if="recentAnnouncements.length === 0" class="notice-empty">暂无公告</div>
              </div>
              <div v-if="isAdmin" class="notice-foot">
                <LinkButton to="/studio/admin/announcements" variant="ghost" class="notice-link">管理公告</LinkButton>
              </div>
            </div>
          </Popover>
          <Popover v-model:open="userMenuOpen" placement="bottom-end" :offset="10">
            <template #trigger>
              <button class="user-trigger" type="button" aria-label="用户菜单">
                <span class="user-avatar">
                  {{ authStore.user.username.charAt(0).toUpperCase() }}
                </span>
                <span class="user-trigger-text">
                  <span class="user-trigger-name">{{ authStore.user.username }}</span>
                  <span class="user-trigger-role">{{ authStore.user.role }}</span>
                </span>
                <ChevronDownIcon :size="16" class="user-trigger-chevron" />
              </button>
            </template>

            <div class="user-menu">
              <div class="user-menu-head">
                <span class="user-menu-avatar">
                  {{ authStore.user.username.charAt(0).toUpperCase() }}
                </span>
                <div class="user-menu-head-text">
                  <div class="user-menu-name">{{ authStore.user.username }}</div>
                  <div class="user-menu-sub">{{ authStore.user.role }}</div>
                </div>
              </div>
              <div class="user-menu-list">
                <button type="button" class="user-menu-item" @click="goProfile">
                  <UserIcon :size="16" />
                  <span>个人资料</span>
                </button>
                <button type="button" class="user-menu-item" @click="copySupport">
                  <HeadphonesIcon :size="16" />
                  <span>联系客服：QQ 3756934376</span>
                </button>
                <div class="user-menu-divider"></div>
                <button type="button" class="user-menu-item danger" @click="logoutFromMenu">
                  <LogOutIcon :size="16" />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          </Popover>
        </div>
        <div class="topbar-right" v-else>
          <LinkButton to="/login" class="btn-pill" style="border-radius: 8px; font-size: 14px;">登录</LinkButton>
        </div>
      </header>

      <div
        v-if="imagesStore.activeJob"
        class="generation-bar"
        :class="[{ 'generation-bar-collapsed': !jobPanelExpanded }, 'generation-bar-' + imagesStore.activeJob.status]"
      >
        <button type="button" class="generation-capsule" @click="toggleJobPanel">
          <LoaderIcon v-if="imagesStore.activeJob.status === 'running'" class="animate-spin" :size="16" />
          <ImageIcon v-else-if="imagesStore.activeJob.status === 'success'" :size="16" />
          <AlertCircleIcon v-else :size="16" />
          <span class="generation-capsule-text">{{ generationCapsuleText }}</span>
          <ChevronDownIcon :size="16" class="generation-capsule-chevron" :class="{ open: jobPanelExpanded }" />
        </button>
        <div v-if="jobPanelExpanded" class="generation-details">
          <div class="generation-info">
            <div class="generation-copy">
              <strong>{{ generationTitle }}</strong>
              <span>{{ generationSubtitle }}</span>
            </div>
          </div>
          <div class="generation-actions">
            <Button variant="ghost" class="generation-btn" type="button" @click="goToGeneration">查看</Button>
            <Button
              v-if="imagesStore.activeJob.status !== 'running'"
              variant="ghost"
              class="generation-btn"
              type="button"
              @click="imagesStore.clearJob()"
            >
              关闭
            </Button>
          </div>
        </div>
      </div>

      <div class="scroll-area" :class="{ 'scroll-area-studio-create': isCreateRoute, 'scroll-area-has-generation': hasActiveJob && !isCreateRoute }">
        <div class="page-shell">
          <router-view />
        </div>
      </div>
    </main>
  </div>

  <Modal v-model:open="announcementOpen" :title="activeAnnouncement?.title || '公告'" size="lg" placement="top" @close="onAnnouncementClosed">
    <div class="announcement-meta">
      <span class="announcement-tag">{{ activeAnnouncement?.notifyMode === 'modal' ? '弹窗' : '静默' }}</span>
      <span v-if="activeAnnouncement?.repeatMode === 'always'" class="announcement-tag sticky">必读</span>
      <span v-else-if="activeAnnouncement && !activeAnnouncement.readAt" class="announcement-tag unread">未读</span>
      <span class="announcement-time">{{ activeAnnouncement?.createdAt ? formatTime(activeAnnouncement.createdAt) : '' }}</span>
    </div>
    <div class="announcement-content">
      <pre class="announcement-md">{{ activeAnnouncement?.contentMd || '' }}</pre>
    </div>
    <template #footer>
      <div class="announcement-actions">
        <Button variant="ghost" size="sm" @click="dismissAnnouncement">关闭</Button>
        <Button
          v-if="activeAnnouncement && activeAnnouncement.repeatMode === 'once' && !activeAnnouncement.readAt"
          size="sm"
          @click="ackAnnouncement"
        >
          我已知晓
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useImagesStore } from '../stores/images'
import { AlertCircleIcon, BellIcon, ChevronDownIcon, HeadphonesIcon, ImageIcon, LoaderIcon, LogOutIcon, PenToolIcon, FolderIcon, LayoutTemplateIcon, SettingsIcon, UserIcon, UsersIcon, ReceiptIcon } from 'lucide-vue-next'
import { Button, LinkButton, Modal, Popover, toastError, toastSuccess } from '../components/common'
import logoUrl from '../hi-image-logo.png'
import { useAnnouncementsStore } from '../stores/announcements'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const imagesStore = useImagesStore()
const announcementsStore = useAnnouncementsStore()

const isAdminRoute = computed(() => String(route.path || '').startsWith('/studio/admin'))

const routeNames = {
  'studio-create': '工作台 / 创建',
  'studio-history': '灵感记录',
  'studio-history-detail': '灵感记录 / 详情',
  'studio-models': '灵感库',
  'studio-profile': '个人资料',
  'studio-settings': '偏好设置',
  'studio-announcements': '公告中心',
  'studio-admin-users': '管理中心 / 用户管理',
  'studio-admin-ledger': '管理中心 / 账务流水',
  'studio-admin-announcements': '管理中心 / 公告中心'
}

const routeDescs = {
  'studio-create': '输入提示词或上传参考图，生成你的图片灵感。',
  'studio-history': '查看历史生成记录，复用提示词继续创作。',
  'studio-history-detail': '查看生成详情，复用提示词、下载图片或删除记录。',
  'studio-models': '浏览社区灵感模板，一键带入工作台。',
  'studio-profile': '查看你的账户信息与权限状态。',
  'studio-settings': '管理账户与生成偏好（后续将逐步补全）。',
  'studio-announcements': '查看平台公告与更新说明。',
  'studio-admin-users': '管理用户套餐、余额与权限。',
  'studio-admin-ledger': '查看充值、扣费等账务流水记录。',
  'studio-admin-announcements': '创建/发布公告，支持全站可见与自动弹窗（读过不弹 / 每次必读）。'
}

const currentRouteName = computed(() => {
  return routeNames[route.name] || '工作台'
})

const currentRouteDesc = computed(() => {
  return routeDescs[route.name] || ''
})

const isAdmin = computed(() => ['admin', 'superadmin'].includes(authStore.user?.role))

const noticeOpen = ref(false)
const userMenuOpen = ref(false)
const announcementOpen = ref(false)
const activeAnnouncement = ref(null)
const autoQueue = ref([])
const autoRunning = ref(false)

const unreadCount = computed(() => announcementsStore.unreadCount || 0)
const recentAnnouncements = computed(() => (announcementsStore.active || []).slice(0, 6))
const isCreateRoute = computed(() => route.name === 'studio-create')
const hasActiveJob = computed(() => Boolean(imagesStore.activeJob))
const jobPanelExpanded = ref(false)

const generationCapsuleText = computed(() => {
  const status = imagesStore.activeJob?.status
  if (status === 'running') return '生成中...'
  if (status === 'success') return '已完成'
  if (status === 'error') return '生成失败'
  return '生成状态'
})

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(val))
}

async function refreshAnnouncements() {
  await announcementsStore.fetchActive({ limit: 20 })
}

function openAnnouncement(a) {
  noticeOpen.value = false
  activeAnnouncement.value = a
  announcementOpen.value = true
}

async function startAutoQueue() {
  if (!authStore.user) return
  await refreshAnnouncements()
  const list = (announcementsStore.active || []).filter((a) => {
    if (a.notifyMode !== 'modal') return false
    if (a.repeatMode === 'always') return true
    return !a.readAt
  })
  autoQueue.value = list
  autoRunning.value = list.length > 0
  if (autoRunning.value) {
    const next = autoQueue.value.shift()
    if (next) {
      activeAnnouncement.value = next
      announcementOpen.value = true
    }
  }
}

async function proceedAutoQueue() {
  if (!autoRunning.value) return
  const next = autoQueue.value.shift()
  if (!next) {
    autoRunning.value = false
    return
  }
  await nextTick()
  activeAnnouncement.value = next
  announcementOpen.value = true
}

async function finalizeRead(announcement) {
  if (!announcement?.id) return
  if (announcement.repeatMode !== 'once') return
  if (announcement.readAt) return
  await announcementsStore.markRead(announcement.id)
  activeAnnouncement.value =
    (announcementsStore.active || []).find((a) => a.id === announcement.id) || announcement
}

async function dismissAnnouncement() {
  const cur = activeAnnouncement.value
  announcementOpen.value = false
  await finalizeRead(cur)
  await proceedAutoQueue()
}

async function ackAnnouncement() {
  await dismissAnnouncement()
}

async function onAnnouncementClosed() {
  const cur = activeAnnouncement.value
  await finalizeRead(cur)
  await proceedAutoQueue()
}

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

function toggleJobPanel() {
  jobPanelExpanded.value = !jobPanelExpanded.value
}

watch(
  () => imagesStore.activeJob?.status,
  async (status) => {
    if (status === 'success') {
      await authStore.fetchUser()
    }
  }
)

watch(
  () => imagesStore.activeJob,
  (job) => {
    if (!job) return
    jobPanelExpanded.value = false
  }
)

watch(
  () => authStore.user?.id,
  async (id) => {
    if (!id) return
    await startAutoQueue()
  }
)

onMounted(async () => {
  if (authStore.user?.id) await startAutoQueue()
})

async function logout() {
  await authStore.logout()
  router.push('/login')
}

function goProfile() {
  userMenuOpen.value = false
  router.push('/studio/profile')
}

async function copySupport() {
  const text = '3756934376'
  userMenuOpen.value = false
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('已复制 QQ 号')
  } catch {
    toastError('复制失败')
  }
}

async function logoutFromMenu() {
  userMenuOpen.value = false
  await logout()
}
</script>

<style scoped>
.page-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-shell :deep(> *) {
  flex: 1;
  min-height: 0;
}

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

.topbar-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.topbar-title :deep(.text-h3) {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.08;
  text-shadow: 0 10px 24px rgba(15, 23, 42, 0.10);
}

.topbar-sub {
  font-size: 13px;
  font-weight: 750;
  color: var(--muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.topbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 850;
  color: var(--text);
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  color: var(--text);
  letter-spacing: 0.02em;
}

.meta-tag.plan {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.18);
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 4px 4px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  cursor: pointer;
  color: var(--text);
  box-shadow: none;
}

.user-trigger:hover {
  border-color: rgba(99, 102, 241, 0.22);
  background: rgba(255, 255, 255, 0.32);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 900;
}

.user-trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  min-width: 0;
}

.user-trigger-name {
  font-size: 13px;
  font-weight: 950;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-trigger-role {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.user-trigger-chevron {
  color: var(--muted);
}

.user-menu {
  width: min(320px, 82vw);
}

.user-menu-head {
  padding: 14px 14px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.7);
}

.user-menu-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 950;
  flex: 0 0 auto;
}

.user-menu-head-text {
  min-width: 0;
}

.user-menu-name {
  font-size: 16px;
  font-weight: 950;
  color: var(--text);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-sub {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.user-menu-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  text-align: left;
}

.user-menu-item:hover {
  border-color: rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
}

.user-menu-divider {
  height: 1px;
  margin: 6px 6px;
  background: rgba(15, 23, 42, 0.08);
}

.user-menu-item.danger {
  color: var(--accent);
}

.user-menu-item.danger:hover {
  background: rgba(236, 72, 153, 0.08);
  border-color: rgba(236, 72, 153, 0.18);
}

.generation-bar {
  min-height: 44px;
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(920px, calc(100vw - 80px));
  margin: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(18px);
  z-index: 30;
}

.generation-bar-collapsed {
  width: auto;
  max-width: calc(100vw - 80px);
  border-radius: 999px;
  gap: 0;
}

.generation-capsule {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 8px;
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
}

.generation-capsule-text {
  min-width: 0;
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generation-capsule-chevron {
  color: var(--muted);
  transition: transform 0.2s;
}

.generation-capsule-chevron.open {
  transform: rotate(180deg);
}

.generation-details {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 6px 4px;
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

.notice-trigger {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  display: grid;
  place-items: center;
  color: var(--text);
  cursor: pointer;
}

.notice-trigger:hover {
  background: rgba(255, 255, 255, 0.32);
}

.notice-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  display: grid;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.92);
}

.notice-panel {
  width: min(360px, 92vw);
}

.notice-head {
  padding: 12px 12px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.notice-title {
  font-weight: 950;
  font-size: 14px;
  color: var(--text);
}

.notice-link {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 10px;
}

.notice-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}

.notice-item {
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.62);
  text-align: left;
  cursor: pointer;
}

.notice-item:hover {
  background: rgba(255, 255, 255, 0.9);
}

.notice-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.notice-item-title {
  font-weight: 900;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.notice-item-sub {
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}

.notice-pill {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
  flex: 0 0 auto;
}

.notice-pill.unread {
  color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.18);
}

.notice-pill.sticky {
  color: rgba(16, 185, 129, 1);
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.20);
}

.notice-empty {
  padding: 14px 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.notice-foot {
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  justify-content: flex-end;
}

.announcement-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.announcement-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
}

.announcement-tag.unread {
  color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.18);
}

.announcement-tag.sticky {
  color: rgba(16, 185, 129, 1);
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.20);
}

.announcement-time {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.announcement-content {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  min-height: 360px;
}

.announcement-md {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
}

.announcement-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .generation-bar {
    left: 20px;
    right: 20px;
    width: auto;
    transform: none;
  }

  .generation-bar.generation-bar-collapsed {
    left: 50%;
    right: auto;
    width: auto;
    max-width: calc(100vw - 40px);
    transform: translateX(-50%);
  }

  .generation-actions {
    width: 100%;
  }

  .generation-btn {
    flex: 1;
  }
}
</style>
