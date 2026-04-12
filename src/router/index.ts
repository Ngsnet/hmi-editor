import { createRouter, createWebHistory } from 'vue-router'
import EditorLayout from '@/components/editor/EditorLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorLayout,
    },
  ],
})

export default router
