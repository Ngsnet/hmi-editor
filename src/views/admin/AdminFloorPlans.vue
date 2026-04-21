<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildingStore } from '@/stores/buildingStore'
import { saveFloorplanSvg, loadFloorplanSvg, deleteFloorplanSvg } from '@/utils/floorplanStorage'
import type { FloorId, Unit } from '@/types/indoor'

const buildingStore = useBuildingStore()
const router = useRouter()

const selectedFloor = ref<FloorId>(buildingStore.sortedFloors[0]?.id ?? '')
const svgPreview = ref<string>('')
const foundIds = ref<string[]>([])
const uploading = ref(false)
const svgPreviewEl = ref<HTMLDivElement | null>(null)

// Interactive selection
const clickedSvgId = ref<string | null>(null)
const highlightedEl = ref<Element | null>(null)
const selectedBBox = ref<{ width: number; height: number; area: number } | null>(null)

// Scale factor: SVG units per real meter - persisted per floor
const svgUnitsPerMeter = computed({
  get: () => currentFloor.value?.svgUnitsPerMeter ?? 1,
  set: (v: number) => {
    if (currentFloor.value) currentFloor.value.svgUnitsPerMeter = v
  },
})

// Preview zoom/pan
const previewZoom = ref(1)
const previewPanX = ref(0)
const previewPanY = ref(0)
let isPanning = false
let panStartX = 0
let panStartY = 0
let panStartPanX = 0
let panStartPanY = 0

function onPreviewWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(20, Math.max(0.2, previewZoom.value * delta))

  // Zoom towards cursor
  const rect = svgPreviewEl.value?.getBoundingClientRect()
  if (rect) {
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    previewPanX.value = mx - (mx - previewPanX.value) * (newZoom / previewZoom.value)
    previewPanY.value = my - (my - previewPanY.value) * (newZoom / previewZoom.value)
  }

  previewZoom.value = newZoom
}

function onPreviewPointerDown(e: PointerEvent) {
  // Middle button or shift+left for panning
  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    e.preventDefault()
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    panStartPanX = previewPanX.value
    panStartPanY = previewPanY.value
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
}

function onPreviewPointerMove(e: PointerEvent) {
  if (isPanning) {
    previewPanX.value = panStartPanX + (e.clientX - panStartX)
    previewPanY.value = panStartPanY + (e.clientY - panStartY)
  }
}

function onPreviewPointerUp(e: PointerEvent) {
  if (isPanning) {
    isPanning = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }
}

function resetPreviewZoom() {
  previewZoom.value = 1
  previewPanX.value = 0
  previewPanY.value = 0
}

// Drawing mode - polygon tool for creating unit areas
const drawing = ref(false)
const drawPoints = ref<Array<{ x: number; y: number }>>([])
const drawPreviewEl = ref<SVGPolygonElement | null>(null)
const drawMousePos = ref<{ x: number; y: number } | null>(null)

// Editing mode - edit vertices of existing polygon/rect
const editing = ref(false)
const editPoints = ref<Array<{ x: number; y: number }>>([])
const editDraggingIdx = ref<number | null>(null)
const editElementId = ref<string | null>(null)

// Calibration mode
const calibrating = ref(false)
const calibPoint1 = ref<{ x: number; y: number } | null>(null)
const calibPoint2 = ref<{ x: number; y: number } | null>(null)
const calibRealDistance = ref<number>(10)
const calibSvgDistance = computed(() => {
  if (!calibPoint1.value || !calibPoint2.value) return null
  const dx = calibPoint2.value.x - calibPoint1.value.x
  const dy = calibPoint2.value.y - calibPoint1.value.y
  return Math.sqrt(dx * dx + dy * dy)
})

const currentFloor = computed(() =>
  buildingStore.building.floors.find(f => f.id === selectedFloor.value)
)

// Units expected on this floor
const expectedUnitIds = computed(() =>
  buildingStore.building.units
    .filter(u => u.floor === selectedFloor.value)
    .map(u => u.svgPathId)
)

// Compare found IDs vs expected
const matchedIds = computed(() =>
  foundIds.value.filter(id => expectedUnitIds.value.includes(id))
)

const unmatchedSvgIds = computed(() =>
  foundIds.value.filter(id => !expectedUnitIds.value.includes(id))
)

const missingInSvg = computed(() =>
  expectedUnitIds.value.filter(id => !foundIds.value.includes(id))
)

// Unit assigned to the clicked SVG element (on current floor only)
const assignedUnit = computed<Unit | null>(() => {
  if (!clickedSvgId.value) return null
  return buildingStore.building.units.find(
    u => u.svgPathId === clickedSvgId.value && u.floor === selectedFloor.value
  ) ?? null
})

// All unit IDs on this floor (for the assign dropdown)
const allSvgElementIds = computed(() => foundIds.value)

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.name.endsWith('.svg')) return

  const reader = new FileReader()
  reader.onload = async () => {
    const text = reader.result as string
    svgPreview.value = text
    parseSvgIds(text)
    // Save to IndexedDB immediately so it persists
    await saveFloorplanSvg(selectedFloor.value, text)
    await nextTick()
    setupClickHandlers()
  }
  reader.readAsText(file)
}

function parseSvgIds(text: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'image/svg+xml')
  const allElements = doc.querySelectorAll('[id^="unit-"]')
  foundIds.value = Array.from(allElements).map(el => el.id)
}

function setupClickHandlers() {
  if (!svgPreviewEl.value) return

  // Make all elements with id clickable (hover styles only)
  const allEls = svgPreviewEl.value.querySelectorAll('[id]')
  allEls.forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.style.cursor = 'pointer'
    htmlEl.addEventListener('mouseenter', () => {
      if (el !== highlightedEl.value && !calibrating.value) {
        htmlEl.style.filter = 'brightness(0.85)'
      }
    })
    htmlEl.addEventListener('mouseleave', () => {
      if (el !== highlightedEl.value) {
        htmlEl.style.filter = ''
      }
    })
  })
}

// Single delegated click handler on the container - handles editing, drawing, calibration, selection
function onPreviewClick(e: MouseEvent) {
  if (!svgPreviewEl.value) return

  if (editing.value) return // handled by direct listeners on handles

  if (drawing.value) {
    handleDrawClick(e)
    return
  }

  if (calibrating.value) {
    handleCalibrationClick(e)
    return
  }

  // Find closest element with an id (for unit selection)
  const target = e.target as Element
  const elWithId = target.closest('[id]')
  if (elWithId && svgPreviewEl.value.contains(elWithId)) {
    selectSvgElement(elWithId.id)
  }
}

function onPreviewDblClick(e: MouseEvent) {
  if (drawing.value) {
    e.preventDefault()
    handleDrawDblClick()
  }
}

function onPreviewMouseMove(e: MouseEvent) {
  if (editing.value) {
    handleEditPointerMove(e)
    return
  }
  if (drawing.value) {
    handleDrawMouseMove(e)
  }
}

function onPreviewMouseUp() {
  if (editing.value) {
    handleEditPointerUp()
  }
}

function onPreviewContextMenu(e: MouseEvent) {
  if (editing.value) {
    handleEditContextMenu(e)
  }
}

function handleCalibrationClick(e: MouseEvent) {
  const svgRoot = svgPreviewEl.value?.querySelector('svg') as SVGSVGElement | null
  if (!svgRoot) return

  // Convert screen coords to SVG coords
  const ctm = svgRoot.getScreenCTM()
  if (!ctm) return

  const pt = new DOMPoint(e.clientX, e.clientY)
  const svgPt = pt.matrixTransform(ctm.inverse())

  if (!calibPoint1.value) {
    calibPoint1.value = { x: svgPt.x, y: svgPt.y }
    drawCalibMarker(svgPt.x, svgPt.y, 'calib-marker-1')
  } else if (!calibPoint2.value) {
    calibPoint2.value = { x: svgPt.x, y: svgPt.y }
    drawCalibMarker(svgPt.x, svgPt.y, 'calib-marker-2')
    drawCalibLine()
  }
}

function drawCalibMarker(x: number, y: number, id: string) {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return
  // Remove if exists
  svgRoot.querySelector(`#${id}`)?.remove()
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('id', id)
  circle.setAttribute('cx', String(x))
  circle.setAttribute('cy', String(y))
  circle.setAttribute('r', '6')
  circle.setAttribute('fill', '#ef4444')
  circle.setAttribute('stroke', '#fff')
  circle.setAttribute('stroke-width', '2')
  circle.style.pointerEvents = 'none'
  svgRoot.appendChild(circle)
}

function drawCalibLine() {
  if (!calibPoint1.value || !calibPoint2.value) return
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return
  svgRoot.querySelector('#calib-line')?.remove()
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.setAttribute('id', 'calib-line')
  line.setAttribute('x1', String(calibPoint1.value.x))
  line.setAttribute('y1', String(calibPoint1.value.y))
  line.setAttribute('x2', String(calibPoint2.value.x))
  line.setAttribute('y2', String(calibPoint2.value.y))
  line.setAttribute('stroke', '#ef4444')
  line.setAttribute('stroke-width', '2')
  line.setAttribute('stroke-dasharray', '6 4')
  line.style.pointerEvents = 'none'
  svgRoot.appendChild(line)
}

function clearCalibMarkers() {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return
  svgRoot.querySelector('#calib-marker-1')?.remove()
  svgRoot.querySelector('#calib-marker-2')?.remove()
  svgRoot.querySelector('#calib-line')?.remove()
}

function startCalibration() {
  calibrating.value = true
  calibPoint1.value = null
  calibPoint2.value = null
  clearCalibMarkers()
  clearSelection()
}

function cancelCalibration() {
  calibrating.value = false
  calibPoint1.value = null
  calibPoint2.value = null
  clearCalibMarkers()
}

function applyCalibration() {
  if (!calibSvgDistance.value || !calibRealDistance.value) return
  svgUnitsPerMeter.value = +(calibSvgDistance.value / calibRealDistance.value).toFixed(4)
  cancelCalibration()
}

function selectSvgElement(id: string) {
  // Clear previous highlight
  if (highlightedEl.value) {
    ;(highlightedEl.value as HTMLElement).style.outline = ''
    ;(highlightedEl.value as HTMLElement).style.filter = ''
  }

  clickedSvgId.value = id
  selectedBBox.value = null

  // Highlight selected and compute bbox
  if (svgPreviewEl.value) {
    const el = svgPreviewEl.value.querySelector(`#${CSS.escape(id)}`)
    if (el) {
      ;(el as HTMLElement).style.outline = '3px solid #2196F3'
      ;(el as HTMLElement).style.filter = 'brightness(0.8)'
      highlightedEl.value = el

      // Compute area from SVG bbox
      const svgEl = el as SVGGraphicsElement
      if (typeof svgEl.getBBox === 'function') {
        try {
          const bbox = svgEl.getBBox()
          const s = svgUnitsPerMeter.value
          const w = bbox.width / s
          const h = bbox.height / s
          selectedBBox.value = {
            width: +w.toFixed(1),
            height: +h.toFixed(1),
            area: +(w * h).toFixed(1),
          }
        } catch { /* getBBox can throw if element not rendered */ }
      }
    }
  }
}

async function onIdChange(newId: string) {
  newId = newId.trim()
  if (!newId || !clickedSvgId.value || !svgPreviewEl.value) return
  if (newId === clickedSvgId.value) return

  // Check for duplicates
  const existing = svgPreviewEl.value.querySelector(`#${CSS.escape(newId)}`)
  if (existing) {
    alert(`Element s ID "${newId}" již existuje.`)
    return
  }

  const oldId = clickedSvgId.value

  // Rename in SVG
  const el = svgPreviewEl.value.querySelector(`#${CSS.escape(oldId)}`)
  if (el) {
    el.setAttribute('id', newId)
  }

  // Update unit in store
  const unit = buildingStore.building.units.find(u => u.svgPathId === oldId)
  if (unit) {
    unit.svgPathId = newId
  }

  // Update foundIds
  const idx = foundIds.value.indexOf(oldId)
  if (idx >= 0) foundIds.value[idx] = newId

  // Save SVG
  const svgRoot = svgPreviewEl.value.querySelector('svg')
  if (svgRoot) {
    const updatedSvg = svgRoot.outerHTML
    await saveFloorplanSvg(selectedFloor.value, updatedSvg)
    svgPreview.value = updatedSvg
  }

  // Update selection
  clickedSvgId.value = newId
  await nextTick()
  setupClickHandlers()
  selectSvgElement(newId)
}

function onNameChange(name: string) {
  // Update unit name in store
  if (assignedUnit.value) {
    assignedUnit.value.name = name
  }
  // Update text label in SVG
  if (clickedSvgId.value && svgPreviewEl.value) {
    const el = svgPreviewEl.value.querySelector(`#${CSS.escape(clickedSvgId.value)}`)
    if (el) {
      const textEl = el.nextElementSibling
      if (textEl && textEl.tagName === 'text') {
        textEl.textContent = name
      }
    }
    // Auto-save SVG
    const svgRoot = svgPreviewEl.value.querySelector('svg')
    if (svgRoot) saveFloorplanSvg(selectedFloor.value, svgRoot.outerHTML)
  }
}

function onDimChange(dim: 'width' | 'height', value: number) {
  if (!selectedBBox.value) {
    selectedBBox.value = { width: 0, height: 0, area: 0 }
  }
  selectedBBox.value[dim] = value
  selectedBBox.value.area = +(selectedBBox.value.width * selectedBBox.value.height).toFixed(1)
  syncAreaToUnit()
}

function onAreaChange(value: number) {
  if (!selectedBBox.value) {
    selectedBBox.value = { width: 0, height: 0, area: 0 }
  }
  selectedBBox.value.area = value
  syncAreaToUnit()
}

function syncAreaToUnit() {
  if (!assignedUnit.value || !selectedBBox.value) return
  assignedUnit.value.area = +selectedBBox.value.area.toFixed(0)
  assignedUnit.value.rentableArea = +selectedBBox.value.area.toFixed(0)
  assignedUnit.value.chargeableArea = +selectedBBox.value.area.toFixed(0)
}

async function deleteElementById(id: string) {
  if (!confirm(`Smazat element "${id}" ze SVG?`)) return

  // Work with the SVG string directly using a temp container (not v-html DOM)
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = svgPreview.value

  const el = tempDiv.querySelector(`#${CSS.escape(id)}`)
  if (!el) return
  // Only protect the actual root <svg> of the document
  const isRoot = el.tagName.toLowerCase() === 'svg' && el === tempDiv.querySelector(':scope > svg')
  if (isRoot) {
    alert('Nelze smazat kořenový SVG element.')
    return
  }

  const nextEl = el.nextElementSibling
  if (nextEl && nextEl.tagName.toLowerCase() === 'text') {
    nextEl.remove()
  }
  el.remove()

  const svgRoot = tempDiv.querySelector('svg')
  if (!svgRoot) return

  const updatedSvg = svgRoot.outerHTML
  await saveFloorplanSvg(selectedFloor.value, updatedSvg)

  foundIds.value = foundIds.value.filter(fid => fid !== id)

  const unitIdx = buildingStore.building.units.findIndex(u => u.svgPathId === id)
  if (unitIdx >= 0) buildingStore.building.units.splice(unitIdx, 1)

  clearSelection()

  svgPreview.value = ''
  await nextTick()
  svgPreview.value = updatedSvg
  await nextTick()
  setupClickHandlers()
}

async function deleteSvgElement() {
  if (!clickedSvgId.value) return
  await deleteElementById(clickedSvgId.value)
}

function clearSelection() {
  if (highlightedEl.value) {
    ;(highlightedEl.value as HTMLElement).style.outline = ''
    ;(highlightedEl.value as HTMLElement).style.filter = ''
    highlightedEl.value = null
  }
  clickedSvgId.value = null
  selectedBBox.value = null
}

function createUnitFromSvg() {
  if (!clickedSvgId.value) return
  const id = `unit-${Date.now()}`
  const computedArea = selectedBBox.value?.area ?? 0
  buildingStore.building.units.push({
    id,
    name: clickedSvgId.value,
    svgPathId: clickedSvgId.value,
    floor: selectedFloor.value,
    area: +computedArea.toFixed(0),
    rentableArea: +computedArea.toFixed(0),
    chargeableArea: +computedArea.toFixed(0),
    tenant: '',
    category: 'empty',
    meters: {},
  })
  router.push({ name: 'admin-unit-detail', params: { id } })
}

function assignExistingUnit(unitId: string) {
  if (!clickedSvgId.value) return
  const unit = buildingStore.building.units.find(u => u.id === unitId)
  if (unit) {
    unit.svgPathId = clickedSvgId.value
    unit.floor = selectedFloor.value
  }
  clearSelection()
}

function goToUnit(unitId: string) {
  router.push({ name: 'admin-unit-detail', params: { id: unitId } })
}

// Unassigned units (no svgPathId match in current SVG, or empty svgPathId)
const unassignedUnits = computed(() =>
  buildingStore.building.units.filter(u =>
    u.floor === selectedFloor.value && !foundIds.value.includes(u.svgPathId)
  )
)

async function uploadFloorPlan() {
  if (!svgPreview.value || !currentFloor.value) return
  uploading.value = true

  try {
    await saveFloorplanSvg(selectedFloor.value, svgPreview.value)
    alert(`Půdorys pro ${currentFloor.value.label} uložen.`)
  } finally {
    uploading.value = false
  }
}

// Load existing SVG preview from IndexedDB
async function loadExisting() {
  if (!currentFloor.value) return
  svgPreview.value = ''
  foundIds.value = []
  clearSelection()

  const stored = await loadFloorplanSvg(selectedFloor.value)
  if (stored) {
    svgPreview.value = stored
    parseSvgIds(stored)
    await nextTick()
    setupClickHandlers()
  }
}

// Recalculate area when scale changes
watch(svgUnitsPerMeter, () => {
  if (clickedSvgId.value) selectSvgElement(clickedSvgId.value)
})

// --- Polygon editing ---
function getElementPoints(el: Element): Array<{ x: number; y: number }> {
  const tag = el.tagName.toLowerCase()
  if (tag === 'polygon' || tag === 'polyline') {
    const pointsAttr = el.getAttribute('points') || ''
    return pointsAttr.trim().split(/\s+/).map(pair => {
      const [x, y] = pair.split(',').map(Number)
      return { x, y }
    }).filter(p => !isNaN(p.x) && !isNaN(p.y))
  }
  if (tag === 'rect') {
    const x = +el.getAttribute('x')!
    const y = +el.getAttribute('y')!
    const w = +el.getAttribute('width')!
    const h = +el.getAttribute('height')!
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }
  if (tag === 'path') {
    // Basic path parsing for M/L commands
    const d = el.getAttribute('d') || ''
    const pts: Array<{ x: number; y: number }> = []
    const regex = /([ML])\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/gi
    let match
    while ((match = regex.exec(d)) !== null) {
      pts.push({ x: +match[2], y: +match[3] })
    }
    return pts
  }
  return []
}

function canEditElement(): boolean {
  if (!clickedSvgId.value || !svgPreviewEl.value) return false
  const el = svgPreviewEl.value.querySelector(`#${CSS.escape(clickedSvgId.value)}`)
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return ['polygon', 'polyline', 'rect', 'path'].includes(tag)
}

function startEditing() {
  if (!clickedSvgId.value || !svgPreviewEl.value) return
  const el = svgPreviewEl.value.querySelector(`#${CSS.escape(clickedSvgId.value)}`)
  if (!el) return

  editing.value = true
  editElementId.value = clickedSvgId.value
  editPoints.value = getElementPoints(el)
  editDraggingIdx.value = null

  // If rect, convert to polygon in SVG
  if (el.tagName.toLowerCase() === 'rect') {
    convertRectToPolygon(el)
  }

  renderEditHandles()
}

function convertRectToPolygon(el: Element) {
  const pts = getElementPoints(el)
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  polygon.setAttribute('id', el.id)
  polygon.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '))
  // Copy styles
  for (const attr of ['fill', 'stroke', 'stroke-width', 'opacity']) {
    const v = el.getAttribute(attr)
    if (v) polygon.setAttribute(attr, v)
  }
  el.replaceWith(polygon)
}

function cancelEditing() {
  editing.value = false
  editPoints.value = []
  editDraggingIdx.value = null
  editElementId.value = null
  clearEditHandles()
}

async function finishEditing() {
  if (!editElementId.value || !svgPreviewEl.value) return

  const el = svgPreviewEl.value.querySelector(`#${CSS.escape(editElementId.value)}`)
  if (el) {
    applyPointsToElement(el, editPoints.value)
  }

  clearEditHandles()

  // Save updated SVG
  const svgRoot = svgPreviewEl.value.querySelector('svg')
  if (svgRoot) {
    await saveFloorplanSvg(selectedFloor.value, svgRoot.outerHTML)
    svgPreview.value = svgRoot.outerHTML
  }

  // Recompute area
  if (clickedSvgId.value) {
    recomputePolygonArea()
  }

  editing.value = false
  editPoints.value = []
  editDraggingIdx.value = null
  editElementId.value = null
}

function applyPointsToElement(el: Element, pts: Array<{ x: number; y: number }>) {
  const tag = el.tagName.toLowerCase()
  if (tag === 'polygon' || tag === 'polyline') {
    el.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '))
  } else if (tag === 'path') {
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    el.setAttribute('d', d)
  }
}

function recomputePolygonArea() {
  if (editPoints.value.length < 3) return
  const pts = editPoints.value
  let areaSum = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    areaSum += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  const svgArea = Math.abs(areaSum) / 2
  const s = svgUnitsPerMeter.value
  const w = 0
  const h = 0
  selectedBBox.value = {
    width: w,
    height: h,
    area: +(svgArea / (s * s)).toFixed(1),
  }
}

function renderEditHandles() {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return

  clearEditHandles()

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('id', 'edit-handles-group')

  // Draw edges with midpoint handles
  for (let i = 0; i < editPoints.value.length; i++) {
    const p = editPoints.value[i]
    const next = editPoints.value[(i + 1) % editPoints.value.length]

    // Edge line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(p.x))
    line.setAttribute('y1', String(p.y))
    line.setAttribute('x2', String(next.x))
    line.setAttribute('y2', String(next.y))
    line.setAttribute('stroke', '#2196F3')
    line.setAttribute('stroke-width', '1.5')
    line.setAttribute('stroke-dasharray', '4 2')
    line.style.pointerEvents = 'none'
    g.appendChild(line)

    // Midpoint handle (for inserting new vertex)
    const mx = (p.x + next.x) / 2
    const my = (p.y + next.y) / 2
    const mid = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    mid.setAttribute('cx', String(mx))
    mid.setAttribute('cy', String(my))
    mid.setAttribute('r', '4')
    mid.setAttribute('fill', '#2196F3')
    mid.setAttribute('fill-opacity', '0.4')
    mid.setAttribute('stroke', '#2196F3')
    mid.setAttribute('stroke-width', '1')
    mid.style.cursor = 'pointer'
    const midIdx = i
    mid.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const p1 = editPoints.value[midIdx]
      const p2 = editPoints.value[(midIdx + 1) % editPoints.value.length]
      const newPt = { x: +(((p1.x + p2.x) / 2).toFixed(1)), y: +(((p1.y + p2.y) / 2).toFixed(1)) }
      editPoints.value.splice(midIdx + 1, 0, newPt)
      editDraggingIdx.value = midIdx + 1
      updateEditElement()
      renderEditHandles()
    })
    g.appendChild(mid)
  }

  // Vertex handles
  for (let i = 0; i < editPoints.value.length; i++) {
    const p = editPoints.value[i]
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', String(p.x))
    circle.setAttribute('cy', String(p.y))
    circle.setAttribute('r', '6')
    circle.setAttribute('fill', '#fff')
    circle.setAttribute('stroke', '#2196F3')
    circle.setAttribute('stroke-width', '2')
    circle.style.cursor = 'move'
    const vtxIdx = i
    circle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      editDraggingIdx.value = vtxIdx
    })
    circle.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (editPoints.value.length > 3) {
        editPoints.value.splice(vtxIdx, 1)
        updateEditElement()
        renderEditHandles()
      }
    })
    g.appendChild(circle)
  }

  svgRoot.appendChild(g)
}

function clearEditHandles() {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return
  svgRoot.querySelector('#edit-handles-group')?.remove()
}

function handleEditPointerDown(e: MouseEvent) {
  const target = e.target as SVGElement
  if (!target.dataset) return

  if (target.dataset.vertexIdx != null) {
    editDraggingIdx.value = +target.dataset.vertexIdx
    e.preventDefault()
    e.stopPropagation()
  } else if (target.dataset.midIdx != null) {
    // Insert new vertex at midpoint
    const idx = +target.dataset.midIdx
    const p1 = editPoints.value[idx]
    const p2 = editPoints.value[(idx + 1) % editPoints.value.length]
    const newPt = { x: +(((p1.x + p2.x) / 2).toFixed(1)), y: +(((p1.y + p2.y) / 2).toFixed(1)) }
    editPoints.value.splice(idx + 1, 0, newPt)
    editDraggingIdx.value = idx + 1
    updateEditElement()
    renderEditHandles()
    e.preventDefault()
    e.stopPropagation()
  }
}

function handleEditPointerMove(e: MouseEvent) {
  if (editDraggingIdx.value == null) return
  const pt = screenToSvg(e)
  if (!pt) return
  editPoints.value[editDraggingIdx.value] = pt
  updateEditElement()
  renderEditHandles()
}

function handleEditPointerUp() {
  editDraggingIdx.value = null
}

function handleEditContextMenu(e: MouseEvent) {
  const target = e.target as SVGElement
  if (target.dataset?.vertexIdx != null && editPoints.value.length > 3) {
    e.preventDefault()
    editPoints.value.splice(+target.dataset.vertexIdx, 1)
    updateEditElement()
    renderEditHandles()
  }
}

function updateEditElement() {
  if (!editElementId.value || !svgPreviewEl.value) return
  const el = svgPreviewEl.value.querySelector(`#${CSS.escape(editElementId.value)}`)
  if (el) {
    applyPointsToElement(el, editPoints.value)
  }
}

// --- Drawing mode ---
function startDrawing() {
  drawing.value = true
  drawPoints.value = []
  drawMousePos.value = null
  clearSelection()
  cancelCalibration()
  clearDrawPreview()
}

function cancelDrawing() {
  drawing.value = false
  drawPoints.value = []
  drawMousePos.value = null
  clearDrawPreview()
}

function screenToSvg(e: MouseEvent): { x: number; y: number } | null {
  const svgRoot = svgPreviewEl.value?.querySelector('svg') as SVGSVGElement | null
  if (!svgRoot) return null
  const ctm = svgRoot.getScreenCTM()
  if (!ctm) return null
  const pt = new DOMPoint(e.clientX, e.clientY)
  const svgPt = pt.matrixTransform(ctm.inverse())
  return { x: +svgPt.x.toFixed(1), y: +svgPt.y.toFixed(1) }
}

function handleDrawClick(e: MouseEvent) {
  const pt = screenToSvg(e)
  if (!pt) return
  drawPoints.value.push(pt)
  updateDrawPreview()
}

function handleDrawDblClick() {
  if (drawPoints.value.length < 3) return
  finishDrawing()
}

function handleDrawMouseMove(e: MouseEvent) {
  if (!drawing.value || drawPoints.value.length === 0) return
  drawMousePos.value = screenToSvg(e)
  updateDrawPreview()
}

function handleKeyDown(e: KeyboardEvent) {
  if (editing.value) {
    if (e.key === 'Escape') cancelEditing()
    else if (e.key === 'Enter') finishEditing()
    return
  }
  if (!drawing.value) return
  if (e.key === 'Escape') {
    cancelDrawing()
  } else if (e.key === 'Backspace' && drawPoints.value.length > 0) {
    drawPoints.value.pop()
    updateDrawPreview()
  } else if (e.key === 'Enter' && drawPoints.value.length >= 3) {
    finishDrawing()
  }
}

function updateDrawPreview() {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return

  // Remove old preview elements
  svgRoot.querySelector('#draw-preview')?.remove()
  svgRoot.querySelector('#draw-points-group')?.remove()

  if (drawPoints.value.length === 0) return

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('id', 'draw-points-group')
  g.style.pointerEvents = 'none'

  // Draw polygon preview
  const allPts = [...drawPoints.value]
  if (drawMousePos.value) allPts.push(drawMousePos.value)

  if (allPts.length >= 2) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('id', 'draw-preview')
    polygon.setAttribute('points', allPts.map(p => `${p.x},${p.y}`).join(' '))
    polygon.setAttribute('fill', 'rgba(33, 150, 243, 0.2)')
    polygon.setAttribute('stroke', '#2196F3')
    polygon.setAttribute('stroke-width', '2')
    polygon.setAttribute('stroke-dasharray', '6 3')
    polygon.style.pointerEvents = 'none'
    svgRoot.appendChild(polygon)
  }

  // Draw vertex markers
  for (let i = 0; i < drawPoints.value.length; i++) {
    const p = drawPoints.value[i]
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', String(p.x))
    circle.setAttribute('cy', String(p.y))
    circle.setAttribute('r', '4')
    circle.setAttribute('fill', i === 0 ? '#22c55e' : '#2196F3')
    circle.setAttribute('stroke', '#fff')
    circle.setAttribute('stroke-width', '1.5')
    g.appendChild(circle)
  }

  svgRoot.appendChild(g)
}

function clearDrawPreview() {
  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return
  svgRoot.querySelector('#draw-preview')?.remove()
  svgRoot.querySelector('#draw-points-group')?.remove()
}

async function finishDrawing() {
  if (drawPoints.value.length < 3) return

  const svgRoot = svgPreviewEl.value?.querySelector('svg')
  if (!svgRoot) return

  // Generate unit ID — prefixed with floor ID for cross-floor uniqueness
  const floorPrefix = selectedFloor.value.toLowerCase().replace(/\s+/g, '-')
  const floorPattern = new RegExp(`^unit-${floorPrefix}-(\\d+)$`)
  const existingNums = foundIds.value
    .map(id => floorPattern.exec(id))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => parseInt(m[1]!, 10))
  // Also check simple unit-XX pattern for backwards compatibility
  const simpleNums = foundIds.value
    .filter(id => /^unit-\d+$/.test(id))
    .map(id => parseInt(id.replace('unit-', ''), 10))
    .filter(n => !isNaN(n))
  const nextNum = Math.max(0, ...existingNums, ...simpleNums) + 1
  const unitSvgId = `unit-${floorPrefix}-${String(nextNum).padStart(2, '0')}`

  // Clear preview
  clearDrawPreview()

  // Create polygon element in SVG
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  polygon.setAttribute('id', unitSvgId)
  polygon.setAttribute('points', drawPoints.value.map(p => `${p.x},${p.y}`).join(' '))
  polygon.setAttribute('fill', '#fff')
  polygon.setAttribute('stroke', '#999')
  polygon.setAttribute('stroke-width', '1.5')
  svgRoot.appendChild(polygon)

  // Add text label at centroid
  const cx = drawPoints.value.reduce((s, p) => s + p.x, 0) / drawPoints.value.length
  const cy = drawPoints.value.reduce((s, p) => s + p.y, 0) / drawPoints.value.length
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', String(+cx.toFixed(1)))
  text.setAttribute('y', String(+cy.toFixed(1)))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('fill', '#1a1a1a')
  text.setAttribute('font-size', '14')
  text.setAttribute('font-weight', '600')
  text.setAttribute('font-family', 'sans-serif')
  text.setAttribute('paint-order', 'stroke')
  text.setAttribute('stroke', '#ffffff')
  text.setAttribute('stroke-width', '3')
  text.setAttribute('stroke-linejoin', 'round')
  text.textContent = unitSvgId
  svgRoot.appendChild(text)

  // Compute area using shoelace formula
  const pts = drawPoints.value
  let areaSum = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    areaSum += pts[i].x * pts[j].y
    areaSum -= pts[j].x * pts[i].y
  }
  const svgArea = Math.abs(areaSum) / 2
  const s = svgUnitsPerMeter.value
  const realArea = +(svgArea / (s * s)).toFixed(0)

  // Save updated SVG to IndexedDB
  const updatedSvg = svgRoot.outerHTML
  await saveFloorplanSvg(selectedFloor.value, updatedSvg)
  svgPreview.value = updatedSvg

  // Update found IDs
  foundIds.value.push(unitSvgId)

  // Create unit in building store
  const unitId = `unit-${Date.now()}`
  buildingStore.building.units.push({
    id: unitId,
    name: unitSvgId,
    svgPathId: unitSvgId,
    floor: selectedFloor.value,
    area: realArea,
    rentableArea: realArea,
    chargeableArea: realArea,
    tenant: '',
    category: 'empty',
    meters: {},
  })

  // Reset drawing
  drawing.value = false
  drawPoints.value = []
  drawMousePos.value = null

  // Re-setup click handlers
  await nextTick()
  setupClickHandlers()

  // Select the new unit
  selectSvgElement(unitSvgId)
}

// --- Floor management ---
const showAddFloor = ref(false)
const newFloorId = ref('')
const newFloorLabel = ref('')

function addFloor() {
  const id = newFloorId.value.trim()
  const label = newFloorLabel.value.trim()
  if (!id || !label) return
  if (buildingStore.building.floors.some(f => f.id === id)) {
    alert(`Patro s ID "${id}" již existuje.`)
    return
  }

  const maxOrder = Math.max(0, ...buildingStore.building.floors.map(f => f.order))
  buildingStore.building.floors.push({
    id,
    label,
    svgPath: `/floorplans/${id}.svg`,
    order: maxOrder + 1,
    totalArea: 0,
    rentableArea: 0,
    chargeableArea: 0,
    svgUnitsPerMeter: 1,
  })

  newFloorId.value = ''
  newFloorLabel.value = ''
  showAddFloor.value = false
  selectedFloor.value = id
  loadExisting()
}

function deleteFloor(floorId: string) {
  const unitsOnFloor = buildingStore.building.units.filter(u => u.floor === floorId)
  const msg = unitsOnFloor.length > 0
    ? `Patro "${floorId}" obsahuje ${unitsOnFloor.length} jednotek. Smazat patro i jednotky?`
    : `Opravdu smazat patro "${floorId}"?`
  if (!confirm(msg)) return

  // Remove units on this floor
  buildingStore.building.units = buildingStore.building.units.filter(u => u.floor !== floorId)
  // Remove floor
  buildingStore.building.floors = buildingStore.building.floors.filter(f => f.id !== floorId)
  // Remove stored SVG
  deleteFloorplanSvg(floorId)

  if (selectedFloor.value === floorId) {
    selectedFloor.value = buildingStore.sortedFloors[0]?.id ?? ''
    loadExisting()
  }
}

function moveFloor(floorId: string, direction: 'up' | 'down') {
  const floors = buildingStore.building.floors
  const idx = floors.findIndex(f => f.id === floorId)
  if (idx < 0) return
  const sorted = [...floors].sort((a, b) => a.order - b.order)
  const sortedIdx = sorted.findIndex(f => f.id === floorId)

  if (direction === 'up' && sortedIdx > 0) {
    const temp = sorted[sortedIdx].order
    sorted[sortedIdx].order = sorted[sortedIdx - 1].order
    sorted[sortedIdx - 1].order = temp
  } else if (direction === 'down' && sortedIdx < sorted.length - 1) {
    const temp = sorted[sortedIdx].order
    sorted[sortedIdx].order = sorted[sortedIdx + 1].order
    sorted[sortedIdx + 1].order = temp
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

loadExisting()
</script>

<template>
  <div class="floorplans-page">
    <div class="page-header">
      <h2 class="page-title">Půdorysy</h2>
    </div>

    <!-- Floor selector -->
    <div class="floor-selector">
      <button
        v-for="f in buildingStore.sortedFloors"
        :key="f.id"
        class="floor-tab"
        :class="{ active: selectedFloor === f.id }"
        @click="selectedFloor = f.id; loadExisting()"
      >
        {{ f.label }} ({{ f.id }})
      </button>
      <button class="floor-tab add-floor-btn" @click="showAddFloor = !showAddFloor">+</button>
    </div>

    <!-- Add floor form -->
    <div v-if="showAddFloor" class="add-floor-form">
      <label class="form-label">
        <span>ID patra</span>
        <input v-model="newFloorId" type="text" class="form-input" placeholder="např. L2, BL2" />
      </label>
      <label class="form-label">
        <span>Název</span>
        <input v-model="newFloorLabel" type="text" class="form-input" placeholder="např. Level 2" />
      </label>
      <div class="add-floor-actions">
        <button class="btn btn-primary btn-sm" @click="addFloor">Přidat patro</button>
        <button class="btn btn-ghost btn-sm" @click="showAddFloor = false">Zrušit</button>
      </div>
    </div>

    <!-- Floor properties -->
    <div v-if="currentFloor" class="floor-props">
      <div class="floor-props-header">
        <h3 class="section-title">{{ currentFloor.label }} ({{ currentFloor.id }})</h3>
        <div class="floor-props-actions">
          <button class="btn btn-ghost btn-xs" title="Posunout dolů" @click="moveFloor(currentFloor.id, 'down')">&#9660;</button>
          <button class="btn btn-ghost btn-xs" title="Posunout nahoru" @click="moveFloor(currentFloor.id, 'up')">&#9650;</button>
          <button class="btn btn-danger btn-xs" title="Smazat patro" @click="deleteFloor(currentFloor.id)">Smazat</button>
        </div>
      </div>
      <div class="floor-props-grid">
        <label class="form-label">
          <span>Název</span>
          <input v-model="currentFloor.label" type="text" class="form-input" />
        </label>
        <label class="form-label">
          <span>Celková plocha (m²)</span>
          <input v-model.number="currentFloor.totalArea" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>Pronajímatelná plocha (m²)</span>
          <input v-model.number="currentFloor.rentableArea" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>Započítávaná plocha (m²)</span>
          <input v-model.number="currentFloor.chargeableArea" type="number" min="0" class="form-input" />
        </label>
        <label class="form-label">
          <span>SVG cesta</span>
          <input v-model="currentFloor.svgPath" type="text" class="form-input" />
        </label>
        <label class="form-label">
          <span>Pořadí</span>
          <input v-model.number="currentFloor.order" type="number" min="0" class="form-input" />
        </label>
      </div>
    </div>

    <!-- Upload -->
    <div class="upload-section">
      <label class="upload-label">
        <span class="upload-text">Nahrát SVG soubor pro patro {{ selectedFloor }}</span>
        <input type="file" accept=".svg" class="upload-input" @change="onFileSelect" />
        <span class="upload-btn">Vybrat soubor</span>
      </label>
    </div>

    <div v-if="svgPreview" class="preview-and-panel">
      <!-- SVG Preview (interactive) -->
      <div class="preview-section">
        <div class="section-header">
          <h3 class="section-title">Půdorys - klikni na plochu pro přiřazení</h3>
          <label class="scale-control" title="Kolik SVG jednotek = 1 metr">
            <span class="scale-label">SVG/m:</span>
            <input
              type="number"
              class="scale-input"
              min="0.01" step="0.1"
              v-model.number="svgUnitsPerMeter"
            />
          </label>
          <button v-if="!calibrating && !drawing" class="btn btn-ghost btn-sm" @click="startCalibration" title="Kalibrovat měřítko kliknutím na dva body">Kalibrovat</button>
          <button v-if="!calibrating && !drawing" class="btn btn-primary btn-sm" @click="startDrawing" title="Nakresli polygon pro novou jednotku">Kreslit jednotku</button>
          <button v-if="clickedSvgId && !calibrating && !drawing" class="btn btn-ghost btn-sm" @click="clearSelection">Zrušit výběr</button>
        </div>
        <!-- Calibration banner -->
        <div v-if="calibrating" class="calib-banner">
          <template v-if="!calibPoint1">
            <span class="calib-step">1/2</span> Klikni na <strong>první bod</strong> známé vzdálenosti
          </template>
          <template v-else-if="!calibPoint2">
            <span class="calib-step">2/2</span> Klikni na <strong>druhý bod</strong>
          </template>
          <template v-else>
            <div class="calib-result">
              <span>SVG vzdálenost: <strong>{{ calibSvgDistance?.toFixed(1) }}</strong> jednotek</span>
              <label class="calib-real">
                Skutečná vzdálenost:
                <input type="number" class="scale-input" min="0.01" step="0.1" v-model.number="calibRealDistance" /> m
              </label>
              <span class="calib-computed">= {{ (calibSvgDistance! / calibRealDistance).toFixed(2) }} SVG/m</span>
              <button class="btn btn-primary btn-sm" @click="applyCalibration">Použít</button>
            </div>
          </template>
          <button class="btn btn-ghost btn-sm calib-cancel" @click="cancelCalibration">Zrušit</button>
        </div>

        <!-- Drawing banner -->
        <div v-if="drawing" class="draw-banner">
          <span class="draw-icon">&#9998;</span>
          <template v-if="drawPoints.length === 0">
            Klikni na <strong>první bod</strong> jednotky
          </template>
          <template v-else>
            <strong>{{ drawPoints.length }}</strong> bodů ·
            Klikni pro další bod ·
            <strong>Double-click</strong> nebo <kbd>Enter</kbd> pro dokončení ·
            <kbd>Backspace</kbd> smaže poslední bod
          </template>
          <button class="btn btn-ghost btn-sm draw-cancel" @click="cancelDrawing">Zrušit</button>
        </div>

        <div
          class="svg-preview-wrapper"
          @wheel.prevent="onPreviewWheel"
          @pointerdown="onPreviewPointerDown"
          @pointermove="onPreviewPointerMove"
          @pointerup="onPreviewPointerUp"
          @mousemove="onPreviewMouseMove"
          @mouseup="onPreviewMouseUp"
        >
          <div class="preview-zoom-info">
            {{ Math.round(previewZoom * 100) }}%
            <button v-if="previewZoom !== 1 || previewPanX !== 0 || previewPanY !== 0" class="zoom-reset" @click="resetPreviewZoom">Reset</button>
          </div>
          <div
            ref="svgPreviewEl"
            class="svg-preview"
            :class="{ calibrating, drawing, editing }"
            :style="{
              transform: `translate(${previewPanX}px, ${previewPanY}px) scale(${previewZoom})`,
              transformOrigin: '0 0',
            }"
            v-html="svgPreview"
            @click="onPreviewClick"
            @dblclick="onPreviewDblClick"
            @contextmenu.prevent="onPreviewContextMenu"
          />
        </div>
      </div>

      <!-- Editing banner -->
      <div v-if="editing" class="selection-panel">
        <div class="sp-header">
          <span class="sp-label">Editace tvaru</span>
          <span class="sp-id">{{ editElementId }}</span>
        </div>
        <div class="edit-info">
          <p class="sp-info"><strong>Tah</strong> za bod = posunout</p>
          <p class="sp-info"><strong>Klik</strong> na hranu = přidat bod</p>
          <p class="sp-info"><strong>Pravý klik</strong> na bod = smazat</p>
          <p class="sp-info sp-count">{{ editPoints.length }} bodů</p>
        </div>
        <div class="edit-actions">
          <button class="btn btn-primary btn-sm" @click="finishEditing">Uložit</button>
          <button class="btn btn-ghost btn-sm" @click="cancelEditing">Zrušit</button>
        </div>
      </div>

      <!-- Selection panel -->
      <div v-if="clickedSvgId && !editing" class="selection-panel">
        <div class="sp-header">
          <span class="sp-label">Element</span>
        </div>

        <!-- Editable SVG ID -->
        <div class="sp-field">
          <label class="sp-field-label">SVG ID</label>
          <div class="sp-id-row">
            <input
              class="sp-field-input sp-id-input"
              :value="clickedSvgId"
              @change="onIdChange(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Editable name -->
        <div class="sp-field">
          <label class="sp-field-label">Název</label>
          <input
            class="sp-field-input"
            :value="assignedUnit?.name ?? clickedSvgId"
            @input="onNameChange(($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Editable dimensions -->
        <div class="sp-dims">
          <label class="sp-field">
            <span class="sp-field-label">Šířka (m)</span>
            <input class="sp-field-input" type="number" step="0.1" min="0"
              :value="selectedBBox?.width ?? 0"
              @input="onDimChange('width', +($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="sp-field">
            <span class="sp-field-label">Hloubka (m)</span>
            <input class="sp-field-input" type="number" step="0.1" min="0"
              :value="selectedBBox?.height ?? 0"
              @input="onDimChange('height', +($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="sp-field">
            <span class="sp-field-label">Plocha (m²)</span>
            <input class="sp-field-input sp-area-input" type="number" step="0.1" min="0"
              :value="selectedBBox?.area ?? 0"
              @input="onAreaChange(+($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>

        <div class="sp-shape-actions">
          <button v-if="canEditElement()" class="btn btn-ghost btn-sm" @click="startEditing">Editovat tvar</button>
          <button class="btn btn-danger btn-xs" @click="deleteSvgElement">Smazat</button>
        </div>

        <template v-if="assignedUnit">
          <div class="sp-assigned">
            <div class="sp-row">
              <span class="sp-key">Nájemník</span>
              <span class="sp-val">{{ assignedUnit.tenant || '—' }}</span>
            </div>
            <div class="sp-row">
              <span class="sp-key">Kategorie</span>
              <span class="sp-val">{{ assignedUnit.category }}</span>
            </div>
            <button class="btn btn-primary btn-sm" @click="goToUnit(assignedUnit.id)">Upravit jednotku</button>
          </div>
        </template>

        <template v-else>
          <div class="sp-unassigned">
            <p class="sp-info">Tato plocha nemá přiřazenou jednotku.</p>
            <button class="btn btn-primary" @click="createUnitFromSvg">Vytvořit novou jednotku</button>

            <template v-if="unassignedUnits.length > 0">
              <div class="sp-divider">nebo přiřadit existující</div>
              <div class="sp-unit-list">
                <button
                  v-for="u in unassignedUnits"
                  :key="u.id"
                  class="sp-unit-option"
                  @click="assignExistingUnit(u.id)"
                >
                  <span class="sp-unit-name">{{ u.name }}</span>
                  <span class="sp-unit-tenant">{{ u.tenant || 'bez nájemníka' }}</span>
                </button>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- ID Analysis -->
    <div v-if="foundIds.length > 0" class="analysis-section">
      <h3 class="section-title">Nalezené ID elementů ({{ foundIds.length }})</h3>

      <div class="id-groups">
        <!-- Matched -->
        <div v-if="matchedIds.length > 0" class="id-group">
          <div class="id-group-header ok">Spárované ({{ matchedIds.length }})</div>
          <div class="id-tags">
            <span
              v-for="id in matchedIds"
              :key="id"
              class="id-tag ok clickable"
              @click="selectSvgElement(id)"
            >{{ id }}</span>
          </div>
        </div>

        <!-- SVG IDs not in building data -->
        <div v-if="unmatchedSvgIds.length > 0" class="id-group">
          <div class="id-group-header warn">V SVG, ale bez jednotky ({{ unmatchedSvgIds.length }})</div>
          <div class="id-tags">
            <span
              v-for="id in unmatchedSvgIds"
              :key="id"
              class="id-tag warn clickable"
              @click="selectSvgElement(id)"
            >{{ id }} <button class="id-tag-delete" @click.stop="deleteElementById(id)" title="Smazat ze SVG">&times;</button></span>
          </div>
        </div>

        <!-- Expected but missing from SVG -->
        <div v-if="missingInSvg.length > 0" class="id-group">
          <div class="id-group-header error">Jednotky bez SVG elementu ({{ missingInSvg.length }})</div>
          <div class="id-tags">
            <span v-for="id in missingInSvg" :key="id" class="id-tag error">{{ id }}</span>
          </div>
        </div>
      </div>

      <button class="btn btn-primary" :disabled="uploading" @click="uploadFloorPlan">
        {{ uploading ? 'Ukládám...' : 'Uložit půdorys' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.floorplans-page {
  max-width: 1100px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #2196F3);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.floor-selector {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
}

.floor-tab {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-secondary, #ccc);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.floor-tab:hover {
  border-color: var(--accent, #2196F3);
}

.floor-tab.active {
  background: var(--accent, #2196F3);
  color: white;
  border-color: var(--accent, #2196F3);
}

.add-floor-btn {
  font-size: 18px;
  font-weight: 700;
  width: 40px;
}

.add-floor-form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--accent, #2196F3);
  border-radius: 10px;
}

.add-floor-actions {
  display: flex;
  gap: 6px;
}

.floor-props {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.floor-props-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.floor-props-actions {
  display: flex;
  gap: 4px;
}

.floor-props-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted, #999);
}

.form-input {
  height: 32px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 6px;
  color: var(--input-text, #eee);
  font-size: 13px;
  padding: 0 10px;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
}

.btn-danger {
  background: #dc2626;
  color: white;
  border: none;
}

.btn-danger:hover {
  background: #b91c1c;
}

.upload-section {
  margin-bottom: 20px;
}

.upload-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-primary, #1e1e1e);
  border: 2px dashed var(--border-color, #444);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.upload-label:hover {
  border-color: var(--accent, #2196F3);
}

.upload-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-muted, #999);
}

.upload-input {
  display: none;
}

.upload-btn {
  padding: 6px 14px;
  background: var(--accent, #2196F3);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.preview-and-panel {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  align-items: flex-start;
}

.preview-section {
  flex: 1;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 10px;
  padding: 16px;
  min-width: 0;
}

.svg-preview-wrapper {
  background: #f5f5f0;
  border-radius: 8px;
  max-height: 600px;
  overflow: hidden;
  position: relative;
  touch-action: none;
}

.preview-zoom-info {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  background: rgba(30, 30, 30, 0.75);
  color: #ccc;
  font-size: 11px;
  font-family: monospace;
  padding: 3px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.zoom-reset {
  background: none;
  border: 1px solid #555;
  border-radius: 3px;
  color: #ccc;
  font-size: 10px;
  padding: 1px 6px;
  cursor: pointer;
}

.zoom-reset:hover {
  border-color: var(--accent, #2196F3);
  color: #fff;
}

.svg-preview {
  padding: 12px;
  will-change: transform;
}

.svg-preview :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}

.svg-preview :deep([id]) {
  cursor: pointer;
  transition: filter 0.15s;
}

.svg-preview.calibrating,
.svg-preview.drawing {
  cursor: crosshair !important;
}

.svg-preview.calibrating :deep([id]),
.svg-preview.drawing :deep([id]) {
  cursor: crosshair !important;
  pointer-events: none;
}

.svg-preview.calibrating :deep(svg),
.svg-preview.drawing :deep(svg) {
  cursor: crosshair;
}

.draw-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #2196F318;
  border: 1px solid #2196F344;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-primary, #eee);
  flex-wrap: wrap;
}

.draw-banner kbd {
  background: #333;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
  color: #eee;
}

.draw-icon {
  font-size: 16px;
}

.draw-cancel {
  margin-left: auto;
}

.edit-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.edit-info .sp-info {
  margin: 0;
  font-size: 12px;
}

.sp-count {
  margin-top: 4px !important;
  color: var(--accent, #2196F3) !important;
  font-weight: 600;
}

.edit-actions {
  display: flex;
  gap: 6px;
}

.sp-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}

.sp-field-label {
  font-size: 10px;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sp-field-input {
  height: 30px;
  width: 100%;
  min-width: 0;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 5px;
  color: var(--input-text, #eee);
  font-size: 13px;
  padding: 0 8px;
  box-sizing: border-box;
}

.sp-field-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.sp-id-row {
  display: flex;
  gap: 4px;
}

.sp-id-input {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
}

.sp-area-input {
  font-weight: 700;
  color: var(--accent, #2196F3) !important;
}

.sp-dims {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
  min-width: 0;
}

.sp-dims .sp-field {
  min-width: 0;
}

.sp-dims .sp-field:last-child {
  grid-column: 1 / -1;
}

.sp-shape-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.sp-shape-actions .btn {
  flex: 1;
}

.svg-preview.editing {
  cursor: default !important;
}

.svg-preview.editing :deep([id]) {
  pointer-events: none;
}

.svg-preview.editing :deep(#edit-handles-group) {
  pointer-events: all;
}

.svg-preview.editing :deep(#edit-handles-group circle) {
  pointer-events: all;
}

.calib-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #ef444418;
  border: 1px solid #ef444444;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-primary, #eee);
  flex-wrap: wrap;
}

.calib-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.calib-result {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
}

.calib-real {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted, #999);
}

.calib-computed {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #2196F3);
}

.calib-cancel {
  margin-left: auto;
}

/* Selection panel */
.selection-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--accent, #2196F3);
  border-radius: 10px;
  padding: 16px;
  overflow: hidden;
  box-sizing: border-box;
}

.scale-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scale-label {
  font-size: 11px;
  color: var(--text-muted, #999);
}

.scale-input {
  width: 60px;
  height: 26px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 4px;
  color: var(--input-text, #eee);
  font-size: 12px;
  text-align: center;
  font-family: monospace;
}

.scale-input:focus {
  outline: none;
  border-color: var(--accent, #2196F3);
}

.sp-header {
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color, #333);
}

.sp-bbox {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-area {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent, #2196F3) !important;
}

.sp-label {
  font-size: 11px;
  color: var(--text-muted, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 4px;
}

.sp-id {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent, #2196F3);
  font-family: monospace;
}

.sp-assigned {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sp-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.sp-key {
  color: var(--text-muted, #999);
}

.sp-val {
  color: var(--text-primary, #eee);
  font-weight: 500;
}

.sp-unassigned {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-info {
  font-size: 12px;
  color: var(--text-muted, #999);
  margin: 0;
}

.sp-divider {
  font-size: 11px;
  color: var(--text-muted, #666);
  text-align: center;
  position: relative;
  margin: 4px 0;
}

.sp-divider::before,
.sp-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background: var(--border-color, #333);
}

.sp-divider::before { left: 0; }
.sp-divider::after { right: 0; }

.sp-unit-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.sp-unit-option {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.sp-unit-option:hover {
  border-color: var(--accent, #2196F3);
  background: var(--btn-hover, #2a2a2a);
}

.sp-unit-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.sp-unit-tenant {
  font-size: 11px;
  color: var(--text-muted, #999);
}

.analysis-section {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.id-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.id-group-header {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.id-group-header.ok { color: #22c55e; }
.id-group-header.warn { color: #f59e0b; }
.id-group-header.error { color: #ef4444; }

.id-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.id-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-family: monospace;
}

.id-tag.clickable {
  cursor: pointer;
  transition: filter 0.15s;
}

.id-tag.clickable:hover {
  filter: brightness(1.3);
}

.id-tag.ok { background: #22c55e22; color: #22c55e; }
.id-tag.warn { background: #f59e0b22; color: #f59e0b; }
.id-tag.error { background: #ef444422; color: #ef4444; }

.id-tag-delete {
  background: none;
  border: none;
  color: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 4px;
  opacity: 0.5;
  line-height: 1;
}

.id-tag-delete:hover {
  opacity: 1;
  color: #ef4444;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}

.btn-primary {
  background: var(--accent, #2196F3);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.15);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted, #999);
  border: 1px solid var(--border-color, #333);
}

.btn-ghost:hover {
  background: var(--btn-hover, #333);
  color: var(--text-primary, #eee);
}
</style>
