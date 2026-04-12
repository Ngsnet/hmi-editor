import { reactive, onUnmounted } from 'vue'
import { useDiagramStore } from '@/stores/diagramStore'
import type L from 'leaflet'

export function useMapSync() {
  const diagramStore = useDiagramStore()

  let map: L.Map | null = null
  const widgetPositions = reactive<Map<string, { x: number; y: number }>>(new Map())

  function setMap(mapInstance: L.Map): void {
    map = mapInstance
    map.on('zoom move zoomend moveend resize', recalculate)
    recalculate()
  }

  function recalculate(): void {
    if (!map) return
    const elements = diagramStore.diagram.elements
    for (const el of elements) {
      if (el.geoPosition) {
        const point = map.latLngToContainerPoint([el.geoPosition.lat, el.geoPosition.lng])
        widgetPositions.set(el.id, { x: point.x, y: point.y })
      }
    }
  }

  function getPosition(elementId: string): { x: number; y: number } | null {
    return widgetPositions.get(elementId) ?? null
  }

  function destroy(): void {
    if (map) {
      map.off('zoom move zoomend moveend resize', recalculate)
      map = null
    }
    widgetPositions.clear()
  }

  onUnmounted(destroy)

  return { widgetPositions, setMap, recalculate, getPosition, destroy }
}
