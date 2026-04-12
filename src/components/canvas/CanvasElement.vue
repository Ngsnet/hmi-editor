<script setup lang="ts">
import { computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import type { CanvasElement as CanvasElementType } from '@/types/diagram'
import ShapeRect from '@/components/widgets/ShapeRect.vue'
import ShapeEllipse from '@/components/widgets/ShapeEllipse.vue'
import ShapeLine from '@/components/widgets/ShapeLine.vue'
import ShapePolyline from '@/components/widgets/ShapePolyline.vue'
import TextLabel from '@/components/widgets/TextLabel.vue'
import ImageWidget from '@/components/widgets/ImageWidget.vue'
import GaugeWidget from '@/components/widgets/GaugeWidget.vue'
import SwitchLED from '@/components/widgets/SwitchLED.vue'
import TextValue from '@/components/widgets/TextValue.vue'
import SliderWidget from '@/components/widgets/SliderWidget.vue'
import ProgressBarWidget from '@/components/widgets/ProgressBarWidget.vue'
import ButtonWidget from '@/components/widgets/ButtonWidget.vue'
import ToggleWidget from '@/components/widgets/ToggleWidget.vue'
import SvgWidget from '@/components/widgets/SvgWidget.vue'

const props = defineProps<{
  element: CanvasElementType
}>()

const diagramStore = useDiagramStore()

const isSelected = computed(() => diagramStore.selectedElementIds.has(props.element.id))

const widgetComponent = computed(() => {
  const map: Record<string, any> = {
    rect: ShapeRect,
    ellipse: ShapeEllipse,
    line: ShapeLine,
    polyline: ShapePolyline,
    text: TextLabel,
    image: ImageWidget,
    gauge: GaugeWidget,
    switch: SwitchLED,
    textValue: TextValue,
    slider: SliderWidget,
    progressBar: ProgressBarWidget,
    button: ButtonWidget,
    toggle: ToggleWidget,
    svg: SvgWidget,
  }
  return map[props.element.type] ?? null
})
</script>

<template>
  <g
    :data-element-id="element.id"
    :transform="element.rotation ? `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})` : undefined"
    :style="{ cursor: element.locked ? 'default' : 'move' }"
  >
    <component
      v-if="widgetComponent"
      :is="widgetComponent"
      :element="element"
      :selected="isSelected"
    />
  </g>
</template>
