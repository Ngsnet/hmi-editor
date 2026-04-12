<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()

const fontSize = computed(() => props.element.style.fontSize ?? 14)
const fontFamily = computed(() => props.element.style.fontFamily ?? 'sans-serif')
const textColor = computed(() => props.element.style.textColor ?? props.element.style.stroke)
const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)
</script>

<template>
  <g>
    <!-- Background rect (for hit area and optional fill) -->
    <rect
      :x="element.x"
      :y="element.y"
      :width="element.width"
      :height="element.height"
      :fill="element.style.fill === 'none' ? 'transparent' : element.style.fill"
      :opacity="element.style.opacity"
    />
    <!-- foreignObject for word-wrap -->
    <foreignObject
      :x="element.x"
      :y="element.y"
      :width="element.width"
      :height="element.height"
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        :style="{
          width: element.width + 'px',
          height: element.height + 'px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: fontSize + 'px',
          fontFamily: fontFamily,
          color: textColor,
          opacity: element.style.opacity,
          overflow: 'hidden',
          wordBreak: 'break-word',
          lineHeight: '1.3',
          padding: '2px 4px',
          boxSizing: 'border-box',
        }"
      >{{ element.label || 'Text' }}</div>
    </foreignObject>
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
