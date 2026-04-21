<script setup lang="ts">
import { computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import type { StrokeDashType } from '@/types/diagram'

const diagramStore = useDiagramStore()

const selected = computed(() => diagramStore.selectedElements)
const single = computed(() => selected.value.length === 1 ? selected.value[0]! : null)

const strokeDashOptions: Array<{ value: StrokeDashType; label: string; pattern: string }> = [
  { value: 'solid', label: 'Plná', pattern: '' },
  { value: 'dashed', label: 'Čárkovaná', pattern: '8 4' },
  { value: 'dotted', label: 'Tečkovaná', pattern: '2 4' },
  { value: 'dash-dot', label: 'Čárka-tečka', pattern: '8 3 2 3' },
  { value: 'long-dash', label: 'Dlouhá čárka', pattern: '16 6' },
]

const isShapeElement = computed(() =>
  single.value && ['rect', 'ellipse', 'line', 'polyline', 'polygon'].includes(single.value.type)
)

function updateProp(key: string, value: unknown) {
  if (!single.value) return
  diagramStore.updateElement(single.value.id, { [key]: value } as any)
}

function updateStyle(key: string, value: unknown) {
  if (!single.value) return
  diagramStore.updateElement(single.value.id, {
    style: { ...single.value.style, [key]: value },
  } as any)
}
</script>

<template>
  <div class="property-panel">
    <div class="panel-header">Vlastnosti</div>

    <!-- No selection -->
    <div v-if="selected.length === 0" class="panel-body">
      <template v-if="diagramStore.diagram.mapSettings?.showAsBackground">
        <div class="prop-section">
          <div class="section-title">Mapový podklad</div>
          <p class="hint">Aktivní. Použijte tlačítko "Změnit" v toolbaru pro úpravu výřezu.</p>
          <div class="prop-row" style="margin-top: 8px">
            <label>px/m</label>
            <input type="number" step="0.1" min="0.01"
              :value="diagramStore.diagram.mapSettings?.pixelsPerMeter ?? 1"
              @change="diagramStore.diagram.mapSettings = { ...diagramStore.diagram.mapSettings!, pixelsPerMeter: Number(($event.target as HTMLInputElement).value) }" />
          </div>
        </div>
      </template>
      <div v-else class="panel-empty">
        Žádný element nevybrán
      </div>
    </div>

    <!-- Single element -->
    <div v-else-if="single" class="panel-body">
      <div class="prop-section">
        <div class="section-title">{{ single.type.toUpperCase() }}</div>
      </div>

      <!-- Position & Size -->
      <div class="prop-section">
        <div class="section-title">Position</div>
        <div class="prop-row">
          <label>X</label>
          <input type="number" :value="Math.round(single.x)"
            @change="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
          <label>Y</label>
          <input type="number" :value="Math.round(single.y)"
            @change="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="prop-row">
          <label>W</label>
          <input type="number" :value="Math.round(single.width)" min="1"
            @change="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
          <label>H</label>
          <input type="number" :value="Math.round(single.height)" min="1"
            @change="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="prop-row">
          <label>Rot</label>
          <input type="number" :value="single.rotation" step="1"
            @change="updateProp('rotation', Number(($event.target as HTMLInputElement).value))" />
        </div>
      </div>

      <!-- Stroke style (for shape elements) -->
      <div v-if="isShapeElement" class="prop-section">
        <div class="section-title">Čára</div>
        <div class="prop-row">
          <label>Barva</label>
          <input type="color" :value="single.style.stroke"
            class="color-input"
            @input="updateStyle('stroke', ($event.target as HTMLInputElement).value)" />
          <label>Šířka</label>
          <input type="number" :value="single.style.strokeWidth" min="0" step="0.5"
            @change="updateStyle('strokeWidth', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="prop-row">
          <label>Typ</label>
          <select class="dash-select"
            :value="single.style.strokeDash ?? 'solid'"
            @change="updateStyle('strokeDash', ($event.target as HTMLSelectElement).value)">
            <option v-for="opt in strokeDashOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="dash-preview">
          <svg width="100%" height="16" viewBox="0 0 140 16">
            <line x1="4" y1="8" x2="136" y2="8"
              :stroke="single.style.stroke"
              :stroke-width="Math.min(single.style.strokeWidth, 4)"
              :stroke-dasharray="strokeDashOptions.find(o => o.value === (single?.style.strokeDash ?? 'solid'))?.pattern ?? ''"
            />
          </svg>
        </div>
        <div class="prop-row">
          <label>Výplň</label>
          <input type="color" :value="single.style.fill === 'none' ? '#ffffff' : single.style.fill"
            class="color-input"
            @input="updateStyle('fill', ($event.target as HTMLInputElement).value)" />
          <label>
            <input type="checkbox" :checked="single.style.fill === 'none'"
              @change="updateStyle('fill', ($event.target as HTMLInputElement).checked ? 'none' : '#ffffff')" />
            Bez
          </label>
        </div>
        <div class="prop-row">
          <label>Průhledness</label>
          <input type="range" :value="single.style.opacity" min="0" max="1" step="0.05"
            class="range-input"
            @input="updateStyle('opacity', Number(($event.target as HTMLInputElement).value))" />
          <span class="hint">{{ Math.round((single.style.opacity) * 100) }}%</span>
        </div>
      </div>

      <!-- Label (for widgets with labels) -->
      <div v-if="['text', 'gauge', 'switch', 'textValue', 'slider', 'progressBar', 'button', 'toggle'].includes(single.type)" class="prop-section">
        <div class="section-title">Label</div>
        <div class="prop-row">
          <input type="text" :value="single.label ?? ''"
            class="text-input"
            @change="updateProp('label', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>

      <!-- DataSource (for gauge, switch, textValue) -->
      <div v-if="single.dataSource" class="prop-section">
        <div class="section-title">Data Source</div>
        <div class="prop-row">
          <label>URL</label>
          <input type="text" :value="single.dataSource.endpoint"
            class="text-input"
            placeholder="http://..."
            @change="updateProp('dataSource', { ...single.dataSource, endpoint: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="prop-row">
          <label>Key</label>
          <input type="text" :value="single.dataSource.valueKey"
            class="text-input"
            placeholder="data.value"
            @change="updateProp('dataSource', { ...single.dataSource, valueKey: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="prop-row">
          <label>Interval</label>
          <input type="number" :value="single.dataSource.interval"
            min="500" step="500"
            @change="updateProp('dataSource', { ...single.dataSource, interval: Number(($event.target as HTMLInputElement).value) })" />
          <span class="hint">ms</span>
        </div>
        <div v-if="['gauge', 'slider', 'progressBar'].includes(single.type)" class="prop-row">
          <label>Min</label>
          <input type="number" :value="single.dataSource.minValue ?? 0"
            @change="updateProp('dataSource', { ...single.dataSource, minValue: Number(($event.target as HTMLInputElement).value) })" />
          <label>Max</label>
          <input type="number" :value="single.dataSource.maxValue ?? 100"
            @change="updateProp('dataSource', { ...single.dataSource, maxValue: Number(($event.target as HTMLInputElement).value) })" />
        </div>
        <div v-if="single.type === 'textValue'" class="prop-row">
          <label>Format</label>
          <input type="text" :value="single.dataSource.format ?? '{v}'"
            class="text-input"
            placeholder="{v} °C"
            @change="updateProp('dataSource', { ...single.dataSource, format: ($event.target as HTMLInputElement).value })" />
        </div>
      </div>

      <!-- GPS position -->
      <div v-if="single.geoPosition" class="prop-section">
        <div class="section-title">GPS pozice</div>
        <div class="prop-row">
          <label>Lat</label>
          <input type="number" :value="single.geoPosition.lat" step="0.000001"
            @change="updateProp('geoPosition', { ...single.geoPosition, lat: Number(($event.target as HTMLInputElement).value) })" />
        </div>
        <div class="prop-row">
          <label>Lng</label>
          <input type="number" :value="single.geoPosition.lng" step="0.000001"
            @change="updateProp('geoPosition', { ...single.geoPosition, lng: Number(($event.target as HTMLInputElement).value) })" />
        </div>
        <div class="prop-row">
          <button class="remove-btn" @click="updateProp('geoPosition', undefined)">Odebrat GPS</button>
        </div>
      </div>

      <!-- Flags -->
      <div class="prop-section">
        <div class="section-title">Options</div>
        <div class="prop-row">
          <label>
            <input type="checkbox" :checked="single.locked"
              @change="updateProp('locked', ($event.target as HTMLInputElement).checked)" />
            Locked
          </label>
          <label>
            <input type="checkbox" :checked="single.visible"
              @change="updateProp('visible', ($event.target as HTMLInputElement).checked)" />
            Visible
          </label>
        </div>
      </div>
    </div>

    <!-- Multi-selection -->
    <div v-else class="panel-body">
      <div class="prop-section">
        <div class="section-title">{{ selected.length }} elements selected</div>
        <p class="hint">Use toolbar to change shared style</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-panel {
  flex: 1;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  overflow-y: auto;
  user-select: none;
}

.panel-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.panel-empty {
  padding: 20px 12px;
  color: var(--text-dim);
  text-align: center;
}

.panel-body {
  padding: 4px 0;
}

.prop-section {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-light);
}

.section-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.prop-row label {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 16px;
}

.prop-row input[type="number"] {
  flex: 1;
  min-width: 0;
  height: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--input-border);
  border-radius: 3px;
  color: var(--input-text);
  text-align: center;
  font-size: 12px;
  padding: 0 4px;
}

.prop-row input[type="checkbox"] {
  accent-color: var(--accent);
}

.text-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--input-border);
  border-radius: 3px;
  color: var(--input-text);
  font-size: 12px;
  padding: 0 6px;
}

.hint {
  color: var(--text-dim);
  font-size: 11px;
  margin: 4px 0 0;
}

.remove-btn {
  padding: 4px 10px;
  background: #c0392b;
  border: none;
  border-radius: 3px;
  color: white;
  font-size: 11px;
  cursor: pointer;
}

.remove-btn:hover {
  background: #e74c3c;
}

.color-input {
  width: 28px;
  height: 24px;
  padding: 1px;
  border: 1px solid var(--input-border);
  border-radius: 3px;
  cursor: pointer;
  background: var(--bg-secondary);
}

.dash-select {
  flex: 1;
  height: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--input-border);
  border-radius: 3px;
  color: var(--input-text);
  font-size: 12px;
  padding: 0 4px;
  cursor: pointer;
}

.dash-preview {
  margin: 2px 0;
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 2px 0;
}

.range-input {
  flex: 1;
  height: 16px;
  accent-color: var(--accent);
}
</style>
