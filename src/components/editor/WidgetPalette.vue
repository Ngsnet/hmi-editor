<script setup lang="ts">
import { useDiagramStore } from '@/stores/diagramStore'
import { useToolStore } from '@/stores/toolStore'
import { useViewportStore } from '@/stores/viewportStore'
import { useHistoryStore } from '@/stores/historyStore'
import { AddElementCommand } from '@/commands/elementCommands'
import type { CanvasElement, ElementType } from '@/types/diagram'

const diagramStore = useDiagramStore()
const viewportStore = useViewportStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()

interface WidgetDef {
  type: ElementType
  label: string
  icon: string
  width: number
  height: number
  defaults: Partial<CanvasElement>
}

const widgets: WidgetDef[] = [
  {
    type: 'text', label: 'Text', icon: 'T',
    width: 120, height: 30,
    defaults: {
      label: 'Text',
      style: { fill: 'none', stroke: '#333333', strokeWidth: 0, opacity: 1, fontSize: 16 },
    },
  },
  {
    type: 'gauge', label: 'Gauge', icon: '⏲',
    width: 120, height: 120,
    defaults: {
      label: 'Gauge',
      dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 },
      style: { fill: 'none', stroke: '#4a90d9', strokeWidth: 2, opacity: 1 },
    },
  },
  {
    type: 'switch', label: 'LED', icon: '●',
    width: 60, height: 60,
    defaults: {
      label: 'Status',
      dataSource: { endpoint: '', valueKey: '', interval: 5000 },
      style: { fill: 'none', stroke: '#333333', strokeWidth: 1, opacity: 1 },
    },
  },
  {
    type: 'textValue', label: 'Value', icon: '123',
    width: 100, height: 40,
    defaults: {
      label: 'Value',
      dataSource: { endpoint: '', valueKey: '', interval: 5000, format: '{v}' },
      style: { fill: '#f5f5f5', stroke: '#333333', strokeWidth: 1, opacity: 1, fontSize: 18 },
    },
  },
  {
    type: 'image', label: 'Image', icon: '🖼',
    width: 150, height: 100,
    defaults: {
      style: { fill: 'none', stroke: '#999999', strokeWidth: 1, opacity: 1 },
    },
  },
  {
    type: 'slider', label: 'Slider', icon: '⎯●',
    width: 160, height: 50,
    defaults: {
      label: 'Slider',
      dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 },
      style: { fill: 'none', stroke: '#4a90d9', strokeWidth: 1, opacity: 1 },
    },
  },
  {
    type: 'progressBar', label: 'Progress', icon: '▰▱',
    width: 180, height: 40,
    defaults: {
      label: 'Progress',
      dataSource: { endpoint: '', valueKey: '', interval: 5000, minValue: 0, maxValue: 100 },
      style: { fill: 'none', stroke: '#4caf50', strokeWidth: 1, opacity: 1 },
    },
  },
  {
    type: 'button', label: 'Button', icon: '[ ]',
    width: 100, height: 36,
    defaults: {
      label: 'Click',
      style: { fill: '#4a90d9', stroke: '#2a6cb8', strokeWidth: 1, opacity: 1, fontSize: 14, textColor: '#ffffff' },
    },
  },
  {
    type: 'toggle', label: 'Toggle', icon: '◑',
    width: 70, height: 60,
    defaults: {
      label: 'Switch',
      dataSource: { endpoint: '', valueKey: '', interval: 5000 },
      style: { fill: 'none', stroke: '#333333', strokeWidth: 1, opacity: 1 },
    },
  },
]

function getVisibleCenter(): { x: number; y: number } {
  const vp = viewportStore.viewport
  // Approximate canvas container size
  const screenW = window.innerWidth - 420 // minus left + right panels
  const screenH = window.innerHeight - 80 // minus toolbar + statusbar
  return {
    x: (screenW / 2 - vp.x) / vp.scale,
    y: (screenH / 2 - vp.y) / vp.scale,
  }
}

function addWidget(def: WidgetDef) {
  const center = getVisibleCenter()
  const cmd = new AddElementCommand({
    type: def.type,
    x: Math.round(center.x - def.width / 2),
    y: Math.round(center.y - def.height / 2),
    width: def.width,
    height: def.height,
    rotation: 0,
    layerId: diagramStore.activeLayerId,
    locked: false,
    visible: true,
    ...def.defaults,
    style: {
      fill: '#ffffff',
      stroke: '#333333',
      strokeWidth: 1,
      opacity: 1,
      ...def.defaults.style,
    },
  } as Omit<CanvasElement, 'id'>)
  historyStore.execute(cmd)
  // Select newly added element (last one)
  const lastEl = diagramStore.diagram.elements[diagramStore.diagram.elements.length - 1]
  if (lastEl) diagramStore.selectElement(lastEl.id)
  toolStore.setTool('select')
}

function onImageUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      const center = getVisibleCenter()
      const cmd = new AddElementCommand({
        type: 'image',
        x: Math.round(center.x - 100),
        y: Math.round(center.y - 75),
        width: 200, height: 150,
        rotation: 0,
        layerId: diagramStore.activeLayerId,
        locked: false,
        visible: true,
        imageData: data,
        imageMimeType: file.type,
        style: { fill: 'none', stroke: '#999', strokeWidth: 0, opacity: 1 },
      })
      historyStore.execute(cmd)
      const lastEl = diagramStore.diagram.elements[diagramStore.diagram.elements.length - 1]
      if (lastEl) diagramStore.selectElement(lastEl.id)
      toolStore.setTool('select')
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function onBackgroundUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      const dw = diagramStore.diagram.width
      const dh = diagramStore.diagram.height

      // Create or find a "Podklad" layer at the bottom
      let bgLayer = diagramStore.diagram.layers.find(l => l.name === 'Podklad')
      if (!bgLayer) {
        const minOrder = Math.min(...diagramStore.diagram.layers.map(l => l.order))
        const bgLayerId = diagramStore.addLayer('Podklad')
        bgLayer = diagramStore.diagram.layers.find(l => l.id === bgLayerId)!
        bgLayer.order = minOrder - 1
      }

      const cmd = new AddElementCommand({
        type: 'image',
        x: 0,
        y: 0,
        width: dw,
        height: dh,
        rotation: 0,
        layerId: bgLayer.id,
        locked: true,
        visible: true,
        imageData: data,
        imageMimeType: file.type,
        style: { fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1 },
      })
      historyStore.execute(cmd)

      // Select the element so user can adjust
      const lastEl = diagramStore.diagram.elements[diagramStore.diagram.elements.length - 1]
      if (lastEl) diagramStore.selectElement(lastEl.id)
      toolStore.setTool('select')
    }
    reader.readAsDataURL(file)
  }
  input.click()
}
</script>

<template>
  <div class="widget-palette">
    <div class="panel-header">Komponenty</div>
    <div class="bg-upload">
      <button class="bg-upload-btn" title="Vložit obrázek jako podklad (půdorys, schéma)" @click="onBackgroundUpload">
        Vložit podklad
      </button>
    </div>
    <div class="widget-grid">
      <button
        v-for="w in widgets"
        :key="w.type"
        class="widget-btn"
        :title="w.label"
        @click="w.type === 'image' ? onImageUpload() : addWidget(w)"
      >
        <span class="widget-icon">{{ w.icon }}</span>
        <span class="widget-label">{{ w.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.widget-palette {
  border-bottom: 1px solid var(--border-color);
}

.panel-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.bg-upload {
  padding: 8px 8px 0;
}

.bg-upload-btn {
  width: 100%;
  padding: 7px 0;
  background: var(--bg-secondary);
  border: 1px dashed var(--input-border);
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
}

.bg-upload-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.widget-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 8px;
}

.widget-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--input-border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
}

.widget-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: white;
}

.widget-icon {
  font-size: 18px;
}

.widget-label {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
