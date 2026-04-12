<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)

const href = computed(() => {
  if (!props.element.imageData) return ''
  if (props.element.imageData.startsWith('data:')) return props.element.imageData
  return `data:${props.element.imageMimeType ?? 'image/png'};base64,${props.element.imageData}`
})
</script>

<template>
  <g>
    <image
      v-if="href"
      :href="href"
      :x="element.x"
      :y="element.y"
      :width="element.width"
      :height="element.height"
      :opacity="element.style.opacity"
      preserveAspectRatio="xMidYMid meet"
    />
    <!-- Placeholder if no image -->
    <rect
      v-else
      :x="element.x"
      :y="element.y"
      :width="element.width"
      :height="element.height"
      fill="#ddd"
      stroke="#999"
      :stroke-width="1 / viewportStore.viewport.scale"
      :opacity="element.style.opacity"
    />
    <text
      v-if="!href"
      :x="element.x + element.width / 2"
      :y="element.y + element.height / 2"
      font-size="12"
      fill="#999"
      text-anchor="middle"
      dominant-baseline="central"
    >
      No image
    </text>
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
