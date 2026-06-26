import type { Vec2, Wall } from '../types'

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => len(sub(a, b))

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Angle of a wall in radians. */
export const wallAngle = (w: Wall): number =>
  Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x)

/** Snap a world point to a fixed grid increment (in meters). */
export const snapToGrid = (p: Vec2, increment: number): Vec2 => ({
  x: Math.round(p.x / increment) * increment,
  y: Math.round(p.y / increment) * increment,
})

/**
 * Project point p onto segment a-b, returning the closest point, the
 * parametric position t (0..1) and the distance.
 */
export function projectPointToSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a)
  const lenSq = ab.x * ab.x + ab.y * ab.y
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / lenSq
  t = Math.max(0, Math.min(1, t))
  const point = { x: a.x + ab.x * t, y: a.y + ab.y * t }
  return { point, t, distance: dist(p, point) }
}

/**
 * Find the nearest existing wall endpoint within `threshold` meters, so chained
 * walls snap together cleanly.
 */
export function snapToEndpoints(
  p: Vec2,
  walls: Wall[],
  threshold: number,
): Vec2 | null {
  let best: Vec2 | null = null
  let bestDist = threshold
  for (const w of walls) {
    for (const pt of [w.start, w.end]) {
      const d = dist(p, pt)
      if (d < bestDist) {
        bestDist = d
        best = pt
      }
    }
  }
  return best
}

/** Find the wall whose body is closest to p, within threshold meters. */
export function nearestWall(p: Vec2, walls: Wall[], threshold: number) {
  let best: { wall: Wall; t: number; distance: number } | null = null
  for (const w of walls) {
    const proj = projectPointToSegment(p, w.start, w.end)
    if (proj.distance <= threshold && (!best || proj.distance < best.distance)) {
      best = { wall: w, t: proj.t, distance: proj.distance }
    }
  }
  return best
}

/**
 * Snap a cabinet (given its depth) so its back rests against the nearest wall,
 * returning the new center position and a rotation that faces it into the room.
 * Works in plan space (Vec2 = {x, y=world-z}). Returns null if no wall is close.
 */
export function snapToWall(
  pos: Vec2,
  depth: number,
  walls: Wall[],
  threshold = 0.7,
): { position: Vec2; rotation: number } | null {
  const hit = nearestWall(pos, walls, threshold)
  if (!hit) return null
  const w = hit.wall
  const proj = projectPointToSegment(pos, w.start, w.end).point
  const dx = w.end.x - w.start.x
  const dy = w.end.y - w.start.y
  const len = Math.hypot(dx, dy) || 1
  let n = { x: -dy / len, y: dx / len }
  const toItem = { x: pos.x - proj.x, y: pos.y - proj.y }
  if (toItem.x * n.x + toItem.y * n.y < 0) n = { x: -n.x, y: -n.y }
  const offset = depth / 2 + (w.thickness ?? 0.1) / 2
  return {
    position: { x: proj.x + n.x * offset, y: proj.y + n.y * offset },
    rotation: Math.atan2(-n.x, n.y),
  }
}

/** Polygon area via the shoelace formula (absolute value, in m²). */
export function polygonArea(points: Vec2[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

let counter = 0
/** Lightweight unique id (no crypto dependency needed). */
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}
