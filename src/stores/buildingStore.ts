import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import type { Building, FloorId, MeterType, Unit } from '@/types/indoor'
import { demoBuilding } from '@/data/demoBuilding'

const STORAGE_KEY = 'hmi-building-v1'
const SETTINGS_KEY = 'hmi-building-settings-v1'

function loadFromStorage(): Building | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore corrupt data */ }
  return null
}

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export const useBuildingStore = defineStore('building', () => {
  const building = ref<Building>(loadFromStorage() ?? demoBuilding)
  const selectedUnitId = ref<string | null>(null)
  const activeFloor = ref<FloorId>('GL')
  const meterValues = reactive<Map<string, number | null>>(new Map())
  const meterAlerts = reactive<Set<string>>(new Set())
  const savedSettings = loadSettingsFromStorage()
  const floorPlanOpacity = ref(savedSettings?.floorPlanOpacity ?? 0.85)
  const floorPlanScale = ref(savedSettings?.floorPlanScale ?? 1)
  const floorPlanOffsetX = ref(savedSettings?.floorPlanOffsetX ?? 0)
  const floorPlanOffsetY = ref(savedSettings?.floorPlanOffsetY ?? 0)
  const floorPlanRotation = ref(savedSettings?.floorPlanRotation ?? 0)
  const mapCenter = ref<[number, number] | null>(savedSettings?.mapCenter ?? null)
  const mapZoom = ref<number | null>(savedSettings?.mapZoom ?? null)

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

  function loadBuilding(b: Building) {
    building.value = b
    activeFloor.value = b.floors[0]?.id ?? 'GL'
    selectedUnitId.value = null
    meterValues.clear()
    meterAlerts.clear()
    saveToStorage()
  }

  // Persistence
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(building.value))
  }

  function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      floorPlanOpacity: floorPlanOpacity.value,
      floorPlanScale: floorPlanScale.value,
      floorPlanOffsetX: floorPlanOffsetX.value,
      floorPlanOffsetY: floorPlanOffsetY.value,
      floorPlanRotation: floorPlanRotation.value,
      mapCenter: mapCenter.value,
      mapZoom: mapZoom.value,
    }))
  }

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveToStorage, 1000)
  }

  // Watch building data changes (debounced)
  watch(building, debouncedSave, { deep: true })

  // Watch view settings changes
  watch(
    [floorPlanOpacity, floorPlanScale, floorPlanOffsetX, floorPlanOffsetY, floorPlanRotation, mapCenter, mapZoom],
    saveSettingsToStorage,
  )

  function resetToDemo() {
    building.value = JSON.parse(JSON.stringify(demoBuilding))
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SETTINGS_KEY)
  }

  return {
    building,
    selectedUnitId,
    activeFloor,
    meterValues,
    meterAlerts,
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
    loadBuilding,
    resetToDemo,
  }
})
