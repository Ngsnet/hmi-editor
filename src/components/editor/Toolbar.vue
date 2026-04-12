<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolStore, type ToolType } from '@/stores/toolStore'
import { useViewportStore } from '@/stores/viewportStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useDiagramStore } from '@/stores/diagramStore'
import { useThemeStore } from '@/stores/themeStore'

const toolStore = useToolStore()
const viewportStore = useViewportStore()
const historyStore = useHistoryStore()
const diagramStore = useDiagramStore()
const themeStore = useThemeStore()

const tools: Array<{ id: ToolType; label: string; shortcut: string; icon: string }> = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: '⊹' },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: '▭' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: '◯' },
  { id: 'line', label: 'Line', shortcut: 'L', icon: '╱' },
  { id: 'polyline', label: 'Polyline', shortcut: 'P', icon: '⏢' },
  { id: 'curve', label: 'Curve', shortcut: 'C', icon: '∿' },
]

// --- Style: reads from selected element, or defaults for new ---

const hasSelection = computed(() => diagramStore.selectedElements.length > 0)

const currentFill = computed(() => {
  if (hasSelection.value) {
    const el = diagramStore.selectedElements[0]!
    return el.style.fill === 'none' ? '#ffffff' : el.style.fill
  }
  return toolStore.toolOptions.fillColor
})

const currentStroke = computed(() => {
  if (hasSelection.value) return diagramStore.selectedElements[0]!.style.stroke
  return toolStore.toolOptions.strokeColor
})

const currentStrokeWidth = computed(() => {
  if (hasSelection.value) return diagramStore.selectedElements[0]!.style.strokeWidth
  return toolStore.toolOptions.strokeWidth
})

const currentOpacity = computed(() => {
  if (hasSelection.value) return diagramStore.selectedElements[0]!.style.opacity
  return toolStore.toolOptions.opacity
})

function setFill(value: string) {
  if (hasSelection.value) {
    for (const el of diagramStore.selectedElements) {
      diagramStore.updateElement(el.id, { style: { ...el.style, fill: value } })
    }
  }
  toolStore.toolOptions.fillColor = value
}

function setStroke(value: string) {
  if (hasSelection.value) {
    for (const el of diagramStore.selectedElements) {
      diagramStore.updateElement(el.id, { style: { ...el.style, stroke: value } })
    }
  }
  toolStore.toolOptions.strokeColor = value
}

function setStrokeWidth(value: number) {
  if (hasSelection.value) {
    for (const el of diagramStore.selectedElements) {
      diagramStore.updateElement(el.id, { style: { ...el.style, strokeWidth: value } })
    }
  }
  toolStore.toolOptions.strokeWidth = value
}

function setOpacity(value: number) {
  if (hasSelection.value) {
    for (const el of diagramStore.selectedElements) {
      diagramStore.updateElement(el.id, { style: { ...el.style, opacity: value } })
    }
  }
  toolStore.toolOptions.opacity = value
}

function zoomIn() {
  viewportStore.zoomToPoint(window.innerWidth / 2, window.innerHeight / 2, 1.2)
}

function zoomOut() {
  viewportStore.zoomToPoint(window.innerWidth / 2, window.innerHeight / 2, 0.8)
}

function exportJSON() {
  const json = diagramStore.exportToJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${diagramStore.diagram.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importJSON() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    try { diagramStore.importFromJSON(text) } catch { /* ignore */ }
  }
  input.click()
}

const showHelp = ref(false)
</script>

<template>
  <div class="toolbar">
    <!-- Tool buttons -->
    <div class="toolbar-group">
      <button
        v-for="t in tools"
        :key="t.id"
        class="tool-btn"
        :class="{ active: toolStore.activeTool === t.id }"
        :title="`${t.label} (${t.shortcut})`"
        @click="toolStore.setTool(t.id)"
      >
        <span class="tool-icon">{{ t.icon }}</span>
      </button>
    </div>

    <div class="separator" />

    <!-- Style (applies to selection or sets defaults) -->
    <div class="toolbar-group style-group">
      <label class="color-swatch" title="Fill color">
        <span class="swatch-preview" :style="{ background: currentFill }" />
        <input
          type="color"
          :value="currentFill"
          @input="setFill(($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="color-swatch" title="Stroke color">
        <span class="swatch-preview stroke-preview" :style="{ borderColor: currentStroke }" />
        <input
          type="color"
          :value="currentStroke"
          @input="setStroke(($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="style-input" title="Stroke width">
        <input
          type="number"
          :value="currentStrokeWidth"
          min="0" max="20" step="1"
          class="num-input"
          @input="setStrokeWidth(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="style-input" title="Opacity">
        <input
          type="range"
          :value="currentOpacity"
          min="0" max="1" step="0.05"
          class="opacity-slider"
          @input="setOpacity(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="opacity-value">{{ Math.round(currentOpacity * 100) }}%</span>
      </label>
    </div>

    <div class="separator" />

    <!-- Undo / Redo -->
    <div class="toolbar-group">
      <button class="tool-btn" :disabled="!historyStore.canUndo" title="Undo (Ctrl+Z)" @click="historyStore.undo()">↩</button>
      <button class="tool-btn" :disabled="!historyStore.canRedo" title="Redo (Ctrl+Y)" @click="historyStore.redo()">↪</button>
    </div>

    <div class="separator" />

    <!-- Zoom -->
    <div class="toolbar-group">
      <button class="tool-btn" title="Zoom out (-)" @click="zoomOut">−</button>
      <span class="zoom-label">{{ Math.round(viewportStore.viewport.scale * 100) }}%</span>
      <button class="tool-btn" title="Zoom in (+)" @click="zoomIn">+</button>
      <button class="tool-btn" title="Reset zoom (0)" @click="viewportStore.resetViewport()">1:1</button>
    </div>

    <div class="separator" />

    <!-- Snap to grid -->
    <label class="snap-toggle" title="Snap to grid">
      <input
        type="checkbox"
        :checked="diagramStore.diagram.snapToGrid"
        @change="diagramStore.diagram.snapToGrid = ($event.target as HTMLInputElement).checked"
      />
      <span>Zachytávání</span>
    </label>

    <div class="spacer" />

    <!-- Export / Import -->
    <div class="toolbar-group">
      <button class="tool-btn text-btn" title="Import JSON" @click="importJSON">Import</button>
      <button class="tool-btn text-btn" title="Export JSON" @click="exportJSON">Export</button>
    </div>

    <div class="separator" />

    <!-- Help -->
    <button class="tool-btn theme-btn" :title="themeStore.isDark ? 'Switch to light theme' : 'Switch to dark theme'" @click="themeStore.toggle()">{{ themeStore.isDark ? '☀' : '☾' }}</button>
    <button class="tool-btn help-btn" title="Help" @click="showHelp = !showHelp">?</button>

    <!-- Help overlay -->
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-panel">
        <div class="help-header">
          <span>HMI Editor - Help</span>
          <button class="help-close" @click="showHelp = false">✕</button>
        </div>
        <div class="help-body">
          <h3>Tools</h3>
          <table>
            <tr><td><kbd>V</kbd></td><td>Select tool</td></tr>
            <tr><td><kbd>R</kbd></td><td>Rectangle</td></tr>
            <tr><td><kbd>E</kbd></td><td>Ellipse</td></tr>
            <tr><td><kbd>L</kbd></td><td>Line</td></tr>
            <tr><td><kbd>P</kbd></td><td>Polyline (straight segments)</td></tr>
            <tr><td><kbd>C</kbd></td><td>Curve (smooth)</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Back to Select / cancel</td></tr>
          </table>

          <h3>Drawing</h3>
          <table>
            <tr><td>Drag</td><td>Draw shape</td></tr>
            <tr><td><kbd>Shift</kbd>+drag</td><td>Square / circle / 45° snap</td></tr>
            <tr><td>Click (P/C)</td><td>Add point</td></tr>
            <tr><td>Double-click (P/C)</td><td>Finish polyline/curve</td></tr>
            <tr><td><kbd>Backspace</kbd> (P/C)</td><td>Remove last point</td></tr>
          </table>

          <h3>Selection</h3>
          <table>
            <tr><td>Click</td><td>Select element</td></tr>
            <tr><td><kbd>Shift</kbd>+click</td><td>Add to selection</td></tr>
            <tr><td>Drag on empty</td><td>Rubber band selection</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>A</kbd></td><td>Select all</td></tr>
            <tr><td>Double-click text</td><td>Edit text inline</td></tr>
          </table>

          <h3>Edit</h3>
          <table>
            <tr><td>Drag element</td><td>Move</td></tr>
            <tr><td>Drag handle</td><td>Resize</td></tr>
            <tr><td><kbd>Ctrl</kbd>+drag corner</td><td>Rotate</td></tr>
            <tr><td><kbd>Shift</kbd>+rotate</td><td>Snap to 15°</td></tr>
            <tr><td><kbd>Delete</kbd></td><td>Delete selected</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>D</kbd></td><td>Duplicate</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>Redo</td></tr>
          </table>

          <h3>Viewport</h3>
          <table>
            <tr><td>Scroll wheel</td><td>Zoom to cursor</td></tr>
            <tr><td><kbd>+</kbd> / <kbd>-</kbd></td><td>Zoom in / out</td></tr>
            <tr><td><kbd>0</kbd></td><td>Reset zoom (100%)</td></tr>
            <tr><td>Middle mouse drag</td><td>Pan</td></tr>
            <tr><td><kbd>Space</kbd>+drag</td><td>Pan</td></tr>
          </table>

          <h3>Polyline / Curve editing</h3>
          <table>
            <tr><td>Select + drag vertex</td><td>Move point</td></tr>
            <tr><td>Right-click vertex</td><td>Delete point</td></tr>
          </table>

          <h3>Komponenty</h3>
          <p>Use the Widgets panel (right) to add Gauge, LED, Value, Text, or Image elements. Drag an image file onto the canvas to insert it.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  min-height: 40px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.style-group {
  gap: 6px;
}

.separator {
  width: 1px;
  height: 24px;
  background: var(--input-border);
  margin: 0 6px;
}

.spacer {
  flex: 1;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.1s;
}

.tool-btn:hover {
  background: var(--btn-hover);
  border-color: var(--swatch-border);
}

.tool-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.tool-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.tool-btn.text-btn {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
}

.tool-icon {
  font-size: 18px;
  line-height: 1;
}

/* Color swatches */
.color-swatch {
  position: relative;
  cursor: pointer;
}

.color-swatch input[type="color"] {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.swatch-preview {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid var(--swatch-border);
  cursor: pointer;
}

.swatch-preview.stroke-preview {
  background: transparent;
  border-width: 3px;
}

/* Style inputs */
.style-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.num-input {
  width: 42px;
  height: 26px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 4px;
  color: var(--input-text);
  text-align: center;
  font-size: 12px;
}

.opacity-slider {
  width: 60px;
  height: 4px;
  accent-color: var(--accent);
}

.opacity-value {
  color: #888;
  font-size: 11px;
  font-family: monospace;
  min-width: 30px;
}

.zoom-label {
  color: #999;
  font-size: 12px;
  font-family: monospace;
  min-width: 40px;
  text-align: center;
}

.snap-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
}

.snap-toggle input[type="checkbox"] {
  accent-color: var(--accent);
}

.help-btn {
  font-weight: bold;
  font-size: 16px;
}

.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-panel {
  background: var(--help-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.help-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.help-close:hover {
  background: var(--btn-hover);
  color: var(--text-primary);
}

.help-body {
  padding: 16px;
  overflow-y: auto;
  color: #ccc;
  font-size: 13px;
  line-height: 1.5;
}

.help-body h3 {
  color: #2196F3;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.help-body h3:first-child {
  margin-top: 0;
}

.help-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4px;
}

.help-body td {
  padding: 3px 8px;
  vertical-align: top;
}

.help-body td:first-child {
  width: 160px;
  color: #999;
  white-space: nowrap;
}

.help-body kbd {
  background: #333;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
  color: #eee;
}

.help-body p {
  margin: 4px 0;
  color: #aaa;
}
</style>
