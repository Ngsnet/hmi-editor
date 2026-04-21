import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { StrokeDashType } from '@/types/diagram'

export type ToolType = 'select' | 'rect' | 'ellipse' | 'line' | 'polyline' | 'curve' | 'polygon' | 'text' | 'image'

export const useToolStore = defineStore('tool', () => {
  const activeTool = ref<ToolType>('select')

  const toolOptions = reactive({
    fillColor: '#ffffff',
    strokeColor: '#333333',
    strokeWidth: 2,
    strokeDash: 'solid' as StrokeDashType,
    opacity: 1,
    fontSize: 14,
  })

  function setTool(tool: ToolType): void {
    activeTool.value = tool
  }

  return { activeTool, toolOptions, setTool }
})
