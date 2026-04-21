<script setup lang="ts">
import { computed } from 'vue'
import type { Unit, MeterType } from '@/types/indoor'
import MeterWidget from './MeterWidget.vue'
import { useIndoorMap } from '@/composables/useIndoorMap'
import { useCemDataStore } from '@/stores/cemDataStore'

const props = defineProps<{
  unit: Unit
}>()

const emit = defineEmits<{
  close: []
}>()

const { exportUnitReport } = useIndoorMap()
const cemStore = useCemDataStore()

const hasCemBinding = computed(() =>
  props.unit.cemObjectIds && props.unit.cemObjectIds.length > 0
)

const cemMetersGrouped = computed(() => {
  const ids = props.unit.cemObjectIds
  if (!ids) return []
  return ids.map(objId => ({
    object: cemStore.objects.find(o => o.id === objId),
    meters: cemStore.getMetersForObject(objId),
  })).filter(g => g.object)
})

const categoryLabels: Record<string, string> = {
  fashion: 'Fashion',
  sport: 'Sport',
  food: 'Food & Drink',
  services: 'Služby',
  empty: 'Volná',
  technical: 'Technické',
}

const meterEntries = computed(() => {
  return (Object.entries(props.unit.meters) as [MeterType, any][])
    .filter(([, config]) => config != null)
})

const contractStartFormatted = computed(() => {
  if (!props.unit.contractStart) return null
  return new Date(props.unit.contractStart).toLocaleDateString('cs-CZ')
})

const contractEndFormatted = computed(() => {
  if (!props.unit.contractEnd) return null
  return new Date(props.unit.contractEnd).toLocaleDateString('cs-CZ')
})
</script>

<template>
  <div class="unit-panel" @click.stop @pointerdown.stop>
    <div class="panel-header">
      <div class="header-info">
        <h2 class="unit-name">{{ unit.name }}</h2>
        <span class="unit-meta">
          {{ unit.id }} · {{ unit.area }} m² · {{ categoryLabels[unit.category] || unit.category }}
        </span>
      </div>
      <button class="close-btn" title="Zavřít" @click="emit('close')">&times;</button>
    </div>

    <!-- Meters section -->
    <div class="panel-section">
      <div class="section-title">Měřidla</div>
      <template v-if="meterEntries.length > 0">
        <MeterWidget
          v-for="[meterType, config] in meterEntries"
          :key="meterType"
          :unit-id="unit.id"
          :meter-type="meterType"
          :config="config"
        />
      </template>
      <div v-else class="no-data">
        Žádná měřidla nejsou nakonfigurována
      </div>
    </div>

    <!-- CEM live meters -->
    <div v-if="hasCemBinding" class="panel-section">
      <div class="section-title">CEM měřidla</div>
      <div v-for="group in cemMetersGrouped" :key="group.object!.id" class="cem-group">
        <div class="cem-group-name">{{ group.object!.name }}</div>
        <div v-for="meter in group.meters" :key="meter.id" class="cem-meter">
          <div class="cem-meter-head">
            <span class="cem-meter-type">{{ meter.meterTypeName ?? 'Měřidlo' }}</span>
            <span class="cem-meter-sn">SN: {{ meter.serial ?? '—' }}</span>
          </div>
          <div v-for="counter in cemStore.getCountersForMeter(meter.id)" :key="counter.id" class="cem-counter">
            <span class="cem-counter-dot" :style="{ background: counter.color }" />
            <span class="cem-counter-label">{{ counter.typeName }}</span>
            <span class="cem-counter-val">
              <template v-if="counter.lastValue != null">{{ counter.lastValue }} {{ counter.unit }}</template>
              <template v-else>--</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Info section -->
    <div class="panel-section">
      <div class="section-title">Informace</div>
      <div class="info-grid">
        <template v-if="unit.tenant">
          <span class="info-label">Nájemník</span>
          <span class="info-value">{{ unit.tenant }}</span>
        </template>
        <template v-if="contractStartFormatted">
          <span class="info-label">Začátek nájmu</span>
          <span class="info-value">{{ contractStartFormatted }}</span>
        </template>
        <template v-if="contractEndFormatted">
          <span class="info-label">Konec nájmu</span>
          <span class="info-value">{{ contractEndFormatted }}</span>
        </template>
        <template v-if="unit.contactEmail">
          <span class="info-label">Kontakt</span>
          <span class="info-value">{{ unit.contactEmail }}</span>
        </template>
        <span class="info-label">Celková plocha</span>
        <span class="info-value">{{ unit.area }} m²</span>
        <span class="info-label">Pronajím. plocha</span>
        <span class="info-value">{{ unit.rentableArea }} m²</span>
        <span class="info-label">Započ. plocha</span>
        <span class="info-value">{{ unit.chargeableArea }} m²</span>
        <span class="info-label">Patro</span>
        <span class="info-value">{{ unit.floor }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="panel-actions">
      <button class="action-btn" @click="exportUnitReport(unit.id)">Export reportu</button>
      <button class="action-btn close-action" @click="emit('close')">Zavřít</button>
    </div>
  </div>
</template>

<style scoped>
.unit-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 320px;
  height: 100%;
  z-index: 700;
  background: var(--bg-primary, #1e1e1e);
  border-left: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.unit-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unit-meta {
  font-size: 12px;
  color: var(--text-muted, #999);
  margin-top: 4px;
  display: block;
}

.close-btn {
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  color: var(--text-muted, #999);
  font-size: 22px;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 6px;
  flex-shrink: 0;
  line-height: 1;
}

.close-btn:hover {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.panel-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent, #2196F3);
  margin-bottom: 8px;
  font-weight: 600;
}

.no-data {
  font-size: 12px;
  color: var(--text-muted, #999);
  font-style: italic;
  padding: 8px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  font-size: 12px;
}

.info-label {
  color: var(--text-muted, #999);
}

.info-value {
  color: var(--text-primary, #eee);
}

.panel-actions {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  background: var(--bg-secondary, #2a2a2a);
  color: var(--text-secondary, #ccc);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--btn-hover, #333);
  border-color: var(--accent, #2196F3);
  color: var(--text-primary, #eee);
}

.close-action {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
  color: #fff !important;
}

.close-action:hover {
  background: #b91c1c !important;
  border-color: #b91c1c !important;
}

.cem-group {
  margin-bottom: 8px;
}

.cem-group-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #999);
  margin-bottom: 4px;
}

.cem-meter {
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  margin-bottom: 6px;
  overflow: hidden;
}

.cem-meter-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--bg-secondary, #161616);
  font-size: 12px;
}

.cem-meter-type {
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.cem-meter-sn {
  font-family: monospace;
  font-size: 10px;
  color: var(--text-muted, #999);
}

.cem-counter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  border-top: 1px solid var(--border-light, #2a2a2a);
}

.cem-counter-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cem-counter-label {
  flex: 1;
  color: var(--text-secondary, #ccc);
}

.cem-counter-val {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary, #eee);
}
</style>
