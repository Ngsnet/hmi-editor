export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / gridSize) * gridSize
}

export interface GeoAnchor {
  canvasX: number
  canvasY: number
  lat: number
  lng: number
}

const METERS_PER_DEG_LAT = 111320

export function canvasToLatLng(
  canvasX: number, canvasY: number,
  anchor: GeoAnchor, pixelsPerMeter: number,
): { lat: number; lng: number } {
  const dxMeters = (canvasX - anchor.canvasX) / pixelsPerMeter
  const dyMeters = (canvasY - anchor.canvasY) / pixelsPerMeter
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(anchor.lat * Math.PI / 180)
  return {
    lat: anchor.lat - dyMeters / METERS_PER_DEG_LAT,
    lng: anchor.lng + dxMeters / metersPerDegLng,
  }
}

export function latLngToCanvas(
  lat: number, lng: number,
  anchor: GeoAnchor, pixelsPerMeter: number,
): { x: number; y: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(anchor.lat * Math.PI / 180)
  const dxMeters = (lng - anchor.lng) * metersPerDegLng
  const dyMeters = (anchor.lat - lat) * METERS_PER_DEG_LAT
  return {
    x: anchor.canvasX + dxMeters * pixelsPerMeter,
    y: anchor.canvasY + dyMeters * pixelsPerMeter,
  }
}
