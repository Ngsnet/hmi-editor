import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'
import type { ViewportState, CanvasElement } from '@/types/diagram'

export const useViewportStore = defineStore('viewport', () => {
  const viewport = reactive<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.05,
    maxScale: 20,
  })

  const transformString = computed(() =>
    `translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`
  )

  function zoomToPoint(screenX: number, screenY: number, delta: number): void {
    const newScale = clamp(viewport.scale * delta, viewport.minScale, viewport.maxScale)
    viewport.x = screenX - (screenX - viewport.x) * (newScale / viewport.scale)
    viewport.y = screenY - (screenY - viewport.y) * (newScale / viewport.scale)
    viewport.scale = newScale
  }

  function panBy(dx: number, dy: number): void {
    viewport.x += dx
    viewport.y += dy
  }

  function resetViewport(): void {
    viewport.x = 0
    viewport.y = 0
    viewport.scale = 1
  }

  function fitToContent(elements: CanvasElement[], svgWidth: number, svgHeight: number): void {
    if (elements.length === 0) {
      resetViewport()
      return
    }

    const minX = Math.min(...elements.map(e => e.x))
    const minY = Math.min(...elements.map(e => e.y))
    const maxX = Math.max(...elements.map(e => e.x + e.width))
    const maxY = Math.max(...elements.map(e => e.y + e.height))

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    const padding = 50
    const scaleX = (svgWidth - padding * 2) / contentWidth
    const scaleY = (svgHeight - padding * 2) / contentHeight
    const newScale = clamp(Math.min(scaleX, scaleY), viewport.minScale, viewport.maxScale)

    viewport.scale = newScale
    viewport.x = (svgWidth - contentWidth * newScale) / 2 - minX * newScale
    viewport.y = (svgHeight - contentHeight * newScale) / 2 - minY * newScale
  }

  return { viewport, transformString, zoomToPoint, panBy, resetViewport, fitToContent }
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
