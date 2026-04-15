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

function addUnit() {
  const id = `unit-${Date.now()}`
  buildingStore.building.units.push({
    id,
    name: 'Nová jednotka',
    svgPathId: id,
    floor: buildingStore.activeFloor,
    area: 0,
    rentableArea: 0,
    chargeableArea: 0,
    tenant: '',
    category: 'empty',
    meters: {},
  })
  router.push({ name: 'admin-unit-detail', params: { id } })
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
        <button class="btn btn-primary" @click="addUnit">+ Přidat jednotku</button>
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
</style>
