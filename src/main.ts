import './assets/main.css'
import 'leaflet/dist/leaflet.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { loadConfig } from './services/config'
import { useAuthStore } from './stores/authStore'
import { createStorageService, migrateFromLocalStorage } from './services/storageFactory'
import { useDiagramStore } from './stores/diagramStore'
import { useBuildingStore } from './stores/buildingStore'

async function bootstrap() {
  await loadConfig()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  const auth = useAuthStore()
  await auth.initAuth()

  // Initialize IndexedDB storage and migrate from localStorage
  const storage = await createStorageService('indexeddb')
  await migrateFromLocalStorage(storage)

  // Initialize stores with IndexedDB backend
  const diagramStore = useDiagramStore()
  await diagramStore.initStorage()
  const buildingStore = useBuildingStore()
  await buildingStore.initStorage()

  app.mount('#app')
}

bootstrap()
