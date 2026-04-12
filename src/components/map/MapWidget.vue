<script setup lang="ts">
import { computed } from 'vue'
import type { CanvasElement } from '@/types/diagram'
import GaugeWidget from '@/components/widgets/GaugeWidget.vue'
import SwitchLED from '@/components/widgets/SwitchLED.vue'
import TextValue from '@/components/widgets/TextValue.vue'
import SliderWidget from '@/components/widgets/SliderWidget.vue'
import ProgressBarWidget from '@/components/widgets/ProgressBarWidget.vue'
import ToggleWidget from '@/components/widgets/ToggleWidget.vue'

const props = defineProps<{
  element: CanvasElement
  position: { x: number; y: number } | null
  liveValue?: unknown
  selected: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const widgetComponent = computed(() => {
  const map: Record<string, any> = {
    gauge: GaugeWidget,
    switch: SwitchLED,
    textValue: TextValue,
    slider: SliderWidget,
    progressBar: ProgressBarWidget,
    toggle: ToggleWidget,
  }
  return map[props.element.type] ?? null
})

// Offset: position is screen center of widget, but inner widgets render at element.x/y
// So translate by (screenCenter - widgetHalf - element.xy) to put element.x/y at the right screen spot
const transform = computed(() => {
  if (!props.position) return ''
  const dx = props.position.x - props.element.width / 2 - props.element.x
  const dy = props.position.y - props.element.height / 2 - props.element.y
  return `translate(${dx}, ${dy})`
})
</script>

<template>
  <g
    v-if="position && widgetComponent"
    :transform="transform"
    style="pointer-events: all; cursor: pointer"
    @pointerdown.stop="emit('click')"
  >
    <!-- White background card -->
    <rect
      :x="element.x" :y="element.y"
      :width="element.width" :height="element.height"
      rx="4" fill="white" fill-opacity="0.9"
      :stroke="selected ? '#2196F3' : '#ccc'"
      :stroke-width="selected ? 2 : 1"
    />

    <!-- Widget content -->
    <component
      :is="widgetComponent"
      :element="element"
      :selected="false"
      :live-value="liveValue"
    />

    <!-- Anchor line to GPS point -->
    <line
      :x1="element.x + element.width / 2"
      :y1="element.y + element.height"
      :x2="element.x + element.width / 2"
      :y2="element.y + element.height + 8"
      stroke="#666" stroke-width="1" opacity="0.5"
    />
    <circle
      :cx="element.x + element.width / 2"
      :cy="element.y + element.height + 8"
      r="2" fill="#666"
    />
  </g>
</template>
