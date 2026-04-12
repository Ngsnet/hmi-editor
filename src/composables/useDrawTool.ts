import { ref, reactive, computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useToolStore, type ToolType } from '@/stores/toolStore'
import { snapToGrid } from '@/utils/coordUtils'
import type { CanvasElement } from '@/types/diagram'

export interface DrawingState {
  active: boolean
  type: CanvasElement['type'] | null
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function useDrawTool(
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number },
  getSvgOffset: (e: PointerEvent) => { x: number; y: number },
  onElementCreated?: (data: Omit<CanvasElement, 'id'>) => void,
) {
  const diagramStore = useDiagramStore()
  const toolStore = useToolStore()

  const drawing = reactive<DrawingState>({
    active: false,
    type: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })

  const previewElement = computed<Partial<CanvasElement> | null>(() => {
    if (!drawing.active || !drawing.type) return null

    const snap = diagramStore.diagram.snapToGrid
    const grid = diagramStore.diagram.gridSize

    let sx = snapToGrid(drawing.startX, grid, snap)
    let sy = snapToGrid(drawing.startY, grid, snap)
    let cx = snapToGrid(drawing.currentX, grid, snap)
    let cy = snapToGrid(drawing.currentY, grid, snap)

    if (drawing.type === 'line') {
      return {
        type: 'line',
        x: Math.min(sx, cx),
        y: Math.min(sy, cy),
        width: Math.abs(cx - sx),
        height: Math.abs(cy - sy),
        points: [{ x: sx, y: sy }, { x: cx, y: cy }],
        style: {
          fill: 'none',
          stroke: toolStore.toolOptions.strokeColor,
          strokeWidth: toolStore.toolOptions.strokeWidth,
          opacity: 0.6,
        },
      }
    }

    // Rect / Ellipse
    const x = Math.min(sx, cx)
    const y = Math.min(sy, cy)
    let width = Math.abs(cx - sx)
    let height = Math.abs(cy - sy)

    return {
      type: drawing.type,
      x, y, width, height,
      style: {
        fill: toolStore.toolOptions.fillColor,
        stroke: toolStore.toolOptions.strokeColor,
        strokeWidth: toolStore.toolOptions.strokeWidth,
        opacity: 0.6,
      },
    }
  })

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return

    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)

    drawing.active = true
    drawing.type = toolStore.activeTool as CanvasElement['type']
    drawing.startX = canvas.x
    drawing.startY = canvas.y
    drawing.currentX = canvas.x
    drawing.currentY = canvas.y
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drawing.active) return

    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)

    let cx = canvas.x
    let cy = canvas.y

    // Shift constraint
    if (e.shiftKey) {
      const dx = cx - drawing.startX
      const dy = cy - drawing.startY

      if (drawing.type === 'line') {
        // Snap to 0°/45°/90°
        const angle = Math.atan2(dy, dx)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
        const dist = Math.hypot(dx, dy)
        cx = drawing.startX + dist * Math.cos(snapAngle)
        cy = drawing.startY + dist * Math.sin(snapAngle)
      } else {
        // Square / circle constraint
        const size = Math.max(Math.abs(dx), Math.abs(dy))
        cx = drawing.startX + size * Math.sign(dx || 1)
        cy = drawing.startY + size * Math.sign(dy || 1)
      }
    }

    drawing.currentX = cx
    drawing.currentY = cy
  }

  function onPointerUp(_e: PointerEvent): void {
    if (!drawing.active || !drawing.type) return

    const snap = diagramStore.diagram.snapToGrid
    const grid = diagramStore.diagram.gridSize

    let sx = snapToGrid(drawing.startX, grid, snap)
    let sy = snapToGrid(drawing.startY, grid, snap)
    let cx = snapToGrid(drawing.currentX, grid, snap)
    let cy = snapToGrid(drawing.currentY, grid, snap)

    const width = Math.abs(cx - sx)
    const height = Math.abs(cy - sy)

    // Minimum size check
    if (width < 3 && height < 3 && drawing.type !== 'line') {
      drawing.active = false
      drawing.type = null
      return
    }

    const layerId = diagramStore.activeLayerId
    const style = {
      fill: drawing.type === 'line' ? 'none' : toolStore.toolOptions.fillColor,
      stroke: toolStore.toolOptions.strokeColor,
      strokeWidth: toolStore.toolOptions.strokeWidth,
      opacity: toolStore.toolOptions.opacity,
    }

    const elementData: Omit<CanvasElement, 'id'> = drawing.type === 'line'
      ? {
          type: 'line', x: Math.min(sx, cx), y: Math.min(sy, cy),
          width, height, rotation: 0, layerId, locked: false, visible: true,
          points: [{ x: sx, y: sy }, { x: cx, y: cy }], style,
        }
      : {
          type: drawing.type, x: Math.min(sx, cx), y: Math.min(sy, cy),
          width, height, rotation: 0, layerId, locked: false, visible: true, style,
        }

    if (onElementCreated) {
      onElementCreated(elementData)
    } else {
      diagramStore.addElement(elementData)
    }

    drawing.active = false
    drawing.type = null
  }

  function cancel(): void {
    drawing.active = false
    drawing.type = null
  }

  return {
    drawing,
    previewElement,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancel,
  }
}
