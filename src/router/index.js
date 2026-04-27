import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/LandingView.vue')
  },
  {
    path: '/auth',
    name: 'auth',
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
        path: 'models',
        name: 'studio-models',
        component: () => import('../views/studio/ModelsView.vue'),
        meta: { requiresAuth: false } // Models page should be accessible without auth for inspiration
      },
      {
        path: 'settings',
        name: 'studio-settings',
        component: () => import('../views/studio/SettingsView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  if (!authStore.isInitialized) {
    await authStore.fetchUser()
  }

  const isAuthenticated = !!authStore.user
  
  // If route explicitly overrides parent's requiresAuth to false
  if (to.meta.requiresAuth === false) {
    return next()
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'auth' })
  } else if (to.meta.guestOnly && isAuthenticated) {
    next({ name: 'studio-create' })
  } else {
    next()
  }
})

export default router