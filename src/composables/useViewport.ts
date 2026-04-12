import { ref, onMounted, onUnmounted } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'

export function useViewport(svgRef: Readonly<{ value: SVGSVGElement | null }>) {
  const viewportStore = useViewportStore()
  const isPanning = ref(false)
  const lastPointer = ref({ x: 0, y: 0 })
  const spacePressed = ref(false)

  function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const vp = viewportStore.viewport
    return {
      x: (screenX - vp.x) / vp.scale,
      y: (screenY - vp.y) / vp.scale,
    }
  }

  function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    const vp = viewportStore.viewport
    return {
      x: canvasX * vp.scale + vp.x,
      y: canvasY * vp.scale + vp.y,
    }
  }

  function onWheel(e: WheelEvent): void {
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const rect = svgRef.value!.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    viewportStore.zoomToPoint(screenX, screenY, delta)
  }

  function onPointerDown(e: PointerEvent): void {
    // Middle mouse button or space+left click → pan
    if (e.button === 1 || (e.button === 0 && spacePressed.value)) {
      isPanning.value = true
      lastPointer.value = { x: e.clientX, y: e.clientY }
      ;(e.currentTarget as Element)?.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isPanning.value) return
    const dx = e.clientX - lastPointer.value.x
    const dy = e.clientY - lastPointer.value.y
    viewportStore.panBy(dx, dy)
    lastPointer.value = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: PointerEvent): void {
    if (isPanning.value) {
      isPanning.value = false
      ;(e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.code === 'Space') {
      e.preventDefault()
      spacePressed.value = true
      return
    }

    const svgEl = svgRef.value
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    switch (e.key) {
      case '+':
      case '=':
        viewportStore.zoomToPoint(centerX, centerY, 1.1)
        break
      case '-':
        viewportStore.zoomToPoint(centerX, centerY, 0.9)
        break
      case '0':
        viewportStore.resetViewport()
        break
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      spacePressed.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
  })

  return {
    screenToCanvas,
    canvasToScreen,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isPanning,
    spacePressed,
  }
}
