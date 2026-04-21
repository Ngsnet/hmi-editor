<script setup lang="ts">
import { ref, inject, onUnmounted, type ShallowRef } from 'vue'
import L from 'leaflet'
import { useBuildingStore } from '@/stores/buildingStore'
import type { GeoRef } from '@/types/indoor'
import FloorPlanLayer from './FloorPlanLayer.vue'

type Step = 'pickSvg1' | 'pickMap1' | 'pickSvg2' | 'pickMap2' | 'preview'

const props = defineProps<{
  floorPlanRef: InstanceType<typeof FloorPlanLayer> | null
}>()

const emit = defineEmits<{
  done: []
}>()

const buildingStore = useBuildingStore()
const mapRef = inject<ShallowRef<L.Map | null>>('leafletMap')

const step = ref<Step>('pickSvg1')
const svgPoint1 = ref<{ x: number; y: number } | null>(null)
const geoPoint1 = ref<{ lat: number; lng: number } | null>(null)
const svgPoint2 = ref<{ x: number; y: number } | null>(null)
const geoPoint2 = ref<{ lat: number; lng: number } | null>(null)

// Manual lat/lng input mode
const manualLat = ref('')
const manualLng = ref('')

// Leaflet markers for reference points
let marker1: L.Marker | null = null
let marker2: L.Marker | null = null

// SVG markers
const svgMarkerIds = ['georef-marker-1', 'georef-marker-2']

function createNumberedIcon(num: number): L.DivIcon {
  return L.divIcon({
    className: 'georef-marker-icon',
    html: `<div style="
      width: 24px; height: 24px;
      background: #e53e3e; color: white;
      border-radius: 50%; border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    ">${num}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function drawSvgMarker(point: { x: number; y: number }, id: string, num: number) {
  const container = props.floorPlanRef?.getSvgContainer()
  const svgEl = container?.querySelector('svg')
  if (!svgEl) return

  // Remove existing marker
  svgEl.querySelector(`#${id}`)?.remove()

  const ns = 'http://www.w3.org/2000/svg'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('id', id)

  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('cx', String(point.x))
  circle.setAttribute('cy', String(point.y))
  circle.setAttribute('r', '8')
  circle.setAttribute('fill', '#e53e3e')
  circle.setAttribute('stroke', 'white')
  circle.setAttribute('stroke-width', '2')
  circle.setAttribute('pointer-events', 'none')

  const text = document.createElementNS(ns, 'text')
  text.setAttribute('x', String(point.x))
  text.setAttribute('y', String(point.y + 4))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('fill', 'white')
  text.setAttribute('font-size', '10')
  text.setAttribute('font-weight', '700')
  text.setAttribute('pointer-events', 'none')
  text.textContent = String(num)

  g.appendChild(circle)
  g.appendChild(text)
  svgEl.appendChild(g)
}

function removeSvgMarkers() {
  const container = props.floorPlanRef?.getSvgContainer()
  const svgEl = container?.querySelector('svg')
  if (!svgEl) return
  for (const id of svgMarkerIds) {
    svgEl.querySelector(`#${id}`)?.remove()
  }
}

function removeMapMarkers() {
  marker1?.remove()
  marker2?.remove()
  marker1 = null
  marker2 = null
}

// --- SVG click handler ---
function onSvgClick(e: MouseEvent) {
  const point = props.floorPlanRef?.getSvgPointFromEvent(e)
  if (!point) return

  if (step.value === 'pickSvg1') {
    svgPoint1.value = point
    drawSvgMarker(point, svgMarkerIds[0]!, 1)
    step.value = 'pickMap1'
  } else if (step.value === 'pickSvg2') {
    svgPoint2.value = point
    drawSvgMarker(point, svgMarkerIds[1]!, 2)
    step.value = 'pickMap2'
  }
}

// --- Map click handler ---
function onMapClick(e: L.LeafletMouseEvent) {
  const map = mapRef?.value
  if (!map) return

  if (step.value === 'pickMap1') {
    geoPoint1.value = { lat: e.latlng.lat, lng: e.latlng.lng }
    marker1 = L.marker(e.latlng, { icon: createNumberedIcon(1) }).addTo(map)
    step.value = 'pickSvg2'
  } else if (step.value === 'pickMap2') {
    geoPoint2.value = { lat: e.latlng.lat, lng: e.latlng.lng }
    marker2 = L.marker(e.latlng, { icon: createNumberedIcon(2) }).addTo(map)
    map.off('click', onMapClick)
    step.value = 'preview'
  }
}

function startMapPick() {
  const map = mapRef?.value
  if (!map) return
  map.on('click', onMapClick)
}

function applyManualLatLng() {
  const lat = parseFloat(manualLat.value)
  const lng = parseFloat(manualLng.value)
  if (isNaN(lat) || isNaN(lng)) return

  const map = mapRef?.value
  if (!map) return

  const latlng = L.latLng(lat, lng)

  if (step.value === 'pickMap1') {
    geoPoint1.value = { lat, lng }
    marker1 = L.marker(latlng, { icon: createNumberedIcon(1) }).addTo(map)
    manualLat.value = ''
    manualLng.value = ''
    step.value = 'pickSvg2'
  } else if (step.value === 'pickMap2') {
    geoPoint2.value = { lat, lng }
    marker2 = L.marker(latlng, { icon: createNumberedIcon(2) }).addTo(map)
    map.off('click', onMapClick)
    manualLat.value = ''
    manualLng.value = ''
    step.value = 'preview'
  }
}

// --- Apply / Cancel ---
function apply() {
  if (!svgPoint1.value || !geoPoint1.value || !svgPoint2.value || !geoPoint2.value) return

  const geoRef: [GeoRef, GeoRef] = [
    { svgX: svgPoint1.value.x, svgY: svgPoint1.value.y, lat: geoPoint1.value.lat, lng: geoPoint1.value.lng },
    { svgX: svgPoint2.value.x, svgY: svgPoint2.value.y, lat: geoPoint2.value.lat, lng: geoPoint2.value.lng },
  ]

  // Reset manual fine-tuning when applying new geoRef
  buildingStore.floorPlanOffsetX = 0
  buildingStore.floorPlanOffsetY = 0
  buildingStore.floorPlanRotation = 0

  buildingStore.setGeoRef(geoRef)
  cleanup()
  emit('done')
}

function cancel() {
  const map = mapRef?.value
  map?.off('click', onMapClick)
  cleanup()
  emit('done')
}

function cleanup() {
  removeSvgMarkers()
  removeMapMarkers()
  svgPoint1.value = null
  geoPoint1.value = null
  svgPoint2.value = null
  geoPoint2.value = null
  step.value = 'pickSvg1'
}

// Enable SVG pointer events during SVG pick steps
function isSvgPickStep(): boolean {
  return step.value === 'pickSvg1' || step.value === 'pickSvg2'
}

// Start map click listener when entering map pick steps
import { watch } from 'vue'
watch(step, (s) => {
  if (s === 'pickMap1' || s === 'pickMap2') {
    startMapPick()
  }
})

onUnmounted(() => {
  const map = mapRef?.value
  map?.off('click', onMapClick)
  removeMapMarkers()
  removeSvgMarkers()
})

const stepLabels: Record<Step, string> = {
  pickSvg1: 'Klikněte na první referenční bod v půdorysu',
  pickMap1: 'Klikněte na odpovídající bod na mapě (nebo zadejte souřadnice)',
  pickSvg2: 'Klikněte na druhý referenční bod v půdorysu',
  pickMap2: 'Klikněte na odpovídající bod na mapě (nebo zadejte souřadnice)',
  preview: 'Zkontrolujte zarovnání a potvrďte',
}

const stepNumber = {
  pickSvg1: 1, pickMap1: 2, pickSvg2: 3, pickMap2: 4, preview: 5,
}
</script>

<template>
  <!-- SVG click overlay (intercepts clicks during SVG pick steps) -->
  <div
    v-if="isSvgPickStep()"
    class="svg-click-overlay"
    @click="onSvgClick"
  />

  <!-- Banner -->
  <div class="georef-banner">
    <div class="georef-step">
      <span class="step-badge">{{ stepNumber[step] }}/5</span>
      <span class="step-label">{{ stepLabels[step] }}</span>
    </div>

    <!-- Manual lat/lng input for map pick steps -->
    <div v-if="step === 'pickMap1' || step === 'pickMap2'" class="manual-input">
      <span class="manual-label">Nebo zadejte:</span>
      <input
        v-model="manualLat"
        type="number"
        step="0.000001"
        placeholder="Lat"
        class="coord-input"
      />
      <input
        v-model="manualLng"
        type="number"
        step="0.000001"
        placeholder="Lng"
        class="coord-input"
      />
      <button class="btn-sm btn-primary" @click="applyManualLatLng">OK</button>
    </div>

    <!-- Preview info -->
    <div v-if="step === 'preview'" class="preview-info">
      <span>Bod 1: SVG ({{ svgPoint1?.x.toFixed(1) }}, {{ svgPoint1?.y.toFixed(1) }}) &rarr; ({{ geoPoint1?.lat.toFixed(6) }}, {{ geoPoint1?.lng.toFixed(6) }})</span>
      <span>Bod 2: SVG ({{ svgPoint2?.x.toFixed(1) }}, {{ svgPoint2?.y.toFixed(1) }}) &rarr; ({{ geoPoint2?.lat.toFixed(6) }}, {{ geoPoint2?.lng.toFixed(6) }})</span>
    </div>

    <!-- Action buttons -->
    <div class="georef-actions">
      <button v-if="step === 'preview'" class="btn-sm btn-primary" @click="apply">Použít</button>
      <button class="btn-sm btn-ghost" @click="cancel">Zrušit</button>
    </div>
  </div>
</template>

<style scoped>
.svg-click-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 510;
  cursor: crosshair;
}

.georef-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 700;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--accent, #2196F3);
  border-radius: 8px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  min-width: 380px;
  max-width: 600px;
}

.georef-step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-badge {
  background: var(--accent, #2196F3);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.step-label {
  font-size: 13px;
  color: var(--text-primary, #eee);
}

.manual-input {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.manual-label {
  color: var(--text-muted, #999);
  font-size: 11px;
  white-space: nowrap;
}

.coord-input {
  width: 100px;
  height: 24px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 4px;
  color: var(--input-text, #eee);
  font-size: 11px;
  text-align: center;
  font-family: monospace;
  padding: 0 4px;
}

.coord-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted, #999);
}

.georef-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-sm {
  padding: 4px 14px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--accent, #2196F3);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.15);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #444);
  color: var(--text-muted, #999);
}

.btn-ghost:hover {
  border-color: var(--accent, #2196F3);
  color: var(--text-primary, #eee);
}
</style>
