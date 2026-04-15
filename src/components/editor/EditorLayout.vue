<script setup lang="ts">
import CanvasView from '@/components/canvas/CanvasView.vue'
import MapView from '@/components/map/MapView.vue'
import IndoorView from '@/components/indoor/IndoorView.vue'
import Toolbar from './Toolbar.vue'
import LayerPanel from './LayerPanel.vue'
import PropertyPanel from './PropertyPanel.vue'
import WidgetPalette from './WidgetPalette.vue'
import ScadaLibrary from './ScadaLibrary.vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useToolStore } from '@/stores/toolStore'
import { AddElementCommand } from '@/commands/elementCommands'
import { ref } from 'vue'

const diagramStore = useDiagramStore()
const historyStore = useHistoryStore()
const toolStore = useToolStore()

const mode = ref<'diagram' | 'map' | 'indoor'>('diagram')
const leftPanelOpen = ref(true)
const rightPanelOpen = ref(true)

function onDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    const reader = new FileReader()
    reader.onload = () => {
      const cmd = new AddElementCommand({
        type: 'image',
        x: 100, y: 100,
        width: 200, height: 150,
        rotation: 0,
        layerId: diagramStore.activeLayerId,
        locked: false,
        visible: true,
        imageData: reader.result as string,
        imageMimeType: file.type,
        style: { fill: 'none', stroke: '#999', strokeWidth: 0, opacity: 1 },
      })
      historyStore.execute(cmd)
      toolStore.setTool('select')
    }
    reader.readAsDataURL(file)
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}
</script>

<template>
  <div class="editor-layout" @drop="onDrop" @dragover="onDragOver">
    <Toolbar :mode="mode" @update:mode="mode = $event" />
    <div class="editor-main">
      <!-- Left panel (hidden in indoor mode) -->
      <template v-if="mode !== 'indoor'">
        <LayerPanel v-show="leftPanelOpen" />
        <button
          class="panel-toggle left"
          :title="leftPanelOpen ? 'Hide layers' : 'Show layers'"
          @click="leftPanelOpen = !leftPanelOpen"
        >{{ leftPanelOpen ? '◂' : '▸' }}</button>
      </template>

      <div class="canvas-container">
        <CanvasView v-if="mode === 'diagram'" />
        <MapView v-else-if="mode === 'map'" />
        <IndoorView v-else />
      </div>

      <!-- Right panel (hidden in indoor mode) -->
      <template v-if="mode !== 'indoor'">
        <button
          class="panel-toggle right"
          :title="rightPanelOpen ? 'Hide properties' : 'Show properties'"
          @click="rightPanelOpen = !rightPanelOpen"
        >{{ rightPanelOpen ? '▸' : '◂' }}</button>
        <div v-show="rightPanelOpen" class="right-panel">
          <WidgetPalette v-if="mode === 'diagram'" />
          <ScadaLibrary v-if="mode === 'diagram'" />
          <PropertyPanel />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.right-panel {
  display: flex;
  flex-direction: column;
  width: 220px;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}

.panel-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  background: var(--bg-secondary);
  border: none;
  color: #999;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;
  position: relative;
}

.panel-toggle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 40px;
  background: var(--swatch-border);
  border-radius: 2px;
}

.panel-toggle:hover {
  background: var(--accent);
  color: #fff;
  width: 22px;
}

.panel-toggle:hover::after {
  background: transparent;
}

.panel-toggle.left {
  border-right: 1px solid var(--border-color);
}

.panel-toggle.right {
  border-left: 1px solid var(--border-color);
}
</style>
