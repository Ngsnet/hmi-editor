import { watch, type Ref } from 'vue'
import { useViewportStore } from '@/stores/viewportStore'
import type L from 'leaflet'

export interface MapBackgroundAnchor {
  canvasX: number
  canvasY: number
  lat: number
  lng: number
}

const METERS_PER_DEG_LAT = 111320

/**
 * Syncs a passive Leaflet map background to the SVG viewport state.
 * Leaflet has all interaction disabled – it just renders tiles.
 * The SVG viewportStore drives zoom/pan.
 */
export function useMapBackground(
  mapInstance: Ref<L.Map | null>,
  containerEl: Ref<HTMLDivElement | null>,
  anchor: Ref<MapBackgroundAnchor | undefined>,
  pixelsPerMeter: Ref<number>,
  svgEl: Ref<SVGSVGElement | null>,
) {
  const viewportStore = useViewportStore()

  let rafId = 0

  function sync() {
    const map = mapInstance.value
    const container = containerEl.value
    const anch = anchor.value
    const ppm = pixelsPerMeter.value
    const svg = svgEl.value

    if (!map || !container || !anch || !ppm || !svg) return

    const vp = viewportStore.viewport
    const svgRect = svg.getBoundingClientRect()

    // Where anchor point appears on screen (in SVG container pixels)
    const anchorScreenX = anch.canvasX * vp.scale + vp.x
    const anchorScreenY = anch.canvasY * vp.scale + vp.y

    // Effective meters per screen pixel at current zoom
    const metersPerPx = 1 / (ppm * vp.scale)

    // Convert to Leaflet zoom level
    // At zoom 0, Leaflet has ~156543 meters/pixel at equator
    // At latitude lat: metersPerPx_at_zoom = 156543.03 * cos(lat) / 2^zoom
    // So: zoom = log2(156543.03 * cos(lat) / metersPerPx)
    const cosLat = Math.cos(anch.lat * Math.PI / 180)
    const leafletZoom = Math.log2(156543.03 * cosLat / metersPerPx)

    // Set Leaflet view centered on anchor
    map.setView([anch.lat, anch.lng], leafletZoom, { animate: false })

    // Now find where Leaflet placed the anchor in its container
    const leafletAnchorPx = map.latLngToContainerPoint([anch.lat, anch.lng])

    // Offset the Leaflet container so anchor aligns with SVG
    const offsetX = anchorScreenX - leafletAnchorPx.x
    const offsetY = anchorScreenY - leafletAnchorPx.y

    container.style.transform = `translate(${offsetX}px, ${offsetY}px)`
  }

  function requestSync() {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(sync)
  }

  // Watch viewport changes
  watch(
    () => [
      viewportStore.viewport.x,
      viewportStore.viewport.y,
      viewportStore.viewport.scale,
    ],
    requestSync,
    { immediate: true },
  )

  // Also watch anchor/pixelsPerMeter changes
  watch([anchor, pixelsPerMeter], requestSync)

  function destroy() {
    cancelAnimationFrame(rafId)
  }

  return { sync, requestSync, destroy }
}
