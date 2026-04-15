import { createRouter, createWebHistory } from 'vue-router'
import EditorLayout from '@/components/editor/EditorLayout.vue'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'editor',
      component: EditorLayout,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'admin-home',
          component: () => import('@/views/admin/AdminUnitList.vue'),
        },
        {
          path: 'units',
          name: 'admin-units',
          component: () => import('@/views/admin/AdminUnitList.vue'),
        },
        {
          path: 'units/:id',
          name: 'admin-unit-detail',
          component: () => import('@/views/admin/AdminUnitDetail.vue'),
          props: true,
        },
        {
          path: 'floorplans',
          name: 'admin-floorplans',
          component: () => import('@/views/admin/AdminFloorPlans.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'editor' }
  }
})

export default router
