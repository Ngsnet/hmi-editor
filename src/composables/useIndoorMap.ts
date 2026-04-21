import { useBuildingStore } from '@/stores/buildingStore'
import type { GeoRef, MeterType, Unit } from '@/types/indoor'

const METERS_PER_DEG_LAT = 111320

export function useIndoorMap() {
  const buildingStore = useBuildingStore()

  /**
   * Convert SVG coordinates to lat/lng using two GeoRef control points.
   * Uses full affine transform (scale + rotation + translation).
   */
  function svgToLatLng(svgX: number, svgY: number, geoRef: [GeoRef, GeoRef]): [number, number] {
    const dSvgX = geoRef[1].svgX - geoRef[0].svgX
    const dSvgY = geoRef[1].svgY - geoRef[0].svgY
    const svgDist = Math.sqrt(dSvgX * dSvgX + dSvgY * dSvgY)

    if (svgDist < 0.001) return [geoRef[0].lat, geoRef[0].lng]

    const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(geoRef[0].lat * Math.PI / 180)

    // Geo vector in meters
    const dGeoXm = (geoRef[1].lng - geoRef[0].lng) * metersPerDegLng
    const dGeoYm = (geoRef[1].lat - geoRef[0].lat) * METERS_PER_DEG_LAT
    const geoDist = Math.sqrt(dGeoXm * dGeoXm + dGeoYm * dGeoYm)

    // Scale (meters per SVG unit) and rotation
    const scale = geoDist / svgDist
    const svgAngle = Math.atan2(dSvgY, dSvgX)
    const geoAngle = Math.atan2(dGeoYm, dGeoXm)
    const rotation = geoAngle - svgAngle

    // Transform point relative to geoRef[0]
    const relX = svgX - geoRef[0].svgX
    const relY = svgY - geoRef[0].svgY
    const rotX = relX * Math.cos(rotation) - relY * Math.sin(rotation)
    const rotY = relX * Math.sin(rotation) + relY * Math.cos(rotation)

    const lat = geoRef[0].lat + (rotY * scale) / METERS_PER_DEG_LAT
    const lng = geoRef[0].lng + (rotX * scale) / metersPerDegLng
    return [lat, lng]
  }

  function getUnitFromSvgId(svgPathId: string): Unit | null {
    return buildingStore.building.units.find(u => u.svgPathId === svgPathId) ?? null
  }

  function formatMeterValue(value: number | null, unit: string): string {
    if (value == null) return '--'
    return `${value.toFixed(1)} ${unit}`
  }

  function exportUnitReport(unitId: string): void {
    const unit = buildingStore.building.units.find(u => u.id === unitId)
    if (!unit) return

    const meterTypes = Object.keys(unit.meters) as MeterType[]
    const meterData: Record<string, { value: number | null; unit: string }> = {}
    for (const mt of meterTypes) {
      const config = unit.meters[mt]
      if (!config) continue
      meterData[mt] = {
        value: buildingStore.getMeterValue(unitId, mt),
        unit: config.unit,
      }
    }

    const report = {
      unitId: unit.id,
      name: unit.name,
      tenant: unit.tenant,
      floor: unit.floor,
      area: unit.area,
      category: unit.category,
      meters: meterData,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unit-${unitId}-report.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    svgToLatLng,
    getUnitFromSvgId,
    formatMeterValue,
    exportUnitReport,
  }
}
