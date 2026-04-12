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

const minVal = computed(() => props.element.dataSource?.minValue ?? 0)
const maxVal = computed(() => props.element.dataSource?.maxValue ?? 100)

const currentValue = computed(() => {
  const v = props.liveValue
  if (v == null) return (maxVal.value - minVal.value) * 0.5 + minVal.value
  const n = Number(v)
  return isNaN(n) ? minVal.value : n
})

const normalized = computed(() => {
  const range = maxVal.value - minVal.value
  if (range <= 0) return 0
  return Math.max(0, Math.min(1, (currentValue.value - minVal.value) / range))
})

const trackY = computed(() => props.element.y + props.element.height / 2)
const trackLeft = computed(() => props.element.x + 8)
const trackRight = computed(() => props.element.x + props.element.width - 8)
const trackWidth = computed(() => trackRight.value - trackLeft.value)
const thumbX = computed(() => trackLeft.value + trackWidth.value * normalized.value)
const thumbR = computed(() => Math.min(10, props.element.height / 2 - 2))

const strokeW = computed(() => 1 / viewportStore.viewport.scale)
const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Track background -->
    <rect
      :x="trackLeft" :y="trackY - 3"
      :width="trackWidth" :height="6"
      rx="3" fill="#444"
      :opacity="element.style.opacity"
    />
    <!-- Track fill -->
    <rect
      :x="trackLeft" :y="trackY - 3"
      :width="trackWidth * normalized" :height="6"
      rx="3" :fill="element.style.stroke"
      :opacity="element.style.opacity"
    />
    <!-- Thumb -->
    <circle
      :cx="thumbX" :cy="trackY" :r="thumbR"
      fill="white"
      :stroke="element.style.stroke"
      :stroke-width="2 * strokeW"
      :opacity="element.style.opacity"
    />
    <!-- Label -->
    <text
      v-if="element.label"
      :x="element.x + element.width / 2"
      :y="element.y + 12"
      :font-size="10"
      fill="#999"
      text-anchor="middle"
      dominant-baseline="central"
    >{{ element.label }}</text>
    <!-- Value -->
    <text
      :x="element.x + element.width / 2"
      :y="element.y + element.height - 6"
      font-size="10"
      :fill="element.style.stroke"
      text-anchor="middle"
      font-family="monospace"
    >{{ Math.round(currentValue) }}</text>
    <!-- Selection -->
    <rect v-if="selected"
      :x="element.x - selectionPadding" :y="element.y - selectionPadding"
      :width="element.width + selectionPadding * 2" :height="element.height + selectionPadding * 2"
      fill="none" stroke="#2196F3" :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3" pointer-events="none"
    />
  </g>
</template>
