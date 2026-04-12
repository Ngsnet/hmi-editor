export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / gridSize) * gridSize
}
