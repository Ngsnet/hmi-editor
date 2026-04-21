<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildingStore } from '@/stores/buildingStore'
import { useCemDataStore } from '@/stores/cemDataStore'
import type { MeterType, MeterConfig, UnitCategory, MediaLayer, CounterLayerAssignment } from '@/types/indoor'
import type { CemObject } from '@/types/cem'
import { loadFloorplanSvg } from '@/utils/floorplanStorage'
import { cemService } from '@/services/cem.service'
import CemTreeLevel from '@/components/admin/CemTreeLevel.vue'

const props = defineProps<{
  id: string
}>()

const buildingStore = useBuildingStore()
const cemStore = useCemDataStore()
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

// =====================
// CEM Data Integration
// =====================

const cemSearch = ref('')
const cemMode = ref<'search' | 'tree'>('search')
const cemExpanded = ref<Set<number>>(new Set())
const sparklines = reactive<Map<number, number[]>>(new Map())

// Load CEM data on mount
onMounted(async () => {
  if (!cemStore.isLoaded && !cemStore.isLoading) {
    await cemStore.fetchAll()
  }
})

// Root objects for the tree picker
const cemRootObjects = computed(() => cemStore.rootObjects)

// Filtered install points matching search
const filteredInstallPoints = computed(() => {
  const q = cemSearch.value.toLowerCase().trim()
  if (!q) return []
  return cemStore.installPoints.filter(o =>
    o.name.toLowerCase().includes(q) || (o.path ?? '').toLowerCase().includes(q)
  )
})

// Currently assigned CEM objects
const assignedCemObjects = computed<CemObject[]>(() => {
  const ids = unit.value?.cemObjectIds
  if (!ids || ids.length === 0) return []
  return ids.map(id => cemStore.objects.find(o => o.id === id)).filter((o): o is CemObject => !!o)
})

const hasCemBinding = computed(() => assignedCemObjects.value.length > 0)

// Meters for all assigned CEM objects
const cemMetersGrouped = computed(() => {
  const ids = unit.value?.cemObjectIds
  if (!ids) return []
  return ids.map(objId => ({
    object: cemStore.objects.find(o => o.id === objId),
    meters: cemStore.getMetersForObject(objId),
  })).filter(g => g.object)
})

function assignCemObject(objectId: number) {
  if (!unit.value) return
  if (!unit.value.cemObjectIds) unit.value.cemObjectIds = []
  if (unit.value.cemObjectIds.includes(objectId)) return
  unit.value.cemObjectIds.push(objectId)
  cemSearch.value = ''
  loadAllSparklines()
}

function removeCemObject(objectId: number) {
  if (!unit.value?.cemObjectIds) return
  unit.value.cemObjectIds = unit.value.cemObjectIds.filter(id => id !== objectId)
  if (unit.value.cemObjectIds.length === 0) {
    unit.value.cemObjectIds = undefined
    sparklines.clear()
  }
}

function clearAllCemObjects() {
  if (!unit.value) return
  unit.value.cemObjectIds = undefined
  sparklines.clear()
}

function toggleExpand(objectId: number) {
  if (cemExpanded.value.has(objectId)) cemExpanded.value.delete(objectId)
  else cemExpanded.value.add(objectId)
}

// Sparkline: fetch 48h history for a counter and store as number[]
async function loadSparkline(varId: number) {
  if (sparklines.has(varId)) return
  const history = await cemStore.fetchHistory48h(varId)
  // Downsample to ~48 points (1 per hour)
  const points = history.map(h => h.value)
  if (points.length > 48) {
    const step = Math.floor(points.length / 48)
    sparklines.set(varId, points.filter((_, i) => i % step === 0))
  } else {
    sparklines.set(varId, points)
  }
}

async function loadAllSparklines() {
  const ids = unit.value?.cemObjectIds
  if (!ids || ids.length === 0) return
  for (const objId of ids) {
    const counters = cemStore.getCountersForObject(objId)
    for (const c of counters) {
      loadSparkline(c.id)
    }
  }
}

// Draw sparkline on a canvas element
function drawSparkline(canvas: HTMLCanvasElement | null, values: number[]) {
  if (!canvas || values.length < 2) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#2196F3'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  for (let i = 0; i < values.length; i++) {
    const x = (i / (values.length - 1)) * w
    const y = h - ((values[i]! - min) / range) * (h - 4) - 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// =====================
// Layer assignment
// =====================

const mediaLayerLabels: Record<MediaLayer, { label: string; icon: string }> = {
  water: { label: 'Voda', icon: '\uD83D\uDCA7' },
  electric: { label: 'Elektřina', icon: '\u26A1' },
  heat: { label: 'Teplo', icon: '\uD83D\uDD34' },
  cool: { label: 'Chlad', icon: '\uD83D\uDD35' },
  temperature: { label: 'Teplota', icon: '\uD83C\uDF21' },
  other: { label: 'Ostatní', icon: '\u2022' },
}

const allMediaLayers: MediaLayer[] = ['water', 'electric', 'heat', 'cool', 'temperature', 'other']

// All CEM counters for this unit (across all assigned objects)
const allCemCounters = computed(() => {
  if (!unit.value?.cemObjectIds) return []
  const counters: Array<{ varId: number; meterId: number; typeName: string; unit: string; color: string; lastValue: number | null }> = []
  for (const objId of unit.value.cemObjectIds) {
    for (const c of cemStore.getCountersForObject(objId)) {
      if (c.isService) continue
      counters.push({ varId: c.id, meterId: c.meterId, typeName: c.typeName, unit: c.unit, color: c.color, lastValue: c.lastValue })
    }
  }
  return counters
})

function getLayerForCounter(varId: number): MediaLayer {
  const assignment = unit.value?.counterLayers?.find(a => a.varId === varId)
  return assignment?.layer ?? 'other'
}

function setCounterLayer(varId: number, layer: MediaLayer) {
  if (!unit.value) return
  if (!unit.value.counterLayers) unit.value.counterLayers = []
  const existing = unit.value.counterLayers.find(a => a.varId === varId)
  if (existing) {
    existing.layer = layer
    existing.auto = false
  } else {
    unit.value.counterLayers.push({ varId, layer, auto: false })
  }
}

function autoAssignLayers() {
  if (!unit.value?.cemObjectIds) return
  if (!unit.value.counterLayers) unit.value.counterLayers = []

  for (const c of allCemCounters.value) {
    const existing = unit.value.counterLayers.find(a => a.varId === c.varId)
    // Only auto-assign if no manual override exists
    if (!existing) {
      const layer = cemService.detectMediaLayer({ typeName: c.typeName, unit: c.unit })
      unit.value.counterLayers.push({ varId: c.varId, layer, auto: true })
    }
  }

  // Remove assignments for counters that no longer exist
  const validIds = new Set(allCemCounters.value.map(c => c.varId))
  unit.value.counterLayers = unit.value.counterLayers.filter(a => validIds.has(a.varId))
}

// Watch cemObjectIds changes — load sparklines + auto-assign layers
watch(() => unit.value?.cemObjectIds, () => {
  loadAllSparklines()
  autoAssignLayers()
}, { immediate: true, deep: true })

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

    <!-- Layer assignment -->
    <section v-if="allCemCounters.length > 0" class="form-section">
      <h3 class="section-title">Přiřazení do vrstev</h3>
      <p class="layer-hint">Počitadla jsou automaticky přiřazena dle typu. Můžete změnit vrstvu ručně.</p>
      <table class="layer-table">
        <thead>
          <tr>
            <th>Počitadlo</th>
            <th>Hodnota</th>
            <th>Jednotka</th>
            <th>Vrstva</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in allCemCounters" :key="c.varId" class="layer-row">
            <td>
              <span class="cem-counter-dot" :style="{ background: c.color }" />
              {{ c.typeName }}
            </td>
            <td class="layer-value">{{ c.lastValue != null ? c.lastValue : '--' }}</td>
            <td class="layer-unit">{{ c.unit }}</td>
            <td>
              <select
                class="layer-select"
                :value="getLayerForCounter(c.varId)"
                @change="setCounterLayer(c.varId, ($event.target as HTMLSelectElement).value as MediaLayer)"
              >
                <option v-for="ml in allMediaLayers" :key="ml" :value="ml">
                  {{ mediaLayerLabels[ml].icon }} {{ mediaLayerLabels[ml].label }}
                </option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- CEM Data Binding -->
    <section class="form-section">
      <h3 class="section-title">CEM Napojení</h3>

      <!-- Loading state -->
      <div v-if="cemStore.isLoading" class="cem-loading">Načítám CEM data...</div>
      <div v-else-if="cemStore.error" class="cem-error">{{ cemStore.error }}</div>

      <template v-else>
        <!-- Assigned objects list -->
        <div v-if="hasCemBinding" class="cem-assigned">
          <div class="cem-assigned-toolbar">
            <span class="cem-assigned-count">{{ assignedCemObjects.length }} install point{{ assignedCemObjects.length > 1 ? 'ů' : '' }}</span>
            <button class="btn btn-sm btn-danger-sm" @click="clearAllCemObjects">Odpojit vše</button>
          </div>

          <div v-for="group in cemMetersGrouped" :key="group.object!.id" class="cem-object-group">
            <div class="cem-assigned-header">
              <div class="cem-assigned-info">
                <span class="cem-assigned-name">{{ group.object!.name }}</span>
                <span class="cem-assigned-path">{{ group.object!.path }}</span>
              </div>
              <button class="btn btn-sm btn-danger-sm" @click="removeCemObject(group.object!.id)">Odebrat</button>
            </div>

            <div v-if="group.meters.length === 0" class="cem-no-meters">Žádná měřidla</div>
            <div v-for="meter in group.meters" :key="meter.id" class="cem-meter-card">
              <div class="cem-meter-header">
                <span class="cem-meter-type">{{ meter.meterTypeName ?? 'Měřidlo' }}</span>
                <span class="cem-meter-serial">SN: {{ meter.serial ?? '—' }}</span>
              </div>
              <div class="cem-meter-meta">
                <span v-if="meter.validFrom">Od: {{ meter.validFrom }}</span>
                <span v-if="meter.isBilling" class="cem-badge">Fakturační</span>
              </div>

              <div v-for="counter in cemStore.getCountersForMeter(meter.id)" :key="counter.id" class="cem-counter-row">
                <div class="cem-counter-info">
                  <span class="cem-counter-dot" :style="{ background: counter.color }" />
                  <span class="cem-counter-name">{{ counter.typeName }}</span>
                  <span class="cem-counter-unit">[{{ counter.unit }}]</span>
                </div>
                <div class="cem-counter-value">
                  <span v-if="counter.lastValue != null" class="cem-value">{{ counter.lastValue }}</span>
                  <span v-else class="cem-value cem-value-none">--</span>
                  <span v-if="counter.lastTime" class="cem-time">{{ counter.lastTime }}</span>
                </div>
                <canvas
                  v-if="sparklines.has(counter.id) && (sparklines.get(counter.id)?.length ?? 0) > 1"
                  :ref="(el) => { if (el) drawSparkline(el as HTMLCanvasElement, sparklines.get(counter.id)!) }"
                  class="cem-sparkline"
                  width="120"
                  height="28"
                />
                <span v-else class="cem-sparkline-empty">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Object picker (always visible to add more) -->
        <div class="cem-picker">
          <div v-if="!hasCemBinding" class="cem-help">
            <div class="cem-help-title">Jak napojit živá data?</div>
            <ol class="cem-help-steps">
              <li>Vyhledejte install point (IP) v poli níže nebo procházejte strom objektů.</li>
              <li>Klikněte na objekt typu <span class="cem-badge cem-badge-ip">IP</span> pro přiřazení k této jednotce.</li>
              <li>Můžete přiřadit více install pointů — každý přidá svá měřidla.</li>
              <li>Pro odebrání klikněte "Odebrat" u konkrétního objektu.</li>
            </ol>
          </div>
          <div v-else class="cem-add-more-label">Přidat další install point:</div>

          <!-- Mode tabs: search vs tree -->
          <div class="cem-mode-tabs">
            <button class="cem-mode-tab" :class="{ active: cemMode === 'search' }" @click="cemMode = 'search'">Hledání</button>
            <button class="cem-mode-tab" :class="{ active: cemMode === 'tree' }" @click="cemMode = 'tree'">Strom objektů</button>
          </div>

          <template v-if="cemMode === 'search'">
            <input
              v-model="cemSearch"
              type="text"
              class="form-input cem-search"
              placeholder="Hledejte CEM objekt (název nebo cesta)..."
            />
            <div v-if="cemSearch && filteredInstallPoints.length > 0" class="cem-results">
              <div
                v-for="obj in filteredInstallPoints.slice(0, 20)"
                :key="obj.id"
                class="cem-result-item"
                :class="{ 'already-assigned': unit?.cemObjectIds?.includes(obj.id) }"
                @click="assignCemObject(obj.id)"
              >
                <span class="cem-result-name">{{ obj.name }}</span>
                <span class="cem-result-path">{{ obj.path }}</span>
                <span v-if="unit?.cemObjectIds?.includes(obj.id)" class="cem-badge">Přiřazeno</span>
              </div>
            </div>
            <div v-else-if="cemSearch && filteredInstallPoints.length === 0" class="cem-no-results">
              Žádné výsledky
            </div>
            <div v-else-if="!cemSearch" class="cem-no-results">
              Zadejte název nebo cestu pro vyhledání install pointu.
            </div>
          </template>

          <div v-if="cemMode === 'tree'" class="cem-tree">
            <CemTreeLevel
              :objects="cemRootObjects"
              :depth="0"
              :expanded="cemExpanded"
              :cem-store="cemStore"
              @toggle="toggleExpand"
              @select="assignCemObject"
            />
          </div>
        </div>
      </template>
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

/* CEM Integration */

.cem-loading, .cem-error, .cem-no-meters, .cem-no-results {
  font-size: 12px;
  color: var(--text-muted, #999);
  padding: 8px 0;
}

.cem-error { color: #ef4444; }

.cem-assigned-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--bg-secondary, #161616);
  border-radius: 8px;
}

.cem-assigned-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cem-assigned-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.cem-assigned-path {
  font-size: 11px;
  color: var(--text-muted, #999);
  font-family: monospace;
}

.btn-danger-sm {
  padding: 4px 10px;
  font-size: 11px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger-sm:hover { background: #b91c1c; }

.cem-assigned-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cem-assigned-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #ccc);
}

.cem-object-group {
  margin-bottom: 14px;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 8px;
}

.cem-confirm-panel {
  border: 2px solid var(--accent, #2196F3);
  border-radius: 8px;
  padding: 12px;
  margin: 10px 0;
  background: var(--bg-secondary, #161616);
}

.cem-confirm-header {
  margin-bottom: 8px;
}

.cem-confirm-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #2196F3);
}

.cem-confirm-object {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.cem-confirm-meters {
  margin-bottom: 10px;
}

.cem-confirm-meters-label {
  font-size: 11px;
  color: var(--text-muted, #999);
  display: block;
  margin-bottom: 4px;
}

.cem-confirm-meter-item {
  font-size: 12px;
  color: var(--text-secondary, #ccc);
  padding: 2px 0;
}

.cem-confirm-actions {
  display: flex;
  gap: 8px;
}

.cem-confirm-btn {
  background: var(--accent, #2196F3) !important;
  color: white !important;
  border: none !important;
}

.cem-confirm-btn:hover {
  filter: brightness(1.15);
}

.btn-ghost-sm {
  padding: 5px 12px;
  font-size: 12px;
  background: transparent;
  color: var(--text-muted, #999);
  border: 1px solid var(--border-color, #444);
  border-radius: 5px;
  cursor: pointer;
}

.btn-ghost-sm:hover {
  border-color: var(--accent, #2196F3);
  color: var(--text-primary, #eee);
}

.layer-hint {
  font-size: 11px;
  color: var(--text-muted, #999);
  margin: 0 0 10px;
}

.layer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.layer-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #999);
  border-bottom: 1px solid var(--border-color, #333);
}

.layer-row td {
  padding: 6px 10px;
  color: var(--text-secondary, #ccc);
  border-bottom: 1px solid var(--border-light, #2a2a2a);
  vertical-align: middle;
}

.layer-row td:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}

.layer-value {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.layer-unit {
  color: var(--text-muted, #999);
}

.layer-select {
  height: 28px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 5px;
  color: var(--input-text, #eee);
  font-size: 12px;
  padding: 0 6px;
  cursor: pointer;
}

.layer-select:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.cem-add-more-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #999);
  margin-bottom: 8px;
  margin-top: 12px;
}

.cem-result-item.already-assigned {
  opacity: 0.5;
  cursor: default;
}

.cem-meter-card {
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}

.cem-meter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary, #161616);
}

.cem-meter-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.cem-meter-serial {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted, #999);
}

.cem-meter-meta {
  display: flex;
  gap: 10px;
  padding: 4px 12px 6px;
  font-size: 11px;
  color: var(--text-muted, #999);
  border-bottom: 1px solid var(--border-color, #333);
}

.cem-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--accent, #2196F3);
  color: white;
  font-weight: 600;
}

.cem-badge-ip {
  background: #16a34a;
  font-size: 9px;
}

.cem-counter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-light, #2a2a2a);
}

.cem-counter-row:last-child { border-bottom: none; }

.cem-counter-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 140px;
}

.cem-counter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cem-counter-name {
  font-size: 12px;
  color: var(--text-secondary, #ccc);
}

.cem-counter-unit {
  font-size: 10px;
  color: var(--text-muted, #999);
}

.cem-counter-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}

.cem-value {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  color: var(--text-primary, #eee);
}

.cem-value-none { color: var(--text-muted, #666); }

.cem-time {
  font-size: 10px;
  color: var(--text-dim, #666);
}

.cem-sparkline {
  flex-shrink: 0;
  border-radius: 4px;
  background: var(--bg-secondary, #161616);
}

.cem-sparkline-empty {
  width: 120px;
  text-align: center;
  color: var(--text-dim, #444);
  font-size: 10px;
}

/* Picker */

.cem-help {
  background: var(--bg-secondary, #161616);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 10px;
}

.cem-help-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #2196F3);
  margin-bottom: 6px;
}

.cem-help-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-muted, #999);
  line-height: 1.6;
}

.cem-help-steps li { margin-bottom: 2px; }

.cem-mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 10px;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  overflow: hidden;
}

.cem-mode-tab {
  flex: 1;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  border: none;
  background: var(--bg-secondary, #161616);
  color: var(--text-muted, #999);
  transition: all 0.15s;
}

.cem-mode-tab.active {
  background: var(--accent, #2196F3);
  color: white;
}

.cem-mode-tab:not(.active):hover {
  background: var(--btn-hover, #333);
  color: var(--text-primary, #eee);
}

.cem-search {
  margin-bottom: 8px;
}

.cem-results {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
}

.cem-result-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light, #2a2a2a);
  transition: background 0.1s;
}

.cem-result-item:hover { background: var(--btn-hover, #333); }
.cem-result-item:last-child { border-bottom: none; }

.cem-result-name {
  font-size: 13px;
  color: var(--text-primary, #eee);
  font-weight: 500;
}

.cem-result-path {
  font-size: 10px;
  color: var(--text-muted, #999);
  font-family: monospace;
}

/* Tree */

.cem-tree {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  padding: 4px 0;
}

.cem-tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary, #ccc);
  transition: background 0.1s;
}

.cem-tree-node:hover { background: var(--btn-hover, #333); }
.cem-tree-node.is-install-point { color: var(--text-primary, #eee); }

.cem-tree-toggle {
  width: 12px;
  font-size: 10px;
  color: var(--text-muted, #999);
  text-align: center;
}

.cem-tree-label { flex: 1; }
</style>
