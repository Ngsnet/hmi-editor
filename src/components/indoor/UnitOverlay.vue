<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'
import { useCemDataStore } from '@/stores/cemDataStore'

const buildingStore = useBuildingStore()
const cemStore = useCemDataStore()

const svgContainer = ref<HTMLElement | null>(null)

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function parseColor(c: string): { r: number; g: number; b: number } | null {
  if (!c) return null
  const t = c.trim()
  let m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    let hex = m[1]!
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('')
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]! }
  return null
}

/** Lighten color when its relative luminance is too low for contrast on the dark badge bg. */
function ensureContrastOnDark(color: string): string {
  const rgb = parseColor(color)
  if (!rgb) return '#e5e7eb'
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  if (lum >= 0.55) return color
  // Mix with white — stronger mix the darker the source.
  const mix = lum < 0.2 ? 0.7 : lum < 0.4 ? 0.55 : 0.4
  const r = Math.round(rgb.r + (255 - rgb.r) * mix)
  const g = Math.round(rgb.g + (255 - rgb.g) * mix)
  const b = Math.round(rgb.b + (255 - rgb.b) * mix)
  return `rgb(${r},${g},${b})`
}

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

const emit = defineEmits<{
  counterClick: [varId: number, unitId: string]
}>()

const cleanupHandlers: Array<() => void> = []

function cleanupAll() {
  cleanupHandlers.forEach(fn => fn())
  cleanupHandlers.length = 0
}

function applyUnitStyle(el: Element, unitId: string | null) {
  const status = unitId ? buildingStore.getUnitStatus(unitId) : 'unassigned'
  const htmlEl = el as HTMLElement
  htmlEl.style.fill = statusColors[status] ?? statusColors['no-data']!
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
// Sparkline cache: varId → { trend: number[], consumption: number[] }
const sparklineCache = new Map<number, { trend: number[]; consumption: number[] }>()

function getDefaultChart(unitObj: Unit, varId: number): 'trend' | 'consumption' {
  return unitObj.counterLayers?.find(a => a.varId === varId)?.defaultChart ?? 'trend'
}

async function loadSparkline(varId: number) {
  if (sparklineCache.has(varId)) return
  const history = await cemStore.fetchHistory48h(varId)
  const sorted = history.sort((a, b) => a.timestamp - b.timestamp)
  const raw = sorted.map(h => h.value)

  // Trend: raw values (downsampled)
  let trend: number[]
  if (raw.length > 48) {
    const step = Math.floor(raw.length / 48)
    trend = raw.filter((_, i) => i % step === 0)
  } else {
    trend = raw
  }

  // Consumption: differences between consecutive readings
  const diffs: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i]!.value - sorted[i - 1]!.value
    if (diff >= 0) diffs.push(diff)
  }
  let consumption: number[]
  if (diffs.length > 48) {
    const step = Math.floor(diffs.length / 48)
    consumption = diffs.filter((_, i) => i % step === 0)
  } else {
    consumption = diffs
  }

  sparklineCache.set(varId, { trend, consumption })
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

function findCounterAndMeter(varId: number): { counter: import('@/types/cem').CemCounter; meter: import('@/types/cem').CemMeter | undefined } | null {
  for (const m of cemStore.meters) {
    const cs = cemStore.getCountersForMeter(m.id)
    const found = cs.find(c => c.id === varId)
    if (found) return { counter: found, meter: m }
  }
  return null
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
  chartMode: 'trend' | 'consumption',
  decimals: number,
) {
  // Lookup meter info for richer card content
  const info = findCounterAndMeter(varId)
  const counterTypeName = truncate(info?.counter.typeName || `Veličina ${varId}`, 22)
  const meterDescRaw = info?.meter?.description || info?.meter?.serial || (info?.meter ? `Měřidlo #${info.meter.id}` : '')
  const meterDesc = truncate(meterDescRaw, 28)

  const badgeW = 130
  const cached = sparklineCache.get(varId)
  const sparklineData = cached ? (chartMode === 'consumption' ? cached.consumption : cached.trend) : undefined
  const hasSparkline = sparklineData && sparklineData.length > 1

  // Layout (group origin = vertical center of badge)
  const bgY = -10
  const bgH = 56
  const headerY = -1     // baseline for type name (top row)
  const descY = 9        // baseline for meter desc
  const valueY = 27      // baseline for big value
  const sparkTop = 32
  const sparkH = 12

  const g = document.createElementNS(NS, 'g')
  g.setAttribute('class', BADGE_CLASS)
  g.setAttribute('data-var-id', String(varId))
  g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)

  // Background — near-black, ~75% opacity
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('x', String(-badgeW / 2))
  bg.setAttribute('y', String(bgY))
  bg.setAttribute('width', String(badgeW))
  bg.setAttribute('height', String(bgH))
  bg.setAttribute('rx', '6')
  bg.setAttribute('fill', 'rgba(15,18,28,0.75)')
  bg.setAttribute('stroke', 'rgba(255,255,255,0.10)')
  bg.setAttribute('stroke-width', '0.6')
  bg.setAttribute('cursor', 'grab')
  bg.setAttribute('pointer-events', 'all')
  g.appendChild(bg)

  // Color accent strip on left (rounded so it doesn't poke out of bg corners)
  const accent = document.createElementNS(NS, 'rect')
  accent.setAttribute('x', String(-badgeW / 2 + 3))
  accent.setAttribute('y', String(bgY + 4))
  accent.setAttribute('width', '2.5')
  accent.setAttribute('height', String(bgH - 8))
  accent.setAttribute('rx', '1.25')
  accent.setAttribute('fill', color)
  accent.setAttribute('opacity', String(opacity))
  accent.setAttribute('pointer-events', 'none')
  g.appendChild(accent)

  // Counter type (header)
  const typeT = document.createElementNS(NS, 'text')
  typeT.setAttribute('x', String(-badgeW / 2 + 11))
  typeT.setAttribute('y', String(headerY))
  typeT.setAttribute('font-size', '8.5')
  typeT.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
  typeT.setAttribute('font-weight', '600')
  typeT.setAttribute('fill', '#f3f4f6')
  typeT.setAttribute('opacity', String(opacity * 0.95))
  typeT.setAttribute('pointer-events', 'none')
  typeT.textContent = counterTypeName
  g.appendChild(typeT)

  // Meter description (subtitle)
  const descT = document.createElementNS(NS, 'text')
  descT.setAttribute('x', String(-badgeW / 2 + 11))
  descT.setAttribute('y', String(descY))
  descT.setAttribute('font-size', '6.5')
  descT.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
  descT.setAttribute('fill', '#9ca3af')
  descT.setAttribute('opacity', String(opacity * 0.85))
  descT.setAttribute('pointer-events', 'none')
  descT.textContent = meterDesc
  g.appendChild(descT)

  // Big semi-transparent value
  const label = document.createElementNS(NS, 'text')
  label.setAttribute('x', String(badgeW / 2 - 6))
  label.setAttribute('y', String(valueY))
  label.setAttribute('text-anchor', 'end')
  label.setAttribute('fill', '#ffffff')
  label.setAttribute('opacity', String(opacity * 0.55))
  label.setAttribute('font-size', '14')
  label.setAttribute('font-weight', '700')
  label.setAttribute('font-family', 'monospace')
  label.setAttribute('pointer-events', 'none')
  label.textContent = text
  g.appendChild(label)

  // Sparkline area — stroke uses a contrast-boosted variant of counter color
  const sparkLeft = -badgeW / 2 + 11
  const sparkRight = badgeW / 2 - 6
  const sparkSpan = sparkRight - sparkLeft
  const sparkColor = ensureContrastOnDark(color)
  if (hasSparkline) {
    const sparkPath = document.createElementNS(NS, 'polyline')
    const min = Math.min(...sparklineData)
    const max = Math.max(...sparklineData)
    const range = max - min || 1
    const pts = sparklineData.map((v, i) => {
      const x = sparkLeft + (i / (sparklineData.length - 1)) * sparkSpan
      const y = sparkTop + sparkH - ((v - min) / range) * (sparkH - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    sparkPath.setAttribute('points', pts)
    sparkPath.setAttribute('fill', 'none')
    sparkPath.setAttribute('stroke', sparkColor)
    sparkPath.setAttribute('stroke-width', '1.3')
    sparkPath.setAttribute('stroke-linejoin', 'round')
    sparkPath.setAttribute('stroke-linecap', 'round')
    sparkPath.setAttribute('opacity', String(opacity * 0.95))
    sparkPath.setAttribute('pointer-events', 'none')
    g.appendChild(sparkPath)
  } else {
    // No data — dashed baseline
    const noData = document.createElementNS(NS, 'line')
    noData.setAttribute('x1', String(sparkLeft))
    noData.setAttribute('y1', String(sparkTop + sparkH / 2))
    noData.setAttribute('x2', String(sparkRight))
    noData.setAttribute('y2', String(sparkTop + sparkH / 2))
    noData.setAttribute('stroke', 'rgba(255,255,255,0.25)')
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
      let newRotation = startRotation + (angle - startAngle)
      // Shift = snap to 90° increments
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 90) * 90
      }
      rotation = newRotation
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)
    }
  }

  function ensureAssignment(unit: Unit) {
    if (!unit.counterLayers) unit.counterLayers = []
    let a = unit.counterLayers.find(x => x.varId === varId)
    if (!a) {
      const ctr = findCounterAndMeter(varId)?.counter
      const layer: MediaLayer = ctr ? cemService.detectMediaLayer(ctr) : 'other'
      a = { varId, layer, auto: true }
      unit.counterLayers.push(a)
    }
    return a
  }

  function onEnd() {
    dragging = false
    rotating = false
    bg.setAttribute('cursor', 'grab')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)

    // Persist position + rotation (creates assignment if missing)
    const unit = buildingStore.building.units.find(u => u.id === unitId)
    if (!unit) return
    const a = ensureAssignment(unit)
    a.pos = { x: pos.x, y: pos.y }
    a.rotation = Math.round(rotation * 10) / 10
  }

  // Shift+click = auto-level (compensate floor rotation)
  function onClick(e: MouseEvent) {
    if (!e.shiftKey) return
    e.stopPropagation()
    e.preventDefault()
    rotation = -floorTotalRotation
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${rotation})`)
    // Persist
    const u = buildingStore.building.units.find(u => u.id === unitId)
    if (!u) return
    const a = ensureAssignment(u)
    a.rotation = Math.round(rotation * 10) / 10
  }

  bg.addEventListener('mousedown', onStart)
  bg.addEventListener('click', onClick)

  // Double-click opens chart modal
  function onDblClick(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    emit('counterClick', varId, unitId)
  }
  bg.addEventListener('dblclick', onDblClick)

  cleanupHandlers.push(() => {
    bg.removeEventListener('mousedown', onStart)
    bg.removeEventListener('click', onClick)
    bg.removeEventListener('dblclick', onDblClick)
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
  })

  svgRoot.appendChild(g)
}

// --- Overlay filter state (controlled from IndoorView) ---
let overlayMediaFilter: Set<string> = new Set() // empty = show all
let overlayVizMode: 'badge' | 'sparkline' | 'heatmap' = 'badge'
let overlayLayerOpacity: Record<string, number> = {}
let floorTotalRotation = 0

function setFloorRotation(rot: number) {
  floorTotalRotation = rot
}

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

    // Each counter gets its own badge — match UnitPanel: render every counter
    // under bound objects, regardless of isService flag.
    let offsetIndex = 0
    for (const objId of unit.cemObjectIds) {
      const counters = cemStore.getCountersForObject(objId)
      for (const c of counters) {
        if (!matchesMediaFilter(unit, c.id, c)) continue

        const layer = getCounterLayer(unit, c.id, c)
        const mediaKey = layerToMediaKey[layer] ?? ''
        const opacity = mediaKey ? getLayerOpacity(mediaKey) : 1
        if (opacity <= 0) continue

        // Get saved position/rotation or default stacked below centroid
        const assignment = unit.counterLayers?.find(a => a.varId === c.id)
        const pos = assignment?.pos
          ? { x: assignment.pos.x, y: assignment.pos.y }
          : { x: centroid.x, y: centroid.y + 30 + offsetIndex * 60 }
        const rotation = assignment?.rotation ?? 0

        const decimals = assignment?.decimals ?? 1
        const val = c.lastValue != null ? `${c.lastValue.toFixed(decimals)} ${c.unit}` : '--'
        const mode = getDefaultChart(unit, c.id)
        createCounterBadge(svgRoot, pos, rotation, c.color, val, opacity, unit.id, c.id, mode, decimals)
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

defineExpose({ applyAllStyles, setOverlayFilter, setFloorRotation })

onUnmounted(cleanupAll)
</script>

<template>
  <span style="display: none" />
</template>
