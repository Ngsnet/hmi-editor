<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'

const props = defineProps<{
  gridSize: number
}>()

const viewportStore = useViewportStore()

const patternId = 'canvas-grid-pattern'
const majorPatternId = 'canvas-grid-major-pattern'

const scaledSize = computed(() => props.gridSize * viewportStore.viewport.scale)
const majorScaledSize = computed(() => props.gridSize * 5 * viewportStore.viewport.scale)

const offsetX = computed(() => viewportStore.viewport.x % scaledSize.value)
const offsetY = computed(() => viewportStore.viewport.y % scaledSize.value)

const majorOffsetX = computed(() => viewportStore.viewport.x % majorScaledSize.value)
const majorOffsetY = computed(() => viewportStore.viewport.y % majorScaledSize.value)
</script>

<template>
  <g class="grid-layer" pointer-events="none">
    <defs>
      <!-- Minor grid -->
      <pattern
        :id="patternId"
        :width="scaledSize"
        :height="scaledSize"
        patternUnits="userSpaceOnUse"
        :x="offsetX"
        :y="offsetY"
      >
        <path
          :d="`M ${scaledSize} 0 L 0 0 0 ${scaledSize}`"
          fill="none"
          stroke="#e0e0e0"
          stroke-width="0.5"
        />
      </pattern>
      <!-- Major grid (every 5 cells) -->
      <pattern
        :id="majorPatternId"
        :width="majorScaledSize"
        :height="majorScaledSize"
        patternUnits="userSpaceOnUse"
        :x="majorOffsetX"
        :y="majorOffsetY"
      >
        <path
          :d="`M ${majorScaledSize} 0 L 0 0 0 ${majorScaledSize}`"
          fill="none"
          stroke="#c0c0c0"
          stroke-width="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="`url(#${patternId})`" />
    <rect width="100%" height="100%" :fill="`url(#${majorPatternId})`" />
  </g>
</template>
