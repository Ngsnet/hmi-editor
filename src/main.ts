import './assets/main.css'
import 'leaflet/dist/leaflet.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { loadConfig } from './services/config'
import { useAuthStore } from './stores/authStore'

async function bootstrap() {
  await loadConfig()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  const auth = useAuthStore()
  await auth.initAuth()

  app.mount('#app')
}

bootstrap()
