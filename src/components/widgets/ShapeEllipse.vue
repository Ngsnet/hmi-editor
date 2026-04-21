<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'
import { strokeDashArray } from '@/utils/svgUtils'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const cx = computed(() => props.element.x + props.element.width / 2)
const cy = computed(() => props.element.y + props.element.height / 2)
const rx = computed(() => props.element.width / 2)
const ry = computed(() => props.element.height / 2)

const visualStrokeWidth = computed(() =>
  props.element.style.strokeWidth / viewportStore.viewport.scale
)

const dashArray = computed(() => strokeDashArray(props.element.style.strokeDash))

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <ellipse
      :cx="cx"
      :cy="cy"
      :rx="rx"
      :ry="ry"
      :fill="element.style.fill"
      :stroke="element.style.stroke"
      :stroke-width="visualStrokeWidth"
      :stroke-dasharray="dashArray"
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
