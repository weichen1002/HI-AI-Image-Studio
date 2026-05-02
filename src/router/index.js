import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/LandingView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/AuthView.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/studio',
    component: () => import('../views/StudioView.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'studio-create',
        component: () => import('../views/studio/CreateView.vue')
      },
      {
        path: 'history',
        name: 'studio-history',
        component: () => import('../views/studio/HistoryView.vue')
      },
      {
        path: 'history/:id',
        name: 'studio-history-detail',
        component: () => import('../views/studio/HistoryDetailView.vue')
      },
      {
        path: 'models',
        name: 'studio-models',
        component: () => import('../views/studio/ModelsView.vue'),
        meta: { requiresAuth: false } // Models page should be accessible without auth for inspiration
      },
      {
        path: 'settings',
        name: 'studio-settings',
        component: () => import('../views/studio/SettingsView.vue')
      },
      {
        path: 'profile',
        name: 'studio-profile',
        component: () => import('../views/studio/ProfileView.vue')
      },
      {
        path: 'announcements',
        name: 'studio-announcements',
        component: () => import('../views/studio/AnnouncementsView.vue')
      },
      {
        path: 'admin/users',
        name: 'studio-admin-users',
        component: () => import('../views/studio/admin/AdminUsersView.vue'),
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/announcements',
        name: 'studio-admin-announcements',
        component: () => import('../views/studio/admin/AdminAnnouncementsView.vue'),
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/settings',
        name: 'studio-admin-settings',
        component: () => import('../views/studio/admin/AdminSettingsView.vue'),
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/ledger',
        name: 'studio-admin-ledger',
        component: () => import('../views/studio/admin/AdminLedgerView.vue'),
        meta: { requiresRole: ['admin', 'superadmin'] }
      },
      {
        path: 'admin/redeem-codes',
        name: 'studio-admin-redeem-codes',
        component: () => import('../views/studio/admin/AdminRedeemCodesView.vue'),
        meta: { requiresRole: ['admin', 'superadmin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
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
