import type { Vec2 } from '../types'
import { dist } from './geometry'

// Convert a freehand stroke into a run of cabinets laid end-to-end along the
// path, each facing toward `facing` (the room interior) when provided.

export interface RunCabinet {
  position: Vec2
  rotation: number
  width: number
}

function cumulative(points: Vec2[]): number[] {
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]))
  return cum
}

export function pathLength(points: Vec2[]): number {
  if (points.length < 2) return 0
  return cumulative(points)[points.length - 1]
}

/** Point + unit tangent at arc-length `s` along the polyline. */
function sample(points: Vec2[], cum: number[], s: number): { point: Vec2; dir: Vec2 } {
  // find the segment containing s
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < s) i++
  const segLen = cum[i + 1] - cum[i] || 1
  const t = Math.max(0, Math.min(1, (s - cum[i]) / segLen))
  const a = points[i]
  const b = points[i + 1]
  const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { point, dir: { x: dx / len, y: dy / len } }
}

export function generateRun(
  points: Vec2[],
  width: number,
  depth: number,
  facing: Vec2 | null,
  maxCount = 60,
): RunCabinet[] {
  if (points.length < 2 || width <= 0) return []
  const cum = cumulative(points)
  const total = cum[cum.length - 1]
  const count = Math.min(maxCount, Math.floor(total / width))
  if (count < 1) return []

  const run: RunCabinet[] = []
  for (let i = 0; i < count; i++) {
    const s = i * width + width / 2
    const { point, dir } = sample(points, cum, s)
    // normal perpendicular to the path
    let n = { x: -dir.y, y: dir.x }
    if (facing) {
      const toRoom = { x: facing.x - point.x, y: facing.y - point.y }
      if (toRoom.x * n.x + toRoom.y * n.y < 0) n = { x: -n.x, y: -n.y }
    }
    run.push({
      position: { x: point.x + n.x * (depth / 2), y: point.y + n.y * (depth / 2) },
      rotation: Math.atan2(-n.x, n.y),
      width,
    })
  }
  return run
}
