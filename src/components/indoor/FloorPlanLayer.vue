<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'
import { loadFloorplanSvg } from '@/utils/floorplanStorage'

const buildingStore = useBuildingStore()
const wrapperEl = ref<HTMLDivElement | null>(null)
const svgContainerEl = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const emit = defineEmits<{
  loaded: []
}>()

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
    // Try IndexedDB first (uploaded SVGs), then fetch from public/
    let svgText = await loadFloorplanSvg(floorId)
    if (!svgText) {
      const basePath = floor.svgPath.startsWith('/') ? floor.svgPath.slice(1) : floor.svgPath
      const response = await fetch(`${import.meta.env.BASE_URL}${basePath}`)
      if (!response.ok) {
        error.value = `SVG nenalezeno: ${floor.svgPath}`
        return
      }
      svgText = await response.text()
    }
    svgContainerEl.value.innerHTML = svgText

    // Ensure SVG fills the container
    const svgEl = svgContainerEl.value.querySelector('svg')
    if (svgEl) {
      svgEl.setAttribute('width', '100%')
      svgEl.setAttribute('height', '100%')
      svgEl.style.display = 'block'
    }

    // Update text labels from building data
    updateUnitLabels()

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
    let textEl = unitEl.nextElementSibling
    if (textEl && textEl.tagName === 'text') {
      textEl.textContent = unit.name
    }
  }
}

defineExpose({ getSvgContainer: () => svgContainerEl.value })

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
      transform: `translate(${buildingStore.floorPlanOffsetX}px, ${buildingStore.floorPlanOffsetY}px) scale(${buildingStore.floorPlanScale}) rotate(${buildingStore.floorPlanRotation}deg)`,
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
