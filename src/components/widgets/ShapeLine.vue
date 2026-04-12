<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const x1 = computed(() => props.element.points?.[0]?.x ?? props.element.x)
const y1 = computed(() => props.element.points?.[0]?.y ?? props.element.y)
const x2 = computed(() => props.element.points?.[1]?.x ?? (props.element.x + props.element.width))
const y2 = computed(() => props.element.points?.[1]?.y ?? (props.element.y + props.element.height))

const visualStrokeWidth = computed(() =>
  props.element.style.strokeWidth / viewportStore.viewport.scale
)

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const hitAreaWidth = computed(() => 10 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Invisible wider hit area for easier clicking -->
    <line
      :x1="x1" :y1="y1"
      :x2="x2" :y2="y2"
      stroke="transparent"
      :stroke-width="hitAreaWidth"
    />
    <line
      :x1="x1" :y1="y1"
      :x2="x2" :y2="y2"
      :stroke="element.style.stroke"
      :stroke-width="visualStrokeWidth"
      :opacity="element.style.opacity"
    />
    <!-- Selection highlight -->
    <line
      v-if="selected"
      :x1="x1" :y1="y1"
      :x2="x2" :y2="y2"
      stroke="#2196F3"
      :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3"
      pointer-events="none"
    />
  </g>
</template>
