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

const minVal = computed(() => props.element.dataSource?.minValue ?? 0)
const maxVal = computed(() => props.element.dataSource?.maxValue ?? 100)

const currentValue = computed(() => {
  const v = props.liveValue
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
})

const normalizedValue = computed(() => {
  if (currentValue.value == null) return 0
  const range = maxVal.value - minVal.value
  if (range <= 0) return 0
  return Math.max(0, Math.min(1, (currentValue.value - minVal.value) / range))
})

const startAngle = -220
const endAngle = 40
const totalArc = endAngle - startAngle // 260°

const bgArcD = computed(() =>
  describeArc(cx.value, cy.value, radius.value, startAngle, endAngle)
)

const valueArcD = computed(() => {
  const angle = startAngle + totalArc * normalizedValue.value
  if (normalizedValue.value <= 0) return ''
  return describeArc(cx.value, cy.value, radius.value, startAngle, angle)
})

const displayValue = computed(() => {
  if (currentValue.value == null) return '--'
  const fmt = props.element.dataSource?.format
  if (fmt) return fmt.replace('{v}', String(currentValue.value))
  return String(Math.round(currentValue.value * 10) / 10)
})

const arcStrokeWidth = computed(() => Math.max(6, radius.value * 0.15))
const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
const labelFontSize = computed(() => Math.max(8, radius.value * 0.3))
const smallFontSize = computed(() => Math.max(6, radius.value * 0.15))

function polarToCartesian(cxv: number, cyv: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cxv + r * Math.cos(rad), y: cyv + r * Math.sin(rad) }
}

function describeArc(cxv: number, cyv: number, r: number, sAngle: number, eAngle: number): string {
  const start = polarToCartesian(cxv, cyv, r, eAngle)
  const end = polarToCartesian(cxv, cyv, r, sAngle)
  const largeArc = eAngle - sAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
</script>

<template>
  <g>
    <!-- Background arc -->
    <path
      :d="bgArcD"
      fill="none"
      stroke="#e0e0e0"
      :stroke-width="arcStrokeWidth"
      stroke-linecap="round"
    />
    <!-- Value arc -->
    <path
      v-if="valueArcD"
      :d="valueArcD"
      fill="none"
      :stroke="element.style.stroke"
      :stroke-width="arcStrokeWidth"
      stroke-linecap="round"
      :opacity="element.style.opacity"
    />
    <!-- Value text -->
    <text
      :x="cx"
      :y="cy"
      :font-size="labelFontSize"
      font-family="monospace"
      :fill="element.style.textColor ?? element.style.stroke"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ displayValue }}
    </text>
    <!-- Min label -->
    <text
      :x="cx - radius * 0.7"
      :y="cy + radius * 0.7"
      :font-size="smallFontSize"
      fill="#999"
      text-anchor="middle"
    >
      {{ minVal }}
    </text>
    <!-- Max label -->
    <text
      :x="cx + radius * 0.7"
      :y="cy + radius * 0.7"
      :font-size="smallFontSize"
      fill="#999"
      text-anchor="middle"
    >
      {{ maxVal }}
    </text>
    <!-- Label -->
    <text
      v-if="element.label"
      :x="cx"
      :y="cy + radius * 0.55"
      :font-size="smallFontSize"
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
