<script setup lang="ts">
import { ref } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import { useViewportStore } from '@/stores/viewportStore'
import type { CanvasElement } from '@/types/diagram'

const diagramStore = useDiagramStore()
const viewportStore = useViewportStore()

const expandedLayers = ref<Set<string>>(new Set())
const editingLayerId = ref<string | null>(null)
const editingName = ref('')

const typeIcons: Record<string, string> = {
  rect: '▭',
  ellipse: '◯',
  line: '╱',
  polyline: '⏢',
  text: 'T',
  image: '🖼',
  gauge: '⏲',
  switch: '●',
  textValue: '123',
  slider: '⎯●',
  progressBar: '▰▱',
  button: '[ ]',
  toggle: '◑',
  svg: '⚙',
}

function startRename(layerId: string, currentName: string) {
  editingLayerId.value = layerId
  editingName.value = currentName
}

function finishRename() {
  if (editingLayerId.value && editingName.value.trim()) {
    diagramStore.updateLayer(editingLayerId.value, { name: editingName.value.trim() })
  }
  editingLayerId.value = null
}

function toggleExpand(layerId: string) {
  if (expandedLayers.value.has(layerId)) {
    expandedLayers.value.delete(layerId)
  } else {
    expandedLayers.value.add(layerId)
  }
}

function addLayer() {
  const count = diagramStore.diagram.layers.length + 1
  diagramStore.addLayer(`Vrstva ${count}`)
}

function deleteLayer(id: string) {
  if (diagramStore.diagram.layers.length <= 1) return
  diagramStore.deleteLayer(id)
}

function elementLabel(el: CanvasElement): string {
  if (el.label) return el.label
  return `${el.type} (${Math.round(el.x)}, ${Math.round(el.y)})`
}

function selectAndPanTo(el: CanvasElement) {
  diagramStore.selectElement(el.id, false)
  // Pan viewport so element is centered
  const screenW = window.innerWidth - 420
  const screenH = window.innerHeight - 80
  const elCx = el.x + el.width / 2
  const elCy = el.y + el.height / 2
  const vp = viewportStore.viewport
  vp.x = screenW / 2 - elCx * vp.scale
  vp.y = screenH / 2 - elCy * vp.scale
}
</script>

<template>
  <div class="layer-panel">
    <div class="panel-header">
      <span>Layers</span>
      <button class="add-btn" title="Add layer" @click="addLayer">+</button>
    </div>

    <div class="layer-list">
      <template v-for="layer in [...diagramStore.sortedLayers].reverse()" :key="layer.id">
        <!-- Layer header -->
        <div
          class="layer-item"
          :class="{ active: diagramStore.activeLayerId === layer.id }"
          @click="diagramStore.activeLayerId = layer.id"
        >
          <!-- Expand/collapse toggle -->
          <button
            class="icon-btn expand-btn"
            :title="expandedLayers.has(layer.id) ? 'Collapse' : 'Expand'"
            @click.stop="toggleExpand(layer.id)"
          >{{ expandedLayers.has(layer.id) ? '▼' : '▶' }}</button>

          <button
            class="icon-btn"
            :class="{ off: !layer.visible }"
            title="Toggle visibility"
            @click.stop="diagramStore.updateLayer(layer.id, { visible: !layer.visible })"
          >{{ layer.visible ? '👁' : '🚫' }}</button>

          <button
            class="icon-btn"
            :class="{ off: !layer.locked }"
            title="Toggle lock"
            @click.stop="diagramStore.updateLayer(layer.id, { locked: !layer.locked })"
          >{{ layer.locked ? '🔒' : '🔓' }}</button>

          <template v-if="editingLayerId === layer.id">
            <input
              v-model="editingName"
              class="rename-input"
              @blur="finishRename"
              @keydown.enter="finishRename"
              @keydown.escape="editingLayerId = null"
              autofocus
              @click.stop
            />
          </template>
          <span v-else class="layer-name" @dblclick.stop="startRename(layer.id, layer.name)">
            {{ layer.name }}
          </span>

          <button class="icon-btn small" title="Move up"
            @click.stop="diagramStore.reorderLayer(layer.id, 'up')">▲</button>
          <button class="icon-btn small" title="Move down"
            @click.stop="diagramStore.reorderLayer(layer.id, 'down')">▼</button>
          <button class="icon-btn small delete" title="Delete layer"
            :disabled="diagramStore.diagram.layers.length <= 1"
            @click.stop="deleteLayer(layer.id)">✕</button>
        </div>

        <!-- Elements in this layer (collapsible) -->
        <template v-if="expandedLayers.has(layer.id)">
          <div
            v-for="el in diagramStore.elementsOnLayer(layer.id)"
            :key="el.id"
            class="element-item"
            :class="{ selected: diagramStore.selectedElementIds.has(el.id) }"
            @click.stop="selectAndPanTo(el)"
          >
            <span class="el-icon">{{ typeIcons[el.type] ?? '?' }}</span>
            <span class="el-name">{{ elementLabel(el) }}</span>
            <span v-if="el.locked" class="el-badge">🔒</span>
            <span v-if="!el.visible" class="el-badge">🚫</span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  width: 220px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.add-btn {
  width: 24px;
  height: 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--swatch-border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  background: var(--accent);
  color: white;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--bg-secondary);
  cursor: pointer;
  transition: background 0.1s;
  font-weight: 600;
}

.layer-item:hover {
  background: var(--bg-secondary);
}

.layer-item.active {
  background: var(--selection-bg);
  border-left: 3px solid var(--accent);
  padding-left: 5px;
}

/* Element items */
.element-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 24px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border-light);
}

.element-item:hover {
  background: var(--bg-secondary);
}

.element-item.selected {
  background: var(--selection-bg);
}

.el-icon {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 16px;
  text-align: center;
}

.el-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-secondary);
}

.el-badge {
  font-size: 10px;
  opacity: 0.6;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  border-radius: 2px;
}

.icon-btn:hover {
  color: #fff;
  background: var(--bg-tertiary);
}

.expand-btn {
  font-size: 8px;
  min-width: 14px;
}

.icon-btn.off {
  opacity: 0.4;
}

.icon-btn.small {
  font-size: 9px;
  padding: 1px 2px;
}

.icon-btn.delete:hover {
  color: #ff5555;
}

.icon-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.layer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.rename-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  background: var(--bg-secondary);
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 0 4px;
  outline: none;
}
</style>
