<script setup lang="ts">
import CanvasView from '@/components/canvas/CanvasView.vue'
import Toolbar from './Toolbar.vue'
import LayerPanel from './LayerPanel.vue'
import PropertyPanel from './PropertyPanel.vue'
import WidgetPalette from './WidgetPalette.vue'
import ScadaLibrary from './ScadaLibrary.vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useToolStore } from '@/stores/toolStore'
import { useViewport } from '@/composables/useViewport'
import { AddElementCommand } from '@/commands/elementCommands'
import { ref } from 'vue'

const diagramStore = useDiagramStore()
const historyStore = useHistoryStore()
const toolStore = useToolStore()

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
    <Toolbar />
    <div class="editor-main">
      <LayerPanel />
      <div class="canvas-container">
        <CanvasView />
      </div>
      <div class="right-panel">
        <WidgetPalette />
        <ScadaLibrary />
        <PropertyPanel />
      </div>
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
  background: #1e1e1e;
  border-left: 1px solid #333;
  overflow-y: auto;
}
</style>
