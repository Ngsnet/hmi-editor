<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const radius = computed(() => Math.min(6, props.element.height / 4))
const fontSize = computed(() => props.element.style.fontSize ?? 14)

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Button shadow -->
    <rect
      :x="element.x + 1" :y="element.y + 2"
      :width="element.width" :height="element.height"
      :rx="radius" fill="rgba(0,0,0,0.2)"
    />
    <!-- Button body -->
    <rect
      :x="element.x" :y="element.y"
      :width="element.width" :height="element.height"
      :rx="radius"
      :fill="element.style.fill"
      :stroke="element.style.stroke"
      :stroke-width="1 / viewportStore.viewport.scale"
      :opacity="element.style.opacity"
    />
    <!-- Button label -->
    <text
      :x="element.x + element.width / 2"
      :y="element.y + element.height / 2"
      :font-size="fontSize"
      :fill="element.style.textColor ?? element.style.stroke"
      text-anchor="middle"
      dominant-baseline="central"
      font-weight="600"
    >{{ element.label || 'Button' }}</text>
    <!-- Selection -->
    <rect v-if="selected"
      :x="element.x - selectionPadding" :y="element.y - selectionPadding"
      :width="element.width + selectionPadding * 2" :height="element.height + selectionPadding * 2"
      fill="none" stroke="#2196F3" :stroke-width="selectionStrokeWidth"
      stroke-dasharray="6 3" pointer-events="none"
    />
  </g>
</template>
