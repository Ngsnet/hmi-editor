import { ref, watch, type ShallowRef } from 'vue'
import type { GeoRef } from '@/types/indoor'

export interface GeoRefTransform {
  translateX: number
  translateY: number
  scale: number
  rotation: number // degrees
}

export interface SvgViewBox {
  x: number
  y: number
  width: number
  height: number
}

const METERS_PER_DEG_LAT = 111320

/**
 * Compute the CSS transform that aligns an SVG floor plan with a Leaflet map,
 * given two geo-reference control points.
 *
 * Each GeoRef maps an SVG coordinate to a geographic coordinate.
 * The function solves for scale, rotation, and translation so that
 * SVG points land on their corresponding map screen positions.
 */
export function computeGeoRefTransform(
  geoRef: [GeoRef, GeoRef],
  map: L.Map,
  svgViewBox: SvgViewBox,
  containerSize: { width: number; height: number },
): GeoRefTransform {
  // 1. Convert geo points to screen pixels
  const screenPt1 = map.latLngToContainerPoint([geoRef[0].lat, geoRef[0].lng])
  const screenPt2 = map.latLngToContainerPoint([geoRef[1].lat, geoRef[1].lng])

  // 2. Map SVG coords to container coords (before any CSS transform).
  // The SVG fills the container with preserveAspectRatio="xMidYMid meet" (default).
  // Compute the actual scale and offset.
  const svgAspect = svgViewBox.width / svgViewBox.height
  const containerAspect = containerSize.width / containerSize.height

  let svgScale: number
  let svgOffsetX: number
  let svgOffsetY: number

  if (svgAspect > containerAspect) {
    // Width-limited
    svgScale = containerSize.width / svgViewBox.width
    svgOffsetX = 0
    svgOffsetY = (containerSize.height - svgViewBox.height * svgScale) / 2
  } else {
    // Height-limited
    svgScale = containerSize.height / svgViewBox.height
    svgOffsetX = (containerSize.width - svgViewBox.width * svgScale) / 2
    svgOffsetY = 0
  }

  // SVG coord → container pixel (pre-transform)
  const svgContainerPt1 = {
    x: svgOffsetX + (geoRef[0].svgX - svgViewBox.x) * svgScale,
    y: svgOffsetY + (geoRef[0].svgY - svgViewBox.y) * svgScale,
  }
  const svgContainerPt2 = {
    x: svgOffsetX + (geoRef[1].svgX - svgViewBox.x) * svgScale,
    y: svgOffsetY + (geoRef[1].svgY - svgViewBox.y) * svgScale,
  }

  // 3. Compute scale and rotation from the two point pairs
  const dSvgX = svgContainerPt2.x - svgContainerPt1.x
  const dSvgY = svgContainerPt2.y - svgContainerPt1.y
  const svgDist = Math.sqrt(dSvgX * dSvgX + dSvgY * dSvgY)

  const dScreenX = screenPt2.x - screenPt1.x
  const dScreenY = screenPt2.y - screenPt1.y
  const screenDist = Math.sqrt(dScreenX * dScreenX + dScreenY * dScreenY)

  if (svgDist < 0.001) {
    return { translateX: 0, translateY: 0, scale: 1, rotation: 0 }
  }

  const scale = screenDist / svgDist
  const svgAngle = Math.atan2(dSvgY, dSvgX)
  const screenAngle = Math.atan2(dScreenY, dScreenX)
  const rotation = (screenAngle - svgAngle) * (180 / Math.PI)

  // 4. Compute translation.
  // CSS transform is: translate(tx, ty) scale(s) rotate(r)
  // with transform-origin: center center.
  // After scale+rotate around center, svgContainerPt1 moves to a new position.
  // We need tx, ty such that the transformed svgContainerPt1 lands on screenPt1.
  const cx = containerSize.width / 2
  const cy = containerSize.height / 2

  // Point relative to center
  const relX = svgContainerPt1.x - cx
  const relY = svgContainerPt1.y - cy

  // After scale and rotate around center
  const rotRad = rotation * (Math.PI / 180)
  const transformedX = cx + (relX * Math.cos(rotRad) - relY * Math.sin(rotRad)) * scale
  const transformedY = cy + (relX * Math.sin(rotRad) + relY * Math.cos(rotRad)) * scale

  const translateX = screenPt1.x - transformedX
  const translateY = screenPt1.y - transformedY

  return { translateX, translateY, scale, rotation }
}

/**
 * Reactive composable that recomputes the CSS transform whenever the map moves/zooms.
 */
export function useGeoRefTransform(
  mapRef: ShallowRef<L.Map | null>,
  geoRefGetter: () => [GeoRef, GeoRef] | undefined,
  svgViewBoxGetter: () => SvgViewBox | null,
  containerSizeGetter: () => { width: number; height: number },
) {
  const transform = ref<GeoRefTransform | null>(null)

  function recompute() {
    const map = mapRef.value
    const geoRef = geoRefGetter()
    const svgViewBox = svgViewBoxGetter()
    const containerSize = containerSizeGetter()

    if (!map || !geoRef || !svgViewBox || containerSize.width === 0) {
      transform.value = null
      return
    }

    transform.value = computeGeoRefTransform(geoRef, map, svgViewBox, containerSize)
  }

  // Watch map changes
  watch(mapRef, (newMap, oldMap) => {
    if (oldMap) {
      oldMap.off('move', recompute)
      oldMap.off('zoomend', recompute)
    }
    if (newMap) {
      newMap.on('move', recompute)
      newMap.on('zoomend', recompute)
      recompute()
    }
  }, { immediate: true })

  return { transform, recompute }
}
