<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useViewportStore } from '@/stores/viewportStore'

const diagramStore = useDiagramStore()
const viewportStore = useViewportStore()

const emit = defineEmits<{
  resizeStart: [handle: string, e: PointerEvent]
  rotateStart: [e: PointerEvent]
  lineHandleStart: [handle: 'p1' | 'p2' | 'mid', e: PointerEvent]
  vertexDragStart: [index: number, e: PointerEvent]
  vertexInsert: [afterIndex: number, e: PointerEvent]
}>()

const ctrlPressed = ref(false)

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta') ctrlPressed.value = true
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta') ctrlPressed.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
})

function canvasToScreen(cx: number, cy: number) {
  const vp = viewportStore.viewport
  return { x: cx * vp.scale + vp.x, y: cy * vp.scale + vp.y }
}

const isLocked = computed(() =>
  diagramStore.selectedElements.some(el => {
    if (el.locked) return true
    const layer = diagramStore.diagram.layers.find(l => l.id === el.layerId)
    return layer?.locked ?? false
  })
)

const isSingleLine = computed(() => {
  const els = diagramStore.selectedElements
  return els.length === 1 && els[0]?.type === 'line'
})

const singleLineElement = computed(() => {
  if (!isSingleLine.value) return null
  return diagramStore.selectedElements[0]!
})

// Detect single polyline/curve/polygon
const isSinglePolyline = computed(() => {
  const els = diagramStore.selectedElements
  return els.length === 1 && (els[0]?.type === 'polyline' || els[0]?.type === 'polygon')
})

const singlePolylineElement = computed(() => {
  if (!isSinglePolyline.value) return null
  return diagramStore.selectedElements[0]!
})

// --- Standard bbox handles ---

// Single element rotation (for rotating the selection overlay)
const singleRotation = computed(() => {
  const els = diagramStore.selectedElements
  if (els.length === 1 && els[0]) return els[0].rotation
  return 0
})

const selectionBBox = computed(() => {
  const els = diagramStore.selectedElements
  if (els.length === 0) return null

  const minX = Math.min(...els.map(e => e.x))
  const minY = Math.min(...els.map(e => e.y))
  const maxX = Math.max(...els.map(e => e.x + e.width))
  const maxY = Math.max(...els.map(e => e.y + e.height))

  const screenMin = canvasToScreen(minX, minY)
  const screenMax = canvasToScreen(maxX, maxY)

  return {
    x: screenMin.x, y: screenMin.y,
    width: screenMax.x - screenMin.x,
    height: screenMax.y - screenMin.y,
  }
})

// Transform string to rotate the selection overlay around its center
const selectionTransform = computed(() => {
  const bb = selectionBBox.value
  if (!bb || singleRotation.value === 0) return undefined
  const cx = bb.x + bb.width / 2
  const cy = bb.y + bb.height / 2
  return `rotate(${singleRotation.value} ${cx} ${cy})`
})

const handleSize = 8
const cornerIds = new Set(['nw', 'ne', 'se', 'sw'])

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const rectHandles = computed(() => {
  const bb = selectionBBox.value
  if (!bb || isSingleLine.value) return []

  const hs = handleSize / 2
  return [
    { id: 'nw' as HandleId, x: bb.x - hs, y: bb.y - hs, cursor: 'nw-resize', isCorner: true },
    { id: 'n' as HandleId,  x: bb.x + bb.width / 2 - hs, y: bb.y - hs, cursor: 'n-resize', isCorner: false },
    { id: 'ne' as HandleId, x: bb.x + bb.width - hs, y: bb.y - hs, cursor: 'ne-resize', isCorner: true },
    { id: 'e' as HandleId,  x: bb.x + bb.width - hs, y: bb.y + bb.height / 2 - hs, cursor: 'e-resize', isCorner: false },
    { id: 'se' as HandleId, x: bb.x + bb.width - hs, y: bb.y + bb.height - hs, cursor: 'se-resize', isCorner: true },
    { id: 's' as HandleId,  x: bb.x + bb.width / 2 - hs, y: bb.y + bb.height - hs, cursor: 's-resize', isCorner: false },
    { id: 'sw' as HandleId, x: bb.x - hs, y: bb.y + bb.height - hs, cursor: 'sw-resize', isCorner: true },
    { id: 'w' as HandleId,  x: bb.x - hs, y: bb.y + bb.height / 2 - hs, cursor: 'w-resize', isCorner: false },
  ]
})

// --- Line handles ---

const lineHandles = computed(() => {
  const el = singleLineElement.value
  if (!el) return []

  const p1 = el.points?.[0] ?? { x: el.x, y: el.y }
  const p2 = el.points?.[1] ?? { x: el.x + el.width, y: el.y + el.height }
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }

  const s1 = canvasToScreen(p1.x, p1.y)
  const s2 = canvasToScreen(p2.x, p2.y)
  const sMid = canvasToScreen(mid.x, mid.y)

  return [
    { id: 'p1' as const, cx: s1.x, cy: s1.y, cursor: 'crosshair' },
    { id: 'p2' as const, cx: s2.x, cy: s2.y, cursor: 'crosshair' },
    { id: 'mid' as const, cx: sMid.x, cy: sMid.y, cursor: 'move' },
  ]
})

const lineOverlayCoords = computed(() => {
  const el = singleLineElement.value
  if (!el) return null
  const p1 = el.points?.[0] ?? { x: el.x, y: el.y }
  const p2 = el.points?.[1] ?? { x: el.x + el.width, y: el.y + el.height }
  const s1 = canvasToScreen(p1.x, p1.y)
  const s2 = canvasToScreen(p2.x, p2.y)
  return { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }
})

function handleCursor(h: { isCorner: boolean; cursor: string }) {
  if (ctrlPressed.value && h.isCorner) return 'grab'
  return h.cursor
}

function onRectHandleDown(handle: HandleId, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  // Ctrl + corner = rotate
  if ((e.ctrlKey || e.metaKey) && cornerIds.has(handle)) {
    emit('rotateStart', e)
  } else {
    emit('resizeStart', handle, e)
  }
}

function onLineHandleDown(handle: 'p1' | 'p2' | 'mid', e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  emit('lineHandleStart', handle, e)
}

// --- Polyline vertex handles ---

const polyVertexHandles = computed(() => {
  const el = singlePolylineElement.value
  if (!el || !el.points) return []
  return el.points.map((p, i) => {
    const s = canvasToScreen(p.x, p.y)
    return { index: i, cx: s.x, cy: s.y }
  })
})

const polyPathScreenD = computed(() => {
  const el = singlePolylineElement.value
  if (!el || !el.points || el.points.length < 2) return ''
  const screenPts = el.points.map(p => canvasToScreen(p.x, p.y))
  const path = screenPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return el.type === 'polygon' ? path + ' Z' : path
})

// Midpoint handles between consecutive vertices (for inserting new points)
const polyMidpointHandles = computed(() => {
  const el = singlePolylineElement.value
  if (!el || !el.points || el.points.length < 2) return []
  const pts = el.points
  const handles: Array<{ afterIndex: number; cx: number; cy: number }> = []

  const segmentCount = el.type === 'polygon' ? pts.length : pts.length - 1
  for (let i = 0; i < segmentCount; i++) {
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % pts.length]!
    const mid = canvasToScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
    handles.push({ afterIndex: i, cx: mid.x, cy: mid.y })
  }
  return handles
})

function onMidpointDown(afterIndex: number, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  emit('vertexInsert', afterIndex, e)
}

function onVertexDown(index: number, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  emit('vertexDragStart', index, e)
}

function onVertexRightClick(index: number, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  // Delete vertex (min 2 points for polyline, 3 for polygon)
  const el = singlePolylineElement.value
  if (!el || !el.points) return
  const minPoints = el.type === 'polygon' ? 3 : 2
  if (el.points.length <= minPoints) return
  const newPoints = el.points.filter((_, i) => i !== index)
  const xs = newPoints.map(p => p.x)
  const ys = newPoints.map(p => p.y)
  diagramStore.updateElement(el.id, {
    points: newPoints,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs) || 1,
    height: Math.max(...ys) - Math.min(...ys) || 1,
  })
}
</script>

<template>
  <!-- Single line selected -->
  <g v-if="isSingleLine && lineOverlayCoords" class="selection-overlay" pointer-events="none">
    <line
      :x1="lineOverlayCoords.x1" :y1="lineOverlayCoords.y1"
      :x2="lineOverlayCoords.x2" :y2="lineOverlayCoords.y2"
      :stroke="isLocked ? '#ff5555' : '#2196F3'"
      stroke-width="1"
      stroke-dasharray="5 3"
    />
    <circle
      v-for="h in lineHandles"
      v-show="!isLocked"
      :key="h.id"
      :cx="h.cx"
      :cy="h.cy"
      r="5"
      :fill="h.id === 'mid' ? '#2196F3' : 'white'"
      stroke="#2196F3"
      stroke-width="1.5"
      :style="{ cursor: h.cursor }"
      pointer-events="all"
      @pointerdown="onLineHandleDown(h.id, $event)"
    />
  </g>

  <!-- Single polyline/curve selected - vertex editing -->
  <g v-else-if="isSinglePolyline && polyVertexHandles.length > 0" class="selection-overlay" pointer-events="none">
    <!-- Path outline -->
    <path
      :d="polyPathScreenD"
      fill="none"
      :stroke="isLocked ? '#ff5555' : '#2196F3'"
      stroke-width="1"
      stroke-dasharray="5 3"
    />
    <!-- Midpoint handles (insert new vertex) -->
    <circle
      v-for="h in polyMidpointHandles"
      v-show="!isLocked"
      :key="'mid-' + h.afterIndex"
      :cx="h.cx"
      :cy="h.cy"
      r="4"
      fill="#2196F3"
      fill-opacity="0.3"
      stroke="#2196F3"
      stroke-width="1"
      stroke-dasharray="2 2"
      style="cursor: copy"
      pointer-events="all"
      @pointerdown="onMidpointDown(h.afterIndex, $event)"
    />
    <!-- Vertex handles -->
    <circle
      v-for="h in polyVertexHandles"
      v-show="!isLocked"
      :key="h.index"
      :cx="h.cx"
      :cy="h.cy"
      r="5"
      fill="white"
      stroke="#2196F3"
      stroke-width="1.5"
      style="cursor: crosshair"
      pointer-events="all"
      @pointerdown="onVertexDown(h.index, $event)"
      @contextmenu="onVertexRightClick(h.index, $event)"
    />
  </g>

  <!-- Non-line selection (bbox + handles) -->
  <g v-else-if="selectionBBox" class="selection-overlay" pointer-events="none" :transform="selectionTransform">
    <rect
      :x="selectionBBox.x"
      :y="selectionBBox.y"
      :width="selectionBBox.width"
      :height="selectionBBox.height"
      fill="none"
      :stroke="isLocked ? '#ff5555' : '#2196F3'"
      stroke-width="1"
      stroke-dasharray="5 3"
    />
    <!-- Rotation hint: show current rotation if non-zero -->
    <text
      v-if="diagramStore.selectedElements.length === 1 && diagramStore.selectedElements[0]!.rotation !== 0"
      :x="selectionBBox.x + selectionBBox.width / 2"
      :y="selectionBBox.y - 8"
      text-anchor="middle"
      fill="#2196F3"
      font-size="11"
      font-family="monospace"
      pointer-events="none"
    >
      {{ Math.round(diagramStore.selectedElements[0]!.rotation) }}°
    </text>
    <rect
      v-for="h in rectHandles"
      v-show="!isLocked"
      :key="h.id"
      :x="h.x"
      :y="h.y"
      :width="handleSize"
      :height="handleSize"
      :fill="ctrlPressed && h.isCorner ? '#2196F3' : 'white'"
      stroke="#2196F3"
      stroke-width="1"
      :rx="ctrlPressed && h.isCorner ? 4 : 0"
      :style="{ cursor: handleCursor(h) }"
      pointer-events="all"
      @pointerdown="onRectHandleDown(h.id, $event)"
    />
  </g>
</template>
