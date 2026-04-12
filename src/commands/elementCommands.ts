import type { Command } from '@/stores/historyStore'
import type { CanvasElement } from '@/types/diagram'
import { useDiagramStore } from '@/stores/diagramStore'

export class AddElementCommand implements Command {
  private elementId = ''
  description = 'Přidat element'

  constructor(private elementData: Omit<CanvasElement, 'id'>) {}

  execute(): void {
    const store = useDiagramStore()
    this.elementId = store.addElement(this.elementData)
  }

  undo(): void {
    const store = useDiagramStore()
    store.deleteElements([this.elementId])
  }
}

export class DeleteElementsCommand implements Command {
  private deletedElements: CanvasElement[] = []
  description = 'Smazat elementy'

  constructor(private ids: string[]) {}

  execute(): void {
    const store = useDiagramStore()
    // Save copies before deleting
    this.deletedElements = store.diagram.elements
      .filter(el => this.ids.includes(el.id))
      .map(el => JSON.parse(JSON.stringify(el)))
    store.deleteElements(this.ids)
  }

  undo(): void {
    const store = useDiagramStore()
    for (const el of this.deletedElements) {
      const { id, ...data } = el
      const newId = store.addElement(data)
      // Patch the ID back to original so references stay consistent
      const added = store.diagram.elements.find(e => e.id === newId)
      if (added) added.id = id
    }
  }
}

export class MoveElementsCommand implements Command {
  description = 'Přesunout elementy'

  constructor(
    private ids: string[],
    private dx: number,
    private dy: number,
  ) {}

  execute(): void {
    const store = useDiagramStore()
    store.moveElements(this.ids, this.dx, this.dy)
  }

  undo(): void {
    const store = useDiagramStore()
    store.moveElements(this.ids, -this.dx, -this.dy)
  }
}

export class ResizeElementsCommand implements Command {
  description = 'Změnit velikost'

  constructor(
    private originals: Array<{ id: string; x: number; y: number; width: number; height: number }>,
    private finals: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ) {}

  execute(): void {
    const store = useDiagramStore()
    for (const f of this.finals) {
      store.updateElement(f.id, { x: f.x, y: f.y, width: f.width, height: f.height })
    }
  }

  undo(): void {
    const store = useDiagramStore()
    for (const o of this.originals) {
      store.updateElement(o.id, { x: o.x, y: o.y, width: o.width, height: o.height })
    }
  }
}
