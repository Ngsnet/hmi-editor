import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { cemService } from '@/services/cem.service'
import type { CemObject, CemMeter, CemCounter, CemCounterType, CemLiveValue } from '@/types/cem'

export const useCemDataStore = defineStore('cemData', () => {
  const objects = ref<CemObject[]>([])
  const meters = ref<CemMeter[]>([])
  const countersByMeterId = ref<Map<number, CemCounter[]>>(new Map())
  const meterIdsByObjectId = ref<Map<number, number[]>>(new Map())
  const counterTypes = ref<CemCounterType[]>([])
  const liveValues = reactive<Map<number, CemLiveValue>>(new Map())

  const isLoading = ref(false)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  let pollingTimer: ReturnType<typeof setInterval> | null = null

  // --- Tree helpers ---

  /** Install points only (mit_id === -1000) */
  const installPoints = computed(() =>
    objects.value.filter(o => o.type === 'installPoint')
  )

  /** Set of all object IDs in dataset */
  const allObjectIds = computed(() => new Set(objects.value.map(o => o.id)))

  /** Build parent→children tree for UI picker */
  const objectTree = computed(() => {
    const map = new Map<number | 'root', CemObject[]>()
    for (const obj of objects.value) {
      // If parent is not in dataset, this is a root node
      const key = (obj.parentId != null && allObjectIds.value.has(obj.parentId))
        ? obj.parentId
        : 'root' as const
      const list = map.get(key)
      if (list) list.push(obj)
      else map.set(key, [obj])
    }
    return map
  })

  /** Root objects (those whose parent is not in the dataset) */
  const rootObjects = computed(() => objectTree.value.get('root') ?? [])

  function getChildObjects(parentId: number): CemObject[] {
    return objectTree.value.get(parentId) ?? []
  }

  // --- Data fetching ---

  async function fetchAll() {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      // 1. Counter types first
      counterTypes.value = await cemService.fetchCounterTypes()

      // 2. Objects, meters, counters in parallel
      const [allObjects, allMeters, allCounters] = await Promise.all([
        cemService.fetchObjects(),
        cemService.fetchAllMeters(),
        cemService.fetchAllCounters(),
      ])

      objects.value = allObjects
      meters.value = allMeters

      // Build object → meter mapping
      const objToMeter = new Map<number, number[]>()
      for (const m of allMeters) {
        const existing = objToMeter.get(m.objectId)
        if (existing) existing.push(m.id)
        else objToMeter.set(m.objectId, [m.id])
      }
      meterIdsByObjectId.value = objToMeter

      // Build meter → counter mapping
      const grouped = new Map<number, CemCounter[]>()
      for (const counter of allCounters) {
        const existing = grouped.get(counter.meterId)
        if (existing) existing.push(counter)
        else grouped.set(counter.meterId, [counter])
      }
      countersByMeterId.value = grouped

      isLoaded.value = true
    } catch (e) {
      error.value = `CEM data load failed: ${(e as Error).message}`
      console.error('CEM fetchAll error:', e)
    } finally {
      isLoading.value = false
    }
  }

  // --- Lookups ---

  function getMetersForObject(objectId: number): CemMeter[] {
    const meterIds = meterIdsByObjectId.value.get(objectId)
    if (!meterIds) return []
    return meters.value.filter(m => meterIds.includes(m.id))
  }

  function getCountersForMeter(meterId: number): CemCounter[] {
    return (countersByMeterId.value.get(meterId) ?? []).sort((a, b) => a.typeId - b.typeId)
  }

  function getCountersForObject(objectId: number): CemCounter[] {
    const meterIds = meterIdsByObjectId.value.get(objectId)
    if (!meterIds) return []
    const result: CemCounter[] = []
    for (const meId of meterIds) {
      const counters = countersByMeterId.value.get(meId)
      if (counters) result.push(...counters)
    }
    return result.sort((a, b) => a.typeId - b.typeId)
  }

  function getAllVarIds(): number[] {
    const ids: number[] = []
    for (const counters of countersByMeterId.value.values()) {
      for (const c of counters) ids.push(c.id)
    }
    return ids
  }

  function getVarIdsForObject(objectId: number): number[] {
    return getCountersForObject(objectId).map(c => c.id)
  }

  // --- Live value polling ---

  function getLiveValue(varId: number): CemLiveValue | undefined {
    return liveValues.get(varId)
  }

  async function pollLiveValues(varIds: number[]) {
    if (varIds.length === 0) return
    try {
      const readings = await cemService.getLastReading(varIds)
      for (const r of readings) {
        liveValues.set(r.var_id, {
          value: r.value,
          time: new Date(r.timestamp).toLocaleString('cs-CZ'),
        })
      }
    } catch (e) {
      console.error('CEM polling error:', e)
    }
  }

  function startPolling(varIds: number[], intervalMs = 30000) {
    stopPolling()
    if (varIds.length === 0) return
    // Initial fetch
    pollLiveValues(varIds)
    pollingTimer = setInterval(() => pollLiveValues(varIds), intervalMs)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  // --- History (48h) ---

  async function fetchHistory48h(varId: number): Promise<Array<{ timestamp: number; value: number }>> {
    const now = new Date()
    const from48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const fromStr = from48h.toISOString().slice(0, 19)
    const toStr = now.toISOString().slice(0, 19)
    try {
      const readings = await cemService.getSingleReadings(varId, fromStr, toStr)
      return readings.map(r => ({ timestamp: r.timestamp, value: r.value }))
    } catch {
      return []
    }
  }

  return {
    objects,
    meters,
    countersByMeterId,
    meterIdsByObjectId,
    counterTypes,
    liveValues,
    isLoading,
    isLoaded,
    error,
    installPoints,
    rootObjects,
    objectTree,
    getChildObjects,
    fetchAll,
    getMetersForObject,
    getCountersForMeter,
    getCountersForObject,
    getAllVarIds,
    getVarIdsForObject,
    getLiveValue,
    startPolling,
    stopPolling,
    pollLiveValues,
    fetchHistory48h,
  }
})
