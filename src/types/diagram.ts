export type ElementType =
  | 'rect' | 'ellipse' | 'line' | 'polyline' | 'polygon'
  | 'image' | 'text'
  | 'gauge' | 'switch' | 'textValue'
  | 'slider' | 'progressBar' | 'button' | 'toggle'
  | 'svg'

export interface DataSource {
  endpoint: string
  valueKey: string
  interval: number
  format?: string
  minValue?: number
  maxValue?: number
}

export type StrokeDashType = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash'

export interface ElementStyle {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDash?: StrokeDashType
  opacity: number
  fontSize?: number
  fontFamily?: string
  textColor?: string
}

export interface CanvasElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  layerId: string
  locked: boolean
  visible: boolean
  label?: string
  dataSource?: DataSource
  style: ElementStyle
  points?: Array<{ x: number; y: number }>
  smooth?: boolean  // true = Catmull-Rom curve, false/undefined = straight segments
  imageData?: string
  imageMimeType?: string
  svgContent?: string    // inline SVG markup for svg type
  geoPosition?: {
    lat: number
    lng: number
    locked: boolean  // true = pozici nelze měnit v diagram módu, jen na mapě
  }
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number
  opacity: number  // 0-1, default 1
}

export interface Diagram {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  gridSize: number
  gridVisible: boolean
  snapToGrid: boolean
  layers: Layer[]
  elements: CanvasElement[]
  mapSettings?: {
    defaultCenter: [number, number]
    defaultZoom: number
    tileProvider: 'osm' | 'google-streets' | 'google-satellite'
    showAsBackground: boolean
    backgroundOpacity: number
    anchorPoint?: {
      canvasX: number
      canvasY: number
      lat: number
      lng: number
    }
    pixelsPerMeter?: number
  }
  createdAt: string
  updatedAt: string
}

export interface ViewportState {
  x: number
  y: number
  scale: number
  minScale: number
  maxScale: number
}
