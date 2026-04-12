import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Command {
  execute(): void
  undo(): void
  description: string
}

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<Command[]>([])
  const redoStack = ref<Command[]>([])
  const maxHistory = 100

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function execute(command: Command): void {
    command.execute()
    undoStack.value.push(command)
    if (undoStack.value.length > maxHistory) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function undo(): void {
    const cmd = undoStack.value.pop()
    if (cmd) {
      cmd.undo()
      redoStack.value.push(cmd)
    }
  }

  function redo(): void {
    const cmd = redoStack.value.pop()
    if (cmd) {
      cmd.execute()
      undoStack.value.push(cmd)
    }
  }

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  return { undoStack, redoStack, canUndo, canRedo, execute, undo, redo, clear }
})
