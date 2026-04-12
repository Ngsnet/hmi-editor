<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import L from 'leaflet'
import { useDiagramStore } from '@/stores/diagramStore'
import { useViewportStore } from '@/stores/viewportStore'

const props = defineProps<{
  svgEl: SVGSVGElement | null
}>()

const diagramStore = useDiagramStore()
const viewportStore = useViewportStore()

const mapContainerEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null
let isSyncing = false

const settings = computed(() => diagramStore.diagram.mapSettings)
const opacity = computed(() => settings.value?.backgroundOpacity ?? 0.5)

const METERS_PER_DEG_LAT = 111320

function getTileInfo(provider: string) {
  switch (provider) {
    case 'google-streets':
      return { url: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', attribution: '', maxNativeZoom: 21 }
    case 'google-satellite':
      return { url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attribution: '', maxNativeZoom: 21 }
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxNativeZoom: 19,
      }
  }
}

function updateTileLayer() {
  if (!map) return
  const provider = settings.value?.tileProvider ?? 'osm'
  const info = getTileInfo(provider)
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(info.url, {
    attribution: info.attribution,
    maxNativeZoom: info.maxNativeZoom,
    maxZoom: 22,
  }).addTo(map)
}

/**
 * Leaflet → viewportStore sync.
 * Calculates SVG viewport transform so canvas elements overlay the map correctly.
 */
function syncViewportFromMap() {
  if (!map || isSyncing) return
  isSyncing = true

  const anchor = settings.value?.anchorPoint
  const ppm = settings.value?.pixelsPerMeter ?? 1
  if (!anchor) { isSyncing = false; return }

  // Leaflet's meters per pixel at current zoom
  const zoom = map.getZoom()
  const cosLat = Math.cos(anchor.lat * Math.PI / 180)
  const metersPerPixel = 156543.03 * cosLat / Math.pow(2, zoom)

  // SVG scale: how many screen pixels per canvas pixel
  // 1 canvas px = (1/ppm) meters = (1/ppm)/metersPerPixel screen pixels
  const scale = 1 / (metersPerPixel * ppm)

  // Where anchor appears on screen (Leaflet container coords)
  const anchorScreen = map.latLngToContainerPoint([anchor.lat, anchor.lng])

  // viewport.x = anchorScreenX - anchorCanvasX * scale
  const vp = viewportStore.viewport
  vp.scale = scale
  vp.x = anchorScreen.x - anchor.canvasX * scale
  vp.y = anchorScreen.y - anchor.canvasY * scale

  isSyncing = false
}

onMounted(() => {
  if (!mapContainerEl.value) return

  const anchor = settings.value?.anchorPoint
  const center: [number, number] = anchor
    ? [anchor.lat, anchor.lng]
    : settings.value?.defaultCenter ?? [50.0755, 14.4378]
  const zoom = settings.value?.defaultZoom ?? 13

  map = L.map(mapContainerEl.value, {
    center,
    zoom,
    zoomControl: true,
    attributionControl: false,
  })

  updateTileLayer()

  // Sync on every map movement
  map.on('move zoom moveend zoomend', syncViewportFromMap)

  // Initial sync
  setTimeout(syncViewportFromMap, 100)
})

watch(() => settings.value?.tileProvider, updateTileLayer)

// When anchor/pixelsPerMeter/defaultZoom change, update Leaflet view first, then sync
watch(
  [
    () => settings.value?.anchorPoint?.lat,
    () => settings.value?.anchorPoint?.lng,
    () => settings.value?.pixelsPerMeter,
    () => settings.value?.defaultZoom,
  ],
  () => {
    if (!map) return
    const anchor = settings.value?.anchorPoint
    const zoom = settings.value?.defaultZoom ?? 13
    if (anchor) {
      map.setView([anchor.lat, anchor.lng], zoom, { animate: false })
    }
    syncViewportFromMap()
  },
)

// Expose methods for CanvasView to forward events
function zoomAt(screenX: number, screenY: number, delta: number) {
  if (!map) return
  const containerPoint = L.point(screenX, screenY)
  const step = delta > 0 ? -1 : 1
  const newZoom = Math.max(1, Math.min(22, map.getZoom() + step))
  map.setZoomAround(containerPoint, newZoom, { animate: false })
}

function panBy(dx: number, dy: number) {
  if (!map) return
  map.panBy([-dx, -dy], { animate: false })
}

defineExpose({ zoomAt, panBy })

onUnmounted(() => {
  if (map) {
    map.off('move zoom moveend zoomend', syncViewportFromMap)
    map.remove()
    map = null
  }
})
</script>

<template>
  <div
    ref="mapContainerEl"
    class="map-background"
    :style="{ opacity }"
  />
</template>

<style scoped>
.map-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
</style>
