import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import type { Building, FloorId, GeoRef, MeterType, Unit } from '@/types/indoor'
import { demoBuilding } from '@/data/demoBuilding'
import { getStorageService } from '@/services/storageFactory'

export const useBuildingStore = defineStore('building', () => {
  const building = ref<Building>(JSON.parse(JSON.stringify(demoBuilding)))
  const selectedUnitId = ref<string | null>(null)
  const activeFloor = ref<FloorId>('')
  const meterValues = reactive<Map<string, number | null>>(new Map())
  const meterAlerts = reactive<Set<string>>(new Set())
  const storageReady = ref(false)

  // View settings (loaded from IndexedDB settings store)
  const floorPlanOpacity = ref(0.85)
  const floorPlanScale = ref(1)
  const floorPlanOffsetX = ref(0)
  const floorPlanOffsetY = ref(0)
  const floorPlanRotation = ref(0)
  const mapCenter = ref<[number, number] | null>(null)
  const mapZoom = ref<number | null>(null)

  const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>()

  // Computed
  const selectedUnit = computed<Unit | null>(() => {
    if (!selectedUnitId.value) return null
    return building.value.units.find(u => u.id === selectedUnitId.value) ?? null
  })

  const sortedFloors = computed(() =>
    [...building.value.floors].sort((a, b) => a.order - b.order)
  )

  const unitsOnActiveFloor = computed(() =>
    building.value.units.filter(u => u.floor === activeFloor.value)
  )

  // Actions
  function selectUnit(id: string | null) {
    selectedUnitId.value = id
  }

  function setActiveFloor(floor: FloorId) {
    activeFloor.value = floor
  }

  function getMeterKey(unitId: string, meterType: MeterType): string {
    return `${unitId}:${meterType}`
  }

  function getMeterValue(unitId: string, meterType: MeterType): number | null {
    return meterValues.get(getMeterKey(unitId, meterType)) ?? null
  }

  function getUnitStatus(unitId: string): 'normal' | 'alert' | 'empty' | 'no-data' {
    const unit = building.value.units.find(u => u.id === unitId)
    if (!unit) return 'no-data'
    if (unit.category === 'empty') return 'empty'

    if (meterAlerts.has(unitId)) return 'alert'

    const meterTypes = Object.keys(unit.meters) as MeterType[]
    if (meterTypes.length === 0) return 'no-data'

    const hasAnyValue = meterTypes.some(mt => meterValues.has(getMeterKey(unitId, mt)))
    if (!hasAnyValue) return 'no-data'

    return 'normal'
  }

  function generateMockValue(endpoint: string): number {
    if (endpoint.startsWith('mock://')) {
      const type = endpoint.replace('mock://', '')
      switch (type) {
        case 'water': return +(0.1 + Math.random() * 2).toFixed(2)
        case 'electric': return +(10 + Math.random() * 50).toFixed(1)
        case 'cooling': return +(0.5 + Math.random() * 3).toFixed(2)
        case 'heating': return +(1 + Math.random() * 5).toFixed(2)
        default: return +(Math.random() * 100).toFixed(1)
      }
    }
    return 0
  }

  function registerAllMeters() {
    unregisterAllMeters()

    for (const unit of building.value.units) {
      for (const [meterType, config] of Object.entries(unit.meters)) {
        if (!config) continue
        const key = getMeterKey(unit.id, meterType as MeterType)

        const poll = () => {
          if (config.endpoint.startsWith('mock://')) {
            const value = generateMockValue(config.endpoint)
            meterValues.set(key, value)

            // Check alert threshold
            if (config.alertThreshold != null && value > config.alertThreshold) {
              meterAlerts.add(unit.id)
            } else {
              // Only remove alert if no other meter is in alert
              const otherAlert = (Object.entries(unit.meters) as [MeterType, typeof config][])
                .some(([mt, mc]) => {
                  if (mt === meterType || !mc) return false
                  const v = meterValues.get(getMeterKey(unit.id, mt))
                  return v != null && mc.alertThreshold != null && v > mc.alertThreshold
                })
              if (!otherAlert) meterAlerts.delete(unit.id)
            }
          } else {
            // Real endpoint fetch
            fetch(config.endpoint)
              .then(res => res.ok ? res.json() : Promise.reject(res.status))
              .then(data => {
                const value = config.valueKey.split('.').reduce((obj: any, k) => obj?.[k], data)
                meterValues.set(key, typeof value === 'number' ? value : null)
              })
              .catch(() => {
                meterValues.set(key, null)
              })
          }
        }

        poll()
        pollingIntervals.set(key, setInterval(poll, config.interval))
      }
    }
  }

  function unregisterAllMeters() {
    pollingIntervals.forEach(id => clearInterval(id))
    pollingIntervals.clear()
  }

  const activeFloorPlan = computed(() =>
    building.value.floors.find(f => f.id === activeFloor.value)
  )

  const activeGeoRef = computed(() => activeFloorPlan.value?.geoRef)

  const hasGeoRef = computed(() => !!activeGeoRef.value)

  function setGeoRef(geoRef: [GeoRef, GeoRef]) {
    const floor = building.value.floors.find(f => f.id === activeFloor.value)
    if (floor) {
      floor.geoRef = geoRef
      saveBuilding()
    }
  }

  function clearGeoRef() {
    const floor = building.value.floors.find(f => f.id === activeFloor.value)
    if (floor) {
      floor.geoRef = undefined
      saveBuilding()
    }
  }

  function loadBuilding(b: Building) {
    building.value = b
    activeFloor.value = b.floors[0]?.id ?? ''
    selectedUnitId.value = null
    meterValues.clear()
    meterAlerts.clear()
    saveBuilding()
  }

  // --- Persistence (IndexedDB via StorageService) ---

  async function saveBuilding(): Promise<void> {
    if (!storageReady.value) return
    try {
      const storage = getStorageService()
      const existing = await storage.buildings.getById(building.value.id)
      if (existing) {
        await storage.buildings.update(building.value.id, JSON.parse(JSON.stringify(building.value)))
      } else {
        await storage.buildings.create(JSON.parse(JSON.stringify(building.value)))
      }
    } catch (e) {
      console.error('Failed to save building:', e)
    }
  }

  async function saveSettings(): Promise<void> {
    if (!storageReady.value) return
    try {
      const storage = getStorageService()
      await storage.settings.set('building-view', {
        floorPlanOpacity: floorPlanOpacity.value,
        floorPlanScale: floorPlanScale.value,
        floorPlanOffsetX: floorPlanOffsetX.value,
        floorPlanOffsetY: floorPlanOffsetY.value,
        floorPlanRotation: floorPlanRotation.value,
        mapCenter: mapCenter.value,
        mapZoom: mapZoom.value,
      })
    } catch (e) {
      console.error('Failed to save building settings:', e)
    }
  }

  async function loadFromStorage(): Promise<void> {
    try {
      const storage = getStorageService()

      // Load building
      const all = await storage.buildings.getAll()
      if (all.length > 0 && all[0]) {
        building.value = all[0]
        activeFloor.value = all[0].floors[0]?.id ?? ''
      }

      // Load view settings
      const settings = await storage.settings.get<{
        floorPlanOpacity?: number
        floorPlanScale?: number
        floorPlanOffsetX?: number
        floorPlanOffsetY?: number
        floorPlanRotation?: number
        mapCenter?: [number, number] | null
        mapZoom?: number | null
      }>('building-view')

      if (settings) {
        floorPlanOpacity.value = settings.floorPlanOpacity ?? 0.85
        floorPlanScale.value = settings.floorPlanScale ?? 1
        floorPlanOffsetX.value = settings.floorPlanOffsetX ?? 0
        floorPlanOffsetY.value = settings.floorPlanOffsetY ?? 0
        floorPlanRotation.value = settings.floorPlanRotation ?? 0
        mapCenter.value = settings.mapCenter ?? null
        mapZoom.value = settings.mapZoom ?? null
      }
    } catch (e) {
      console.error('Failed to load building from storage:', e)
    }
  }

  async function initStorage(): Promise<void> {
    storageReady.value = true
    await loadFromStorage()
  }

  async function resetToDemo() {
    // Clear all building data from IndexedDB
    try {
      const storage = getStorageService()
      const allBuildings = await storage.buildings.getAll()
      await storage.buildings.bulkDelete(allBuildings.map(b => b.id))
      await storage.settings.delete('building-view')

      // Clear all floorplan SVGs from blobs
      const allKeys = await storage.blobs.getAllKeys()
      for (const key of allKeys) {
        if (key.startsWith('floorplan:')) {
          await storage.blobs.delete(key)
        }
      }
    } catch (e) {
      console.error('Failed to clear storage:', e)
    }

    // Reset to empty default
    building.value = JSON.parse(JSON.stringify(demoBuilding))
    activeFloor.value = building.value.floors[0]?.id ?? ''
    selectedUnitId.value = null
    meterValues.clear()
    meterAlerts.clear()
    floorPlanOpacity.value = 0.85
    floorPlanScale.value = 1
    floorPlanOffsetX.value = 0
    floorPlanOffsetY.value = 0
    floorPlanRotation.value = 0
    mapCenter.value = null
    mapZoom.value = null

    await saveBuilding()
  }

  // Auto-save with debounce
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(building, () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveBuilding, 1000)
  }, { deep: true })

  // Watch view settings changes
  watch(
    [floorPlanOpacity, floorPlanScale, floorPlanOffsetX, floorPlanOffsetY, floorPlanRotation, mapCenter, mapZoom],
    saveSettings,
  )

  return {
    building,
    selectedUnitId,
    activeFloor,
    meterValues,
    meterAlerts,
    storageReady,
    floorPlanOpacity,
    floorPlanScale,
    floorPlanOffsetX,
    floorPlanOffsetY,
    floorPlanRotation,
    mapCenter,
    mapZoom,
    selectedUnit,
    sortedFloors,
    unitsOnActiveFloor,
    selectUnit,
    setActiveFloor,
    getMeterValue,
    getUnitStatus,
    registerAllMeters,
    unregisterAllMeters,
    activeGeoRef,
    hasGeoRef,
    setGeoRef,
    clearGeoRef,
    loadBuilding,
    initStorage,
    resetToDemo,
  }
})
