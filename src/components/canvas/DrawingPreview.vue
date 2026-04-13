<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'

const props = defineProps<{
  preview: {
    type?: string
    x?: number
    y?: number
    width?: number
    height?: number
    points?: Array<{ x: number; y: number }>
    style?: {
      fill?: string
      stroke?: string
      strokeWidth?: number
      opacity?: number
    }
  } | null
  polylinePreview?: {
    points: Array<{ x: number; y: number }>
    smooth: boolean
    closed?: boolean
    style: {
      fill: string
      stroke: string
      strokeWidth: number
      opacity: number
    }
  } | null
}>()

const viewportStore = useViewportStore()

const strokeWidth = computed(() =>
  (props.preview?.style?.strokeWidth ?? 2) / viewportStore.viewport.scale
)

const polyStrokeWidth = computed(() =>
  (props.polylinePreview?.style.strokeWidth ?? 2) / viewportStore.viewport.scale
)

const dotRadius = computed(() => 4 / viewportStore.viewport.scale)

const polyPathD = computed(() => {
  const pp = props.polylinePreview
  if (!pp || pp.points.length < 2) return ''
  const suffix = pp.closed ? ' Z' : ''
  if (pp.smooth) return catmullRomPath(pp.points) + suffix
  return pp.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + suffix
})

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
  <g pointer-events="none">
    <!-- Shape previews -->
    <g v-if="preview">
      <rect
        v-if="preview.type === 'rect'"
        :x="preview.x" :y="preview.y"
        :width="preview.width" :height="preview.height"
        :fill="preview.style?.fill ?? 'none'"
        :stroke="preview.style?.stroke ?? '#333'"
        :stroke-width="strokeWidth"
        :opacity="preview.style?.opacity ?? 0.6"
        stroke-dasharray="6 3"
      />
      <ellipse
        v-if="preview.type === 'ellipse'"
        :cx="(preview.x ?? 0) + (preview.width ?? 0) / 2"
        :cy="(preview.y ?? 0) + (preview.height ?? 0) / 2"
        :rx="(preview.width ?? 0) / 2"
        :ry="(preview.height ?? 0) / 2"
        :fill="preview.style?.fill ?? 'none'"
        :stroke="preview.style?.stroke ?? '#333'"
        :stroke-width="strokeWidth"
        :opacity="preview.style?.opacity ?? 0.6"
        stroke-dasharray="6 3"
      />
      <line
        v-if="preview.type === 'line' && preview.points?.length === 2"
        :x1="preview.points![0]!.x" :y1="preview.points![0]!.y"
        :x2="preview.points![1]!.x" :y2="preview.points![1]!.y"
        :stroke="preview.style?.stroke ?? '#333'"
        :stroke-width="strokeWidth"
        :opacity="preview.style?.opacity ?? 0.6"
        stroke-dasharray="6 3"
      />
    </g>

    <!-- Polyline / Curve preview -->
    <g v-if="polylinePreview && polylinePreview.points.length >= 2">
      <path
        :d="polyPathD"
        :fill="polylinePreview.closed ? polylinePreview.style.fill : 'none'"
        :stroke="polylinePreview.style.stroke"
        :stroke-width="polyStrokeWidth"
        :opacity="polylinePreview.style.opacity"
        stroke-dasharray="6 3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- Vertex dots -->
      <circle
        v-for="(pt, i) in polylinePreview.points"
        :key="i"
        :cx="pt.x" :cy="pt.y"
        :r="dotRadius"
        :fill="i === polylinePreview.points.length - 1 ? '#2196F3' : 'white'"
        stroke="#2196F3"
        :stroke-width="1 / viewportStore.viewport.scale"
      />
    </g>
  </g>
</template>
