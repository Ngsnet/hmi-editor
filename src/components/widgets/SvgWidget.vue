<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const props = defineProps<{
  element: CanvasElement
  selected: boolean
}>()

const viewportStore = useViewportStore()
const selectionStrokeWidth = computed(() => 2 / viewportStore.viewport.scale)
const selectionPadding = computed(() => 4 / viewportStore.viewport.scale)

// Parse SVG and extract viewBox for proper scaling
const svgData = computed(() => {
  const raw = props.element.svgContent
  if (!raw) return null

  // Extract viewBox from SVG
  const vbMatch = raw.match(/viewBox=["']([^"']+)["']/)
  let vbWidth = 100, vbHeight = 100
  if (vbMatch) {
    const parts = vbMatch[1]!.trim().split(/\s+/)
    vbWidth = parseFloat(parts[2] ?? '100')
    vbHeight = parseFloat(parts[3] ?? '100')
  }

  // Strip outer <svg> tag, keep inner content
  let inner = raw
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim()

  return { inner, vbWidth, vbHeight }
})
</script>

<template>
  <g>
    <g v-if="svgData"
      :transform="`translate(${element.x}, ${element.y}) scale(${element.width / svgData.vbWidth}, ${element.height / svgData.vbHeight})`"
      :opacity="element.style.opacity"
      v-html="svgData.inner"
    />
    <!-- Placeholder if no SVG -->
    <g v-else>
      <rect
        :x="element.x" :y="element.y"
        :width="element.width" :height="element.height"
        fill="#eee" stroke="#999"
        :stroke-width="1 / viewportStore.viewport.scale"
      />
      <text
        :x="element.x + element.width / 2"
        :y="element.y + element.height / 2"
        font-size="11" fill="#999"
        text-anchor="middle" dominant-baseline="central"
      >SVG</text>
    </g>
    <!-- Label -->
    <text v-if="element.label"
      :x="element.x + element.width / 2"
      :y="element.y + element.height + 14"
      font-size="10" fill="#666"
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
