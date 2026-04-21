import type { TimeSeriesPoint, DataGap } from '@/types/cem'

export function medianInterval(points: TimeSeriesPoint[]): number {
  if (points.length < 2) return 0
  const diffs: number[] = []
  for (let i = 1; i < points.length; i++) {
    diffs.push(points[i]!.timestamp - points[i - 1]!.timestamp)
  }
  diffs.sort((a, b) => a - b)
  const mid = Math.floor(diffs.length / 2)
  return diffs.length % 2 === 0 ? (diffs[mid - 1]! + diffs[mid]!) / 2 : diffs[mid]!
}

export function detectGaps(points: TimeSeriesPoint[]): DataGap[] {
  if (points.length < 3) return []
  const typical = medianInterval(points)
  if (typical <= 0) return []
  const gaps: DataGap[] = []
  for (let i = 1; i < points.length; i++) {
    const duration = points[i]!.timestamp - points[i - 1]!.timestamp
    if (duration > typical * 2) {
      gaps.push({ fromIndex: i - 1, toIndex: i, fromTimestamp: points[i - 1]!.timestamp, toTimestamp: points[i]!.timestamp, duration })
    }
  }
  return gaps
}

function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export function interpolateGaps(points: TimeSeriesPoint[], maxGapMultiplier = 5): TimeSeriesPoint[] {
  if (points.length < 3) return [...points]
  const typical = medianInterval(points)
  if (typical <= 0) return [...points]
  const maxGap = typical * maxGapMultiplier
  const gaps = detectGaps(points)
  if (gaps.length === 0) return [...points]

  const result: TimeSeriesPoint[] = []
  let lastIdx = 0
  for (const gap of gaps) {
    for (let i = lastIdx; i <= gap.fromIndex; i++) result.push(points[i]!)
    lastIdx = gap.toIndex
    if (gap.duration <= maxGap) {
      const p1 = points[gap.fromIndex]!.value
      const p2 = points[gap.toIndex]!.value
      const p0 = gap.fromIndex > 0 ? points[gap.fromIndex - 1]!.value : 2 * p1 - p2
      const p3 = gap.toIndex < points.length - 1 ? points[gap.toIndex + 1]!.value : 2 * p2 - p1
      const steps = Math.round(gap.duration / typical) - 1
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1)
        const ts = Math.round(points[gap.fromIndex]!.timestamp + gap.duration * t)
        result.push({ timestamp: ts, date: new Date(ts), value: Math.round(catmullRom(t, p0, p1, p2, p3) * 1000) / 1000, source: 'interpolated', quality: 'normal' })
      }
    }
  }
  for (let i = lastIdx; i < points.length; i++) result.push(points[i]!)
  return result
}
