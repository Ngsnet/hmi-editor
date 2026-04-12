<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const visualStrokeWidth = computed(() =>
  props.element.style.strokeWidth / viewportStore.viewport.scale
)

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <rect
      :x="element.x"
      :y="element.y"
      :width="element.width"
      :height="element.height"
      :fill="element.style.fill"
      :stroke="element.style.stroke"
      :stroke-width="visualStrokeWidth"
      :opacity="element.style.opacity"
    />
    <!-- Selection highlight -->
    <rect
      v-if="selected"
      :x="element.x - selectionPadding"
      :y="element.y - selectionPadding"
      :width="element.width + selectionPadding * 2"
      :height="element.height + selectionPadding * 2"
      fill="none"
      stroke="#2196F3"
      :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3"
      pointer-events="none"
    />
  </g>
</template>
