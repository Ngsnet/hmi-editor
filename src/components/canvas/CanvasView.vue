<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import { useDiagramStore } from '@/stores/diagramStore'
import { useToolStore } from '@/stores/toolStore'
import { useHistoryStore } from '@/stores/historyStore'
import { AddElementCommand, DeleteElementsCommand, MoveElementsCommand, ResizeElementsCommand } from '@/commands/elementCommands'
import { useViewport } from '@/composables/useViewport'
import { useSelectTool } from '@/composables/useSelectTool'
import { useDrawTool } from '@/composables/useDrawTool'
import { usePolylineTool } from '@/composables/usePolylineTool'
import GridLayer from './GridLayer.vue'
import CanvasLayer from './CanvasLayer.vue'
import DrawingPreview from './DrawingPreview.vue'
import SelectionOverlay from './SelectionOverlay.vue'

const svgRef = ref<SVGSVGElement | null>(null)
const viewportStore = useViewportStore()
const diagramStore = useDiagramStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()

const {
  onWheel,
  onPointerDown: onViewportPointerDown,
  onPointerMove: onViewportPointerMove,
  onPointerUp: onViewportPointerUp,
  screenToCanvas,
  spacePressed,
} = useViewport(svgRef)

function getSvgOffset(e: PointerEvent | MouseEvent): { x: number; y: number } {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const selectTool = useSelectTool(screenToCanvas, getSvgOffset, {
  onMoveEnd(ids, dx, dy) {
    // Move already happened visually; record reverse for undo, then re-apply for redo
    historyStore.undoStack.push({
      execute() { diagramStore.moveElements(ids, dx, dy) },
      undo() { diagramStore.moveElements(ids, -dx, -dy) },
      description: 'Přesunout elementy',
    })
    historyStore.redoStack = []
  },
  onDelete(ids) {
    const cmd = new DeleteElementsCommand(ids)
    historyStore.execute(cmd)
  },
})

const drawTool = useDrawTool(screenToCanvas, getSvgOffset, (data) => {
  const cmd = new AddElementCommand(data)
  historyStore.execute(cmd)
})

const polylineTool = usePolylineTool(screenToCanvas, getSvgOffset, (data) => {
  const cmd = new AddElementCommand(data)
  historyStore.execute(cmd)
})

const isPolylineTool = computed(() =>
  toolStore.activeTool === 'polyline' || toolStore.activeTool === 'curve'
)

const cursorCanvas = reactive({ x: 0, y: 0 })

function onMouseMove(e: MouseEvent) {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return
  const pos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
  cursorCanvas.x = Math.round(pos.x)
  cursorCanvas.y = Math.round(pos.y)
}

// --- Inline text editing ---

const editingElementId = ref<string | null>(null)
const editingText = ref('')
const editingPos = reactive({ x: 0, y: 0, width: 0, height: 0, fontSize: 14 })

function canvasToScreenPos(cx: number, cy: number) {
  const vp = viewportStore.viewport
  return { x: cx * vp.scale + vp.x, y: cy * vp.scale + vp.y }
}

function startTextEdit(el: { id: string; x: number; y: number; width: number; height: number; label?: string; style: { fontSize?: number } }) {
  editingElementId.value = el.id
  editingText.value = el.label ?? ''
  const topLeft = canvasToScreenPos(el.x, el.y)
  const bottomRight = canvasToScreenPos(el.x + el.width, el.y + el.height)
  editingPos.x = topLeft.x
  editingPos.y = topLeft.y
  editingPos.width = bottomRight.x - topLeft.x
  editingPos.height = bottomRight.y - topLeft.y
  editingPos.fontSize = (el.style.fontSize ?? 14) * viewportStore.viewport.scale
}

function finishTextEdit() {
  if (editingElementId.value) {
    diagramStore.updateElement(editingElementId.value, { label: editingText.value })
    editingElementId.value = null
  }
}

function cancelTextEdit() {
  editingElementId.value = null
}

function onCanvasDblClick(e: MouseEvent) {
  if (isPolylineTool.value) {
    polylineTool.onDoubleClick(e)
    return
  }

  // Check if double-clicked on a text element
  if (toolStore.activeTool === 'select' && diagramStore.selectedElements.length === 1) {
    const el = diagramStore.selectedElements[0]!
    if (el.type === 'text' || el.type === 'textValue') {
      startTextEdit(el)
    }
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  // Right-click cancels drawing / switches to select (same as Escape)
  if (polylineTool.isDrawing.value) {
    polylineTool.cancel()
  }
  if (drawTool.drawing.active) {
    drawTool.cancel()
  }
  if (toolStore.activeTool !== 'select') {
    toolStore.setTool('select')
  }
}

// --- Event routing ---

function onCanvasPointerDown(e: PointerEvent) {
  // Viewport pan (middle button or space+drag)
  onViewportPointerDown(e)
  if (e.button === 1 || (e.button === 0 && spacePressed.value)) return

  if (toolStore.activeTool === 'select') {
    selectTool.onPointerDown(e)
  } else if (isPolylineTool.value) {
    polylineTool.onClick(e)
  } else {
    drawTool.onPointerDown(e)
  }
}

function onCanvasPointerMove(e: PointerEvent) {
  onViewportPointerMove(e)

  if (isVertexDrag.value) {
    handleVertexDragMove(e)
    return
  }

  if (isRotating.value) {
    handleRotateMove(e)
    return
  }

  if (isLineHandleDrag.value) {
    handleLineHandleMove(e)
    return
  }

  if (isResizing.value) {
    handleResizeMove(e)
    return
  }

  if (toolStore.activeTool === 'select') {
    selectTool.onPointerMove(e)
  } else if (isPolylineTool.value) {
    polylineTool.onMouseMove(e)
  } else {
    drawTool.onPointerMove(e)
  }
}

function onCanvasPointerUp(e: PointerEvent) {
  onViewportPointerUp(e)

  if (isVertexDrag.value) {
    handleVertexDragUp()
    return
  }

  if (isRotating.value) {
    handleRotateUp()
    return
  }

  if (isLineHandleDrag.value) {
    handleLineHandleUp()
    return
  }

  if (isResizing.value) {
    handleResizeUp()
    return
  }

  if (toolStore.activeTool === 'select') {
    selectTool.onPointerUp(e)
  } else if (!isPolylineTool.value) {
    drawTool.onPointerUp(e)
  }
  // polyline tool uses click, not pointer up
}

// --- Keyboard shortcuts for tool switching ---

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    historyStore.undo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    historyStore.redo()
    return
  }

  // Tool shortcuts (only without modifiers)
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case 'v': toolStore.setTool('select'); return
      case 'r': toolStore.setTool('rect'); return
      case 'e': toolStore.setTool('ellipse'); return
      case 'l': toolStore.setTool('line'); return
      case 'p': toolStore.setTool('polyline'); return
      case 'c': toolStore.setTool('curve'); return
    }
  }

  // Polyline tool keyboard handling (Escape, Enter, Backspace)
  if (isPolylineTool.value && polylineTool.isDrawing.value) {
    polylineTool.onKeyDown(e)
    if (e.key === 'Escape') return
  }

  if (e.key === 'Escape') {
    if (drawTool.drawing.active) {
      drawTool.cancel()
    }
    if (polylineTool.isDrawing.value) {
      polylineTool.cancel()
    }
    if (toolStore.activeTool !== 'select') {
      toolStore.setTool('select')
      return
    }
  }

  // Select tool keyboard shortcuts
  selectTool.onKeyDown(e)
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

// --- Rubber band in canvas coords for rendering ---

const rubberBandScreen = computed(() => {
  const rb = selectTool.rubberBand
  if (!rb.active) return null
  const p1 = { x: rb.startX, y: rb.startY }
  const p2 = { x: rb.currentX, y: rb.currentY }
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  }
})

// --- Canvas cursor ---

const canvasCursor = computed(() => {
  if (spacePressed.value) return 'grab'
  if (toolStore.activeTool === 'select') return 'default'
  return 'crosshair'
})

// --- Resize logic ---

const isResizing = ref(false)
const resizeHandle = ref('')
const resizeStartCanvas = reactive({ x: 0, y: 0 })
const resizeOriginals = ref<Array<{ id: string; x: number; y: number; width: number; height: number }>>([])

function isSelectionLocked(): boolean {
  return diagramStore.selectedElements.some(el => {
    if (el.locked) return true
    const layer = diagramStore.diagram.layers.find(l => l.id === el.layerId)
    return layer?.locked ?? false
  })
}

function onResizeStart(handle: string, e: PointerEvent) {
  if (isSelectionLocked()) return
  isResizing.value = true
  resizeHandle.value = handle

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  resizeStartCanvas.x = canvas.x
  resizeStartCanvas.y = canvas.y

  resizeOriginals.value = diagramStore.selectedElements.map(el => ({
    id: el.id, x: el.x, y: el.y, width: el.width, height: el.height,
  }))
}

function handleResizeMove(e: PointerEvent) {
  if (!isResizing.value) return

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  const dx = canvas.x - resizeStartCanvas.x
  const dy = canvas.y - resizeStartCanvas.y
  const h = resizeHandle.value

  for (const orig of resizeOriginals.value) {
    let newX = orig.x
    let newY = orig.y
    let newW = orig.width
    let newH = orig.height

    // Horizontal
    if (h.includes('w')) {
      newX = orig.x + dx
      newW = orig.width - dx
    } else if (h.includes('e')) {
      newW = orig.width + dx
    }

    // Vertical
    if (h.includes('n')) {
      newY = orig.y + dy
      newH = orig.height - dy
    } else if (h.includes('s')) {
      newH = orig.height + dy
    }

    // Minimum size
    if (newW < 5) { newW = 5; if (h.includes('w')) newX = orig.x + orig.width - 5 }
    if (newH < 5) { newH = 5; if (h.includes('n')) newY = orig.y + orig.height - 5 }

    diagramStore.updateElement(orig.id, { x: newX, y: newY, width: newW, height: newH })
  }
}

function handleResizeUp() {
  if (resizeOriginals.value.length > 0) {
    const originals = [...resizeOriginals.value]
    const finals = originals.map(o => {
      const el = diagramStore.diagram.elements.find(e => e.id === o.id)
      return el
        ? { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }
        : { ...o }
    })
    // Resize already happened visually; push to undo stack directly
    historyStore.undoStack.push(new ResizeElementsCommand(originals, finals))
    historyStore.redoStack = []
  }
  isResizing.value = false
  resizeOriginals.value = []
}

// --- Rotation logic ---

const isRotating = ref(false)
const rotateStartAngle = ref(0)
const rotateOriginalRotations = ref<Array<{ id: string; rotation: number }>>([])

function onRotateStart(e: PointerEvent) {
  if (isSelectionLocked()) return
  const els = diagramStore.selectedElements
  if (els.length === 0) return

  isRotating.value = true
  rotateOriginalRotations.value = els.map(el => ({ id: el.id, rotation: el.rotation }))

  // Calculate angle from selection center to mouse
  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  const bbox = getSelectionCenter()
  rotateStartAngle.value = Math.atan2(canvas.y - bbox.cy, canvas.x - bbox.cx) * 180 / Math.PI
}

function handleRotateMove(e: PointerEvent) {
  if (!isRotating.value) return

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  const bbox = getSelectionCenter()
  const currentAngle = Math.atan2(canvas.y - bbox.cy, canvas.x - bbox.cx) * 180 / Math.PI
  let deltaAngle = currentAngle - rotateStartAngle.value

  // Shift = snap to 15° increments
  if (e.shiftKey) {
    deltaAngle = Math.round(deltaAngle / 15) * 15
  }

  for (const orig of rotateOriginalRotations.value) {
    let newRotation = (orig.rotation + deltaAngle) % 360
    if (newRotation < 0) newRotation += 360
    diagramStore.updateElement(orig.id, { rotation: newRotation })
  }
}

function handleRotateUp() {
  if (isRotating.value) {
    // Record for undo
    const originals = rotateOriginalRotations.value.map(o => ({ ...o }))
    const finals = originals.map(o => {
      const el = diagramStore.diagram.elements.find(e => e.id === o.id)
      return { id: o.id, rotation: el?.rotation ?? o.rotation }
    })
    historyStore.undoStack.push({
      execute() {
        const store = useDiagramStore()
        for (const f of finals) store.updateElement(f.id, { rotation: f.rotation })
      },
      undo() {
        const store = useDiagramStore()
        for (const o of originals) store.updateElement(o.id, { rotation: o.rotation })
      },
      description: 'Rotace',
    })
    historyStore.redoStack = []
  }
  isRotating.value = false
  rotateOriginalRotations.value = []
}

function getSelectionCenter() {
  const els = diagramStore.selectedElements
  const minX = Math.min(...els.map(e => e.x))
  const minY = Math.min(...els.map(e => e.y))
  const maxX = Math.max(...els.map(e => e.x + e.width))
  const maxY = Math.max(...els.map(e => e.y + e.height))
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// --- Line handle drag logic ---

const isLineHandleDrag = ref(false)
const lineHandleType = ref<'p1' | 'p2' | 'mid'>('p1')
const lineHandleStartCanvas = reactive({ x: 0, y: 0 })
const lineOriginalPoints = ref<Array<{ x: number; y: number }>>([])
const lineOriginalPos = reactive({ x: 0, y: 0 })
const lineElementId = ref('')

function onLineHandleStart(handle: 'p1' | 'p2' | 'mid', e: PointerEvent) {
  if (isSelectionLocked()) return
  const el = diagramStore.selectedElements[0]
  if (!el || el.type !== 'line') return

  isLineHandleDrag.value = true
  lineHandleType.value = handle
  lineElementId.value = el.id
  lineOriginalPoints.value = (el.points ?? []).map(p => ({ ...p }))
  lineOriginalPos.x = el.x
  lineOriginalPos.y = el.y

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  lineHandleStartCanvas.x = canvas.x
  lineHandleStartCanvas.y = canvas.y
}

function handleLineHandleMove(e: PointerEvent) {
  if (!isLineHandleDrag.value) return

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  const dx = canvas.x - lineHandleStartCanvas.x
  const dy = canvas.y - lineHandleStartCanvas.y

  const el = diagramStore.diagram.elements.find(e => e.id === lineElementId.value)
  if (!el || !el.points || el.points.length < 2) return

  if (lineHandleType.value === 'mid') {
    // Move entire line
    el.points[0]!.x = lineOriginalPoints.value[0]!.x + dx
    el.points[0]!.y = lineOriginalPoints.value[0]!.y + dy
    el.points[1]!.x = lineOriginalPoints.value[1]!.x + dx
    el.points[1]!.y = lineOriginalPoints.value[1]!.y + dy
    el.x = Math.min(el.points[0]!.x, el.points[1]!.x)
    el.y = Math.min(el.points[0]!.y, el.points[1]!.y)
    el.width = Math.abs(el.points[1]!.x - el.points[0]!.x)
    el.height = Math.abs(el.points[1]!.y - el.points[0]!.y)
  } else {
    // Move single endpoint
    const idx = lineHandleType.value === 'p1' ? 0 : 1
    el.points[idx]!.x = lineOriginalPoints.value[idx]!.x + dx
    el.points[idx]!.y = lineOriginalPoints.value[idx]!.y + dy
    el.x = Math.min(el.points[0]!.x, el.points[1]!.x)
    el.y = Math.min(el.points[0]!.y, el.points[1]!.y)
    el.width = Math.abs(el.points[1]!.x - el.points[0]!.x)
    el.height = Math.abs(el.points[1]!.y - el.points[0]!.y)
  }
}

function handleLineHandleUp() {
  isLineHandleDrag.value = false
}

// --- Vertex drag logic (polyline/curve) ---

const isVertexDrag = ref(false)
const vertexIndex = ref(0)
const vertexElementId = ref('')
const vertexStartCanvas = reactive({ x: 0, y: 0 })
const vertexOriginalPoint = reactive({ x: 0, y: 0 })

function onVertexDragStart(index: number, e: PointerEvent) {
  if (isSelectionLocked()) return
  const el = diagramStore.selectedElements[0]
  if (!el || el.type !== 'polyline' || !el.points) return

  const pt = el.points[index]
  if (!pt) return

  isVertexDrag.value = true
  vertexIndex.value = index
  vertexElementId.value = el.id
  vertexOriginalPoint.x = pt.x
  vertexOriginalPoint.y = pt.y

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  vertexStartCanvas.x = canvas.x
  vertexStartCanvas.y = canvas.y
}

function handleVertexDragMove(e: PointerEvent) {
  if (!isVertexDrag.value) return

  const offset = getSvgOffset(e)
  const canvas = screenToCanvas(offset.x, offset.y)
  const snap = diagramStore.diagram.snapToGrid
  const grid = diagramStore.diagram.gridSize

  let newX = vertexOriginalPoint.x + (canvas.x - vertexStartCanvas.x)
  let newY = vertexOriginalPoint.y + (canvas.y - vertexStartCanvas.y)

  if (snap) {
    newX = Math.round(newX / grid) * grid
    newY = Math.round(newY / grid) * grid
  }

  const el = diagramStore.diagram.elements.find(e => e.id === vertexElementId.value)
  if (!el || !el.points) return

  const pt = el.points[vertexIndex.value]
  if (!pt) return

  pt.x = newX
  pt.y = newY

  // Update bounding box
  const xs = el.points.map(p => p.x)
  const ys = el.points.map(p => p.y)
  el.x = Math.min(...xs)
  el.y = Math.min(...ys)
  el.width = Math.max(...xs) - el.x || 1
  el.height = Math.max(...ys) - el.y || 1
}

function handleVertexDragUp() {
  isVertexDrag.value = false
}

const gridSize = computed(() => diagramStore.diagram.gridSize)
const gridVisible = computed(() => diagramStore.diagram.gridVisible)
const backgroundColor = computed(() => diagramStore.diagram.backgroundColor)

// Add demo elements if diagram is empty
onMounted(() => {
  if (diagramStore.diagram.elements.length === 0) {
    const layerId = diagramStore.diagram.layers[0]?.id ?? ''
    const defaultStyle = { fill: '#ffffff', stroke: '#333333', strokeWidth: 2, opacity: 1 }

    diagramStore.addElement({
      type: 'rect', x: 100, y: 100, width: 200, height: 120,
      rotation: 0, layerId, locked: false, visible: true,
      style: { ...defaultStyle, fill: '#4a90d9' },
    })
    diagramStore.addElement({
      type: 'ellipse', x: 400, y: 80, width: 160, height: 160,
      rotation: 0, layerId, locked: false, visible: true,
      style: { ...defaultStyle, fill: '#e8744f' },
    })
    diagramStore.addElement({
      type: 'rect', x: 200, y: 300, width: 300, height: 80,
      rotation: 0, layerId, locked: false, visible: true,
      style: { ...defaultStyle, fill: '#5cb85c' },
    })
    diagramStore.addElement({
      type: 'line', x: 100, y: 450, width: 400, height: 0,
      rotation: 0, layerId, locked: false, visible: true,
      points: [{ x: 100, y: 450 }, { x: 500, y: 300 }],
      style: { ...defaultStyle, fill: 'none', strokeWidth: 3 },
    })
  }
})
</script>

<template>
  <div class="canvas-wrapper">
  <svg
    ref="svgRef"
    class="canvas-view"
    :style="{ cursor: canvasCursor }"
    @wheel.prevent="onWheel"
    @pointerdown="onCanvasPointerDown"
    @pointermove="onCanvasPointerMove"
    @pointerup="onCanvasPointerUp"
    @mousemove="onMouseMove"
    @dblclick="onCanvasDblClick"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- Everything inside this <g> zooms together -->
    <g :transform="viewportStore.transformString">
      <!-- Background fill -->
      <rect
        :x="-50000" :y="-50000"
        width="100000" height="100000"
        :fill="backgroundColor"
      />

      <!-- Layers rendered in order -->
      <CanvasLayer
        v-for="layer in diagramStore.sortedLayers"
        :key="layer.id"
        :layer="layer"
      />

      <!-- Drawing preview (ghost shape) -->
      <DrawingPreview
        :preview="drawTool.previewElement.value"
        :polyline-preview="polylineTool.previewPath.value"
      />

      <!-- Rubber band selection -->
      <rect
        v-if="rubberBandScreen"
        :x="rubberBandScreen.x"
        :y="rubberBandScreen.y"
        :width="rubberBandScreen.width"
        :height="rubberBandScreen.height"
        fill="rgba(33, 150, 243, 0.1)"
        stroke="#2196F3"
        :stroke-width="1 / viewportStore.viewport.scale"
        stroke-dasharray="4 2"
        pointer-events="none"
      />
    </g>

    <!-- Grid rendered outside transform -->
    <GridLayer v-if="gridVisible" :grid-size="gridSize" />

    <!-- Selection overlay (outside transform, pixel-perfect) -->
    <SelectionOverlay
      @resize-start="onResizeStart"
      @rotate-start="onRotateStart"
      @line-handle-start="onLineHandleStart"
      @vertex-drag-start="onVertexDragStart"
    />

  </svg>

  <!-- Inline text editor overlay -->
  <div
    v-if="editingElementId"
    class="text-edit-overlay"
    :style="{
      left: editingPos.x + 'px',
      top: editingPos.y + 'px',
      width: editingPos.width + 'px',
      height: editingPos.height + 'px',
    }"
  >
    <input
      v-model="editingText"
      class="text-edit-input"
      :style="{ fontSize: editingPos.fontSize + 'px' }"
      @keydown.enter="finishTextEdit"
      @keydown.escape="cancelTextEdit"
      @blur="finishTextEdit"
      autofocus
    />
  </div>

  <!-- Status bar -->
  <div class="status-bar">
    <span>X: {{ cursorCanvas.x }}  Y: {{ cursorCanvas.y }}</span>
    <span>{{ toolStore.activeTool.toUpperCase() }}</span>
    <span>Zoom: {{ Math.round(viewportStore.viewport.scale * 100) }}%</span>
  </div>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.canvas-view {
  flex: 1;
  display: block;
  background: #e8e8e8;
  outline: none;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 4px 12px;
  background: #2d2d2d;
  color: #ccc;
  font-family: monospace;
  font-size: 12px;
  user-select: none;
}

.text-edit-overlay {
  position: absolute;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.text-edit-input {
  width: 100%;
  height: 100%;
  border: 2px solid #2196F3;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  text-align: center;
  outline: none;
  padding: 0 4px;
  font-family: sans-serif;
}
</style>
