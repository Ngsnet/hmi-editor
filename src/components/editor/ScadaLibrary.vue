<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useViewportStore } from '@/stores/viewportStore'
import { useToolStore } from '@/stores/toolStore'
import { useHistoryStore } from '@/stores/historyStore'
import { AddElementCommand } from '@/commands/elementCommands'
import { scadaSymbols, scadaCategories } from '@/assets/scadaSymbols'
import type { CanvasElement } from '@/types/diagram'

const diagramStore = useDiagramStore()
const viewportStore = useViewportStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()

const expanded = ref(false)
const activeCategory = ref(scadaCategories[0] ?? '')

const filteredSymbols = computed(() =>
  scadaSymbols.filter(s => s.category === activeCategory.value)
)

function getVisibleCenter() {
  const vp = viewportStore.viewport
  const screenW = window.innerWidth - 420
  const screenH = window.innerHeight - 80
  return {
    x: (screenW / 2 - vp.x) / vp.scale,
    y: (screenH / 2 - vp.y) / vp.scale,
  }
}

function addSymbol(symbol: typeof scadaSymbols[0]) {
  const center = getVisibleCenter()
  const cmd = new AddElementCommand({
    type: 'svg',
    x: Math.round(center.x - symbol.width / 2),
    y: Math.round(center.y - symbol.height / 2),
    width: symbol.width,
    height: symbol.height,
    rotation: 0,
    layerId: diagramStore.activeLayerId,
    locked: false,
    visible: true,
    label: symbol.name,
    svgContent: symbol.svg,
    style: { fill: 'none', stroke: '#333333', strokeWidth: 1, opacity: 1 },
  } as Omit<CanvasElement, 'id'>)
  historyStore.execute(cmd)
  const lastEl = diagramStore.diagram.elements[diagramStore.diagram.elements.length - 1]
  if (lastEl) diagramStore.selectElement(lastEl.id)
  toolStore.setTool('select')
}

function importSvgFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.svg'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const center = getVisibleCenter()

    // Try to extract dimensions from SVG
    let w = 80, h = 80
    const vbMatch = text.match(/viewBox=["'](\d+)\s+(\d+)\s+(\d+)\s+(\d+)["']/)
    if (vbMatch) {
      w = parseInt(vbMatch[3]!)
      h = parseInt(vbMatch[4]!)
    }
    // Clamp to reasonable size
    const scale = Math.min(1, 200 / Math.max(w, h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)

    const cmd = new AddElementCommand({
      type: 'svg',
      x: Math.round(center.x - w / 2),
      y: Math.round(center.y - h / 2),
      width: w, height: h,
      rotation: 0,
      layerId: diagramStore.activeLayerId,
      locked: false,
      visible: true,
      label: file.name.replace('.svg', ''),
      svgContent: text,
      style: { fill: 'none', stroke: '#333', strokeWidth: 1, opacity: 1 },
    } as Omit<CanvasElement, 'id'>)
    historyStore.execute(cmd)
    const lastEl = diagramStore.diagram.elements[diagramStore.diagram.elements.length - 1]
    if (lastEl) diagramStore.selectElement(lastEl.id)
    toolStore.setTool('select')
  }
  input.click()
}
</script>

<template>
  <div class="scada-library">
    <div class="panel-header" @click="expanded = !expanded">
      <span>{{ expanded ? '▼' : '▶' }} SCADA Symbols</span>
      <button class="import-btn" title="Import SVG file" @click.stop="importSvgFile">SVG</button>
    </div>

    <template v-if="expanded">
      <!-- Category tabs -->
      <div class="category-tabs">
        <button
          v-for="cat in scadaCategories"
          :key="cat"
          class="cat-tab"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >{{ cat }}</button>
      </div>

      <!-- Symbols grid -->
      <div class="symbols-grid">
        <button
          v-for="sym in filteredSymbols"
          :key="sym.id"
          class="symbol-btn"
          :title="sym.name"
          @click="addSymbol(sym)"
        >
          <span class="symbol-preview" v-html="sym.svg" />
          <span class="symbol-name">{{ sym.name }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scada-library {
  border-bottom: 1px solid #333;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid #333;
  color: #ccc;
  cursor: pointer;
  user-select: none;
}

.panel-header:hover {
  background: #2a2a2a;
}

.import-btn {
  padding: 2px 8px;
  background: #333;
  border: 1px solid #555;
  border-radius: 3px;
  color: #ccc;
  font-size: 10px;
  cursor: pointer;
}

.import-btn:hover {
  background: #2196F3;
  color: white;
  border-color: #2196F3;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid #2a2a2a;
}

.cat-tab {
  padding: 3px 8px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 3px;
  color: #999;
  font-size: 10px;
  cursor: pointer;
}

.cat-tab:hover {
  color: #fff;
  border-color: #666;
}

.cat-tab.active {
  background: #2196F3;
  color: white;
  border-color: #2196F3;
}

.symbols-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.symbol-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.1s;
}

.symbol-btn:hover {
  background: #333;
  border-color: #2196F3;
}

.symbol-preview {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.symbol-preview :deep(svg) {
  width: 100%;
  height: 100%;
}

.symbol-name {
  font-size: 9px;
  color: #999;
  text-align: center;
  line-height: 1.2;
}
</style>
