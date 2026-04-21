<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onUnmounted, type ShallowRef } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'
import { loadFloorplanSvg } from '@/utils/floorplanStorage'
import { useGeoRefTransform, type SvgViewBox } from '@/composables/useGeoRefTransform'

const buildingStore = useBuildingStore()
const wrapperEl = ref<HTMLDivElement | null>(null)
const svgContainerEl = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const svgViewBox = ref<SvgViewBox | null>(null)

const mapRef = inject<ShallowRef<L.Map | null>>('leafletMap', ref(null) as any)

const emit = defineEmits<{
  loaded: []
}>()

// Reactive geo-ref transform
const { transform: geoTransform, recompute } = useGeoRefTransform(
  mapRef,
  () => buildingStore.activeGeoRef,
  () => svgViewBox.value,
  () => {
    if (!wrapperEl.value) return { width: 0, height: 0 }
    return { width: wrapperEl.value.offsetWidth, height: wrapperEl.value.offsetHeight }
  },
)

// Recompute when geoRef changes
watch(() => buildingStore.activeGeoRef, recompute, { deep: true })

// Recompute on container resize
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (wrapperEl.value) {
    resizeObserver = new ResizeObserver(recompute)
    resizeObserver.observe(wrapperEl.value)
  }
})
onUnmounted(() => {
  resizeObserver?.disconnect()
})

// Computed CSS transform: geoRef-based or manual fallback
const transformStyle = computed(() => {
  const gt = geoTransform.value
  if (gt && buildingStore.hasGeoRef) {
    // GeoRef-computed transform + manual fine-tuning
    const tx = gt.translateX + buildingStore.floorPlanOffsetX
    const ty = gt.translateY + buildingStore.floorPlanOffsetY
    const s = gt.scale
    const r = gt.rotation + buildingStore.floorPlanRotation
    return `translate(${tx}px, ${ty}px) scale(${s}) rotate(${r}deg)`
  }
  // Manual fallback (no geoRef)
  return `translate(${buildingStore.floorPlanOffsetX}px, ${buildingStore.floorPlanOffsetY}px) scale(${buildingStore.floorPlanScale}) rotate(${buildingStore.floorPlanRotation}deg)`
})

async function loadFloorPlan(floorId: string) {
  if (!svgContainerEl.value) return

  const floor = buildingStore.building.floors.find(f => f.id === floorId)
  if (!floor) {
    error.value = `Patro ${floorId} nenalezeno`
    return
  }

  loading.value = true
  error.value = null

  try {
    const svgText = await loadFloorplanSvg(floorId)
    if (!svgText) {
      error.value = `SVG pro patro "${floor.label}" není nahráno. Nahrajte SVG v Admin → Půdorysy.`
      return
    }
    svgContainerEl.value.innerHTML = svgText

    // Ensure SVG fills the container
    const svgEl = svgContainerEl.value.querySelector('svg')
    if (svgEl) {
      svgEl.setAttribute('width', '100%')
      svgEl.setAttribute('height', '100%')
      svgEl.style.display = 'block'

      // Extract viewBox for geo-ref transform
      const vb = svgEl.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
      if (vb && vb.length === 4) {
        svgViewBox.value = { x: vb[0]!, y: vb[1]!, width: vb[2]!, height: vb[3]! }
      } else {
        // Fallback: use width/height attributes or bounding box
        const w = parseFloat(svgEl.getAttribute('width') ?? '0') || svgEl.getBBox().width
        const h = parseFloat(svgEl.getAttribute('height') ?? '0') || svgEl.getBBox().height
        svgViewBox.value = { x: 0, y: 0, width: w, height: h }
      }
    }

    // Update text labels from building data
    updateUnitLabels()

    // Recompute geo-ref after SVG is loaded
    recompute()

    emit('loaded')
  } catch (e) {
    error.value = `Chyba načítání: ${(e as Error).message}`
  } finally {
    loading.value = false
  }
}

function updateUnitLabels() {
  if (!svgContainerEl.value) return

  for (const unit of buildingStore.unitsOnActiveFloor) {
    const unitEl = svgContainerEl.value.querySelector(`#${CSS.escape(unit.svgPathId)}`)
    if (!unitEl) continue

    // Find the <text> sibling right after this element
    const textEl = unitEl.nextElementSibling
    if (textEl && textEl.tagName === 'text') {
      textEl.textContent = unit.name
      // Ensure label is readable
      textEl.setAttribute('fill', '#1a1a1a')
      textEl.setAttribute('font-weight', '600')
      textEl.setAttribute('paint-order', 'stroke')
      textEl.setAttribute('stroke', '#ffffff')
      textEl.setAttribute('stroke-width', '3')
      textEl.setAttribute('stroke-linejoin', 'round')
    }
  }
}

function getSvgPointFromEvent(e: MouseEvent): { x: number; y: number } | null {
  const svgEl = svgContainerEl.value?.querySelector('svg') as SVGSVGElement | null
  if (!svgEl) return null
  const ctm = svgEl.getScreenCTM()
  if (!ctm) return null
  const pt = new DOMPoint(e.clientX, e.clientY)
  const svgPt = pt.matrixTransform(ctm.inverse())
  return { x: svgPt.x, y: svgPt.y }
}

/** Total effective rotation of the floor plan (geo-ref + manual) */
function getTotalRotation(): number {
  const gt = geoTransform.value
  if (gt && buildingStore.hasGeoRef) {
    return gt.rotation + buildingStore.floorPlanRotation
  }
  return buildingStore.floorPlanRotation
}

defineExpose({
  getSvgContainer: () => svgContainerEl.value,
  getSvgViewBox: () => svgViewBox.value,
  getSvgPointFromEvent,
  getTotalRotation,
})

onMounted(() => {
  loadFloorPlan(buildingStore.activeFloor)
})

watch(() => buildingStore.activeFloor, (floorId) => {
  loadFloorPlan(floorId)
})
</script>

<template>
  <div
    ref="wrapperEl"
    class="floor-plan-layer"
    :style="{
      opacity: buildingStore.floorPlanOpacity,
      transform: transformStyle,
      transformOrigin: 'center center',
    }"
  >
    <div ref="svgContainerEl" class="svg-container" />
  </div>
  <div v-if="loading" class="floor-plan-loading">Načítám půdorys...</div>
  <div v-if="error" class="floor-plan-error">{{ error }}</div>
</template>

<style scoped>
.floor-plan-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 500;
}

.floor-plan-layer :deep(svg) {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.floor-plan-layer :deep([id^="unit-"]) {
  pointer-events: all;
}

.svg-container {
  width: 100%;
  height: 100%;
}

.floor-plan-loading,
.floor-plan-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 550;
  padding: 12px 24px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted, #999);
  pointer-events: none;
}

.floor-plan-error {
  color: #ef4444;
}
</style>
