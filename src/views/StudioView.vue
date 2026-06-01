<template>
  <div class="studio-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Sidebar -->
    <aside class="sidebar" :aria-label="sidebarCollapsed ? '主导航，已收起' : '主导航'">
      <div class="header sidebar-header">
        <router-link to="/studio" class="brand">
          <div class="brand-icon">
            <img :src="logoUrl" alt="Hi AI Image Studio logo" width="44" height="44" loading="eager" fetchpriority="high" />
          </div>
        </router-link>
        <button
          type="button"
          class="sidebar-toggle"
          :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebar"
        >
          <ChevronRightIcon v-if="sidebarCollapsed" :size="15" />
          <ChevronLeftIcon v-else :size="15" />
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group">
          <div class="nav-group-label">工作区</div>
          <router-link to="/studio" active-class="" exact-active-class="router-link-active" class="nav-link" title="创作工作台" aria-label="创作工作台">
            <PenToolIcon :size="18" />
            <span class="nav-label">创作工作台</span>
          </router-link>
          <router-link to="/studio/dialogue" class="nav-link" title="对话创作" aria-label="对话创作">
            <BotMessageSquareIcon :size="18" />
            <span class="nav-label">对话创作</span>
          </router-link>
          <router-link to="/studio/history" class="nav-link" title="灵感记录" aria-label="灵感记录">
            <FolderIcon :size="18" />
            <span class="nav-label">灵感记录</span>
          </router-link>
          <router-link to="/studio/tasks" class="nav-link" title="任务中心" aria-label="任务中心">
            <ClipboardListIcon :size="18" />
            <span class="nav-label">任务中心</span>
          </router-link>
          <router-link to="/studio/style-boards" class="nav-link" title="风格板" aria-label="风格板">
            <PanelsTopLeftIcon :size="18" />
            <span class="nav-label">风格板</span>
          </router-link>
          <router-link to="/studio/models" class="nav-link" title="灵感库" aria-label="灵感库">
            <LayoutTemplateIcon :size="18" />
            <span class="nav-label">灵感库</span>
          </router-link>
          <router-link to="/studio/billing" class="nav-link" title="充值中心" aria-label="充值中心">
            <ReceiptIcon :size="18" />
            <span class="nav-label">充值中心</span>
          </router-link>
        </div>
        <router-link v-if="isAdmin" to="/studio/admin/dashboard" class="nav-link nav-link-admin-mobile">
          <BarChart3Icon :size="18" />
          总览
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/settings" class="nav-link nav-link-admin-mobile">
          <SlidersHorizontalIcon :size="18" />
          系统
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/users" class="nav-link nav-link-admin-mobile">
          <UsersIcon :size="18" />
          用户
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/ledger" class="nav-link nav-link-admin-mobile">
          <ReceiptIcon :size="18" />
          账务
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/billing-orders" class="nav-link nav-link-admin-mobile">
          <ClipboardListIcon :size="18" />
          订单
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/audit-logs" class="nav-link nav-link-admin-mobile">
          <AlertCircleIcon :size="18" />
          审计
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/announcements" class="nav-link nav-link-admin-mobile">
          <MegaphoneIcon :size="18" />
          公告
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/redeem-codes" class="nav-link nav-link-admin-mobile">
          <GiftIcon :size="18" />
          兑换
        </router-link>
        <router-link v-if="isAdmin" to="/studio/admin/image-feedback" class="nav-link nav-link-admin-mobile">
          <ImageIcon :size="18" />
          反馈
        </router-link>
        <div v-if="isAdmin" class="nav-section nav-group">
          <div class="nav-group-label">后台</div>
          <button
            type="button"
            class="nav-section-toggle"
            :class="{ active: isAdminManagementRoute }"
            :aria-expanded="adminMenuOpen"
            :aria-label="adminMenuOpen ? '收起管理中心菜单' : '展开管理中心菜单'"
            title="管理中心"
            @click="toggleAdminMenu"
          >
            <SlidersHorizontalIcon :size="18" />
            <span class="nav-label">管理中心</span>
            <ChevronDownIcon :size="16" class="nav-section-chevron" :class="{ open: adminMenuOpen }" />
          </button>
          <div v-if="adminMenuOpen && !sidebarCollapsed" class="nav-section-list">
            <router-link to="/studio/admin/dashboard" class="nav-link nav-sub-link">
              <BarChart3Icon :size="18" />
              <span class="nav-label">指标总览</span>
            </router-link>
            <router-link to="/studio/admin/settings" class="nav-link nav-sub-link">
              <SlidersHorizontalIcon :size="18" />
              <span class="nav-label">系统设置</span>
            </router-link>
            <router-link to="/studio/admin/users" class="nav-link nav-sub-link">
              <UsersIcon :size="18" />
              <span class="nav-label">用户管理</span>
            </router-link>
            <router-link to="/studio/admin/ledger" class="nav-link nav-sub-link">
              <ReceiptIcon :size="18" />
              <span class="nav-label">账务流水</span>
            </router-link>
            <router-link to="/studio/admin/billing-orders" class="nav-link nav-sub-link">
              <ClipboardListIcon :size="18" />
              <span class="nav-label">订单</span>
            </router-link>
            <router-link to="/studio/admin/audit-logs" class="nav-link nav-sub-link">
              <AlertCircleIcon :size="18" />
              <span class="nav-label">审计日志</span>
            </router-link>
          </div>
        </div>

        <div v-if="isAdmin" class="nav-section nav-group">
          <div class="nav-group-label">运营</div>
          <button
            type="button"
            class="nav-section-toggle"
            :class="{ active: isOperationsRoute }"
            :aria-expanded="operationsMenuOpen"
            :aria-label="operationsMenuOpen ? '收起运营中心菜单' : '展开运营中心菜单'"
            title="运营中心"
            @click="toggleOperationsMenu"
          >
            <TargetIcon :size="18" />
            <span class="nav-label">运营中心</span>
            <ChevronDownIcon :size="16" class="nav-section-chevron" :class="{ open: operationsMenuOpen }" />
          </button>
          <div v-if="operationsMenuOpen && !sidebarCollapsed" class="nav-section-list">
            <router-link to="/studio/admin/operations" class="nav-link nav-sub-link">
              <ChartNoAxesCombinedIcon :size="18" />
              <span class="nav-label">运营看板</span>
            </router-link>
            <router-link to="/studio/admin/announcements" class="nav-link nav-sub-link">
              <MegaphoneIcon :size="18" />
              <span class="nav-label">公告投放</span>
            </router-link>
            <router-link to="/studio/admin/redeem-codes" class="nav-link nav-sub-link">
              <GiftIcon :size="18" />
              <span class="nav-label">兑换码</span>
            </router-link>
            <router-link to="/studio/admin/image-feedback" class="nav-link nav-sub-link">
              <ImageIcon :size="18" />
              <span class="nav-label">反馈样本</span>
            </router-link>
          </div>
        </div>
        <div class="nav-group nav-account-group">
          <div class="nav-group-label">账户</div>
          <router-link to="/studio/settings" class="nav-link" title="偏好设置" aria-label="偏好设置">
            <SettingsIcon :size="18" />
            <span class="nav-label">账户与偏好</span>
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content" :class="{ 'admin-bg': isAdminRoute }">
      <header class="topbar" :class="{ 'topbar-create': isCreateRoute }">
        <div class="topbar-title">
          <div class="text-h3 topbar-heading">
            <span v-if="isCreateRoute" class="topbar-mode-icon">
              <PenToolIcon v-if="siteStore.createIcon === 'wand'" :size="20" />
              <ImageIcon v-else-if="siteStore.createIcon === 'image'" :size="20" />
              <BotMessageSquareIcon v-else-if="siteStore.createIcon === 'dialogue'" :size="20" />
              <WrenchIcon v-else-if="siteStore.createIcon === 'tools'" :size="20" />
              <PenToolIcon v-else :size="20" />
            </span>
            <span>{{ currentRouteName }}</span>
          </div>
          <div v-if="currentRouteDesc" class="topbar-sub">{{ currentRouteDesc }}</div>
        </div>
        
        <div class="topbar-right" v-if="authStore.user">
          <div class="topbar-meta">
            <span class="meta-tag plan">{{ authStore.user.plan === 'pro' ? 'PRO' : 'FREE' }}</span>
            <span class="meta-tag balance">余额 {{ authStore.user.creditBalance ?? 0 }}</span>
            <button class="redeem-entry" type="button" @click="openRedeemModal">
              <GiftIcon :size="14" />
              <span>兑换码</span>
            </button>
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
                  <span>账户与偏好</span>
                </button>
                <button type="button" class="user-menu-item" @click="copySupport">
                  <HeadphonesIcon :size="16" />
                  <span>联系客服：{{ siteSettings.supportContact }}</span>
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
          <LoaderIcon v-if="imagesStore.activeJob.status === 'queued' || imagesStore.activeJob.status === 'running'" class="animate-spin" :size="16" />
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
              v-if="imagesStore.activeJob.status !== 'queued' && imagesStore.activeJob.status !== 'running'"
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

  <Modal v-model:open="redeemOpen" title="兑换余额" size="sm">
    <div class="redeem-form">
      <div class="redeem-help">输入兑换码后会立即到账，活动码同一账号只能成功兑换一次。</div>
      <Input
        v-model="redeemCode"
        maxlength="32"
        autocomplete="off"
        spellcheck="false"
        placeholder="请输入兑换码"
        @keydown.enter.prevent="submitRedeem"
      />
    </div>
    <template #footer>
      <div class="announcement-actions">
        <Button variant="ghost" size="sm" :disabled="redeemLoading" @click="redeemOpen = false">取消</Button>
        <Button size="sm" :disabled="redeemLoading" @click="submitRedeem">
          {{ redeemLoading ? '兑换中...' : '立即兑换' }}
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
import { useSiteStore } from '../stores/site'
import { AlertCircleIcon, BarChart3Icon, BellIcon, BotMessageSquareIcon, ChartNoAxesCombinedIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, GiftIcon, HeadphonesIcon, ImageIcon, LoaderIcon, LogOutIcon, MegaphoneIcon, PenToolIcon, FolderIcon, LayoutTemplateIcon, PanelsTopLeftIcon, SettingsIcon, SlidersHorizontalIcon, TargetIcon, UserIcon, UsersIcon, ReceiptIcon, WrenchIcon } from 'lucide-vue-next'
import { Button, Input, LinkButton, Modal, Popover, toastError, toastSuccess } from '../components/common'
import logoUrl from '../hi-image-logo.png'
import { useAnnouncementsStore } from '../stores/announcements'
import { apiFetch } from '../utils/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const imagesStore = useImagesStore()
const announcementsStore = useAnnouncementsStore()
const siteStore = useSiteStore()
const siteSettings = computed(() => siteStore.settings)
const SIDEBAR_COLLAPSED_KEY = 'studio:sidebar-collapsed'
const ADMIN_MENU_OPEN_KEY = 'studio:admin-menu-open'
const OPERATIONS_MENU_OPEN_KEY = 'studio:operations-menu-open'

const isAdminRoute = computed(() => String(route.path || '').startsWith('/studio/admin'))
const adminManagementRouteNames = new Set([
  'studio-admin-dashboard',
  'studio-admin-settings',
  'studio-admin-users',
  'studio-admin-ledger',
  'studio-admin-billing-orders',
  'studio-admin-audit-logs'
])
const operationsRouteNames = new Set([
  'studio-admin-operations',
  'studio-admin-announcements',
  'studio-admin-redeem-codes',
  'studio-admin-image-feedback'
])
const isAdminManagementRoute = computed(() => adminManagementRouteNames.has(route.name))
const isOperationsRoute = computed(() => operationsRouteNames.has(route.name))

const routeNames = {
  'studio-create': '工作台 / 创建',
  'studio-dialogue': '对话创作',
  'studio-history': '灵感记录',
  'studio-history-detail': '灵感记录 / 详情',
  'studio-tasks': '任务中心',
  'studio-style-boards': '风格板',
  'studio-models': '灵感库',
  'studio-profile': '账户与偏好',
  'studio-billing': '充值中心',
  'studio-settings': '账户与偏好',
  'studio-announcements': '公告中心',
  'studio-admin-dashboard': '管理中心 / 指标总览',
  'studio-admin-settings': '管理中心 / 系统设置',
  'studio-admin-users': '管理中心 / 用户管理',
  'studio-admin-ledger': '管理中心 / 账务流水',
  'studio-admin-billing-orders': '管理中心 / 订单',
  'studio-admin-operations': '运营中心 / 运营看板',
  'studio-admin-announcements': '运营中心 / 公告投放',
  'studio-admin-redeem-codes': '运营中心 / 兑换码',
  'studio-admin-audit-logs': '管理中心 / 审计日志',
  'studio-admin-image-feedback': '运营中心 / 反馈样本'
}

const routeDescs = {
  'studio-create': '输入提示词或上传参考图，生成你的图片灵感。',
  'studio-dialogue': '从空白、参考图或已有结果开始，逐轮调整图片。',
  'studio-history': '查看历史生成记录，复用提示词继续创作。',
  'studio-history-detail': '查看生成详情，复用提示词、下载图片或删除记录。',
  'studio-tasks': '跟踪排队、运行、成功和失败的生成任务。',
  'studio-style-boards': '保存项目风格参考，按需带入本次创作。',
  'studio-models': '浏览社区灵感模板，一键带入工作台。',
  'studio-profile': '查看账户信息，并管理默认创作参数。',
  'studio-billing': '查看可用套餐，创建待支付订单并跟踪订单状态。',
  'studio-settings': '查看账户信息，并管理默认创作参数。',
  'studio-announcements': '查看平台公告与更新说明。',
  'studio-admin-dashboard': '查看用户、任务、积分、订单和失败原因的核心运营指标。',
  'studio-admin-settings': '统一管理注册赠送余额、积分规则与后续系统级配置。',
  'studio-admin-users': '管理用户套餐、余额与权限。',
  'studio-admin-ledger': '查看充值、扣费等账务流水记录。',
  'studio-admin-billing-orders': '查看充值订单，筛选用户与状态，并确认人工补单入账。',
  'studio-admin-operations': '集中管理公告投放、活动码和反馈样本，规划后续运营活动能力。',
  'studio-admin-announcements': '创建公告投放，支持全站可见与自动弹窗（读过不弹 / 每次必读）。',
  'studio-admin-redeem-codes': '创建和管理单次码、活动码，承接运营活动。',
  'studio-admin-audit-logs': '查看注册、登录、封禁、删号等关键安全与管理操作记录。',
  'studio-admin-image-feedback': '查看用户对生成结果的低分反馈，沉淀运营和质量优化样本。'
}

const currentRouteName = computed(() => {
  if (isCreateRoute.value) return siteStore.createTitle
  return routeNames[route.name] || '工作台'
})

const currentRouteDesc = computed(() => {
  if (isCreateRoute.value) return siteStore.createSubtitle
  return routeDescs[route.name] || ''
})

const isAdmin = computed(() => ['admin', 'superadmin'].includes(authStore.user?.role))

const noticeOpen = ref(false)
const userMenuOpen = ref(false)
const announcementOpen = ref(false)
const activeAnnouncement = ref(null)
const autoQueue = ref([])
const autoRunning = ref(false)
const redeemOpen = ref(false)
const redeemLoading = ref(false)
const redeemCode = ref('')
const sidebarCollapsed = ref(false)
const adminMenuOpen = ref(true)
const operationsMenuOpen = ref(true)

const unreadCount = computed(() => announcementsStore.unreadCount || 0)
const recentAnnouncements = computed(() => (announcementsStore.active || []).slice(0, 6))
const isCreateRoute = computed(() => route.name === 'studio-create' || route.name === 'studio-dialogue')
const hasActiveJob = computed(() => Boolean(imagesStore.activeJob))
const jobPanelExpanded = ref(false)

const generationCapsuleText = computed(() => {
  const status = imagesStore.activeJob?.status
  if (status === 'queued') return '排队中...'
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

function readStoredBoolean(key, fallback) {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  if (value === '1') return true
  if (value === '0') return false
  return fallback
}

function writeStoredBoolean(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value ? '1' : '0')
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  writeStoredBoolean(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value)
}

function toggleAdminMenu() {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    writeStoredBoolean(SIDEBAR_COLLAPSED_KEY, false)
    adminMenuOpen.value = true
    writeStoredBoolean(ADMIN_MENU_OPEN_KEY, true)
    return
  }
  adminMenuOpen.value = !adminMenuOpen.value
  writeStoredBoolean(ADMIN_MENU_OPEN_KEY, adminMenuOpen.value)
}

function toggleOperationsMenu() {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    writeStoredBoolean(SIDEBAR_COLLAPSED_KEY, false)
    operationsMenuOpen.value = true
    writeStoredBoolean(OPERATIONS_MENU_OPEN_KEY, true)
    return
  }
  operationsMenuOpen.value = !operationsMenuOpen.value
  writeStoredBoolean(OPERATIONS_MENU_OPEN_KEY, operationsMenuOpen.value)
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
  if (status === 'queued') return '任务已排队'
  if (status === 'running') return '图片正在生成'
  if (status === 'success') return '图片已生成'
  if (status === 'error') return '生成失败'
  return ''
})

const generationSubtitle = computed(() => {
  const job = imagesStore.activeJob
  if (!job) return ''
  if (job.status === 'queued') return '任务已提交，后台会按顺序开始生成'
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
      await authStore.refreshUser()
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
    await imagesStore.restoreActiveJob()
    await startAutoQueue()
  }
)

onMounted(async () => {
  sidebarCollapsed.value = readStoredBoolean(SIDEBAR_COLLAPSED_KEY, false)
  adminMenuOpen.value = readStoredBoolean(ADMIN_MENU_OPEN_KEY, true)
  operationsMenuOpen.value = readStoredBoolean(OPERATIONS_MENU_OPEN_KEY, true)
  if (isAdminManagementRoute.value) adminMenuOpen.value = true
  if (isOperationsRoute.value) operationsMenuOpen.value = true
  await siteStore.fetchSettings()
  if (authStore.user?.id) {
    await imagesStore.restoreActiveJob()
    await startAutoQueue()
  }
})

watch(isAdminManagementRoute, (active) => {
  if (active && !adminMenuOpen.value) {
    adminMenuOpen.value = true
    writeStoredBoolean(ADMIN_MENU_OPEN_KEY, true)
  }
})

watch(isOperationsRoute, (active) => {
  if (active && !operationsMenuOpen.value) {
    operationsMenuOpen.value = true
    writeStoredBoolean(OPERATIONS_MENU_OPEN_KEY, true)
  }
})

async function logout() {
  await authStore.logout()
  router.push('/login')
}

function openRedeemModal() {
  redeemCode.value = ''
  redeemOpen.value = true
}

async function submitRedeem() {
  const code = String(redeemCode.value || '').trim()
  if (!code) {
    toastError('请输入兑换码')
    return
  }
  try {
    redeemLoading.value = true
    const data = await apiFetch('/api/redeem-codes/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    if (authStore.user) {
      authStore.user.creditBalance = Number(data?.balance || authStore.user.creditBalance || 0)
    }
    redeemOpen.value = false
    redeemCode.value = ''
    toastSuccess(`兑换成功，已到账 ${data?.amount || 0} 余额`)
  } catch (e) {
    toastError(e.message || '兑换失败')
  } finally {
    redeemLoading.value = false
  }
}

function goProfile() {
  userMenuOpen.value = false
  router.push('/studio/settings')
}

async function copySupport() {
  const text = String(siteSettings.value.supportContact || '')
  userMenuOpen.value = false
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('已复制联系方式')
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

.studio-layout :deep(.sidebar) {
  min-height: 0;
  transition: width 0.22s ease, padding 0.22s ease;
}

.studio-layout :deep(.sidebar-nav) {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 18px;
}

.studio-layout :deep(.sidebar-nav > div[style*="flex"]) {
  flex: 0 0 8px !important;
}

.nav-group {
  display: grid;
  gap: 5px;
  padding: 8px 0;
}

.nav-group + .nav-group {
  margin-top: 6px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.nav-group-label {
  padding: 0 12px 3px;
  color: rgba(100, 116, 139, 0.78);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1.4;
}

.sidebar-header {
  position: relative;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
}

.sidebar-header :deep(.brand) {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: center;
  padding: 0;
}

.sidebar-header :deep(.brand-icon) {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
}

.sidebar-header :deep(.brand-icon img) {
  width: 44px;
  height: 44px;
}

.brand-label,
.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-toggle {
  position: absolute;
  right: -13px;
  top: 50%;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-50%);
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  color: var(--muted);
  cursor: pointer;
  box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.4);
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  z-index: 5;
}

.sidebar-toggle:hover {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(37, 99, 235, 0.08);
}

.nav-section {
  margin: 0;
}

.nav-section-toggle {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.nav-section-toggle:hover,
.nav-section-toggle.active {
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
}

.nav-section-chevron {
  margin-left: auto;
  transition: transform 0.18s ease;
}

.nav-section-chevron.open {
  transform: rotate(180deg);
}

.nav-section-list {
  display: grid;
  gap: 4px;
  margin-top: 4px;
  padding: 3px 0 0 10px;
}

.nav-sub-link {
  height: 36px;
  padding-left: 12px;
  font-size: 12px;
  font-weight: 800;
}

.studio-layout.sidebar-collapsed :deep(.sidebar) {
  width: 72px;
}

.studio-layout.sidebar-collapsed .sidebar-header {
  justify-content: center;
  padding: 0 12px;
}

.studio-layout.sidebar-collapsed .sidebar-header :deep(.brand) {
  flex: 0 0 48px;
}

.studio-layout.sidebar-collapsed .sidebar-header :deep(.brand-icon) {
  width: 44px;
  height: 44px;
  flex-basis: 44px;
}

.studio-layout.sidebar-collapsed .sidebar-header :deep(.brand-icon img) {
  width: 40px;
  height: 40px;
}

.studio-layout.sidebar-collapsed :deep(.sidebar-nav) {
  padding: 16px 10px;
  align-items: center;
}

.studio-layout.sidebar-collapsed :deep(.nav-link),
.studio-layout.sidebar-collapsed .nav-section-toggle {
  width: 42px;
  justify-content: center;
  padding: 0;
  gap: 0;
}

.studio-layout.sidebar-collapsed .nav-label,
.studio-layout.sidebar-collapsed .nav-section-chevron,
.studio-layout.sidebar-collapsed .nav-group-label {
  display: none;
}

.studio-layout.sidebar-collapsed .nav-section,
.studio-layout.sidebar-collapsed .nav-group {
  width: 100%;
  padding: 8px 0;
}

.studio-layout.sidebar-collapsed .nav-group + .nav-group {
  margin-top: 4px;
}

.nav-link-admin-mobile {
  display: none;
}

.topbar-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}

.topbar-title :deep(.text-h3) {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.12;
  text-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.topbar-heading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar-mode-icon {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border-radius: 10px;
  background: var(--gradient-subtle);
  color: var(--primary);
  flex: none;
}

.topbar.topbar-create {
  min-height: 64px;
}

.topbar-sub {
  font-size: 12px;
  font-weight: 750;
  color: var(--muted);
  line-height: 1.4;
  max-width: 680px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 1 auto;
  min-width: 0;
}

.topbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 850;
  color: var(--text);
}

.redeem-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.redeem-entry:hover {
  background: rgba(37, 99, 235, 0.12);
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  color: var(--text);
  letter-spacing: 0.02em;
}

.meta-tag.plan {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.18);
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 7px 3px 3px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  cursor: pointer;
  color: var(--text);
  box-shadow: none;
}

.user-trigger:hover {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(255, 255, 255, 0.32);
}

.user-avatar {
  width: 28px;
  height: 28px;
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
  font-size: 12px;
  font-weight: 950;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-trigger-role {
  font-size: 10px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.user-trigger-chevron {
  color: var(--muted);
}

.user-menu {
  width: min(220px, 80vw);
}

.user-menu-head {
  padding: 10px 10px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.7);
}

.user-menu-avatar {
  width: 28px;
  height: 28px;
  border-radius: 10px;
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
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-sub {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 900;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.user-menu-list {
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  text-align: left;
}

.user-menu-item:hover {
  border-color: rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
}

.user-menu-divider {
  height: 1px;
  margin: 5px 6px;
  background: rgba(15, 23, 42, 0.08);
}

.user-menu-item.danger {
  color: var(--accent);
}

.user-menu-item.danger:hover {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.18);
}

.redeem-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.redeem-help {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}

.generation-bar {
  min-height: 40px;
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(920px, calc(100vw - 80px));
  margin: 0;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.08);
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
  gap: 8px;
  padding: 1px 7px;
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
  gap: 12px;
  padding: 1px 5px 3px;
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
  font-size: 13px;
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
  border-color: rgba(220, 38, 38, 0.24);
}

.generation-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 12px;
}

.notice-trigger {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 10px;
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
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.18);
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
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.18);
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
  .studio-layout.sidebar-collapsed :deep(.sidebar) {
    width: auto;
  }

  .sidebar-toggle {
    display: none;
  }

  .brand-label,
  .nav-label,
  .studio-layout.sidebar-collapsed .nav-label {
    display: inline;
  }

  .studio-layout.sidebar-collapsed :deep(.sidebar-nav) {
    padding: 7px;
    align-items: center;
  }

  .nav-group,
  .studio-layout.sidebar-collapsed .nav-group {
    display: contents;
  }

  .nav-group-label,
  .studio-layout.sidebar-collapsed .nav-group-label {
    display: none;
  }

  .studio-layout.sidebar-collapsed :deep(.nav-link) {
    flex: 1 0 68px;
    width: auto;
    height: 46px;
    padding: 0 8px;
    gap: 5px;
  }

  .nav-section {
    display: none;
  }

  .page-shell {
    display: block;
    flex: none;
    width: 100%;
    padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }

  .page-shell :deep(> *) {
    flex: none;
    min-height: 0;
  }

  .nav-link-admin-mobile {
    display: flex;
  }

  .topbar-title {
    flex: 1 1 100%;
    max-width: 100%;
  }

  .topbar-title :deep(.text-h3) {
    font-size: 20px;
    line-height: 1.15;
  }

  .topbar-heading {
    gap: 10px;
    width: 100%;
  }

  .topbar-mode-icon {
    width: 30px;
    height: 30px;
    border-radius: 10px;
  }

  .topbar-heading > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topbar-sub {
    max-width: none;
    font-size: 12px;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .topbar-right {
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .topbar-meta {
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
    flex: 1 1 auto;
  }

  .meta-tag,
  .redeem-entry {
    height: 28px;
    padding: 0 8px;
    max-width: 100%;
    font-size: 11px;
  }

  .meta-tag.balance {
    max-width: 94px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-trigger-text,
  .user-trigger-chevron {
    display: none;
  }

  .generation-bar {
    left: 12px;
    right: 12px;
    bottom: calc(78px + env(safe-area-inset-bottom, 0px));
    width: auto;
    transform: none;
  }

  .generation-bar.generation-bar-collapsed {
    left: 50%;
    right: auto;
    width: auto;
    max-width: calc(100vw - 24px);
    transform: translateX(-50%);
  }

  .generation-details {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .generation-actions {
    width: 100%;
  }

  .generation-btn {
    flex: 1;
  }
}
</style>
