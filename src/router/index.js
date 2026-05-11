import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LandingView from '../views/LandingView.vue'
import AuthView from '../views/AuthView.vue'
import StudioView from '../views/StudioView.vue'
import CreateView from '../views/studio/CreateView.vue'
import HistoryView from '../views/studio/HistoryView.vue'
import HistoryDetailView from '../views/studio/HistoryDetailView.vue'
import ModelsView from '../views/studio/ModelsView.vue'
import SettingsView from '../views/studio/SettingsView.vue'
import ProfileView from '../views/studio/ProfileView.vue'
import AnnouncementsView from '../views/studio/AnnouncementsView.vue'
import AdminUsersView from '../views/studio/admin/AdminUsersView.vue'
import AdminAnnouncementsView from '../views/studio/admin/AdminAnnouncementsView.vue'
import AdminSettingsView from '../views/studio/admin/AdminSettingsView.vue'
import AdminLedgerView from '../views/studio/admin/AdminLedgerView.vue'
import AdminRedeemCodesView from '../views/studio/admin/AdminRedeemCodesView.vue'
import AdminAuditLogsView from '../views/studio/admin/AdminAuditLogsView.vue'

const DYNAMIC_IMPORT_ERROR_RELOAD_KEY = 'router:dynamic-import-reload'

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
        component: ProfileView
      },
      {
        path: 'announcements',
        name: 'studio-announcements',
        component: AnnouncementsView
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
    return { name: 'login' }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return { name: 'studio-create' }
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
