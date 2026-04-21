<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildingStore } from '@/stores/buildingStore'
import type { FloorId } from '@/types/indoor'

const buildingStore = useBuildingStore()
const router = useRouter()

const filterFloor = ref<FloorId | ''>('')

const categoryLabels: Record<string, string> = {
  fashion: 'Fashion',
  sport: 'Sport',
  food: 'Food & Drink',
  services: 'Služby',
  empty: 'Volná',
  technical: 'Technické',
}

const categoryColors: Record<string, string> = {
  fashion: '#a78bfa',
  sport: '#60a5fa',
  food: '#f59e0b',
  services: '#34d399',
  empty: '#6b7280',
  technical: '#f87171',
}

const filteredUnits = computed(() => {
  const units = buildingStore.building.units
  if (!filterFloor.value) return units
  return units.filter(u => u.floor === filterFloor.value)
})

function meterCount(unit: any): number {
  return Object.keys(unit.meters).length
}

function openUnit(id: string) {
  router.push({ name: 'admin-unit-detail', params: { id } })
}

const showAddForm = ref(false)
const newUnitName = ref('')
const newUnitFloor = ref<FloorId>(buildingStore.sortedFloors[0]?.id ?? '')
const newUnitCategory = ref('empty')

function addUnit() {
  const name = newUnitName.value.trim()
  if (!name) return
  const id = `unit-${Date.now()}`
  buildingStore.building.units.push({
    id,
    name,
    svgPathId: '',
    floor: newUnitFloor.value,
    area: 0,
    rentableArea: 0,
    chargeableArea: 0,
    tenant: '',
    category: newUnitCategory.value as any,
    meters: {},
  })
  showAddForm.value = false
  newUnitName.value = ''
  router.push({ name: 'admin-unit-detail', params: { id } })
}

function cancelAdd() {
  showAddForm.value = false
  newUnitName.value = ''
}
</script>

<template>
  <div class="unit-list-page">
    <div class="page-header">
      <h2 class="page-title">Obchodní jednotky</h2>
      <div class="header-actions">
        <select v-model="filterFloor" class="filter-select">
          <option value="">Všechna patra</option>
          <option v-for="f in buildingStore.sortedFloors" :key="f.id" :value="f.id">
            {{ f.label }} ({{ f.id }})
          </option>
        </select>
        <button class="btn btn-primary" @click="showAddForm = true">+ Přidat jednotku</button>
      </div>
    </div>

    <!-- Add unit form -->
    <div v-if="showAddForm" class="add-unit-form">
      <div class="add-unit-title">Nová jednotka</div>
      <div class="add-unit-grid">
        <label class="add-unit-label">
          <span>Název</span>
          <input v-model="newUnitName" type="text" class="add-unit-input" placeholder="např. Obchod A1" autofocus />
        </label>
        <label class="add-unit-label">
          <span>Patro</span>
          <select v-model="newUnitFloor" class="add-unit-input">
            <option v-for="f in buildingStore.sortedFloors" :key="f.id" :value="f.id">
              {{ f.label }} ({{ f.id }})
            </option>
          </select>
        </label>
        <label class="add-unit-label">
          <span>Kategorie</span>
          <select v-model="newUnitCategory" class="add-unit-input">
            <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
      </div>
      <div class="add-unit-actions">
        <button class="btn btn-primary btn-sm" :disabled="!newUnitName.trim()" @click="addUnit">Vytvořit</button>
        <button class="btn btn-ghost btn-sm" @click="cancelAdd">Zrušit</button>
      </div>
    </div>

    <div class="unit-table-wrap">
      <table class="unit-table">
        <thead>
          <tr>
            <th>Název</th>
            <th>Nájemník</th>
            <th>Patro</th>
            <th>Celk.</th>
            <th>Pronaj.</th>
            <th>Započ.</th>
            <th>Kategorie</th>
            <th>Měřidla</th>
            <th>SVG ID</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="unit in filteredUnits"
            :key="unit.id"
            class="unit-row"
            @click="openUnit(unit.id)"
          >
            <td class="cell-name">{{ unit.name }}</td>
            <td class="cell-tenant">{{ unit.tenant || '—' }}</td>
            <td>{{ unit.floor }}</td>
            <td>{{ unit.area }}</td>
            <td>{{ unit.rentableArea }}</td>
            <td>{{ unit.chargeableArea }}</td>
            <td>
              <span
                class="category-badge"
                :style="{ background: categoryColors[unit.category] + '22', color: categoryColors[unit.category] }"
              >
                {{ categoryLabels[unit.category] || unit.category }}
              </span>
            </td>
            <td class="cell-meters">{{ meterCount(unit) }}</td>
            <td class="cell-svg-id">{{ unit.svgPathId }}</td>
          </tr>
          <tr v-if="filteredUnits.length === 0">
            <td colspan="9" class="empty-row">Žádné jednotky k zobrazení</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="list-footer">
      Celkem: {{ filteredUnits.length }} jednotek
    </div>
  </div>
</template>

<style scoped>
.unit-list-page {
  max-width: 1000px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter-select {
  height: 34px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 6px;
  color: var(--input-text, #eee);
  font-size: 13px;
  padding: 0 10px;
  cursor: pointer;
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

.btn-primary {
  background: var(--accent, #2196F3);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.15);
}

.unit-table-wrap {
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  overflow: hidden;
}

.unit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.unit-table th {
  text-align: left;
  padding: 10px 14px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-muted, #999);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color, #333);
}

.unit-row {
  cursor: pointer;
  transition: background 0.1s;
}

.unit-row:hover {
  background: var(--btn-hover, #2a2a2a);
}

.unit-row td {
  padding: 10px 14px;
  color: var(--text-secondary, #ccc);
  border-bottom: 1px solid var(--border-color, #262626);
}

.cell-name {
  font-weight: 600;
  color: var(--text-primary, #eee) !important;
}

.cell-tenant {
  color: var(--text-muted, #999) !important;
}

.cell-meters {
  text-align: center;
}

.cell-svg-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-muted, #888) !important;
}

.category-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.empty-row {
  text-align: center;
  color: var(--text-muted, #999) !important;
  padding: 24px 14px !important;
  font-style: italic;
}

.list-footer {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted, #999);
}

.add-unit-form {
  background: var(--bg-primary, #1e1e1e);
  border: 2px solid var(--accent, #2196F3);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.add-unit-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #2196F3);
  margin-bottom: 12px;
}

.add-unit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.add-unit-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted, #999);
}

.add-unit-input {
  height: 34px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 6px;
  color: var(--input-text, #eee);
  font-size: 13px;
  padding: 0 10px;
}

.add-unit-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.add-unit-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 5px;
  cursor: pointer;
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted, #999);
  border: 1px solid var(--border-color, #444);
}

.btn-ghost:hover {
  border-color: var(--accent, #2196F3);
  color: var(--text-primary, #eee);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
