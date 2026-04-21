import { ref, computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useToolStore } from '@/stores/toolStore'
import { snapToGrid } from '@/utils/coordUtils'

export function usePolylineTool(
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number },
  getSvgOffset: (e: PointerEvent | MouseEvent) => { x: number; y: number },
  onElementCreated?: (data: any) => void,
) {
  const diagramStore = useDiagramStore()
  const toolStore = useToolStore()

  const isDrawing = ref(false)
  const points = ref<Array<{ x: number; y: number }>>([])
  const currentPoint = ref({ x: 0, y: 0 })

  const isPolygonTool = computed(() => toolStore.activeTool === 'polygon')

  const previewPath = computed(() => {
    if (!isDrawing.value || points.value.length === 0) return null

    const snap = diagramStore.diagram.snapToGrid
    const grid = diagramStore.diagram.gridSize
    const smooth = toolStore.activeTool === 'curve'

    const allPoints = [
      ...points.value.map(p => ({
        x: snapToGrid(p.x, grid, snap),
        y: snapToGrid(p.y, grid, snap),
      })),
      {
        x: snapToGrid(currentPoint.value.x, grid, snap),
        y: snapToGrid(currentPoint.value.y, grid, snap),
      },
    ]

    return {
      points: allPoints,
      smooth,
      closed: isPolygonTool.value,
      style: {
        fill: isPolygonTool.value ? toolStore.toolOptions.fillColor : 'none',
        stroke: toolStore.toolOptions.strokeColor,
        strokeWidth: toolStore.toolOptions.strokeWidth,
        opacity: 0.6,
      },
    }
  })

  function onClick(e: PointerEvent): void {
    if (e.button !== 0) return

    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)
    const snap = diagramStore.diagram.snapToGrid
    const grid = diagramStore.diagram.gridSize

    const pt = {
      x: snapToGrid(canvas.x, grid, snap),
      y: snapToGrid(canvas.y, grid, snap),
    }

    if (!isDrawing.value) {
      // First click - start drawing
      isDrawing.value = true
      points.value = [pt]
      currentPoint.value = { ...pt }
    } else {
      // Add point
      points.value.push(pt)
    }
  }

  function onDoubleClick(e: MouseEvent): void {
    // Finish drawing
    if (!isDrawing.value || points.value.length < 2) return
    finalize()
  }

  function onMouseMove(e: PointerEvent): void {
    if (!isDrawing.value) return
    const offset = getSvgOffset(e)
    const canvas = screenToCanvas(offset.x, offset.y)
    currentPoint.value = { x: canvas.x, y: canvas.y }
  }

  function finalize() {
    const minPoints = isPolygonTool.value ? 3 : 2
    if (points.value.length < minPoints) {
      cancel()
      return
    }

    const snap = diagramStore.diagram.snapToGrid
    const grid = diagramStore.diagram.gridSize
    const smooth = toolStore.activeTool === 'curve'
    const isPolygon = isPolygonTool.value

    const finalPoints = points.value.map(p => ({
      x: snapToGrid(p.x, grid, snap),
      y: snapToGrid(p.y, grid, snap),
    }))

    const xs = finalPoints.map(p => p.x)
    const ys = finalPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)

    const elementData = {
      type: (isPolygon ? 'polygon' : 'polyline') as 'polygon' | 'polyline',
      x: minX,
      y: minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
      rotation: 0,
      layerId: diagramStore.activeLayerId,
      locked: false,
      visible: true,
      smooth,
      points: finalPoints,
      style: {
        fill: isPolygon ? toolStore.toolOptions.fillColor : 'none',
        stroke: toolStore.toolOptions.strokeColor,
        strokeWidth: toolStore.toolOptions.strokeWidth,
        strokeDash: toolStore.toolOptions.strokeDash,
        opacity: toolStore.toolOptions.opacity,
      },
    }

    if (onElementCreated) {
      onElementCreated(elementData)
    } else {
      diagramStore.addElement(elementData)
    }

    isDrawing.value = false
    points.value = []
  }

  function cancel() {
    isDrawing.value = false
    points.value = []
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isDrawing.value) return

    if (e.key === 'Escape') {
      cancel()
      e.preventDefault()
    }
    if (e.key === 'Enter') {
      finalize()
      e.preventDefault()
    }
    // Backspace removes last point
    if (e.key === 'Backspace' && points.value.length > 1) {
      points.value.pop()
      e.preventDefault()
    }
  }

  return {
    isDrawing,
    points,
    currentPoint,
    previewPath,
    onClick,
    onDoubleClick,
    onMouseMove,
    onKeyDown,
    cancel,
    finalize,
  }
}
