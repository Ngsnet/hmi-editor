<script setup lang="ts">
import { useBuildingStore } from '@/stores/buildingStore'

const buildingStore = useBuildingStore()
</script>

<template>
  <div class="floor-switcher">
    <button
      v-for="floor in buildingStore.sortedFloors"
      :key="floor.id"
      class="floor-btn"
      :class="{ active: buildingStore.activeFloor === floor.id }"
      :title="floor.label"
      @click="buildingStore.setActiveFloor(floor.id)"
    >
      {{ floor.id }}
    </button>
  </div>
</template>

<style scoped>
.floor-switcher {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.floor-btn {
  width: 42px;
  height: 36px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary, #ccc);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.floor-btn:hover {
  background: var(--btn-hover, #333);
  border-color: var(--swatch-border, #555);
}

.floor-btn.active {
  background: var(--accent, #2196F3);
  color: white;
  border-color: var(--accent, #2196F3);
}
</style>
