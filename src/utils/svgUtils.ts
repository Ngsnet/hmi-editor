import type { StrokeDashType } from '@/types/diagram'

// Converts StrokeDashType to SVG stroke-dasharray value.
// Values are relative to strokeWidth — SVG scales dasharray by the stroke width.
const DASH_PATTERNS: Record<StrokeDashType, string> = {
  'solid': 'none',
  'dashed': '8 4',
  'dotted': '2 4',
  'dash-dot': '8 3 2 3',
  'long-dash': '16 6',
}

export function strokeDashArray(type: StrokeDashType | undefined): string | undefined {
  if (!type || type === 'solid') return undefined
  return DASH_PATTERNS[type] ?? undefined
}
