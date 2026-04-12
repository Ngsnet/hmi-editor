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
  if (v == null) return (maxVal.value - minVal.value) * 0.3 + minVal.value
  const n = Number(v)
  return isNaN(n) ? minVal.value : n
})

const normalized = computed(() => {
  const range = maxVal.value - minVal.value
  if (range <= 0) return 0
  return Math.max(0, Math.min(1, (currentValue.value - minVal.value) / range))
})

const barHeight = computed(() => Math.max(8, props.element.height * 0.4))
const barY = computed(() => props.element.y + (props.element.height - barHeight.value) / 2)
const radius = computed(() => Math.min(4, barHeight.value / 2))

const displayValue = computed(() => {
  const fmt = props.element.dataSource?.format
  if (fmt) return fmt.replace('{v}', String(Math.round(currentValue.value)))
  return `${Math.round(normalized.value * 100)}%`
})

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Background bar -->
    <rect
      :x="element.x" :y="barY"
      :width="element.width" :height="barHeight"
      :rx="radius" fill="#333"
      :opacity="element.style.opacity"
    />
    <!-- Fill bar -->
    <rect
      :x="element.x" :y="barY"
      :width="element.width * normalized" :height="barHeight"
      :rx="radius" :fill="element.style.stroke"
      :opacity="element.style.opacity"
    />
    <!-- Border -->
    <rect
      :x="element.x" :y="barY"
      :width="element.width" :height="barHeight"
      :rx="radius" fill="none"
      stroke="#555" :stroke-width="1 / viewportStore.viewport.scale"
    />
    <!-- Value text -->
    <text
      :x="element.x + element.width / 2"
      :y="barY + barHeight / 2"
      font-size="11"
      fill="white"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="monospace"
      font-weight="bold"
    >{{ displayValue }}</text>
    <!-- Label -->
    <text v-if="element.label"
      :x="element.x + element.width / 2"
      :y="element.y + 10"
      font-size="10" fill="#999"
      text-anchor="middle"
    >{{ element.label }}</text>
    <!-- Selection -->
    <rect v-if="selected"
      :x="element.x - selectionPadding" :y="element.y - selectionPadding"
      :width="element.width + selectionPadding * 2" :height="element.height + selectionPadding * 2"
      fill="none" stroke="#2196F3" :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3" pointer-events="none"
    />
  </g>
</template>
