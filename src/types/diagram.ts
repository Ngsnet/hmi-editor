export type ElementType =
  | 'rect' | 'ellipse' | 'line' | 'polyline'
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

export interface ElementStyle {
  fill: string
  stroke: string
  strokeWidth: number
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
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number
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
