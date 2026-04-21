import type { DataInterval, PointQuality, TimeSeriesPoint } from '@/types/cem'

export function computeInterval(values: number[]): DataInterval {
  if (values.length === 0) return { min: 0, max: 0 }

  if (values.length < 10) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || Math.abs(max) * 0.1 || 1
    return { min: min - range * 0.05, max: max + range * 0.05 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
  const iqr = q3 - q1
  return { min: q1 - 1.5 * iqr, max: q3 + 1.5 * iqr }
}

export function classifyPoint(value: number, interval: DataInterval): PointQuality {
  if (value >= interval.min && value <= interval.max) return 'normal'
  const range = interval.max - interval.min || 1
  if (value >= interval.min - range * 0.05 && value <= interval.max + range * 0.05) return 'dimmed'
  return 'outlier'
}

export function classifyAllPoints(points: TimeSeriesPoint[], interval: DataInterval): TimeSeriesPoint[] {
  return points.map(p => p.source !== 'raw' ? p : { ...p, quality: classifyPoint(p.value, interval) })
}
