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

const isOn = computed(() => {
  const v = props.liveValue
  if (v == null) return false
  return v === true || v === 1 || v === '1' || v === 'on'
})

const trackW = computed(() => Math.min(props.element.width, props.element.height * 1.8))
const trackH = computed(() => Math.min(props.element.height * 0.6, trackW.value / 1.8))
const trackX = computed(() => props.element.x + (props.element.width - trackW.value) / 2)
const trackY = computed(() => props.element.y + (props.element.height - trackH.value) / 2)
const trackR = computed(() => trackH.value / 2)

const thumbR = computed(() => trackH.value / 2 - 2)
const thumbCx = computed(() =>
  isOn.value
    ? trackX.value + trackW.value - trackR.value
    : trackX.value + trackR.value
)
const thumbCy = computed(() => trackY.value + trackH.value / 2)

const trackColor = computed(() => isOn.value ? '#4caf50' : '#666')

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Track -->
    <rect
      :x="trackX" :y="trackY"
      :width="trackW" :height="trackH"
      :rx="trackR"
      :fill="trackColor"
      :opacity="element.style.opacity"
    />
    <!-- Thumb -->
    <circle
      :cx="thumbCx" :cy="thumbCy" :r="thumbR"
      fill="white"
      :stroke="isOn ? '#388e3c' : '#444'"
      :stroke-width="1 / viewportStore.viewport.scale"
    />
    <!-- Label -->
    <text v-if="element.label"
      :x="element.x + element.width / 2"
      :y="trackY - 6"
      font-size="10" fill="#999"
      text-anchor="middle"
    >{{ element.label }}</text>
    <!-- State text -->
    <text
      :x="element.x + element.width / 2"
      :y="trackY + trackH + 14"
      font-size="10"
      :fill="isOn ? '#4caf50' : '#999'"
      text-anchor="middle"
      font-family="monospace"
    >{{ isOn ? 'ON' : 'OFF' }}</text>
    <!-- Selection -->
    <rect v-if="selected"
      :x="element.x - selectionPadding" :y="element.y - selectionPadding"
      :width="element.width + selectionPadding * 2" :height="element.height + selectionPadding * 2"
      fill="none" stroke="#2196F3" :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3" pointer-events="none"
    />
  </g>
</template>
