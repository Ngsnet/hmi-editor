import type { CemSingleReadingRaw, TimeSeries, TimeSeriesPoint, DataInterval, DataGap, CemCounter } from '@/types/cem'
import { computeInterval, classifyAllPoints } from './readingQuality'
import { interpolateGaps, detectGaps, medianInterval } from './readingInterpolation'

export interface GapInfo {
  fromTimestamp: number
  toTimestamp: number
  duration: number
}

/**
 * Convert single-counter raw readings (API 3) to a TimeSeries.
 * Large gaps (> maxGapMultiplier × median) are preserved as NaN breaks.
 */
export function toTimeSeries(
  readings: CemSingleReadingRaw[],
  counter: CemCounter,
  options?: { interpolate?: boolean; maxGapMultiplier?: number },
): TimeSeries & { gaps: GapInfo[] } {
  const shouldInterpolate = options?.interpolate ?? true
  const maxGapMult = options?.maxGapMultiplier ?? 5

  let points: TimeSeriesPoint[] = readings
    .map(r => ({
      timestamp: r.timestamp,
      date: new Date(r.timestamp),
      value: r.value * counter.multiplier,
      source: 'raw' as const,
      quality: 'normal' as const,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const values = points.map(p => p.value)
  const interval: DataInterval = computeInterval(values)
  points = classifyAllPoints(points, interval)

  // Detect large gaps before interpolation
  const median = medianInterval(points)
  const allGaps = detectGaps(points)
  const largeGaps: GapInfo[] = allGaps
    .filter(g => g.duration > median * maxGapMult)
    .map(g => ({ fromTimestamp: g.fromTimestamp, toTimestamp: g.toTimestamp, duration: g.duration }))

  if (shouldInterpolate && points.length >= 3) {
    points = interpolateGaps(points, maxGapMult)
  }

  // Insert NaN break points at large gaps so Chart.js breaks the line
  if (largeGaps.length > 0) {
    const withBreaks: TimeSeriesPoint[] = []
    let gapIdx = 0
    for (let i = 0; i < points.length; i++) {
      withBreaks.push(points[i]!)
      // Check if there's a large gap after this point
      if (gapIdx < largeGaps.length && i < points.length - 1) {
        const gap = largeGaps[gapIdx]!
        const curr = points[i]!.timestamp
        const next = points[i + 1]!.timestamp
        if (curr <= gap.fromTimestamp && next >= gap.toTimestamp) {
          // Insert NaN break in the middle of the gap
          const midTs = Math.round((gap.fromTimestamp + gap.toTimestamp) / 2)
          withBreaks.push({
            timestamp: midTs,
            date: new Date(midTs),
            value: NaN,
            source: 'raw',
            quality: 'normal',
          })
          gapIdx++
        }
      }
    }
    points = withBreaks
  }

  return {
    varId: counter.id,
    label: counter.typeName,
    unit: counter.unit,
    color: counter.color,
    points,
    interval,
    gaps: largeGaps,
  }
}

/**
 * Calculate consumption (differences between consecutive readings).
 */
export interface ConsumptionPoint {
  timestamp: number
  date: Date
  value: number
  source: 'raw' | 'interpolated'
}

export interface ConsumptionSeries {
  varId: number
  label: string
  unit: string
  color: string
  total: number
  points: ConsumptionPoint[]
}

export function toConsumption(
  readings: CemSingleReadingRaw[],
  counter: CemCounter,
  options?: { interpolate?: boolean; maxGapMultiplier?: number },
): ConsumptionSeries {
  // First build time series (with optional interpolation)
  const ts = toTimeSeries(readings, counter, options)
  const points: ConsumptionPoint[] = []
  let total = 0

  for (let i = 1; i < ts.points.length; i++) {
    const curr = ts.points[i]!
    const prev = ts.points[i - 1]!
    const diff = curr.value - prev.value
    if (diff >= 0) {
      const isInterpolated = curr.source === 'interpolated' || prev.source === 'interpolated'
      points.push({
        timestamp: curr.timestamp,
        date: curr.date,
        value: Math.round(diff * 1000) / 1000,
        source: isInterpolated ? 'interpolated' : 'raw',
      })
      total += diff
    }
  }

  return { varId: counter.id, label: counter.typeName, unit: counter.unit, color: counter.color, total, points }
}

/**
 * Format ConsumptionSeries into Chart.js bar chart data.
 */
export function toBarChartData(series: ConsumptionSeries) {
  return {
    labels: series.points.map(p => p.date),
    datasets: [{
      label: `${series.label} spotřeba (${series.unit})`,
      data: series.points.map(p => p.value),
      backgroundColor: series.points.map(p =>
        p.source === 'interpolated' ? series.color + '40' : series.color + '80'
      ),
      borderColor: series.color,
      borderWidth: 1,
    }],
  }
}

/**
 * Format TimeSeries into Chart.js line chart data.
 */
export function toLineChartData(seriesList: Array<TimeSeries & { gaps?: GapInfo[] }>) {
  if (seriesList.length === 0) return { labels: [] as Date[], datasets: [] as any[], gaps: [] as GapInfo[] }

  const longest = seriesList.reduce((a, b) => a.points.length > b.points.length ? a : b)
  const allGaps = seriesList.flatMap(s => (s as any).gaps ?? []) as GapInfo[]

  return {
    labels: longest.points.map(p => p.date),
    gaps: allGaps,
    datasets: seriesList.map(s => ({
      label: `${s.label} (${s.unit})`,
      data: s.points.map(p => isNaN(p.value) ? null : p.value),
      borderColor: s.color,
      backgroundColor: s.color + '20',
      fill: false,
      tension: 0.3,
      spanGaps: false,  // NaN/null breaks the line
      pointRadius: s.points.length > 100 ? 0 : 3,
      segment: {
        borderDash: (ctx: { p0DataIndex: number; p1DataIndex: number }) => {
          const p0 = s.points[ctx.p0DataIndex]
          const p1 = s.points[ctx.p1DataIndex]
          if (p0?.source === 'interpolated' || p1?.source === 'interpolated') return [5, 5]
          if (p0?.source === 'predicted' || p1?.source === 'predicted') return [10, 5]
          return undefined
        },
      },
      pointBackgroundColor: s.points.map(p => {
        if (isNaN(p.value)) return 'transparent'
        if (p.quality === 'outlier') return '#EF4444'
        if (p.quality === 'dimmed') return s.color + '60'
        if (p.source === 'interpolated') return '#9CA3AF'
        if (p.source === 'predicted') return s.color + '80'
        return s.color
      }),
    })),
  }
}
