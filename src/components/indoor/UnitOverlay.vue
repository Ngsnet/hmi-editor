<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'
import { useCemDataStore } from '@/stores/cemDataStore'

const buildingStore = useBuildingStore()
const cemStore = useCemDataStore()

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

function getElementCentroid(el: Element): { x: number; y: number } | null {
  try {
    const svgEl = el as SVGGraphicsElement
    const bbox = svgEl.getBBox()
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
  } catch {
    return null
  }
}

const NS = 'http://www.w3.org/2000/svg'
const BADGE_CLASS = 'cem-meter-badge'

function removeMeterBadges(root: HTMLElement) {
  root.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove())
}

function createMeterBadge(
  svgRoot: SVGSVGElement,
  pos: { x: number; y: number },
  lines: Array<{ color: string; text: string; opacity: number }>,
  unitId: string,
) {
  const lineHeight = 13
  const padding = 4
  const handleHeight = 10
  const totalHeight = lines.length * lineHeight + padding * 2
  const badgeWidth = 80

  const g = document.createElementNS(NS, 'g')
  g.setAttribute('class', BADGE_CLASS)
  g.setAttribute('data-unit-id', unitId)

  // Drag handle bar (top)
  const handle = document.createElementNS(NS, 'rect')
  handle.setAttribute('x', String(pos.x - badgeWidth / 2))
  handle.setAttribute('y', String(pos.y))
  handle.setAttribute('width', String(badgeWidth))
  handle.setAttribute('height', String(handleHeight))
  handle.setAttribute('rx', '4')
  handle.setAttribute('fill', 'rgba(255,255,255,0.15)')
  handle.setAttribute('cursor', 'grab')
  handle.setAttribute('pointer-events', 'all')
  g.appendChild(handle)

  // Grip dots on handle
  for (let i = 0; i < 3; i++) {
    const dot = document.createElementNS(NS, 'circle')
    dot.setAttribute('cx', String(pos.x - 6 + i * 6))
    dot.setAttribute('cy', String(pos.y + handleHeight / 2))
    dot.setAttribute('r', '1.2')
    dot.setAttribute('fill', 'rgba(255,255,255,0.5)')
    dot.setAttribute('pointer-events', 'none')
    g.appendChild(dot)
  }

  // Background rect
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('x', String(pos.x - badgeWidth / 2))
  bg.setAttribute('y', String(pos.y + handleHeight))
  bg.setAttribute('width', String(badgeWidth))
  bg.setAttribute('height', String(totalHeight))
  bg.setAttribute('rx', '4')
  bg.setAttribute('fill', 'rgba(0,0,0,0.75)')
  bg.setAttribute('stroke', 'rgba(255,255,255,0.2)')
  bg.setAttribute('stroke-width', '0.5')
  bg.setAttribute('pointer-events', 'none')
  g.appendChild(bg)

  // Value lines
  lines.forEach((line, i) => {
    const dot = document.createElementNS(NS, 'circle')
    dot.setAttribute('cx', String(pos.x - badgeWidth / 2 + padding + 4))
    dot.setAttribute('cy', String(pos.y + handleHeight + padding + i * lineHeight + lineHeight / 2))
    dot.setAttribute('r', '3')
    dot.setAttribute('fill', line.color)
    dot.setAttribute('opacity', String(line.opacity))
    dot.setAttribute('pointer-events', 'none')
    g.appendChild(dot)

    const text = document.createElementNS(NS, 'text')
    text.setAttribute('x', String(pos.x - badgeWidth / 2 + padding + 12))
    text.setAttribute('y', String(pos.y + handleHeight + padding + i * lineHeight + lineHeight / 2 + 4))
    text.setAttribute('fill', '#ffffff')
    text.setAttribute('opacity', String(line.opacity))
    text.setAttribute('font-size', '10')
    text.setAttribute('font-family', 'monospace')
    text.setAttribute('pointer-events', 'none')
    text.textContent = line.text
    g.appendChild(text)
  })

  // Drag logic
  let dragging = false
  let dragStartX = 0
  let dragStartY = 0
  let badgeStartX = pos.x
  let badgeStartY = pos.y

  function toSvgPoint(e: MouseEvent): { x: number; y: number } {
    const ctm = svgRoot.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const pt = new DOMPoint(e.clientX, e.clientY)
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }

  function onDragStart(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    dragging = true
    const svgPt = toSvgPoint(e)
    dragStartX = svgPt.x
    dragStartY = svgPt.y
    badgeStartX = pos.x
    badgeStartY = pos.y
    handle.setAttribute('cursor', 'grabbing')
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }

  function onDragMove(e: MouseEvent) {
    if (!dragging) return
    const svgPt = toSvgPoint(e)
    const dx = svgPt.x - dragStartX
    const dy = svgPt.y - dragStartY
    pos.x = badgeStartX + dx
    pos.y = badgeStartY + dy
    g.setAttribute('transform', `translate(${dx}, ${dy})`)
  }

  function onDragEnd(e: MouseEvent) {
    if (!dragging) return
    dragging = false
    handle.setAttribute('cursor', 'grab')
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)

    // Save position to unit
    const unit = buildingStore.building.units.find(u => u.id === unitId)
    if (unit) {
      unit.meterBadgePos = { x: pos.x, y: pos.y }
    }

    // Rebuild badge at new position (removes transform hack)
    if (svgContainer.value) applyMeterBadges(svgContainer.value)
  }

  handle.addEventListener('mousedown', onDragStart)

  cleanupHandlers.push(() => {
    handle.removeEventListener('mousedown', onDragStart)
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  })

  svgRoot.appendChild(g)
}

// --- Overlay filter state (controlled from IndoorView) ---
let overlayMediaFilter: Set<string> = new Set() // empty = show all
let overlayVizMode: 'badge' | 'sparkline' | 'heatmap' = 'badge'
let overlayLayerOpacity: Record<string, number> = {}

function setOverlayFilter(media: Set<string>, viz: 'badge' | 'sparkline' | 'heatmap', opacity?: Record<string, number>) {
  overlayMediaFilter = media
  overlayVizMode = viz
  if (opacity) overlayLayerOpacity = opacity
  if (svgContainer.value) applyMeterBadges(svgContainer.value)
}

function getLayerOpacity(mediaKey: string): number {
  if (Object.keys(overlayLayerOpacity).length === 0) return 1
  return overlayLayerOpacity[mediaKey] ?? 1
}

// Reverse lookup: MediaLayer → media filter key
const layerToMediaKey: Record<string, string> = {
  water: 'voda',
  electric: 'elektřina',
  heat: 'teplo',
  cool: 'chlad',
  temperature: 'teplota',
  other: '',
}

import type { Unit, MediaLayer } from '@/types/indoor'
import { cemService } from '@/services/cem.service'

// Map overlay media filter keys to MediaLayer values
const mediaFilterToLayer: Record<string, MediaLayer> = {
  'voda': 'water',
  'elektřina': 'electric',
  'teplo': 'heat',
  'chlad': 'cool',
  'teplota': 'temperature',
}

function getCounterLayer(unit: Unit, varId: number, counter: { typeName: string; unit: string }): MediaLayer {
  // Check manual/auto assignment first
  const assignment = unit.counterLayers?.find(a => a.varId === varId)
  if (assignment) return assignment.layer
  // Fallback: auto-detect
  return cemService.detectMediaLayer(counter)
}

function matchesMediaFilter(unit: Unit, varId: number, counter: { typeName: string; unit: string }): boolean {
  if (overlayMediaFilter.size === 0) return true
  const layer = getCounterLayer(unit, varId, counter)
  for (const media of overlayMediaFilter) {
    const targetLayer = mediaFilterToLayer[media.toLowerCase()]
    if (targetLayer && targetLayer === layer) return true
  }
  return false
}

function applyMeterBadges(root: HTMLElement) {
  removeMeterBadges(root)
  const svgRoot = root.querySelector('svg') as SVGSVGElement | null
  if (!svgRoot || !cemStore.isLoaded) return

  for (const unit of buildingStore.unitsOnActiveFloor) {
    if (!unit.cemObjectIds || unit.cemObjectIds.length === 0) continue

    const el = root.querySelector(`#${CSS.escape(unit.svgPathId)}`)
    if (!el) continue

    const centroid = getElementCentroid(el)
    if (!centroid) continue

    // Use custom position or fallback to centroid
    const pos = unit.meterBadgePos
      ? { x: unit.meterBadgePos.x, y: unit.meterBadgePos.y }
      : { x: centroid.x, y: centroid.y }

    // Collect counter values filtered by media, with per-layer opacity
    const lines: Array<{ color: string; text: string; opacity: number }> = []
    for (const objId of unit.cemObjectIds) {
      const counters = cemStore.getCountersForObject(objId)
      for (const c of counters) {
        if (c.isService) continue
        if (!matchesMediaFilter(unit, c.id, c)) continue
        const layer = getCounterLayer(unit, c.id, c)
        const mediaKey = layerToMediaKey[layer] ?? ''
        const opacity = mediaKey ? getLayerOpacity(mediaKey) : 1
        if (opacity <= 0) continue
        const val = c.lastValue != null ? `${c.lastValue} ${c.unit}` : '--'
        lines.push({ color: c.color, text: val, opacity })
      }
    }

    if (lines.length > 0) {
      createMeterBadge(svgRoot, pos, lines.slice(0, 6), unit.id)
    }
  }
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

  // Overlay CEM meter values on units
  applyMeterBadges(root)
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

// Refresh meter badges when CEM data changes
watch(() => cemStore.isLoaded, (loaded) => {
  if (loaded && svgContainer.value) applyMeterBadges(svgContainer.value)
})

watch(() => [...cemStore.liveValues], () => {
  if (svgContainer.value) applyMeterBadges(svgContainer.value)
})

defineExpose({ applyAllStyles, setOverlayFilter })

onUnmounted(cleanupAll)
</script>

<template>
  <span style="display: none" />
</template>
