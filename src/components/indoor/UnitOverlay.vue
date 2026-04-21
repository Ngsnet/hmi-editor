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

/**
 * Create a single counter badge — draggable + Ctrl+drag to rotate.
 * Each counter has its own position and rotation stored in CounterLayerAssignment.
 */
// Sparkline cache: varId → number[]
const sparklineCache = new Map<number, number[]>()

async function loadSparkline(varId: number) {
  if (sparklineCache.has(varId)) return
  const history = await cemStore.fetchHistory48h(varId)
  const points = history.map(h => h.value)
  if (points.length > 48) {
    const step = Math.floor(points.length / 48)
    sparklineCache.set(varId, points.filter((_, i) => i % step === 0))
  } else {
    sparklineCache.set(varId, points)
  }
  // Re-render badges after sparkline loaded
  if (svgContainer.value) applyMeterBadges(svgContainer.value)
}

function createSparklinePath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * w - w / 2
    const y = -(((v - min) / range) * (h - 2) + 1 - h / 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

function createCounterBadge(
  svgRoot: SVGSVGElement,
  pos: { x: number; y: number },
  rotation: number,
  color: string,
  text: string,
  opacity: number,
  unitId: string,
  varId: number,
) {
  const badgeW = 78
  const sparklineData = sparklineCache.get(varId)
  const hasSparkline = sparklineData && sparklineData.length > 1
  const sparkH = 14
  const badgeH = 16 + sparkH + 2  // always include sparkline area

  const g = document.createElementNS(NS, 'g')
  g.setAttribute('class', BADGE_CLASS)
  g.setAttribute('data-var-id', String(varId))
  g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)

  // Background
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('x', String(-badgeW / 2))
  bg.setAttribute('y', String(-8))
  bg.setAttribute('width', String(badgeW))
  bg.setAttribute('height', String(badgeH))
  bg.setAttribute('rx', '3')
  bg.setAttribute('fill', 'rgba(255,253,245,0.85)')
  bg.setAttribute('stroke', 'rgba(180,170,150,0.6)')
  bg.setAttribute('stroke-width', '0.8')
  bg.setAttribute('cursor', 'grab')
  bg.setAttribute('pointer-events', 'all')
  g.appendChild(bg)

  // Color dot
  const dot = document.createElementNS(NS, 'circle')
  dot.setAttribute('cx', String(-badgeW / 2 + 8))
  dot.setAttribute('cy', '0')
  dot.setAttribute('r', '3')
  dot.setAttribute('fill', color)
  dot.setAttribute('opacity', String(opacity))
  dot.setAttribute('pointer-events', 'none')
  g.appendChild(dot)

  // Value text
  const label = document.createElementNS(NS, 'text')
  label.setAttribute('x', String(-badgeW / 2 + 16))
  label.setAttribute('y', '4')
  label.setAttribute('fill', '#1a1a1a')
  label.setAttribute('opacity', String(opacity))
  label.setAttribute('font-size', '10')
  label.setAttribute('font-family', 'monospace')
  label.setAttribute('pointer-events', 'none')
  label.textContent = text
  g.appendChild(label)

  // Sparkline area
  if (hasSparkline) {
    const sparkPath = document.createElementNS(NS, 'polyline')
    const pts = sparklineData.map((v, i) => {
      const min = Math.min(...sparklineData)
      const max = Math.max(...sparklineData)
      const range = max - min || 1
      const x = (i / (sparklineData.length - 1)) * (badgeW - 8) - (badgeW - 8) / 2
      const y = 8 + sparkH - ((v - min) / range) * (sparkH - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    sparkPath.setAttribute('points', pts)
    sparkPath.setAttribute('fill', 'none')
    sparkPath.setAttribute('stroke', color)
    sparkPath.setAttribute('stroke-width', '1')
    sparkPath.setAttribute('opacity', String(opacity * 0.8))
    sparkPath.setAttribute('pointer-events', 'none')
    g.appendChild(sparkPath)
  } else {
    // No data — dashed baseline
    const noData = document.createElementNS(NS, 'line')
    noData.setAttribute('x1', String(-(badgeW - 8) / 2))
    noData.setAttribute('y1', String(8 + sparkH / 2))
    noData.setAttribute('x2', String((badgeW - 8) / 2))
    noData.setAttribute('y2', String(8 + sparkH / 2))
    noData.setAttribute('stroke', 'rgba(150,150,150,0.4)')
    noData.setAttribute('stroke-width', '0.8')
    noData.setAttribute('stroke-dasharray', '3 2')
    noData.setAttribute('pointer-events', 'none')
    g.appendChild(noData)
    // Trigger async load
    loadSparkline(varId)
  }

  // Drag + rotate logic
  let dragging = false
  let rotating = false
  let dragStartX = 0
  let dragStartY = 0
  let startPosX = pos.x
  let startPosY = pos.y
  let startRotation = rotation

  function toSvgPoint(e: MouseEvent): { x: number; y: number } {
    const ctm = svgRoot.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
  }

  function onStart(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const svgPt = toSvgPoint(e)
    dragStartX = svgPt.x
    dragStartY = svgPt.y
    startPosX = pos.x
    startPosY = pos.y
    startRotation = rotation

    if (e.ctrlKey || e.metaKey) {
      rotating = true
      bg.setAttribute('cursor', 'crosshair')
    } else {
      dragging = true
      bg.setAttribute('cursor', 'grabbing')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
  }

  function onMove(e: MouseEvent) {
    const svgPt = toSvgPoint(e)
    if (dragging) {
      pos.x = startPosX + (svgPt.x - dragStartX)
      pos.y = startPosY + (svgPt.y - dragStartY)
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)
    } else if (rotating) {
      const angle = Math.atan2(svgPt.y - pos.y, svgPt.x - pos.x) * (180 / Math.PI)
      const startAngle = Math.atan2(dragStartY - startPosY, dragStartX - startPosX) * (180 / Math.PI)
      rotation = startRotation + (angle - startAngle)
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)
    }
  }

  function onEnd() {
    dragging = false
    rotating = false
    bg.setAttribute('cursor', 'grab')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)

    // Persist position + rotation
    const unit = buildingStore.building.units.find(u => u.id === unitId)
    if (unit) {
      if (!unit.counterLayers) unit.counterLayers = []
      const assignment = unit.counterLayers.find(a => a.varId === varId)
      if (assignment) {
        assignment.pos = { x: pos.x, y: pos.y }
        assignment.rotation = Math.round(rotation * 10) / 10
      }
    }
  }

  bg.addEventListener('mousedown', onStart)

  cleanupHandlers.push(() => {
    bg.removeEventListener('mousedown', onStart)
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
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

    // Each counter gets its own badge
    let offsetIndex = 0
    for (const objId of unit.cemObjectIds) {
      const counters = cemStore.getCountersForObject(objId)
      for (const c of counters) {
        if (c.isService) continue
        if (!matchesMediaFilter(unit, c.id, c)) continue

        const layer = getCounterLayer(unit, c.id, c)
        const mediaKey = layerToMediaKey[layer] ?? ''
        const opacity = mediaKey ? getLayerOpacity(mediaKey) : 1
        if (opacity <= 0) continue

        // Get saved position/rotation or default stacked below centroid
        const assignment = unit.counterLayers?.find(a => a.varId === c.id)
        const pos = assignment?.pos
          ? { x: assignment.pos.x, y: assignment.pos.y }
          : { x: centroid.x, y: centroid.y + 12 + offsetIndex * 20 }
        const rotation = assignment?.rotation ?? 0

        const decimals = assignment?.decimals ?? 1
        const val = c.lastValue != null ? `${c.lastValue.toFixed(decimals)} ${c.unit}` : '--'
        createCounterBadge(svgRoot, pos, rotation, c.color, val, opacity, unit.id, c.id)
        offsetIndex++
      }
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
