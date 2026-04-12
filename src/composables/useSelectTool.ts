import { ref, reactive } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useViewportStore } from '@/stores/viewportStore'
import { snapToGrid } from '@/utils/coordUtils'

export interface RubberBand {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export interface SelectToolCallbacks {
  onMoveEnd?: (ids: string[], dx: number, dy: number) => void
  onDelete?: (ids: string[]) => void
}

export function useSelectTool(
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number },
  getSvgOffset: (e: PointerEvent) => { x: number; y: number },
  callbacks?: SelectToolCallbacks,
) {
  const diagramStore = useDiagramStore()
  const viewportStore = useViewportStore()

  const isDragging = ref(false)
  const dragStartCanvas = reactive({ x: 0, y: 0 })
  const dragElementIds = ref<string[]>([])
  const totalDx = ref(0)
  const totalDy = ref(0)

  const rubberBand = reactive<RubberBand>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })

  function hitTestElement(canvasX: number, canvasY: number): string | null {
    // Iterate in reverse (top-most first)
    const elements = diagramStore.diagram.elements
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]!
      if (!el.visible) continue

      // Check layer visibility
      const layer = diagramStore.diagram.layers.find(l => l.id === el.layerId)
      if (layer && !layer.visible) continue

      if (el.type === 'line') {
        const p1 = el.points?.[0] ?? { x: el.x, y: el.y }
        const p2 = el.points?.[1] ?? { x: el.x + el.width, y: el.y + el.height }
        const dist = pointToSegmentDist(canvasX, canvasY, p1.x, p1.y, p2.x, p2.y)
        const hitThreshold = 8 / viewportStore.viewport.scale
        if (dist < hitThreshold) return el.id
      } else if (el.type === 'polyline' && el.points && el.points.length >= 2) {
        const hitThreshold = 8 / viewportStore.viewport.scale
        for (let j = 0; j < el.points.length - 1; j++) {
          const p1 = el.points[j]!
          const p2 = el.points[j + 1]!
          const dist = pointToSegmentDist(canvasX, canvasY, p1.x, p1.y, p2.x, p2.y)
          if (dist < hitThreshold) return el.id
        }
      } else {
        if (
          canvasX >= el.x && canvasX <= el.x + el.width &&
          canvasY >= el.y && canvasY <= el.y + el.height
        ) {
          return el.id
        }
      }
    }
    return null
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return

    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)
    const hitId = hitTestElement(canvas.x, canvas.y)

    if (hitId) {
      // Click on element
      if (!e.shiftKey && !diagramStore.selectedElementIds.has(hitId)) {
        diagramStore.selectElement(hitId, false)
      } else if (e.shiftKey) {
        diagramStore.selectElement(hitId, true)
      }

      // Start drag move (only if no locked/layer-locked elements in selection)
      const hitEl = diagramStore.diagram.elements.find(el => el.id === hitId)
      const hitLayer = hitEl ? diagramStore.diagram.layers.find(l => l.id === hitEl.layerId) : null
      const canDrag = hitEl && !hitEl.locked && !(hitLayer?.locked)

      if (canDrag) {
        isDragging.value = true
        dragStartCanvas.x = canvas.x
        dragStartCanvas.y = canvas.y
        dragElementIds.value = [...diagramStore.selectedElementIds].filter(id => {
          const el = diagramStore.diagram.elements.find(e => e.id === id)
          if (!el || el.locked) return false
          const layer = diagramStore.diagram.layers.find(l => l.id === el.layerId)
          return !layer?.locked
        })
        totalDx.value = 0
        totalDy.value = 0
      }
    } else {
      // Click on empty space → rubber band or deselect
      if (!e.shiftKey) {
        diagramStore.deselectAll()
      }
      rubberBand.active = true
      rubberBand.startX = canvas.x
      rubberBand.startY = canvas.y
      rubberBand.currentX = canvas.x
      rubberBand.currentY = canvas.y
    }
  }

  function onPointerMove(e: PointerEvent): void {
    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)

    if (isDragging.value && dragElementIds.value.length > 0) {
      const snap = diagramStore.diagram.snapToGrid
      const grid = diagramStore.diagram.gridSize

      let dx = canvas.x - dragStartCanvas.x
      let dy = canvas.y - dragStartCanvas.y

      if (snap) {
        dx = snapToGrid(dx, grid, true)
        dy = snapToGrid(dy, grid, true)
      }

      // Apply incremental movement
      const incrementDx = dx - totalDx.value
      const incrementDy = dy - totalDy.value
      if (incrementDx !== 0 || incrementDy !== 0) {
        diagramStore.moveElements(dragElementIds.value, incrementDx, incrementDy)
        totalDx.value = dx
        totalDy.value = dy
      }
    }

    if (rubberBand.active) {
      rubberBand.currentX = canvas.x
      rubberBand.currentY = canvas.y
    }
  }

  function onPointerUp(_e: PointerEvent): void {
    if (rubberBand.active) {
      // Select elements within rubber band
      const x1 = Math.min(rubberBand.startX, rubberBand.currentX)
      const y1 = Math.min(rubberBand.startY, rubberBand.currentY)
      const x2 = Math.max(rubberBand.startX, rubberBand.currentX)
      const y2 = Math.max(rubberBand.startY, rubberBand.currentY)

      if (Math.abs(x2 - x1) > 2 || Math.abs(y2 - y1) > 2) {
        diagramStore.diagram.elements.forEach(el => {
          if (!el.visible) return
          const layer = diagramStore.diagram.layers.find(l => l.id === el.layerId)
          if (layer && (!layer.visible || layer.locked)) return

          // Check bbox overlap
          if (el.x < x2 && el.x + el.width > x1 && el.y < y2 && el.y + el.height > y1) {
            diagramStore.selectElement(el.id, true)
          }
        })
      }

      rubberBand.active = false
    }

    // Notify move end for undo/redo
    if (isDragging.value && (totalDx.value !== 0 || totalDy.value !== 0)) {
      callbacks?.onMoveEnd?.(dragElementIds.value, totalDx.value, totalDy.value)
    }

    isDragging.value = false
    dragElementIds.value = []
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if ((e.key === 'Delete' || e.key === 'Backspace') && diagramStore.selectedElementIds.size > 0) {
      e.preventDefault()
      const ids = [...diagramStore.selectedElementIds]
      if (callbacks?.onDelete) {
        callbacks.onDelete(ids)
      } else {
        diagramStore.deleteElements(ids)
      }
    }

    if (e.key === 'd' && (e.ctrlKey || e.metaKey) && diagramStore.selectedElementIds.size > 0) {
      e.preventDefault()
      const newIds = diagramStore.duplicateElements([...diagramStore.selectedElementIds])
      diagramStore.selectedElementIds.clear()
      newIds.forEach(id => diagramStore.selectedElementIds.add(id))
    }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      diagramStore.selectAll()
    }

    if (e.key === 'Escape') {
      diagramStore.deselectAll()
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    rubberBand,
    isDragging,
  }
}

function pointToSegmentDist(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
