# HMI Canvas Editor – Implementační plán pro Vue 3

## Instrukce pro Claude Code
Implementuj tuto Vue 3 aplikaci postupně, fázi po fázi.
Začni Fází 1 (useViewport + CanvasView + GridLayer).
Po dokončení každé fáze se zeptej před pokračováním dál.
Vždy piš TypeScript. Používej `<script setup>` syntaxi.

## Kontext projektu

Cílem je vybudovat standalone Vue 3 aplikaci – zoomovatelné plátno (SCADA/HMI styl) s možností kreslení tvarů, vkládání obrázků, vrstvami a napojením live hodnot z REST API přes polling. Plátno je SVG, veškeré objekty se zoomují společně přes jeden root `<g transform>`.

---

## Technologický stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** (dev server + build)
- **Pinia** (state management)
- **TypeScript** (volitelné, ale doporučené)
- **Vue Router** (pro budoucí rozšíření – editor / viewer view)
- Žádné UI knihovny třetích stran pro canvas – čisté SVG

---

## Struktura projektu

```
src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── stores/
│   ├── diagramStore.ts       # elementy, vrstvy, selection
│   ├── viewportStore.ts      # zoom, pan, transform matrix
│   ├── toolStore.ts          # aktivní tool, tool options
│   ├── liveDataStore.ts      # live hodnoty z REST API
│   └── historyStore.ts       # undo/redo command stack
├── composables/
│   ├── useViewport.ts        # zoom/pan logika, coord conversions
│   ├── useTool.ts            # router na aktivní tool composable
│   ├── useSelectTool.ts      # select, move, resize
│   ├── useDrawTool.ts        # kreslení rect, ellipse, line, polyline
│   ├── usePolling.ts         # REST polling service
│   └── useUndoRedo.ts        # keyboard shortcuts, command pattern
├── components/
│   ├── editor/
│   │   ├── EditorLayout.vue          # hlavní layout (toolbar + canvas + panels)
│   │   ├── Toolbar.vue               # tool buttons, zoom controls
│   │   ├── LayerPanel.vue            # panel vrstev (vlevo nebo vpravo)
│   │   ├── PropertyPanel.vue         # panel vlastností vybraného elementu
│   │   └── WidgetPalette.vue         # paleta widgetů k přidání
│   ├── canvas/
│   │   ├── CanvasView.vue            # SVG root, viewport transform, event dispatch
│   │   ├── GridLayer.vue             # SVG grid (pattern tile)
│   │   ├── CanvasLayer.vue           # jedna vrstva (g element s visibility)
│   │   ├── CanvasElement.vue         # switch na type → renderuje konkrétní widget
│   │   ├── SelectionOverlay.vue      # selection rect + resize handles (mimo transform)
│   │   └── DrawingPreview.vue        # náhled tvaru při kreslení
│   └── widgets/
│       ├── ShapeRect.vue             # obdélník / čtverec
│       ├── ShapeEllipse.vue          # elipsa / kruh
│       ├── ShapeLine.vue             # úsečka
│       ├── ShapePolyline.vue         # lomená čára / křivka (segmenty)
│       ├── ImageWidget.vue           # vložený obrázek (base64 embed)
│       ├── TextLabel.vue             # statický textový popisek
│       ├── GaugeWidget.vue           # měřidlo (SVG arc) s live hodnotou
│       ├── SwitchLED.vue             # on/off indikátor s live stavem
│       └── TextValue.vue             # číselná / textová live hodnota
├── types/
│   └── diagram.ts                    # TypeScript typy (viz sekce Datové typy)
└── utils/
    ├── coordUtils.ts                 # screen ↔ canvas conversions
    ├── svgUtils.ts                   # helpers pro SVG path, bbox
    └── colorUtils.ts                 # color helpers
```

---

## Datové typy (src/types/diagram.ts)

```typescript
export type ElementType =
  | 'rect' | 'ellipse' | 'line' | 'polyline'
  | 'image' | 'text'
  | 'gauge' | 'switch' | 'textValue'

export interface DataSource {
  endpoint: string          // URL REST endpointu
  valueKey: string          // klíč v JSON odpovědi, např. 'temperature'
  interval: number          // polling interval v ms, default 5000
  format?: string           // formátovací string, např. '{v} °C' nebo '{v.toFixed(1)}'
  minValue?: number         // pro gauge
  maxValue?: number         // pro gauge
}

export interface ElementStyle {
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  fontSize?: number
  fontFamily?: string
  textColor?: string
}

export interface CanvasElement {
  id: string
  type: ElementType
  x: number                 // canvas coords (ne screen)
  y: number
  width: number
  height: number
  rotation: number          // stupně
  layerId: string
  locked: boolean
  visible: boolean
  label?: string            // volitelný popisek
  dataSource?: DataSource   // null/undefined = statický element
  style: ElementStyle
  // pro polyline / line:
  points?: Array<{ x: number; y: number }>
  // pro image:
  imageData?: string        // base64 encoded
  imageMimeType?: string
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number             // pořadí renderování (vyšší = nahoře)
}

export interface Diagram {
  id: string
  name: string
  width: number             // canvas rozměry v logických jednotkách
  height: number
  backgroundColor: string
  gridSize: number          // velikost mřížky (default 20)
  gridVisible: boolean
  snapToGrid: boolean
  layers: Layer[]
  elements: CanvasElement[]
  createdAt: string
  updatedAt: string
}

export interface ViewportState {
  x: number                 // pan offset X (screen pixels)
  y: number                 // pan offset Y (screen pixels)
  scale: number             // zoom faktor
  minScale: number          // default 0.05
  maxScale: number          // default 20
}
```

---

## Fáze 1: Viewport a základní canvas

### 1.1 viewportStore (src/stores/viewportStore.ts)

```typescript
// Stav:
const viewport = reactive<ViewportState>({
  x: 0, y: 0, scale: 1, minScale: 0.05, maxScale: 20
})

// Akce:
function zoomToPoint(screenX: number, screenY: number, delta: number): void
function panBy(dx: number, dy: number): void
function resetViewport(): void
function fitToContent(elements: CanvasElement[]): void

// Computed:
const transformString = computed(() =>
  `translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`
)
```

### 1.2 useViewport composable (src/composables/useViewport.ts)

Implementuj tyto funkce:

```typescript
// Konverze souřadnic
function screenToCanvas(screenX: number, screenY: number): { x: number; y: number }
function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number }

// Event handlers pro SVG element
function onWheel(e: WheelEvent): void
// - preventDefault
// - vypočítej delta (e.deltaY > 0 ? 0.9 : 1.1)
// - newScale = clamp(scale * delta, minScale, maxScale)
// - zoom ke kurzoru:
//     vp.x = e.offsetX - (e.offsetX - vp.x) * (newScale / vp.scale)
//     vp.y = e.offsetY - (e.offsetY - vp.y) * (newScale / vp.scale)

function onPointerDown(e: PointerEvent): void   // start pan (middle button nebo space+drag)
function onPointerMove(e: PointerEvent): void   // pan move
function onPointerUp(e: PointerEvent): void     // pan end

// Keyboard shortcuts
// + / - : zoom in/out ke středu viewportu
// 0 : reset zoom na 100%
// F : fit to content
```

### 1.3 CanvasView.vue (src/components/canvas/CanvasView.vue)

```html
<template>
  <svg
    ref="svgRef"
    class="canvas-view"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- Vše uvnitř tohoto <g> se zoomuje -->
    <g :transform="viewportStore.transformString">

      <!-- Background fill -->
      <rect
        :x="-50000" :y="-50000"
        width="100000" height="100000"
        :fill="diagram.backgroundColor"
      />

      <!-- Grid -->
      <GridLayer v-if="diagram.gridVisible" />

      <!-- Vrstvy – renderované v pořadí dle layer.order -->
      <CanvasLayer
        v-for="layer in sortedLayers"
        :key="layer.id"
        :layer="layer"
      />

      <!-- Náhled kreslení -->
      <DrawingPreview />

    </g>

    <!-- MIMO transform – vždy pixel-perfect -->
    <SelectionOverlay />

  </svg>
</template>
```

### 1.4 GridLayer.vue

Implementuj mřížku pomocí SVG `<pattern>`:

```html
<defs>
  <pattern
    :id="patternId"
    :width="gridSize * viewport.scale"
    :height="gridSize * viewport.scale"
    patternUnits="userSpaceOnUse"
    :x="viewport.x % (gridSize * viewport.scale)"
    :y="viewport.y % (gridSize * viewport.scale)"
  >
    <!-- Minor grid line (každý gridSize) -->
    <path :d="`M ${gridSize * viewport.scale} 0 L 0 0 0 ${gridSize * viewport.scale}`"
          fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
    <!-- Major grid line (každých 5 * gridSize) - přidej zvlášť pro 5x interval -->
  </pattern>
</defs>
<rect width="100%" height="100%" :fill="`url(#${patternId})`"/>
```

Poznámka: Grid pattern musí být v userSpaceOnUse s korekcí na viewport offset, aby se pohyboval spolu s panoramováním.

---

## Fáze 2: Datový model a diagram store

### 2.1 diagramStore (src/stores/diagramStore.ts)

```typescript
// Stav:
const diagram = ref<Diagram>(defaultDiagram())
const selectedElementIds = ref<Set<string>>(new Set())
const activeLayerId = ref<string>('')

// Computed:
const sortedLayers = computed(() =>
  [...diagram.value.layers].sort((a, b) => a.order - b.order)
)
const selectedElements = computed(() =>
  diagram.value.elements.filter(el => selectedElementIds.value.has(el.id))
)
function elementsOnLayer(layerId: string): CanvasElement[]

// Akce pro elementy:
function addElement(el: Omit<CanvasElement, 'id'>): string
function updateElement(id: string, patch: Partial<CanvasElement>): void
function deleteElements(ids: string[]): void
function moveElements(ids: string[], dx: number, dy: number): void
function duplicateElements(ids: string[]): string[]
function reorderElement(id: string, direction: 'up' | 'down' | 'top' | 'bottom'): void

// Akce pro vrstvy:
function addLayer(name: string): string
function updateLayer(id: string, patch: Partial<Layer>): void
function deleteLayer(id: string): void
function reorderLayer(id: string, direction: 'up' | 'down'): void

// Selection:
function selectElement(id: string, addToSelection?: boolean): void
function deselectAll(): void
function selectAll(): void

// Persistence:
function saveTolocalStorage(): void
function loadFromLocalStorage(): void
function exportToJSON(): string
function importFromJSON(json: string): void
```

### 2.2 Snap to grid utility

```typescript
// src/utils/coordUtils.ts
export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / gridSize) * gridSize
}
```

---

## Fáze 3: Nástroje (Tools)

### 3.1 toolStore (src/stores/toolStore.ts)

```typescript
export type ToolType = 'select' | 'rect' | 'ellipse' | 'line' | 'polyline' | 'text' | 'image'

const activeTool = ref<ToolType>('select')
const toolOptions = reactive({
  fillColor: '#ffffff',
  strokeColor: '#333333',
  strokeWidth: 1,
  opacity: 1,
  fontSize: 14,
})
```

### 3.2 Select tool (src/composables/useSelectTool.ts)

Implementuj:

- **Click na element**: selectElement(id), pokud Shift → addToSelection
- **Click na prázdno**: deselectAll()
- **Drag na prázdno**: rubber-band selection (rectangle select) – vyber všechny elementy, jejichž bbox se překrývá s drag rect
- **Drag na vybraný element**: moveElements – pohyb v canvas coords se snap to grid
- **Resize handles** (8 bodů kolem selection bbox):
  - každý handle mění x/y/width/height vybraného elementu
  - zachovej aspect ratio při Shift
- **Keyboard**: Delete/Backspace → deleteElements, Ctrl+D → duplicateElements

### 3.3 Draw tool (src/composables/useDrawTool.ts)

Implementuj pro typy: rect, ellipse, line, polyline

```typescript
// Společná logika:
// onPointerDown: ulož startPoint (canvas coords)
// onPointerMove: aktualizuj DrawingPreview (temp element ve store nebo local ref)
// onPointerUp: finalizuj element → addElement()

// Rect / Ellipse:
// - x = min(start.x, current.x), y = min(start.y, current.y)
// - width = abs(current.x - start.x), height = abs(current.y - start.y)
// - Shift = zachovej aspect ratio (čtverec / kruh)

// Line:
// - points = [startPoint, currentPoint]
// - Shift = snap na 0°/45°/90°

// Polyline:
// - Click přidá bod, double-click ukončí
// - každý segment je uložen jako points array
// - ESC zruší kreslení
```

### 3.4 DrawingPreview.vue

Zobrazuje "ghost" element při kreslení (dashed stroke, nízká opacity) předtím, než je element finalizován.

---

## Fáze 4: Widgety

### 4.1 CanvasElement.vue – dispatcher

```html
<component
  :is="widgetComponent"
  :element="element"
  :selected="isSelected"
  :live-value="liveValue"
/>

// widgetComponent se určí dle element.type:
const componentMap: Record<ElementType, Component> = {
  rect: ShapeRect,
  ellipse: ShapeEllipse,
  line: ShapeLine,
  polyline: ShapePolyline,
  image: ImageWidget,
  text: TextLabel,
  gauge: GaugeWidget,
  switch: SwitchLED,
  textValue: TextValue,
}
```

### 4.2 ShapeRect.vue

```html
<rect
  :x="element.x" :y="element.y"
  :width="element.width" :height="element.height"
  :fill="element.style.fill"
  :stroke="element.style.stroke"
  :stroke-width="element.style.strokeWidth / viewport.scale"  <!-- zachovej tloušťku čáry při zoom -->
  :opacity="element.style.opacity"
/>
```

Poznámka: strokeWidth děleno viewport.scale zajistí, že čáry mají vždy stejnou vizuální tloušťku bez ohledu na zoom.

### 4.3 GaugeWidget.vue

Implementuj měřidlo jako SVG arc:

```typescript
// Výpočet arc path:
// - fullAngle: od -220° do +40° (260° rozsah)
// - normalize hodnotu na 0–1 dle minValue/maxValue
// - polarToCartesian(cx, cy, r, angle) → {x, y}
// - arcPath = `M startX startY A r r 0 largeArc sweep endX endY`

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx, cy, r, startAngle, endAngle): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
```

Zobrazuj: background arc (šedý), value arc (barevný), numerická hodnota uprostřed, min/max popisky.

### 4.4 SwitchLED.vue

- Kruh s fill: zelená (true) / červená (false) / šedá (null/no data)
- Volitelný popisek (element.label)
- Hodnota z `liveDataStore.getValue(element.dataSource)`

### 4.5 TextValue.vue

- `<text>` SVG element
- Hodnota formátovaná přes `element.dataSource.format`
- Fallback: '--' pokud není data nebo endpoint nedostupný
- Konfigurovatelný font, barva, velikost

### 4.6 ImageWidget.vue

```html
<image
  :href="element.imageData"        <!-- base64: 'data:image/png;base64,...' -->
  :x="element.x" :y="element.y"
  :width="element.width" :height="element.height"
  preserveAspectRatio="xMidYMid meet"
/>
```

Drag & drop upload: v EditorLayout.vue zachyť `@drop` event, načti File jako base64, přidej jako ImageWidget element na aktuální pozici kurzoru.

---

## Fáze 5: Live data (REST polling)

### 5.1 usePolling composable (src/composables/usePolling.ts)

```typescript
// Lifecycle-aware polling service
export function usePolling() {
  const intervals = new Map<string, ReturnType<typeof setInterval>>()

  function register(
    key: string,           // unikátní klíč (typicky element.id nebo endpoint+valueKey)
    endpoint: string,
    valueKey: string,
    intervalMs: number,
    onValue: (value: unknown) => void
  ): void {
    if (intervals.has(key)) return  // deduplicate

    const fetch = async () => {
      try {
        const res = await window.fetch(endpoint)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const value = valueKey.split('.').reduce((obj, k) => obj?.[k], data)
        onValue(value)
      } catch (e) {
        onValue(null)  // null = endpoint nedostupný
      }
    }

    fetch()  // initial fetch okamžitě
    intervals.set(key, setInterval(fetch, intervalMs))
  }

  function unregister(key: string): void {
    const id = intervals.get(key)
    if (id) { clearInterval(id); intervals.delete(key) }
  }

  function unregisterAll(): void {
    intervals.forEach((id) => clearInterval(id))
    intervals.clear()
  }

  // Automatické cleanup při unmount:
  onUnmounted(unregisterAll)

  return { register, unregister, unregisterAll }
}
```

### 5.2 liveDataStore (src/stores/liveDataStore.ts)

```typescript
// Stav:
const values = reactive<Map<string, unknown>>(new Map())
// key = `${element.id}` nebo sdílený `${endpoint}::${valueKey}`

// Akce:
function setValue(key: string, value: unknown): void
function getValue(key: string): unknown
function getFormattedValue(element: CanvasElement): string

// Optimalizace: sdílej polling pro elementy se stejným endpointem:
// Pokud dva elementy čtou ze stejného endpointu, registruj polling jen jednou.
const endpointSubscribers = new Map<string, Set<string>>()
```

### 5.3 Napojení widgetů na live data

V `CanvasElement.vue` (nebo centrálně v `EditorLayout.vue` při mounted):

```typescript
// Pro každý element s dataSource:
onMounted(() => {
  const elementsWithData = diagramStore.diagram.elements
    .filter(el => el.dataSource)

  elementsWithData.forEach(el => {
    polling.register(
      el.id,
      el.dataSource!.endpoint,
      el.dataSource!.valueKey,
      el.dataSource!.interval ?? 5000,
      (value) => liveDataStore.setValue(el.id, value)
    )
  })
})
```

---

## Fáze 6: Selection Overlay

### SelectionOverlay.vue

Renderuje se **mimo** viewport transform (přímý child `<svg>`), souřadnice přepočítáváš přes `canvasToScreen()`.

```typescript
// Výpočet bounding boxu selection v screen coords:
const selectionBBox = computed(() => {
  if (selectedElements.value.length === 0) return null
  const els = selectedElements.value
  const minX = Math.min(...els.map(e => e.x))
  const minY = Math.min(...els.map(e => e.y))
  const maxX = Math.max(...els.map(e => e.x + e.width))
  const maxY = Math.max(...els.map(e => e.y + e.height))

  const screenMin = canvasToScreen(minX, minY)
  const screenMax = canvasToScreen(maxX, maxY)

  return {
    x: screenMin.x, y: screenMin.y,
    width: screenMax.x - screenMin.x,
    height: screenMax.y - screenMin.y
  }
})
```

Resize handles: 8 kruhů (4 rohy + 4 středy stran), každý s `cursor` stylem (nw-resize, n-resize, atd.).

---

## Fáze 7: Undo / Redo

### 7.1 Command pattern (src/stores/historyStore.ts)

```typescript
interface Command {
  execute(): void
  undo(): void
  description: string
}

const undoStack = ref<Command[]>([])
const redoStack = ref<Command[]>([])
const maxHistory = 100

function execute(command: Command): void {
  command.execute()
  undoStack.value.push(command)
  if (undoStack.value.length > maxHistory)
    undoStack.value.shift()
  redoStack.value = []  // clear redo po nové akci
}

function undo(): void {
  const cmd = undoStack.value.pop()
  if (cmd) { cmd.undo(); redoStack.value.push(cmd) }
}

function redo(): void {
  const cmd = redoStack.value.pop()
  if (cmd) { cmd.execute(); undoStack.value.push(cmd) }
}
```

### 7.2 Příklady command implementací

```typescript
// AddElementCommand:
class AddElementCommand implements Command {
  private elementId: string
  constructor(private elementData: Omit<CanvasElement, 'id'>) {}
  execute() { this.elementId = diagramStore.addElement(this.elementData) }
  undo() { diagramStore.deleteElements([this.elementId]) }
  description = 'Přidat element'
}

// MoveElementsCommand:
class MoveElementsCommand implements Command {
  constructor(
    private ids: string[],
    private dx: number,
    private dy: number
  ) {}
  execute() { diagramStore.moveElements(this.ids, this.dx, this.dy) }
  undo() { diagramStore.moveElements(this.ids, -this.dx, -this.dy) }
  description = 'Přesunout element'
}
```

### 7.3 Keyboard shortcuts (v useUndoRedo.ts)

```typescript
// Ctrl+Z → undo, Ctrl+Y nebo Ctrl+Shift+Z → redo
// Registruj přes useEventListener('@keydown') na document
```

---

## Fáze 8: Persistence

### 8.1 localStorage (pro prototyp)

```typescript
// V diagramStore:
const STORAGE_KEY = 'hmi-diagram-v1'

function saveTolocalStorage(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram.value))
}

function loadFromLocalStorage(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      diagram.value = JSON.parse(raw)
    } catch { /* ignore corrupt data */ }
  }
}

// Auto-save: watch diagram changes s debounce 1000ms
watch(diagram, debounce(saveTolocalStorage, 1000), { deep: true })
```

### 8.2 Export / Import

```typescript
// Export JSON:
function exportToJSON(): string {
  return JSON.stringify(diagram.value, null, 2)
}

// Trigger download:
function downloadJSON(): void {
  const blob = new Blob([exportToJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${diagram.value.name}.json`
  a.click(); URL.revokeObjectURL(url)
}

// Import JSON:
function importFromJSON(json: string): void {
  const data = JSON.parse(json)
  // TODO: validace schématu
  diagram.value = data
}
```

### 8.3 IndexedDB persistence (src/services/storageService.ts)

Abstrakce nad úložištěm s repository pattern — stejné rozhraní pro IndexedDB (frontend) i PostgreSQL REST API (backend). Umožňuje transparentní přechod na backend bez změny kódu ve storech.

#### 8.3.1 Storage interface (src/services/storageInterface.ts)

```typescript
// Společné rozhraní pro všechny storage implementace
// Mapuje se 1:1 na budoucí PostgreSQL tabulky

export interface StorageRepository<T extends { id: string }> {
  getAll(): Promise<T[]>
  getById(id: string): Promise<T | undefined>
  create(item: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
  bulkCreate(items: T[]): Promise<T[]>
  bulkDelete(ids: string[]): Promise<void>
}

export interface StorageService {
  diagrams: StorageRepository<Diagram>
  elements: StorageRepository<CanvasElement>
  layers: StorageRepository<Layer>
  buildings: StorageRepository<Building>
  floors: StorageRepository<Floor>
  units: StorageRepository<Unit>
  // Lifecycle:
  init(): Promise<void>
  close(): Promise<void>
}
```

#### 8.3.2 IndexedDB implementace (src/services/indexedDbStorage.ts)

```typescript
// Použij idb knihovnu (lightweight wrapper nad IndexedDB)
// npm install idb

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'hmi-editor'
const DB_VERSION = 1

// Schéma DB — každý object store = budoucí PostgreSQL tabulka
// Indexy odpovídají budoucím SQL indexům
async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // diagrams (→ PostgreSQL: diagrams table)
      const diagrams = db.createObjectStore('diagrams', { keyPath: 'id' })
      diagrams.createIndex('by_name', 'name')
      diagrams.createIndex('by_updated', 'updatedAt')

      // elements (→ PostgreSQL: elements table, FK: diagram_id, layer_id)
      const elements = db.createObjectStore('elements', { keyPath: 'id' })
      elements.createIndex('by_diagram', 'diagramId')
      elements.createIndex('by_layer', 'layerId')
      elements.createIndex('by_type', 'type')

      // layers (→ PostgreSQL: layers table, FK: diagram_id)
      const layers = db.createObjectStore('layers', { keyPath: 'id' })
      layers.createIndex('by_diagram', 'diagramId')
      layers.createIndex('by_order', 'order')

      // buildings (→ PostgreSQL: buildings table)
      const buildings = db.createObjectStore('buildings', { keyPath: 'id' })
      buildings.createIndex('by_name', 'name')

      // floors (→ PostgreSQL: floors table, FK: building_id)
      const floors = db.createObjectStore('floors', { keyPath: 'id' })
      floors.createIndex('by_building', 'buildingId')

      // units (→ PostgreSQL: units table, FK: floor_id)
      const units = db.createObjectStore('units', { keyPath: 'id' })
      units.createIndex('by_floor', 'floorId')
    }
  })
}

// Generic repository pro libovolný object store
class IndexedDbRepository<T extends { id: string }> implements StorageRepository<T> {
  constructor(
    private db: IDBPDatabase,
    private storeName: string
  ) {}

  async getAll(): Promise<T[]> {
    return this.db.getAll(this.storeName)
  }

  async getById(id: string): Promise<T | undefined> {
    return this.db.get(this.storeName, id)
  }

  async create(item: T): Promise<T> {
    await this.db.put(this.storeName, item)
    return item
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.getById(id)
    if (!existing) throw new Error(`${this.storeName}/${id} not found`)
    const updated = { ...existing, ...patch }
    await this.db.put(this.storeName, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(this.storeName, id)
  }

  async bulkCreate(items: T[]): Promise<T[]> {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    await Promise.all([
      ...items.map(item => tx.store.put(item)),
      tx.done
    ])
    return items
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    await Promise.all([
      ...ids.map(id => tx.store.delete(id)),
      tx.done
    ])
  }

  // Helper: query by index (IndexedDB) → mapuje se na WHERE clause v SQL
  async getByIndex(indexName: string, value: IDBValidKey): Promise<T[]> {
    return this.db.getAllFromIndex(this.storeName, indexName, value)
  }
}
```

#### 8.3.3 REST API implementace (src/services/restApiStorage.ts)

```typescript
// Budoucí implementace — stejné rozhraní, HTTP calls místo IndexedDB
// PostgreSQL schéma se generuje z IndexedDB struktury (viz migrace níže)

class RestApiRepository<T extends { id: string }> implements StorageRepository<T> {
  constructor(private baseUrl: string, private resource: string) {}

  async getAll(): Promise<T[]> {
    const res = await fetch(`${this.baseUrl}/${this.resource}`)
    return res.json()
  }

  async getById(id: string): Promise<T | undefined> {
    const res = await fetch(`${this.baseUrl}/${this.resource}/${id}`)
    if (res.status === 404) return undefined
    return res.json()
  }

  async create(item: T): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${this.resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    })
    return res.json()
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${this.resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    return res.json()
  }

  async delete(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/${this.resource}/${id}`, { method: 'DELETE' })
  }

  async bulkCreate(items: T[]): Promise<T[]> {
    const res = await fetch(`${this.baseUrl}/${this.resource}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    })
    return res.json()
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await fetch(`${this.baseUrl}/${this.resource}/bulk`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  }
}
```

#### 8.3.4 Storage factory + migrace z localStorage

```typescript
// src/services/storageFactory.ts

export type StorageBackend = 'indexeddb' | 'rest-api'

export function createStorageService(
  backend: StorageBackend = 'indexeddb',
  apiBaseUrl?: string
): StorageService {
  if (backend === 'rest-api') {
    return new RestApiStorageService(apiBaseUrl!)
  }
  return new IndexedDbStorageService()
}

// Migrace existujících dat z localStorage do IndexedDB:
export async function migrateFromLocalStorage(
  storage: StorageService
): Promise<void> {
  const raw = localStorage.getItem('hmi-diagram-v1')
  if (!raw) return

  const diagram: Diagram = JSON.parse(raw)
  await storage.diagrams.create(diagram)
  await storage.layers.bulkCreate(
    diagram.layers.map(l => ({ ...l, diagramId: diagram.id }))
  )
  await storage.elements.bulkCreate(
    diagram.elements.map(e => ({ ...e, diagramId: diagram.id }))
  )

  // Po úspěšné migraci smaž localStorage klíč
  localStorage.removeItem('hmi-diagram-v1')
}
```

#### 8.3.5 Napojení na Pinia stores

```typescript
// V diagramStore — nahraď přímé localStorage volání:
const storage = createStorageService('indexeddb')

async function loadDiagram(id: string): Promise<void> {
  const d = await storage.diagrams.getById(id)
  if (d) diagram.value = d
}

async function saveDiagram(): Promise<void> {
  await storage.diagrams.update(diagram.value.id, diagram.value)
}

// Auto-save zůstává stejný, jen volá saveDiagram() místo localStorage
watch(diagram, debounce(saveDiagram, 1000), { deep: true })
```

#### 8.3.6 Budoucí PostgreSQL schéma (reference)

```sql
-- Generováno z IndexedDB object stores
-- Každý object store = tabulka, každý index = SQL index

CREATE TABLE diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  width INT NOT NULL DEFAULT 1920,
  height INT NOT NULL DEFAULT 1080,
  background_color VARCHAR(7) DEFAULT '#ffffff',
  grid_size INT DEFAULT 20,
  grid_visible BOOLEAN DEFAULT true,
  snap_to_grid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  visible BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  "order" INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_layers_diagram ON layers(diagram_id);

CREATE TABLE elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  layer_id UUID NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 100,
  height DOUBLE PRECISION NOT NULL DEFAULT 100,
  rotation DOUBLE PRECISION DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true,
  label VARCHAR(255),
  style JSONB NOT NULL DEFAULT '{}',
  data_source JSONB,           -- DataSource jako JSON
  points JSONB,                -- polyline body
  image_data TEXT,             -- base64 (nebo odkaz na file storage)
  image_mime_type VARCHAR(50)
);
CREATE INDEX idx_elements_diagram ON elements(diagram_id);
CREATE INDEX idx_elements_layer ON elements(layer_id);
CREATE INDEX idx_elements_type ON elements(type);

CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  floor_plan_id UUID REFERENCES diagrams(id)
);
CREATE INDEX idx_floors_building ON floors(building_id);

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  polygon JSONB                -- obrys jednotky na půdorysu
);
CREATE INDEX idx_units_floor ON units(floor_id);
```

### 8.4 REST API (pro pozdější fázi)

Připrav stub service `src/services/diagramService.ts` (bude nahrazeno RestApiStorageService z 8.3.3):

```typescript
export const diagramService = {
  async save(diagram: Diagram): Promise<void> {
    await fetch(`/api/diagrams/${diagram.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    })
  },
  async load(id: string): Promise<Diagram> {
    const res = await fetch(`/api/diagrams/${id}`)
    return res.json()
  }
}
```

---

## Fáze 9: UI panely

### 9.1 Toolbar.vue

Tlačítka pro tools (ikonky SVG), zoom controls (+/-/reset/fit), separátory.
Aktivní tool zvýrazni CSS class.

### 9.2 LayerPanel.vue

- Seznam vrstev (drag-to-reorder pomocí HTML5 drag API nebo @vueuse/core `useSortable`)
- Každá vrstva: visibility toggle (oko), lock toggle (zámek), rename (double-click)
- Tlačítka: Přidat vrstvu, Smazat vrstvu
- Zvýrazni aktivní vrstvu (ta, do které se přidávají nové elementy)

### 9.3 PropertyPanel.vue

Zobrazuje a edituje vlastnosti vybraného elementu:

- Žádný výběr: informační text
- Jeden element: formulář s polem pro každou vlastnost (x, y, w, h, fill, stroke, opacity, ...)
- Více elementů: sdílené vlastnosti (fill, stroke, opacity)
- Pro elementy s dataSource: sekce "Live data" s endpointem, valueKey, intervalem

### 9.4 WidgetPalette.vue

Grid ikonek widgetů (rect, ellipse, line, gauge, switch, textValue, image).
Klik na widget → nastaví activeTool + výchozí konfiguraci elementu.

---

## Fáze 10: Keyboard shortcuts (přehled)

| Zkratka | Akce |
|---|---|
| V | Select tool |
| R | Rect tool |
| E | Ellipse tool |
| L | Line tool |
| P | Polyline tool |
| T | Text tool |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste |
| Ctrl+D | Duplicate |
| Delete / Backspace | Smazat vybrané |
| Ctrl+A | Select all |
| Escape | Deselect / zrušit kreslení |
| +/- | Zoom in/out |
| 0 | Reset zoom (100%) |
| F | Fit to content |
| Space+drag | Pan (alternativa k middle button) |
| Ctrl+G | Seskupit (budoucí fáze) |

---

## Implementační poznámky a edge cases

### Stroke width a zoom

Všechny `stroke-width` atributy SVG elementů musí být děleny `viewport.scale`, aby čáry měly konstantní vizuální tloušťku při jakémkoli zoomu:

```typescript
const visualStrokeWidth = computed(() =>
  element.style.strokeWidth / viewportStore.viewport.scale
)
```

### Hit testing při zoom

SVG `pointer-events` fungují v canvas coords (uvnitř transform), takže klikání funguje automaticky správně – browser přepočítá souřadnice myši přes inversní transform.

### Image embed

Obrázky ukládej jako base64 přímo do elementu. Pro velké obrázky (>500KB) zobrazuj varování a nabídni kompresi (Canvas API: `canvas.toDataURL('image/jpeg', 0.7)`).

### Polyline editing

Po vytvoření polyline umožni editaci jednotlivých bodů v select modu – při výběru polyline zobrazuj handle na každém vrcholu.

### DataSource formát

Podpora nested JSON klíčů přes tečkovou notaci:
```typescript
// valueKey: 'sensors.temperature.value'
const value = valueKey.split('.').reduce((obj, k) => obj?.[k], apiResponse)
```

### Výkon při polling

Deduplikuj polling requestů – pokud více elementů čte ze stejného endpointu, pošli jen jeden HTTP request a distribuuj výsledek všem subscriberům.

### Z-order v rámci vrstvy

Implementuj pořadí elementů uvnitř vrstvy přes `order` property nebo pozici v poli. Expose akce: `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`.

---

## Doporučené pořadí implementace

1. Projekt setup: `npm create vue@latest`, nainstaluj Pinia, Vue Router,Axios,Tailwind CSS
2. Datové typy (src/types/diagram.ts)
3. viewportStore + useViewport composable
4. CanvasView.vue s fungujícím zoom/pan a gridem
5. diagramStore + CanvasLayer + CanvasElement dispatcher
6. Základní widgety: ShapeRect, ShapeEllipse, ShapeLine
7. Select tool (click select, move, rubber-band)
8. Draw tools (rect, ellipse, line)
9. SelectionOverlay s resize handles
10. historyStore (Undo/Redo)
11. Persistence (localStorage + JSON export/import)
12. IndexedDB persistence + repository pattern (příprava na PostgreSQL backend)
13. GaugeWidget + SwitchLED + TextValue
14. usePolling + liveDataStore napojení
15. ImageWidget + drag & drop upload
16. ShapePolyline + vertex editing
17. UI panely (Toolbar, LayerPanel, PropertyPanel)
18. Keyboard shortcuts

---

## Testování

Pro každou fázi navrhni ruční test scénáře:

- **Viewport**: zoom in/out, pan, zoom ke kurzoru zachovává bod pod myší
- **Grid**: grid se pohybuje spolu s panoramováním, odpovídá canvas koordinátům
- **Draw**: nakresli rect → má správné canvas coords, snap to grid funguje
- **Select**: vyber element, posuň, zkontroluj coords v PropertyPanel
- **Live data**: nastav mock endpoint (json-server nebo podobný), ověř polling a aktualizaci widgetu
- **Undo/Redo**: přidej element, smaž, undo → element se vrátí se stejnými vlastnostmi
- **Persistence (localStorage)**: ulož, reload stránky → diagram se obnoví z localStorage
- **Persistence (IndexedDB)**: migrace z localStorage proběhne automaticky, data jsou v IndexedDB (DevTools → Application → IndexedDB → hmi-editor), localStorage klíč je odstraněn
- **Storage switch**: přepni na REST API backend → stejné operace fungují přes HTTP calls
