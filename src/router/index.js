import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const DYNAMIC_IMPORT_ERROR_RELOAD_KEY = 'router:dynamic-import-reload'

const LandingView = () => import('../views/LandingView.vue')
const AuthView = () => import('../views/AuthView.vue')
const StudioView = () => import('../views/StudioView.vue')
const CreateView = () => import('../views/studio/CreateView.vue')
const HistoryView = () => import('../views/studio/HistoryView.vue')
const HistoryDetailView = () => import('../views/studio/HistoryDetailView.vue')
const ModelsView = () => import('../views/studio/ModelsView.vue')
const SettingsView = () => import('../views/studio/SettingsView.vue')
const AnnouncementsView = () => import('../views/studio/AnnouncementsView.vue')
const TasksView = () => import('../views/studio/TasksView.vue')
const StyleBoardsView = () => import('../views/studio/StyleBoardsView.vue')
const AdminDashboardView = () => import('../views/studio/admin/AdminDashboardView.vue')
const AdminOperationsView = () => import('../views/studio/admin/AdminOperationsView.vue')
const AdminUsersView = () => import('../views/studio/admin/AdminUsersView.vue')
const AdminAnnouncementsView = () => import('../views/studio/admin/AdminAnnouncementsView.vue')
const AdminSettingsView = () => import('../views/studio/admin/AdminSettingsView.vue')
const AdminLedgerView = () => import('../views/studio/admin/AdminLedgerView.vue')
const AdminRedeemCodesView = () => import('../views/studio/admin/AdminRedeemCodesView.vue')
const AdminAuditLogsView = () => import('../views/studio/admin/AdminAuditLogsView.vue')
const AdminBillingOrdersView = () => import('../views/studio/admin/AdminBillingOrdersView.vue')
const AdminImageFeedbackView = () => import('../views/studio/admin/AdminImageFeedbackView.vue')
const BillingView = () => import('../views/studio/BillingView.vue')

export function isDynamicImportError(error) {
  const message = String(error?.message || error || '')
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  )
}

function getReloadPath(targetPath) {
  if (targetPath) return targetPath
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function shouldReloadOnDynamicImportError() {
  return import.meta.env.PROD
}

export function reloadOnDynamicImportError(error, targetPath) {
  if (
    typeof window === 'undefined' ||
    !shouldReloadOnDynamicImportError() ||
    !isDynamicImportError(error)
  ) {
    return false
  }

  const reloadPath = getReloadPath(targetPath)
  const lastReloadPath = window.sessionStorage.getItem(DYNAMIC_IMPORT_ERROR_RELOAD_KEY)
  if (lastReloadPath === reloadPath) {
    window.sessionStorage.removeItem(DYNAMIC_IMPORT_ERROR_RELOAD_KEY)
    return false
  }

  window.sessionStorage.setItem(DYNAMIC_IMPORT_ERROR_RELOAD_KEY, reloadPath)
  window.location.assign(reloadPath)
  return true
}

function safeRedirectTarget(value, fallback = '/studio') {
  const target = String(value || '').trim()
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/login')) {
    return fallback
  }
  return target
}

const routes = [
  {
    path: '/',
    name: 'home',
    component: LandingView
  },
  {
    path: '/login',
    name: 'login',
    component: AuthView,
    meta: { guestOnly: true }
  },
  {
    path: '/studio',
    component: StudioView,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'studio-create',
        component: CreateView
      },
      {
        path: 'dialogue',
        name: 'studio-dialogue',
        component: CreateView
      },
      {
        path: 'history',
        name: 'studio-history',
        component: HistoryView
      },
      {
        path: 'history/:id',
        name: 'studio-history-detail',
        component: HistoryDetailView
      },
      {
        path: 'models',
        name: 'studio-models',
        component: ModelsView,
        meta: { requiresAuth: false } // Models page should be accessible without auth for inspiration
      },
      {
        path: 'settings',
        name: 'studio-settings',
        component: SettingsView
      },
      {
        path: 'profile',
        name: 'studio-profile',
        redirect: { name: 'studio-settings' }
      },
      {
        path: 'billing',
        name: 'studio-billing',
        component: BillingView
      },
      {
        path: 'tasks',
        name: 'studio-tasks',
        component: TasksView
      },
      {
        path: 'style-boards',
        name: 'studio-style-boards',
        component: StyleBoardsView
      },
      {
        path: 'announcements',
        name: 'studio-announcements',
        component: AnnouncementsView
      },
      {
        path: 'admin',
        redirect: { name: 'studio-admin-dashboard' }
      },
      {
        path: 'admin/operations',
        name: 'studio-admin-operations',
        component: AdminOperationsView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/dashboard',
        name: 'studio-admin-dashboard',
        component: AdminDashboardView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/users',
        name: 'studio-admin-users',
        component: AdminUsersView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/announcements',
        name: 'studio-admin-announcements',
        component: AdminAnnouncementsView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/settings',
        name: 'studio-admin-settings',
        component: AdminSettingsView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/ledger',
        name: 'studio-admin-ledger',
        component: AdminLedgerView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/billing-orders',
        name: 'studio-admin-billing-orders',
        component: AdminBillingOrdersView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/redeem-codes',
        name: 'studio-admin-redeem-codes',
        component: AdminRedeemCodesView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/audit-logs',
        name: 'studio-admin-audit-logs',
        component: AdminAuditLogsView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/image-feedback',
        name: 'studio-admin-image-feedback',
        component: AdminImageFeedbackView,
        meta: { requiresRole: ['admin', 'superadmin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.onError((error, to) => {
  reloadOnDynamicImportError(error, to?.fullPath)
})

router.beforeEach(async (to) => {
  if (typeof window !== 'undefined') {
    const lastReloadPath = window.sessionStorage.getItem(DYNAMIC_IMPORT_ERROR_RELOAD_KEY)
    if (lastReloadPath === to.fullPath) {
      window.sessionStorage.removeItem(DYNAMIC_IMPORT_ERROR_RELOAD_KEY)
    }
  }

  const authStore = useAuthStore()
  if (!authStore.isInitialized) {
    await authStore.fetchUser()
  }

  const isAuthenticated = !!authStore.user
  const role = authStore.user?.role
  
  // If route explicitly overrides parent's requiresAuth to false
  if (to.meta.requiresAuth === false) {
    return true
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return safeRedirectTarget(to.query.redirect)
  }

  if (to.meta.requiresRole) {
    const allowed = Array.isArray(to.meta.requiresRole) ? to.meta.requiresRole : []
    if (!isAuthenticated) {
      return { name: 'login' }
    }
    if (!allowed.includes(role)) {
      return { name: 'studio-create' }
    }
    return true
  }

  return true
})

export default router
