export type FloorId = string

export type MeterType = 'water' | 'electric' | 'cooling' | 'heating'

export type UnitCategory =
  | 'fashion' | 'sport' | 'food' | 'services' | 'empty' | 'technical'

export interface MeterConfig {
  deviceId: string
  endpoint: string
  valueKey: string
  unit: string
  interval: number
  alertThreshold?: number
  dailyLimit?: number
}

export interface Unit {
  id: string
  name: string
  svgPathId: string
  floor: FloorId
  area: number
  rentableArea: number
  chargeableArea: number
  tenant: string
  category: UnitCategory
  contactEmail?: string
  contractStart?: string
  contractEnd?: string
  meters: Partial<Record<MeterType, MeterConfig>>
  cemObjectIds?: number[]  // CEM API object IDs (mis_id[]) — vazba na install points
}

export interface FloorPlan {
  id: FloorId
  label: string
  svgPath: string
  order: number
  totalArea: number
  rentableArea: number
  chargeableArea: number
  svgUnitsPerMeter: number
  geoRef?: [GeoRef, GeoRef]
}

export interface GeoRef {
  svgX: number
  svgY: number
  lat: number
  lng: number
}

export interface Building {
  id: string
  name: string
  floors: FloorPlan[]
  units: Unit[]
  geoCenter: [number, number]
  geoZoom: number
  geoRef?: [GeoRef, GeoRef]
}
