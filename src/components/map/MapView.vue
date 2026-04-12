<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import { useDiagramStore } from '@/stores/diagramStore'
import { useToolStore } from '@/stores/toolStore'
import { useHistoryStore } from '@/stores/historyStore'
import { AddElementCommand } from '@/commands/elementCommands'
import { useMapSync } from '@/composables/useMapSync'
import MapWidgetOverlay from './MapWidgetOverlay.vue'

const diagramStore = useDiagramStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()
const mapSync = useMapSync()

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null

const widgetTypes = new Set(['gauge', 'switch', 'textValue', 'slider', 'progressBar', 'toggle'])

const mapWidgetTools = [
  { id: 'select', label: 'Select', icon: '⊹' },
  { id: 'gauge', label: 'Gauge', icon: '⏲' },
  { id: 'switch', label: 'LED', icon: '●' },
  { id: 'textValue', label: 'Value', icon: '123' },
  { id: 'slider', label: 'Slider', icon: '⎯●' },
  { id: 'progressBar', label: 'Progress', icon: '▰▱' },
  { id: 'toggle', label: 'Toggle', icon: '◑' },
]

function getTileUrl(provider: string): { url: string; attribution: string } {
  switch (provider) {
    case 'google-streets':
      return { url: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', attribution: '' }
    case 'google-satellite':
      return { url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attribution: '' }
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
  }
}

function updateTileLayer() {
  if (!map) return
  const provider = diagramStore.diagram.mapSettings?.tileProvider ?? 'osm'
  const { url, attribution } = getTileUrl(provider)
  if (tileLayer) {
    map.removeLayer(tileLayer)
  }
  tileLayer = L.tileLayer(url, { attribution, maxZoom: 20 }).addTo(map)
}

onMounted(() => {
  if (!mapEl.value) return

  const settings = diagramStore.diagram.mapSettings
  const center: [number, number] = settings?.defaultCenter ?? [50.0755, 14.4378]
  const zoom = settings?.defaultZoom ?? 13

  map = L.map(mapEl.value, {
    center,
    zoom,
    zoomControl: true,
  })

  updateTileLayer()
  mapSync.setMap(map)

  // Click to place widgets
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (!widgetTypes.has(toolStore.activeTool)) return

    const { lat, lng } = e.latlng
    const defaultStyle = { fill: '#ffffff', stroke: '#333333', strokeWidth: 1, opacity: 1 }

    const defaults: Record<string, any> = {
      gauge: { width: 100, height: 100, label: 'Gauge', dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 } },
      switch: { width: 60, height: 60, label: 'Status', dataSource: { endpoint: '', valueKey: '', interval: 5000 } },
      textValue: { width: 100, height: 40, label: 'Value', style: { ...defaultStyle, fontSize: 18 }, dataSource: { endpoint: '', valueKey: '', interval: 5000, format: '{v}' } },
      slider: { width: 140, height: 50, label: 'Slider', dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 } },
      progressBar: { width: 160, height: 40, label: 'Progress', dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 } },
      toggle: { width: 70, height: 60, label: 'Switch', dataSource: { endpoint: '', valueKey: '', interval: 5000 } },
    }

    const def = defaults[toolStore.activeTool] ?? { width: 80, height: 80 }

    const cmd = new AddElementCommand({
      type: toolStore.activeTool as any,
      x: diagramStore.diagram.width / 2,
      y: diagramStore.diagram.height / 2,
      width: def.width,
      height: def.height,
      rotation: 0,
      layerId: diagramStore.activeLayerId,
      locked: false,
      visible: true,
      label: def.label,
      dataSource: def.dataSource,
      geoPosition: { lat, lng, locked: false },
      style: def.style ?? defaultStyle,
    })
    historyStore.execute(cmd)
    mapSync.recalculate()
    toolStore.setTool('select')
  })

  // Right-click cancels widget placement
  map.on('contextmenu', (e: L.LeafletMouseEvent) => {
    L.DomEvent.preventDefault(e.originalEvent)
    if (widgetTypes.has(toolStore.activeTool)) {
      toolStore.setTool('select')
    }
  })
})

// Esc cancels widget placement
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && widgetTypes.has(toolStore.activeTool)) {
    toolStore.setTool('select')
  }
}

// Watch tile provider changes
watch(
  () => diagramStore.diagram.mapSettings?.tileProvider,
  () => updateTileLayer(),
)

// Change cursor when a widget tool is active
const isPlacingWidget = computed(() => widgetTypes.has(toolStore.activeTool))

const widgetToolLabels: Record<string, string> = {
  gauge: 'Gauge',
  switch: 'LED',
  textValue: 'Value',
  slider: 'Slider',
  progressBar: 'Progress',
  toggle: 'Toggle',
}

const placingLabel = computed(() => widgetToolLabels[toolStore.activeTool] ?? '')

watch(isPlacingWidget, (placing) => {
  if (!mapEl.value) return
  mapEl.value.classList.toggle('placing-widget', placing)
}, { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  mapSync.destroy()
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-container">
    <div ref="mapEl" class="map-element" />
    <MapWidgetOverlay :map-sync="mapSync" />

    <!-- Floating widget palette -->
    <div class="map-palette">
      <div class="map-palette-title">Komponenty</div>
      <button
        v-for="t in mapWidgetTools"
        :key="t.id"
        class="map-palette-btn"
        :class="{ active: toolStore.activeTool === t.id }"
        :title="t.label"
        @click="toolStore.setTool(t.id as any)"
      >
        <span class="mp-icon">{{ t.icon }}</span>
        <span class="mp-label">{{ t.label }}</span>
      </button>
    </div>

    <!-- Placement hint banner -->
    <div v-if="isPlacingWidget" class="placement-hint">
      Klikni na mapu pro umístění: <strong>{{ placingLabel }}</strong>
      <span class="hint-sub">(Esc nebo pravé tlačítko = zrušit)</span>
    </div>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-element {
  width: 100%;
  height: 100%;
}

/* Floating widget palette */
.map-palette {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 600;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.map-palette-title {
  font-size: 10px;
  color: var(--text-muted, #999);
  text-align: center;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #333);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.map-palette-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--text-secondary, #ccc);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
}

.map-palette-btn:hover {
  background: var(--btn-hover, #333);
  border-color: var(--swatch-border, #555);
}

.map-palette-btn.active {
  background: var(--accent, #2196F3);
  color: white;
  border-color: var(--accent, #2196F3);
}

.mp-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.mp-label {
  font-size: 12px;
}

.placement-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  background: var(--accent, #2196F3);
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

.hint-sub {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 8px;
}
</style>
