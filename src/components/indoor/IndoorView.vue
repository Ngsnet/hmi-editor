<script setup lang="ts">
import { ref, shallowRef, computed, provide, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import { useBuildingStore } from '@/stores/buildingStore'
import { useDiagramStore } from '@/stores/diagramStore'
import FloorPlanLayer from './FloorPlanLayer.vue'
import UnitOverlay from './UnitOverlay.vue'
import UnitPanel from './UnitPanel.vue'
import FloorSwitcher from './FloorSwitcher.vue'
import GeoRefTool from './GeoRefTool.vue'

const buildingStore = useBuildingStore()
const diagramStore = useDiagramStore()

const mapEl = ref<HTMLDivElement | null>(null)
const unitOverlayRef = ref<InstanceType<typeof UnitOverlay> | null>(null)
const floorPlanRef = ref<InstanceType<typeof FloorPlanLayer> | null>(null)
const showAdjust = ref(false)
const showGeoRef = ref(false)
const showHelp = ref(false)
const mapRef = shallowRef<L.Map | null>(null)
let map: L.Map | null = null

provide('leafletMap', mapRef)

const activeFloorPlan = computed(() =>
  buildingStore.building.floors.find(f => f.id === buildingStore.activeFloor)
)

function getTileUrl(provider: string): { url: string; attribution: string; maxNativeZoom: number } {
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

function onFloorPlanLoaded() {
  // Pass SVG container to UnitOverlay so it can find elements
  const container = floorPlanRef.value?.getSvgContainer()
  unitOverlayRef.value?.applyAllStyles(container ?? undefined)
}

onMounted(() => {
  if (!mapEl.value) return

  const building = buildingStore.building
  const center: [number, number] = buildingStore.mapCenter ?? building.geoCenter
  const zoom = buildingStore.mapZoom ?? building.geoZoom

  map = L.map(mapEl.value, {
    center,
    zoom,
    zoomControl: true,
  })

  const provider = diagramStore.diagram.mapSettings?.tileProvider ?? 'osm'
  const tileInfo = getTileUrl(provider)
  L.tileLayer(tileInfo.url, {
    attribution: tileInfo.attribution,
    maxNativeZoom: tileInfo.maxNativeZoom,
    maxZoom: 22,
  }).addTo(map)

  mapRef.value = map

  // Save map position on move/zoom
  map.on('moveend', () => {
    if (!map) return
    const c = map.getCenter()
    buildingStore.mapCenter = [c.lat, c.lng]
    buildingStore.mapZoom = map.getZoom()
  })

  buildingStore.registerAllMeters()
})

onUnmounted(() => {
  buildingStore.unregisterAllMeters()
  if (map) {
    map.remove()
    map = null
    mapRef.value = null
  }
})
</script>

<template>
  <div class="indoor-view">
    <div class="map-area">
      <div ref="mapEl" class="map-element" />
      <FloorPlanLayer ref="floorPlanRef" @loaded="onFloorPlanLoaded" />
      <UnitOverlay ref="unitOverlayRef" />
      <FloorSwitcher />

      <!-- Geo-reference tool -->
      <GeoRefTool
        v-if="showGeoRef"
        :floor-plan-ref="floorPlanRef"
        @done="showGeoRef = false"
      />

      <!-- Floor label + controls -->
      <div class="floor-controls">
        <span class="floor-label-text">
          {{ activeFloorPlan?.label ?? buildingStore.activeFloor }}
        </span>
        <span v-if="activeFloorPlan && activeFloorPlan.totalArea > 0" class="floor-areas">
          {{ activeFloorPlan.totalArea }} m²
          <span class="floor-areas-detail" title="Celk. / Pronaj. / Započ.">
            ({{ activeFloorPlan.rentableArea }} / {{ activeFloorPlan.chargeableArea }})
          </span>
        </span>
        <label class="ctrl-row" title="Průhlednost půdorysu">
          <span class="ctrl-icon">&#9783;</span>
          <input
            type="range"
            min="0.1" max="1" step="0.05"
            :value="buildingStore.floorPlanOpacity"
            @input="buildingStore.floorPlanOpacity = Number(($event.target as HTMLInputElement).value)"
          />
          <span class="ctrl-val">{{ Math.round(buildingStore.floorPlanOpacity * 100) }}%</span>
        </label>
        <button class="adjust-toggle" :class="{ active: showGeoRef }" @click="showGeoRef = !showGeoRef" title="Geo-reference (2-bodové zarovnání s mapou)">
          &#9906;
        </button>
        <button class="adjust-toggle" :class="{ active: showAdjust }" @click="showAdjust = !showAdjust" title="Zarovnání půdorysu">
          &#9881;
        </button>
        <button class="adjust-toggle" :class="{ active: showHelp }" @click="showHelp = !showHelp" title="Nápověda / postup">
          ?
        </button>
      </div>

      <!-- Adjust panel -->
      <div v-if="showAdjust" class="adjust-panel">
        <div class="adjust-title">Zarovnání půdorysu</div>

        <!-- GeoRef status -->
        <div v-if="buildingStore.hasGeoRef" class="georef-status">
          <span class="georef-active">&#10003; Geo-reference aktivní</span>
          <button class="reset-btn" @click="buildingStore.clearGeoRef()">Vymazat geo-ref</button>
        </div>

        <!-- Manual scale (only when no geoRef) -->
        <label v-if="!buildingStore.hasGeoRef" class="ctrl-row">
          <span class="ctrl-label">Měřítko</span>
          <input
            type="range"
            min="0.1" max="5" step="0.01"
            :value="buildingStore.floorPlanScale"
            @input="buildingStore.floorPlanScale = Number(($event.target as HTMLInputElement).value)"
          />
          <input
            type="number"
            class="ctrl-num"
            min="0.1" max="5" step="0.01"
            :value="buildingStore.floorPlanScale.toFixed(2)"
            @input="buildingStore.floorPlanScale = Number(($event.target as HTMLInputElement).value)"
          />
        </label>

        <!-- Fine-tune offset X -->
        <label class="ctrl-row">
          <span class="ctrl-label">{{ buildingStore.hasGeoRef ? 'Doladění X' : 'Posun X' }}</span>
          <input
            type="range"
            min="-500" max="500" step="1"
            :value="buildingStore.floorPlanOffsetX"
            @input="buildingStore.floorPlanOffsetX = Number(($event.target as HTMLInputElement).value)"
          />
          <input
            type="number"
            class="ctrl-num"
            :value="buildingStore.floorPlanOffsetX"
            @input="buildingStore.floorPlanOffsetX = Number(($event.target as HTMLInputElement).value)"
          /> px
        </label>

        <!-- Fine-tune offset Y -->
        <label class="ctrl-row">
          <span class="ctrl-label">{{ buildingStore.hasGeoRef ? 'Doladění Y' : 'Posun Y' }}</span>
          <input
            type="range"
            min="-500" max="500" step="1"
            :value="buildingStore.floorPlanOffsetY"
            @input="buildingStore.floorPlanOffsetY = Number(($event.target as HTMLInputElement).value)"
          />
          <input
            type="number"
            class="ctrl-num"
            :value="buildingStore.floorPlanOffsetY"
            @input="buildingStore.floorPlanOffsetY = Number(($event.target as HTMLInputElement).value)"
          /> px
        </label>

        <!-- Fine-tune rotation -->
        <label class="ctrl-row">
          <span class="ctrl-label">{{ buildingStore.hasGeoRef ? 'Doladění rot.' : 'Rotace' }}</span>
          <input
            type="range"
            min="-180" max="180" step="0.5"
            :value="buildingStore.floorPlanRotation"
            @input="buildingStore.floorPlanRotation = Number(($event.target as HTMLInputElement).value)"
          />
          <input
            type="number"
            class="ctrl-num"
            min="-180" max="180" step="0.5"
            :value="buildingStore.floorPlanRotation"
            @input="buildingStore.floorPlanRotation = Number(($event.target as HTMLInputElement).value)"
          /> &deg;
        </label>

        <button class="reset-btn" @click="buildingStore.floorPlanScale = 1; buildingStore.floorPlanOffsetX = 0; buildingStore.floorPlanOffsetY = 0; buildingStore.floorPlanRotation = 0">
          Reset
        </button>
      </div>
      <!-- Help panel -->
      <div v-if="showHelp" class="help-panel">
        <div class="help-header">
          <span class="help-title">Postup nastavení indoor plánu</span>
          <button class="help-close" @click="showHelp = false">&times;</button>
        </div>
        <ol class="help-steps">
          <li>
            <strong>Založte podlaží</strong>
            <span>V Admin CMS vytvořte podlaží (floor) s ID a názvem.</span>
          </li>
          <li>
            <strong>Nahrajte SVG půdorys</strong>
            <span>V Admin &rarr; Půdorysy nahrajte SVG soubor pro dané podlaží.</span>
          </li>
          <li>
            <strong>Kalibrujte měřítko</strong>
            <span>V Admin &rarr; Půdorysy použijte tlačítko "Kalibrovat" &mdash; klikněte dva body se známou vzdáleností a zadejte metry.</span>
          </li>
          <li>
            <strong>Zarovnejte s mapou</strong>
            <span>Zde v indoor pohledu klikněte <strong>&#9906;</strong> (Geo-reference) &mdash; označte dva rohy budovy v půdorysu a na mapě. Systém automaticky vypočítá měřítko, rotaci a pozici.</span>
          </li>
          <li>
            <strong>Dolaďte pozici</strong>
            <span>Klikněte <strong>&#9881;</strong> a posuvníky jemně dolaďte posun a rotaci. Průhlednost půdorysu nastavte posuvníkem vlevo.</span>
          </li>
          <li>
            <strong>Nakreslete jednotky</strong>
            <span>V Admin &rarr; Půdorysy klikněte "Kreslit jednotku" a nakreslete polygony pro každou jednotku (obchod, kancelář...).</span>
          </li>
          <li>
            <strong>Přiřaďte jednotky</strong>
            <span>Klikněte na nakreslený segment a zvolte "Vytvořit novou jednotku" nebo přiřaďte existující. Nastavte nájemce, plochu a měřiče.</span>
          </li>
        </ol>
        <div class="help-footer">
          <span class="help-hint">Klávesy: kolečko myši = zoom, pravé tlačítko = přesun mapy</span>
        </div>
      </div>

      <UnitPanel
        v-if="buildingStore.selectedUnit"
        :unit="buildingStore.selectedUnit"
        @close="buildingStore.selectUnit(null)"
      />
    </div>
  </div>
</template>

<style scoped>
.indoor-view {
  display: flex;
  width: 100%;
  height: 100%;
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.map-element {
  width: 100%;
  height: 100%;
}

.floor-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 600;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.floor-label-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.floor-areas {
  font-size: 12px;
  color: var(--text-secondary, #ccc);
  font-family: monospace;
  border-left: 1px solid var(--border-color, #444);
  padding-left: 10px;
}

.floor-areas-detail {
  color: var(--text-muted, #888);
  font-size: 11px;
}

.ctrl-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted, #999);
  cursor: pointer;
}

.ctrl-icon {
  font-size: 14px;
  color: var(--text-muted, #999);
}

.ctrl-label {
  min-width: 56px;
  font-size: 11px;
  color: var(--text-muted, #999);
}

.ctrl-row input[type="range"] {
  width: 90px;
  height: 4px;
  accent-color: var(--accent, #2196F3);
}

.ctrl-val {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted, #999);
  min-width: 32px;
}

.ctrl-num {
  width: 54px;
  height: 22px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 4px;
  color: var(--input-text, #eee);
  font-size: 11px;
  text-align: center;
  font-family: monospace;
}

.ctrl-num:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.adjust-toggle {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.adjust-toggle:hover {
  background: var(--btn-hover, #333);
}

.adjust-toggle.active {
  background: var(--accent, #2196F3);
  color: white;
}

.adjust-panel {
  position: absolute;
  bottom: 60px;
  left: 16px;
  z-index: 600;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  user-select: none;
  min-width: 280px;
}

.adjust-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #2196F3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.reset-btn {
  align-self: flex-end;
  padding: 4px 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.reset-btn:hover {
  border-color: var(--accent, #2196F3);
  color: var(--text-primary, #eee);
}

.georef-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}

.georef-active {
  font-size: 12px;
  color: #48bb78;
  font-weight: 600;
}

.help-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 650;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  width: 340px;
  max-height: calc(100% - 80px);
  overflow-y: auto;
  user-select: none;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #333);
}

.help-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #2196F3);
}

.help-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-close:hover {
  background: var(--btn-hover, #333);
  color: var(--text-primary, #eee);
}

.help-steps {
  list-style: none;
  counter-reset: help-step;
  padding: 8px 14px;
  margin: 0;
}

.help-steps li {
  counter-increment: help-step;
  position: relative;
  padding: 8px 0 8px 32px;
  border-bottom: 1px solid var(--border-light, #2a2a2a);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.help-steps li:last-child {
  border-bottom: none;
}

.help-steps li::before {
  content: counter(help-step);
  position: absolute;
  left: 0;
  top: 8px;
  width: 22px;
  height: 22px;
  background: var(--accent, #2196F3);
  color: white;
  font-size: 11px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-steps li strong {
  font-size: 12px;
  color: var(--text-primary, #eee);
}

.help-steps li span {
  font-size: 11px;
  color: var(--text-muted, #999);
  line-height: 1.4;
}

.help-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--border-color, #333);
}

.help-hint {
  font-size: 10px;
  color: var(--text-dim, #666);
}
</style>
