<script setup lang="ts">
import { computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useMapSync } from '@/composables/useMapSync'
import MapWidget from './MapWidget.vue'

const props = defineProps<{
  mapSync: ReturnType<typeof useMapSync>
}>()

const diagramStore = useDiagramStore()

const geoElements = computed(() =>
  diagramStore.diagram.elements.filter(el => el.geoPosition)
)
</script>

<template>
  <svg class="map-widget-overlay">
    <MapWidget
      v-for="el in geoElements"
      :key="el.id"
      :element="el"
      :position="props.mapSync.getPosition(el.id)"
      :selected="diagramStore.selectedElementIds.has(el.id)"
      @click="diagramStore.selectElement(el.id)"
    />
  </svg>
</template>

<style scoped>
.map-widget-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 500;
}
</style>
