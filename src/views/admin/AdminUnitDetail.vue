<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildingStore } from '@/stores/buildingStore'
import type { MeterType, MeterConfig, UnitCategory } from '@/types/indoor'
import { loadFloorplanSvg } from '@/utils/floorplanStorage'

const props = defineProps<{
  id: string
}>()

const buildingStore = useBuildingStore()
const router = useRouter()

const unit = computed(() =>
  buildingStore.building.units.find(u => u.id === props.id)
)

// Redirect if unit not found
if (!unit.value) {
  router.replace({ name: 'admin-units' })
}

const categories: { value: UnitCategory; label: string }[] = [
  { value: 'fashion', label: 'Fashion' },
  { value: 'sport', label: 'Sport' },
  { value: 'food', label: 'Food & Drink' },
  { value: 'services', label: 'Služby' },
  { value: 'empty', label: 'Volná' },
  { value: 'technical', label: 'Technické' },
]

const meterTypes: { type: MeterType; label: string; icon: string; defaultUnit: string }[] = [
  { type: 'water', label: 'Vodoměr', icon: '\uD83D\uDCA7', defaultUnit: 'm\u00B3' },
  { type: 'electric', label: 'Elektroměr', icon: '\u26A1', defaultUnit: 'kWh' },
  { type: 'cooling', label: 'Chlazení', icon: '\uD83D\uDD35', defaultUnit: 'GJ' },
  { type: 'heating', label: 'Topení', icon: '\uD83D\uDD34', defaultUnit: 'GJ' },
]

const intervals = [
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1 min' },
  { value: 300000, label: '5 min' },
]

// Meter enable toggles
const meterEnabled = reactive<Record<MeterType, boolean>>({
  water: !!unit.value?.meters.water,
  electric: !!unit.value?.meters.electric,
  cooling: !!unit.value?.meters.cooling,
  heating: !!unit.value?.meters.heating,
})

function toggleMeter(mt: MeterType, enabled: boolean) {
  if (!unit.value) return
  if (enabled) {
    const def = meterTypes.find(m => m.type === mt)!
    unit.value.meters[mt] = {
      deviceId: '',
      endpoint: `mock://${mt}`,
      valueKey: 'value',
      unit: def.defaultUnit,
      interval: 30000,
    }
  } else {
    delete unit.value.meters[mt]
  }
  meterEnabled[mt] = enabled
}

function getMeterConfig(mt: MeterType): MeterConfig {
  return unit.value!.meters[mt]!
}

// SVG ID verification
const svgVerifyResult = ref<'ok' | 'not-found' | null>(null)

async function verifySvgId() {
  if (!unit.value) return
  const floor = buildingStore.building.floors.find(f => f.id === unit.value!.floor)
  if (!floor) { svgVerifyResult.value = 'not-found'; return }

  try {
    const text = await loadFloorplanSvg(floor.id)
    if (!text) { svgVerifyResult.value = 'not-found'; return }
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'image/svg+xml')
    const el = doc.getElementById(unit.value.svgPathId)
    svgVerifyResult.value = el ? 'ok' : 'not-found'
  } catch {
    svgVerifyResult.value = 'not-found'
  }
}

// Test meter endpoint
const testResults = reactive<Record<string, string>>({})

async function testMeter(mt: MeterType) {
  const config = unit.value?.meters[mt]
  if (!config) return

  if (config.endpoint.startsWith('mock://')) {
    const type = config.endpoint.replace('mock://', '')
    const mockValues: Record<string, number> = {
      water: +(0.1 + Math.random() * 2).toFixed(2),
      electric: +(10 + Math.random() * 50).toFixed(1),
      cooling: +(0.5 + Math.random() * 3).toFixed(2),
      heating: +(1 + Math.random() * 5).toFixed(2),
    }
    testResults[mt] = `OK: ${mockValues[type] ?? Math.random().toFixed(2)} ${config.unit}`
    return
  }

  try {
    const res = await fetch(config.endpoint)
    if (!res.ok) { testResults[mt] = `Chyba: HTTP ${res.status}`; return }
    const data = await res.json()
    const value = config.valueKey.split('.').reduce((obj: any, k) => obj?.[k], data)
    testResults[mt] = `OK: ${value} ${config.unit}`
  } catch (e) {
    testResults[mt] = `Chyba: ${(e as Error).message}`
  }
}

function deleteUnit() {
  if (!unit.value) return
  const idx = buildingStore.building.units.findIndex(u => u.id === props.id)
  if (idx >= 0) {
    buildingStore.building.units.splice(idx, 1)
  }
  router.push({ name: 'admin-units' })
}
</script>

<template>
  <div v-if="unit" class="unit-detail-page">
    <div class="page-header">
      <button class="btn btn-ghost" @click="router.push({ name: 'admin-units' })">&larr; Zpět</button>
      <h2 class="page-title">{{ unit.name }}</h2>
      <button class="btn btn-danger" @click="deleteUnit">Smazat</button>
    </div>

    <!-- Unit form -->
    <section class="form-section">
      <h3 class="section-title">Základní údaje</h3>
      <div class="form-grid">
        <label class="form-label">
          <span>Název</span>
          <input v-model="unit.name" type="text" class="form-input" />
        </label>
        <label class="form-label">
          <span>Nájemník</span>
          <input v-model="unit.tenant" type="text" class="form-input" />
        </label>
        <label class="form-label">
          <span>Kategorie</span>
          <select v-model="unit.category" class="form-input">
            <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>
        <label class="form-label">
          <span>Celková plocha (m²)</span>
          <input v-model.number="unit.area" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>Pronajímatelná plocha (m²)</span>
          <input v-model.number="unit.rentableArea" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>Započítávaná plocha (m²)</span>
          <input v-model.number="unit.chargeableArea" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>Patro</span>
          <select v-model="unit.floor" class="form-input">
            <option v-for="f in buildingStore.sortedFloors" :key="f.id" :value="f.id">
              {{ f.label }} ({{ f.id }})
            </option>
          </select>
        </label>
        <label class="form-label">
          <span>SVG Path ID</span>
          <div class="input-with-btn">
            <input v-model="unit.svgPathId" type="text" class="form-input" />
            <button class="btn btn-sm" @click="verifySvgId">Ověřit</button>
          </div>
          <span v-if="svgVerifyResult === 'ok'" class="verify-ok">Nalezeno v SVG</span>
          <span v-else-if="svgVerifyResult === 'not-found'" class="verify-fail">Nenalezeno v SVG</span>
        </label>
        <label class="form-label">
          <span>Kontaktní email</span>
          <input v-model="unit.contactEmail" type="email" class="form-input" />
        </label>
        <label class="form-label">
          <span>Začátek nájmu</span>
          <input v-model="unit.contractStart" type="date" class="form-input" />
        </label>
        <label class="form-label">
          <span>Konec nájmu</span>
          <input v-model="unit.contractEnd" type="date" class="form-input" />
        </label>
      </div>
    </section>

    <!-- Meters -->
    <section class="form-section">
      <h3 class="section-title">Konfigurace měřidel</h3>
      <div v-for="mt in meterTypes" :key="mt.type" class="meter-block">
        <label class="meter-toggle">
          <input
            type="checkbox"
            :checked="meterEnabled[mt.type]"
            @change="toggleMeter(mt.type, ($event.target as HTMLInputElement).checked)"
          />
          <span class="meter-toggle-icon">{{ mt.icon }}</span>
          <span class="meter-toggle-label">{{ mt.label }}</span>
        </label>

        <div v-if="meterEnabled[mt.type] && unit.meters[mt.type]" class="meter-config">
          <div class="meter-grid">
            <label class="form-label">
              <span>Device ID</span>
              <input v-model="getMeterConfig(mt.type).deviceId" type="text" class="form-input" />
            </label>
            <label class="form-label">
              <span>API endpoint</span>
              <input v-model="getMeterConfig(mt.type).endpoint" type="text" class="form-input" placeholder="mock://water nebo /api/meters/..." />
            </label>
            <label class="form-label">
              <span>Value key</span>
              <input v-model="getMeterConfig(mt.type).valueKey" type="text" class="form-input" />
            </label>
            <label class="form-label">
              <span>Jednotka</span>
              <select v-model="getMeterConfig(mt.type).unit" class="form-input">
                <option value="m³">m³</option>
                <option value="kWh">kWh</option>
                <option value="GJ">GJ</option>
                <option value="MWh">MWh</option>
              </select>
            </label>
            <label class="form-label">
              <span>Polling interval</span>
              <select v-model.number="getMeterConfig(mt.type).interval" class="form-input">
                <option v-for="i in intervals" :key="i.value" :value="i.value">{{ i.label }}</option>
              </select>
            </label>
            <label class="form-label">
              <span>Alert threshold</span>
              <input v-model.number="getMeterConfig(mt.type).alertThreshold" type="number" min="0" class="form-input" placeholder="volitelné" />
            </label>
            <label class="form-label">
              <span>Denní limit</span>
              <input v-model.number="getMeterConfig(mt.type).dailyLimit" type="number" min="0" class="form-input" placeholder="volitelné" />
            </label>
            <div class="form-label">
              <span>&nbsp;</span>
              <button class="btn btn-sm" @click="testMeter(mt.type)">Test</button>
              <span v-if="testResults[mt.type]" class="test-result" :class="{ 'test-ok': testResults[mt.type].startsWith('OK') }">
                {{ testResults[mt.type] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.unit-detail-page {
  max-width: 800px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin: 0;
  flex: 1;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted, #999);
  border: 1px solid var(--border-color, #333);
}

.btn-ghost:hover {
  background: var(--btn-hover, #333);
  color: var(--text-primary, #eee);
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-secondary, #ccc);
  border: 1px solid var(--border-color, #444);
  border-radius: 5px;
  cursor: pointer;
}

.btn-sm:hover {
  border-color: var(--accent, #2196F3);
}

.form-section {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #2196F3);
  margin: 0 0 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted, #999);
}

.form-input {
  height: 34px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 6px;
  color: var(--input-text, #eee);
  font-size: 13px;
  padding: 0 10px;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.input-with-btn {
  display: flex;
  gap: 6px;
}

.input-with-btn .form-input {
  flex: 1;
}

.verify-ok {
  color: #22c55e;
  font-size: 11px;
}

.verify-fail {
  color: #ef4444;
  font-size: 11px;
}

.meter-block {
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.meter-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary, #eee);
  background: var(--bg-secondary, #161616);
}

.meter-toggle input[type="checkbox"] {
  accent-color: var(--accent, #2196F3);
}

.meter-toggle-icon {
  font-size: 16px;
}

.meter-toggle-label {
  font-weight: 600;
  font-size: 13px;
}

.meter-config {
  padding: 14px;
  border-top: 1px solid var(--border-color, #333);
}

.meter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.test-result {
  font-size: 11px;
  color: #ef4444;
  margin-top: 2px;
}

.test-result.test-ok {
  color: #22c55e;
}
</style>
