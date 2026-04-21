import type { StorageService } from './storageInterface'
import { IndexedDbStorageService } from './indexedDbStorage'
import { RestApiStorageService } from './restApiStorage'

export type StorageBackend = 'indexeddb' | 'rest-api'

let _instance: StorageService | null = null

export async function createStorageService(
  backend: StorageBackend = 'indexeddb',
  options?: {
    apiBaseUrl?: string
    authTokenProvider?: () => string | null
  },
): Promise<StorageService> {
  if (_instance) return _instance

  if (backend === 'rest-api') {
    const url = options?.apiBaseUrl
    if (!url) throw new Error('apiBaseUrl is required for rest-api backend')
    _instance = new RestApiStorageService(url, options?.authTokenProvider)
  } else {
    _instance = new IndexedDbStorageService()
  }

  await _instance.init()
  return _instance
}

export function getStorageService(): StorageService {
  if (!_instance) throw new Error('StorageService not initialized — call createStorageService() first')
  return _instance
}

// --- Migration from localStorage to IndexedDB ---

const LS_DIAGRAM_KEY = 'hmi-diagram-v1'
const LS_BUILDING_KEY = 'hmi-building-v1'
const LS_BUILDING_SETTINGS_KEY = 'hmi-building-settings-v1'
const LS_FLOORPLAN_DB = 'hmi-floorplans'

export async function migrateFromLocalStorage(storage: StorageService): Promise<void> {
  let migrated = false

  // 1. Migrate diagram
  const rawDiagram = localStorage.getItem(LS_DIAGRAM_KEY)
  if (rawDiagram) {
    try {
      const diagram = JSON.parse(rawDiagram)
      const existing = await storage.diagrams.getById(diagram.id)
      if (!existing) {
        await storage.diagrams.create(diagram)
        migrated = true
      }
    } catch { /* skip corrupt data */ }
  }

  // 2. Migrate building
  const rawBuilding = localStorage.getItem(LS_BUILDING_KEY)
  if (rawBuilding) {
    try {
      const building = JSON.parse(rawBuilding)
      const existing = await storage.buildings.getById(building.id)
      if (!existing) {
        await storage.buildings.create(building)
        migrated = true
      }
    } catch { /* skip corrupt data */ }
  }

  // 3. Migrate building settings
  const rawSettings = localStorage.getItem(LS_BUILDING_SETTINGS_KEY)
  if (rawSettings) {
    try {
      const settings = JSON.parse(rawSettings)
      await storage.settings.set('building-view', settings)
      migrated = true
    } catch { /* skip corrupt data */ }
  }

  // 4. Migrate SVG floorplans from old IndexedDB (hmi-floorplans → unified hmi-editor)
  try {
    await migrateFloorplanBlobs(storage)
  } catch { /* old DB might not exist */ }

  // 5. Clean up localStorage after successful migration
  if (migrated) {
    localStorage.removeItem(LS_DIAGRAM_KEY)
    localStorage.removeItem(LS_BUILDING_KEY)
    localStorage.removeItem(LS_BUILDING_SETTINGS_KEY)
  }
}

async function migrateFloorplanBlobs(storage: StorageService): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LS_FLOORPLAN_DB, 1)
    request.onerror = () => resolve() // old DB doesn't exist — nothing to migrate
    request.onsuccess = async () => {
      const oldDb = request.result
      if (!oldDb.objectStoreNames.contains('svgFiles')) {
        oldDb.close()
        return resolve()
      }

      try {
        const tx = oldDb.transaction('svgFiles', 'readonly')
        const store = tx.objectStore('svgFiles')
        const cursorReq = store.openCursor()

        const entries: Array<{ key: string; value: string }> = []
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor) {
            entries.push({ key: String(cursor.key), value: cursor.value })
            cursor.continue()
          }
        }

        tx.oncomplete = async () => {
          for (const entry of entries) {
            const existing = await storage.blobs.get(`floorplan:${entry.key}`)
            if (!existing) {
              await storage.blobs.put(`floorplan:${entry.key}`, entry.value)
            }
          }
          oldDb.close()
          // Delete old database after migration
          indexedDB.deleteDatabase(LS_FLOORPLAN_DB)
          resolve()
        }
        tx.onerror = () => { oldDb.close(); reject(tx.error) }
      } catch (e) {
        oldDb.close()
        reject(e)
      }
    }
    request.onupgradeneeded = () => {
      // Old DB didn't exist, created fresh — close and delete it
      request.result.close()
      indexedDB.deleteDatabase(LS_FLOORPLAN_DB)
      resolve()
    }
  })
}
