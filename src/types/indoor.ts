export type FloorId = string

export type MeterType = 'water' | 'electric' | 'cooling' | 'heating'

export type MediaLayer = 'water' | 'electric' | 'heat' | 'cool' | 'temperature' | 'other'

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

/** Maps a CEM counter (var_id) to a media layer. Auto-detected or manually overridden. */
export interface CounterLayerAssignment {
  varId: number
  layer: MediaLayer
  auto: boolean  // true = auto-detected, false = manually set
  pos?: { x: number; y: number }  // custom SVG position (if dragged)
  rotation?: number  // text rotation in degrees
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
  meters: Partial<Record<MeterType, MeterConfig>>  // legacy — kept for backward compat
  cemObjectIds?: number[]  // CEM API object IDs (mis_id[]) — vazba na install points
  counterLayers?: CounterLayerAssignment[]  // CEM counter → media layer mapping
  meterBadgePos?: { x: number; y: number }  // Custom SVG position for meter badge
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
