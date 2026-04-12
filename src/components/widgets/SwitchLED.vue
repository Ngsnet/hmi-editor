<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
  liveValue?: unknown
}>()

const viewportStore = useViewportStore()

const cx = computed(() => props.element.x + props.element.width / 2)
const cy = computed(() => props.element.y + props.element.height / 2)
const radius = computed(() => Math.min(props.element.width, props.element.height) / 2 * 0.8)

const ledColor = computed(() => {
  const v = props.liveValue
  if (v == null) return '#999'     // no data → grey
  if (v === true || v === 1 || v === '1' || v === 'on') return '#4caf50'  // green
  return '#f44336'  // red
})

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
const labelFontSize = computed(() => Math.max(8, radius.value * 0.35))
</script>

<template>
  <g>
    <!-- LED circle -->
    <circle
      :cx="cx"
      :cy="cy"
      :r="radius"
      :fill="ledColor"
      :stroke="element.style.stroke"
      :stroke-width="2 / viewportStore.viewport.scale"
      :opacity="element.style.opacity"
    />
    <!-- Highlight -->
    <circle
      :cx="cx - radius * 0.25"
      :cy="cy - radius * 0.25"
      :r="radius * 0.3"
      fill="rgba(255,255,255,0.3)"
    />
    <!-- Label -->
    <text
      v-if="element.label"
      :x="cx"
      :y="cy + radius + labelFontSize * 1.2"
      :font-size="labelFontSize"
      fill="#666"
      text-anchor="middle"
    >
      {{ element.label }}
    </text>
    <!-- Selection -->
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
