<script setup lang="ts">
import { computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import type { Layer } from '@/types/diagram'
import CanvasElement from './CanvasElement.vue'

const props = defineProps<{
  layer: Layer
}>()

const diagramStore = useDiagramStore()

const layerElements = computed(() => diagramStore.elementsOnLayer(props.layer.id))
</script>

<template>
  <g
    :data-layer-id="layer.id"
    :visibility="layer.visible ? 'visible' : 'hidden'"
    :opacity="layer.opacity ?? 1"
  >
    <CanvasElement
      v-for="element in layerElements"
      :key="element.id"
      :element="element"
    />
  </g>
</template>
