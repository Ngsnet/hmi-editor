import { useBuildingStore } from '@/stores/buildingStore'
import type { GeoRef, MeterType, Unit } from '@/types/indoor'

export function useIndoorMap() {
  const buildingStore = useBuildingStore()

  function svgToLatLng(svgX: number, svgY: number, geoRef: [GeoRef, GeoRef]): [number, number] {
    const scaleX = (geoRef[1].lng - geoRef[0].lng) / (geoRef[1].svgX - geoRef[0].svgX)
    const scaleY = (geoRef[1].lat - geoRef[0].lat) / (geoRef[1].svgY - geoRef[0].svgY)
    const lat = geoRef[0].lat + (svgY - geoRef[0].svgY) * scaleY
    const lng = geoRef[0].lng + (svgX - geoRef[0].svgX) * scaleX
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
