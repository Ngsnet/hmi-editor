import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Diagram, CanvasElement, Layer } from '@/types/diagram'

const STORAGE_KEY = 'hmi-diagram-v1'

function generateId(): string {
  return crypto.randomUUID()
}

function defaultDiagram(): Diagram {
  const layerId = generateId()
  return {
    id: generateId(),
    name: 'Nový diagram',
    width: 1920,
    height: 1080,
    backgroundColor: '#f8f9fa',
    gridSize: 10,
    gridVisible: true,
    snapToGrid: true,
    layers: [
      { id: layerId, name: 'Vrstva 1', visible: true, locked: false, order: 0, opacity: 1 },
    ],
    elements: [],
    mapSettings: {
      defaultCenter: [50.0755, 14.4378], // Praha
      defaultZoom: 13,
      tileProvider: 'osm',
      showAsBackground: false,
      backgroundOpacity: 0.5,
      anchorPoint: { canvasX: 960, canvasY: 540, lat: 50.0755, lng: 14.4378 },
      pixelsPerMeter: 1,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const useDiagramStore = defineStore('diagram', () => {
  const diagram = ref<Diagram>(defaultDiagram())
  const selectedElementIds = ref<Set<string>>(new Set())
  const activeLayerId = ref<string>(diagram.value.layers[0]?.id ?? '')

  // --- Computed ---

  const sortedLayers = computed(() =>
    [...diagram.value.layers].sort((a, b) => a.order - b.order)
  )

  const selectedElements = computed(() =>
    diagram.value.elements.filter(el => selectedElementIds.value.has(el.id))
  )

  function elementsOnLayer(layerId: string): CanvasElement[] {
    return diagram.value.elements.filter(el => el.layerId === layerId)
  }

  // --- Element actions ---

  function addElement(data: Omit<CanvasElement, 'id'>): string {
    const id = generateId()
    diagram.value.elements.push({ ...data, id })
    diagram.value.updatedAt = new Date().toISOString()
    return id
  }

  function updateElement(id: string, patch: Partial<CanvasElement>): void {
    const el = diagram.value.elements.find(e => e.id === id)
    if (el) {
      Object.assign(el, patch)
      diagram.value.updatedAt = new Date().toISOString()
    }
  }

  function deleteElements(ids: string[]): void {
    const idSet = new Set(ids)
    diagram.value.elements = diagram.value.elements.filter(e => !idSet.has(e.id))
    ids.forEach(id => selectedElementIds.value.delete(id))
    diagram.value.updatedAt = new Date().toISOString()
  }

  function moveElements(ids: string[], dx: number, dy: number): void {
    const idSet = new Set(ids)
    diagram.value.elements.forEach(el => {
      if (idSet.has(el.id)) {
        el.x += dx
        el.y += dy
        // Move points for line/polyline
        if (el.points) {
          el.points.forEach(p => { p.x += dx; p.y += dy })
        }
      }
    })
    diagram.value.updatedAt = new Date().toISOString()
  }

  function duplicateElements(ids: string[]): string[] {
    const newIds: string[] = []
    ids.forEach(id => {
      const original = diagram.value.elements.find(e => e.id === id)
      if (original) {
        const newId = addElement({
          ...JSON.parse(JSON.stringify(original)),
          x: original.x + 20,
          y: original.y + 20,
        })
        newIds.push(newId)
      }
    })
    return newIds
  }

  function reorderElement(id: string, direction: 'up' | 'down' | 'top' | 'bottom'): void {
    const el = diagram.value.elements.find(e => e.id === id)
    if (!el) return
    const layerEls = diagram.value.elements.filter(e => e.layerId === el.layerId)
    const idx = layerEls.indexOf(el)
    const globalIdx = diagram.value.elements.indexOf(el)

    switch (direction) {
      case 'up':
        if (idx < layerEls.length - 1) {
          const next = layerEls[idx + 1]
          if (next) {
            const nextGlobal = diagram.value.elements.indexOf(next)
            diagram.value.elements.splice(globalIdx, 1)
            diagram.value.elements.splice(nextGlobal, 0, el)
          }
        }
        break
      case 'down':
        if (idx > 0) {
          const prev = layerEls[idx - 1]
          if (prev) {
            const prevGlobal = diagram.value.elements.indexOf(prev)
            diagram.value.elements.splice(globalIdx, 1)
            diagram.value.elements.splice(prevGlobal, 0, el)
          }
        }
        break
      case 'top': {
        diagram.value.elements.splice(globalIdx, 1)
        diagram.value.elements.push(el)
        break
      }
      case 'bottom': {
        diagram.value.elements.splice(globalIdx, 1)
        diagram.value.elements.unshift(el)
        break
      }
    }
  }

  // --- Layer actions ---

  function addLayer(name: string): string {
    const id = generateId()
    const maxOrder = diagram.value.layers.reduce((max, l) => Math.max(max, l.order), -1)
    diagram.value.layers.push({
      id, name, visible: true, locked: false, order: maxOrder + 1, opacity: 1,
    })
    activeLayerId.value = id
    return id
  }

  function updateLayer(id: string, patch: Partial<Layer>): void {
    const layer = diagram.value.layers.find(l => l.id === id)
    if (layer) Object.assign(layer, patch)
  }

  function deleteLayer(id: string): void {
    if (diagram.value.layers.length <= 1) return
    diagram.value.layers = diagram.value.layers.filter(l => l.id !== id)
    diagram.value.elements = diagram.value.elements.filter(e => e.layerId !== id)
    if (activeLayerId.value === id) {
      activeLayerId.value = diagram.value.layers[0]?.id ?? ''
    }
  }

  function reorderLayer(id: string, direction: 'up' | 'down'): void {
    const sorted = sortedLayers.value
    const idx = sorted.findIndex(l => l.id === id)
    if (idx < 0) return
    const current = sorted[idx]!
    if (direction === 'up' && idx < sorted.length - 1) {
      const next = sorted[idx + 1]!
      const thisOrder = current.order
      current.order = next.order
      next.order = thisOrder
    } else if (direction === 'down' && idx > 0) {
      const prev = sorted[idx - 1]!
      const thisOrder = current.order
      current.order = prev.order
      prev.order = thisOrder
    }
  }

  // --- Selection ---

  function selectElement(id: string, addToSelection = false): void {
    if (!addToSelection) selectedElementIds.value.clear()
    selectedElementIds.value.add(id)
  }

  function deselectAll(): void {
    selectedElementIds.value.clear()
  }

  function selectAll(): void {
    diagram.value.elements.forEach(el => selectedElementIds.value.add(el.id))
  }

  // --- Persistence ---

  function saveToLocalStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram.value))
  }

  function loadFromLocalStorage(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw)
        diagram.value = data
        if (data.layers.length > 0) {
          activeLayerId.value = data.layers[0].id
        }
      } catch { /* ignore corrupt data */ }
    }
  }

  function exportToJSON(): string {
    return JSON.stringify(diagram.value, null, 2)
  }

  function importFromJSON(json: string): void {
    const data = JSON.parse(json)
    diagram.value = data
    selectedElementIds.value.clear()
    if (data.layers.length > 0) {
      activeLayerId.value = data.layers[0].id
    }
  }

  // Auto-save with debounce
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(diagram, () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveToLocalStorage, 1000)
  }, { deep: true })

  // Load on init
  loadFromLocalStorage()

  return {
    diagram,
    selectedElementIds,
    activeLayerId,
    sortedLayers,
    selectedElements,
    elementsOnLayer,
    addElement,
    updateElement,
    deleteElements,
    moveElements,
    duplicateElements,
    reorderElement,
    addLayer,
    updateLayer,
    deleteLayer,
    reorderLayer,
    selectElement,
    deselectAll,
    selectAll,
    saveToLocalStorage,
    loadFromLocalStorage,
    exportToJSON,
    importFromJSON,
  }
})
