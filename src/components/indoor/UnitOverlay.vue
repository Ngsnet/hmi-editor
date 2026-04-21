<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'

const buildingStore = useBuildingStore()

const svgContainer = ref<HTMLElement | null>(null)

const statusColors: Record<string, string> = {
  normal: 'rgba(34, 197, 94, 0.45)',
  alert: 'rgba(239, 68, 68, 0.55)',
  empty: 'rgba(156, 163, 175, 0.35)',
  'no-data': 'rgba(251, 191, 36, 0.4)',
  'unassigned': 'rgba(200, 200, 200, 0.3)',
}

const statusStrokes: Record<string, string> = {
  normal: '#16a34a',
  alert: '#dc2626',
  empty: '#6b7280',
  'no-data': '#d97706',
  'unassigned': '#9ca3af',
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
  htmlEl.style.stroke = statusStrokes[status] ?? '#6b7280'
  htmlEl.style.strokeWidth = '2px'
  htmlEl.style.transition = 'fill 0.3s ease, stroke 0.3s ease'
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
