<script setup lang="ts">
import type { CemObject } from '@/types/cem'

const props = defineProps<{
  objects: CemObject[]
  depth: number
  expanded: Set<number>
  cemStore: {
    getChildObjects: (parentId: number) => CemObject[]
  }
}>()

const emit = defineEmits<{
  toggle: [id: number]
  select: [id: number]
}>()

function onClick(obj: CemObject) {
  if (obj.type === 'installPoint') emit('select', obj.id)
  else emit('toggle', obj.id)
}
</script>

<template>
  <template v-for="obj in objects" :key="obj.id">
    <div
      class="cem-tree-node"
      :class="{ 'is-install-point': obj.type === 'installPoint' }"
      :style="{ paddingLeft: (12 + depth * 16) + 'px' }"
      @click="onClick(obj)"
    >
      <span class="cem-tree-toggle">
        {{ cemStore.getChildObjects(obj.id).length > 0 ? (expanded.has(obj.id) ? '▾' : '▸') : '\u00A0' }}
      </span>
      <span class="cem-tree-label">{{ obj.name }}</span>
      <span v-if="obj.type === 'installPoint'" class="cem-badge cem-badge-ip">IP</span>
    </div>
    <CemTreeLevel
      v-if="expanded.has(obj.id)"
      :objects="cemStore.getChildObjects(obj.id)"
      :depth="depth + 1"
      :expanded="expanded"
      :cem-store="cemStore"
      @toggle="(id: number) => emit('toggle', id)"
      @select="(id: number) => emit('select', id)"
    />
  </template>
</template>

<style scoped>
.cem-tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary, #ccc);
  transition: background 0.1s;
}

.cem-tree-node:hover {
  background: var(--btn-hover, rgba(255, 255, 255, 0.08));
}

.cem-tree-node.is-install-point {
  color: var(--text-primary, #eee);
}

.cem-tree-toggle {
  width: 12px;
  font-size: 10px;
  color: var(--text-muted, #999);
  text-align: center;
  flex-shrink: 0;
}

.cem-tree-label {
  flex: 1;
}

.cem-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--accent, #2196F3);
  color: white;
  font-weight: 600;
}

.cem-badge-ip {
  background: #16a34a;
  font-size: 9px;
}
</style>
