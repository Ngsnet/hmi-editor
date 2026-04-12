<script setup lang="ts">
import { computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'

const diagramStore = useDiagramStore()

const selected = computed(() => diagramStore.selectedElements)
const single = computed(() => selected.value.length === 1 ? selected.value[0]! : null)

function updateProp(key: string, value: unknown) {
  if (!single.value) return
  diagramStore.updateElement(single.value.id, { [key]: value } as any)
}
</script>

<template>
  <div class="property-panel">
    <div class="panel-header">Properties</div>

    <!-- No selection -->
    <div v-if="selected.length === 0" class="panel-empty">
      No element selected
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
  background: #1e1e1e;
  color: #ccc;
  font-size: 12px;
  overflow-y: auto;
  user-select: none;
}

.panel-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #333;
  color: #eee;
}

.panel-empty {
  padding: 20px 12px;
  color: #666;
  text-align: center;
}

.panel-body {
  padding: 4px 0;
}

.prop-section {
  padding: 6px 12px;
  border-bottom: 1px solid #2a2a2a;
}

.section-title {
  font-size: 11px;
  color: #888;
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
  color: #999;
  min-width: 16px;
}

.prop-row input[type="number"] {
  flex: 1;
  min-width: 0;
  height: 24px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 3px;
  color: #ccc;
  text-align: center;
  font-size: 12px;
  padding: 0 4px;
}

.prop-row input[type="checkbox"] {
  accent-color: #2196F3;
}

.text-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 3px;
  color: #ccc;
  font-size: 12px;
  padding: 0 6px;
}

.hint {
  color: #666;
  font-size: 11px;
  margin: 4px 0 0;
}
</style>
