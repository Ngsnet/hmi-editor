import type { TimeSeriesPoint, PredictionResult } from '@/types/cem'

const MIN_POINTS = 30

export function canPredict(points: TimeSeriesPoint[]): boolean {
  return points.filter(p => p.source === 'raw').length >= MIN_POINTS
}

function linearRegression(points: TimeSeriesPoint[]) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 }
  const t0 = points[0]!.timestamp
  const xs = points.map(p => p.timestamp - t0)
  const ys = points.map(p => p.value)
  let sx = 0, sy = 0, sxy = 0, sx2 = 0
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; sxy += xs[i]! * ys[i]!; sx2 += xs[i]! * xs[i]! }
  const d = n * sx2 - sx * sx
  if (d === 0) return { slope: 0, intercept: sy / n, rSquared: 0 }
  const slope = (n * sxy - sx * sy) / d
  const intercept = (sy - slope * sx) / n
  const my = sy / n
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) { ssRes += (ys[i]! - (slope * xs[i]! + intercept)) ** 2; ssTot += (ys[i]! - my) ** 2 }
  return { slope, intercept, rSquared: ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot)) }
}

export function predict(points: TimeSeriesPoint[], steps?: number, varId = 0): PredictionResult {
  const raw = points.filter(p => p.source === 'raw')
  if (raw.length < MIN_POINTS) return { varId, points: [], confidence: 0 }
  const maxSteps = Math.floor(raw.length / 3)
  const actual = Math.min(steps ?? maxSteps, maxSteps)
  if (actual <= 0) return { varId, points: [], confidence: 0 }
  const { slope, intercept, rSquared } = linearRegression(raw)
  const recent = raw.slice(-10)
  let avgInt = 0
  for (let i = 1; i < recent.length; i++) avgInt += recent[i]!.timestamp - recent[i - 1]!.timestamp
  avgInt /= Math.max(1, recent.length - 1)
  const t0 = raw[0]!.timestamp
  const last = raw[raw.length - 1]!.timestamp
  const pts: TimeSeriesPoint[] = []
  for (let i = 1; i <= actual; i++) {
    const ts = Math.round(last + avgInt * i)
    pts.push({ timestamp: ts, date: new Date(ts), value: Math.round((slope * (ts - t0) + intercept) * 1000) / 1000, source: 'predicted', quality: 'normal' })
  }
  return { varId, points: pts, confidence: Math.round(rSquared * 100) / 100 }
}
