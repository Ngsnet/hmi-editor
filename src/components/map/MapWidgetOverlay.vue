<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useMapSync } from '@/composables/useMapSync'
import type L from 'leaflet'
import MapWidget from './MapWidget.vue'

const props = defineProps<{
  mapSync: ReturnType<typeof useMapSync>
  map: L.Map | null
}>()

const diagramStore = useDiagramStore()

const geoElements = computed(() =>
  diagramStore.diagram.elements.filter(el => el.geoPosition)
)

// --- Drag state ---
const isDragging = ref(false)
const dragElementId = ref('')
const dragStart = reactive({ x: 0, y: 0 })

// --- Resize state ---
const isResizing = ref(false)
const resizeElementId = ref('')
const resizeHandle = ref('')
const resizeStart = reactive({ x: 0, y: 0 })
const resizeOriginal = reactive({ width: 0, height: 0 })

// --- Selected element bounding box in screen coords ---
const selectedBBox = computed(() => {
  if (diagramStore.selectedElements.length !== 1) return null
  const el = diagramStore.selectedElements[0]!
  if (!el.geoPosition) return null
  const pos = props.mapSync.getPosition(el.id)
  if (!pos) return null
  return {
    x: pos.x - el.width / 2,
    y: pos.y - el.height / 2,
    width: el.width,
    height: el.height,
  }
})

const handleSize = 8

const resizeHandles = computed(() => {
  const bb = selectedBBox.value
  if (!bb) return []
  const hs = handleSize / 2
  return [
    { id: 'nw', x: bb.x - hs, y: bb.y - hs, cursor: 'nw-resize' },
    { id: 'ne', x: bb.x + bb.width - hs, y: bb.y - hs, cursor: 'ne-resize' },
    { id: 'se', x: bb.x + bb.width - hs, y: bb.y + bb.height - hs, cursor: 'se-resize' },
    { id: 'sw', x: bb.x - hs, y: bb.y + bb.height - hs, cursor: 'sw-resize' },
    { id: 'n', x: bb.x + bb.width / 2 - hs, y: bb.y - hs, cursor: 'n-resize' },
    { id: 'e', x: bb.x + bb.width - hs, y: bb.y + bb.height / 2 - hs, cursor: 'e-resize' },
    { id: 's', x: bb.x + bb.width / 2 - hs, y: bb.y + bb.height - hs, cursor: 's-resize' },
    { id: 'w', x: bb.x - hs, y: bb.y + bb.height / 2 - hs, cursor: 'w-resize' },
  ]
})

// --- Widget click / drag ---
function onWidgetPointerDown(elId: string, e: PointerEvent) {
  e.stopPropagation()
  diagramStore.selectElement(elId)

  isDragging.value = true
  dragElementId.value = elId
  dragStart.x = e.clientX
  dragStart.y = e.clientY

  // Disable map dragging while we drag widget
  props.map?.dragging.disable()
}

function onOverlayPointerMove(e: PointerEvent) {
  if (isDragging.value) {
    handleDragMove(e)
  } else if (isResizing.value) {
    handleResizeMove(e)
  }
}

function onOverlayPointerUp(_e: PointerEvent) {
  if (isDragging.value) {
    isDragging.value = false
    props.map?.dragging.enable()
    props.mapSync.recalculate()
  }
  if (isResizing.value) {
    isResizing.value = false
    props.map?.dragging.enable()
  }
}

function handleDragMove(e: PointerEvent) {
  if (!props.map) return
  const el = diagramStore.diagram.elements.find(el => el.id === dragElementId.value)
  if (!el || !el.geoPosition) return

  const pos = props.mapSync.getPosition(el.id)
  if (!pos) return

  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  dragStart.x = e.clientX
  dragStart.y = e.clientY

  // Convert new screen position to lat/lng
  const newScreenPos = { x: pos.x + dx, y: pos.y + dy }
  const newLatLng = props.map.containerPointToLatLng([newScreenPos.x, newScreenPos.y])

  el.geoPosition.lat = newLatLng.lat
  el.geoPosition.lng = newLatLng.lng

  props.mapSync.recalculate()
}

// --- Resize ---
function onResizePointerDown(handle: string, e: PointerEvent) {
  e.stopPropagation()
  const el = diagramStore.selectedElements[0]
  if (!el) return

  isResizing.value = true
  resizeElementId.value = el.id
  resizeHandle.value = handle
  resizeStart.x = e.clientX
  resizeStart.y = e.clientY
  resizeOriginal.width = el.width
  resizeOriginal.height = el.height

  props.map?.dragging.disable()
}

function handleResizeMove(e: PointerEvent) {
  const el = diagramStore.diagram.elements.find(el => el.id === resizeElementId.value)
  if (!el) return

  const dx = e.clientX - resizeStart.x
  const dy = e.clientY - resizeStart.y
  const h = resizeHandle.value

  let newW = resizeOriginal.width
  let newH = resizeOriginal.height

  if (h.includes('e')) newW = resizeOriginal.width + dx
  if (h.includes('w')) newW = resizeOriginal.width - dx
  if (h.includes('s')) newH = resizeOriginal.height + dy
  if (h.includes('n')) newH = resizeOriginal.height - dy

  el.width = Math.max(20, newW)
  el.height = Math.max(20, newH)
}

const isInteracting = computed(() => isDragging.value || isResizing.value)

// --- Click empty area to deselect ---
function onOverlayClick(e: MouseEvent) {
  // Only deselect if click was on the SVG itself, not on a widget
  if (e.target === e.currentTarget) {
    diagramStore.deselectAll()
  }
}
</script>

<template>
  <svg
    class="map-widget-overlay"
    :style="{ pointerEvents: isInteracting ? 'all' : 'none' }"
    @pointermove="onOverlayPointerMove"
    @pointerup="onOverlayPointerUp"
    @click="onOverlayClick"
  >
    <!-- Widgets -->
    <MapWidget
      v-for="el in geoElements"
      :key="el.id"
      :element="el"
      :position="props.mapSync.getPosition(el.id)"
      :selected="diagramStore.selectedElementIds.has(el.id)"
      @click="diagramStore.selectElement(el.id)"
      @dragstart="onWidgetPointerDown(el.id, $event)"
    />

    <!-- Selection box + resize handles -->
    <g v-if="selectedBBox" pointer-events="none">
      <rect
        :x="selectedBBox.x"
        :y="selectedBBox.y"
        :width="selectedBBox.width"
        :height="selectedBBox.height"
        fill="none"
        stroke="#2196F3"
        stroke-width="1.5"
        stroke-dasharray="5 3"
      />
      <rect
        v-for="rh in resizeHandles"
        :key="rh.id"
        :x="rh.x"
        :y="rh.y"
        :width="handleSize"
        :height="handleSize"
        fill="white"
        stroke="#2196F3"
        stroke-width="1"
        :style="{ cursor: rh.cursor }"
        pointer-events="all"
        @pointerdown="onResizePointerDown(rh.id, $event)"
      />
    </g>
  </svg>
</template>

<style scoped>
.map-widget-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 500;
}
</style>
