<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'

const buildingStore = useBuildingStore()

const svgContainer = ref<HTMLElement | null>(null)

const statusColors: Record<string, string> = {
  normal: 'rgba(34, 197, 94, 0.25)',
  alert: 'rgba(239, 68, 68, 0.4)',
  empty: 'rgba(156, 163, 175, 0.2)',
  'no-data': 'rgba(251, 191, 36, 0.25)',
  'unassigned': 'rgba(200, 200, 200, 0.15)',
}

const cleanupHandlers: Array<() => void> = []

function cleanupAll() {
  cleanupHandlers.forEach(fn => fn())
  cleanupHandlers.length = 0
}

function applyUnitStyle(el: Element, unitId: string | null) {
  const status = unitId ? buildingStore.getUnitStatus(unitId) : 'unassigned'
  const htmlEl = el as HTMLElement
  htmlEl.style.fill = statusColors[status] ?? statusColors['no-data']
  htmlEl.style.cursor = 'pointer'
  htmlEl.style.stroke = '#374151'
  htmlEl.style.strokeWidth = '1.5px'
  htmlEl.style.transition = 'fill 0.3s ease'
}

function applyAllStyles(container?: HTMLElement) {
  cleanupAll()

  if (container) {
    svgContainer.value = container
  }

  const root = svgContainer.value
  if (!root) return

  // Find ALL unit-* elements in SVG
  const allUnitEls = root.querySelectorAll('[id^="unit-"]')

  for (const el of allUnitEls) {
    // Skip SVG root elements
    if (el.tagName.toLowerCase() === 'svg') continue

    const svgId = el.id
    const unit = buildingStore.building.units.find(
      u => u.svgPathId === svgId && u.floor === buildingStore.activeFloor
    )

    applyUnitStyle(el, unit?.id ?? null)

    const onEnter = () => {
      ;(el as HTMLElement).style.fillOpacity = '0.6'
    }
    const onLeave = () => {
      applyUnitStyle(el, unit?.id ?? null)
    }
    const onClick = () => {
      if (unit) {
        buildingStore.selectUnit(unit.id)
      }
    }

    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('click', onClick)

    cleanupHandlers.push(() => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('click', onClick)
    })
  }
}

// Re-apply when floor changes or alerts update
watch(() => buildingStore.activeFloor, () => {
  setTimeout(() => applyAllStyles(), 200)
})

watch(() => [...buildingStore.meterAlerts], () => {
  const root = svgContainer.value
  if (!root) return
  for (const unit of buildingStore.unitsOnActiveFloor) {
    const el = root.querySelector(`#${CSS.escape(unit.svgPathId)}`)
    if (el) applyUnitStyle(el, unit.id)
  }
})

defineExpose({ applyAllStyles })

onUnmounted(cleanupAll)
</script>

<template>
  <span style="display: none" />
</template>
