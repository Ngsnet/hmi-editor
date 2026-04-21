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

const visualStrokeWidth = computed(() =>
  props.element.style.strokeWidth / viewportStore.viewport.scale
)

const dashArray = computed(() => strokeDashArray(props.element.style.strokeDash))

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const hitAreaWidth = computed(() => 10 / viewportStore.viewport.scale)

const pathD = computed(() => {
  const pts = props.element.points
  if (!pts || pts.length < 2) return ''

  if (props.element.smooth) {
    return catmullRomPath(pts)
  }
  // Straight polyline
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

// Catmull-Rom spline → cubic bezier SVG path
function catmullRomPath(pts: Array<{ x: number; y: number }>, tension = 0.5): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`

  let d = `M ${pts[0]!.x} ${pts[0]!.y}`

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!
    const p1 = pts[i]!
    const p2 = pts[Math.min(i + 1, pts.length - 1)]!
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!

    const cp1x = p1.x + (p2.x - p0.x) / (6 / tension)
    const cp1y = p1.y + (p2.y - p0.y) / (6 / tension)
    const cp2x = p2.x - (p3.x - p1.x) / (6 / tension)
    const cp2y = p2.y - (p3.y - p1.y) / (6 / tension)

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return d
}
</script>

<template>
  <g>
    <!-- Invisible wider hit area -->
    <path
      :d="pathD"
      fill="none"
      stroke="transparent"
      :stroke-width="hitAreaWidth"
    />
    <!-- Actual path -->
    <path
      :d="pathD"
      :fill="element.style.fill === 'none' ? 'none' : element.style.fill"
      :stroke="element.style.stroke"
      :stroke-width="visualStrokeWidth"
      :stroke-dasharray="dashArray"
      :opacity="element.style.opacity"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Selection highlight -->
    <path
      v-if="selected"
      :d="pathD"
      fill="none"
      stroke="#2196F3"
      :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3"
      pointer-events="none"
    />
  </g>
</template>
