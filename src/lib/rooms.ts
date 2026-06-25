import type { Vec2, Wall } from '../types'

// Detect enclosed rooms from the wall network using planar face extraction.
// A "room" is a minimal cycle (bounded face) of the graph whose nodes are wall
// endpoints and whose edges are walls.

export interface Room {
  /** stable-ish key derived from the sorted corner coordinates */
  key: string
  /** ordered polygon corners (meters) */
  polygon: Vec2[]
  /** floor area in m² */
  area: number
  centroid: Vec2
}

const QUANT = 1000 // round coordinates to the nearest mm for node identity
const nodeKey = (p: Vec2) => `${Math.round(p.x * QUANT)}:${Math.round(p.y * QUANT)}`

/** Shoelace signed area (m²) in the canvas' y-down coordinate system. */
function signedArea(pts: Vec2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

export function detectRooms(walls: Wall[]): Room[] {
  if (walls.length < 3) return []

  // ---- build the planar graph ----
  const nodes = new Map<string, Vec2>()
  const addNode = (p: Vec2): string => {
    const k = nodeKey(p)
    if (!nodes.has(k)) {
      nodes.set(k, { x: Math.round(p.x * QUANT) / QUANT, y: Math.round(p.y * QUANT) / QUANT })
    }
    return k
  }

  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a)!.push(b)
  }

  for (const w of walls) {
    const a = addNode(w.start)
    const b = addNode(w.end)
    if (a === b) continue
    link(a, b)
    link(b, a)
  }

  // sort each node's neighbours by angle (and dedupe parallel edges)
  const angle = (from: string, to: string) => {
    const A = nodes.get(from)!
    const B = nodes.get(to)!
    return Math.atan2(B.y - A.y, B.x - A.x)
  }
  for (const [k, list] of adj) {
    const uniq = Array.from(new Set(list))
    uniq.sort((x, y) => angle(k, x) - angle(k, y))
    adj.set(k, uniq)
  }

  // ---- trace faces (clockwise-next half-edge rule) ----
  const visited = new Set<string>()
  const he = (a: string, b: string) => `${a}->${b}`
  const faces: Vec2[][] = []

  for (const [start, neigh] of adj) {
    for (const first of neigh) {
      if (visited.has(he(start, first))) continue
      const poly: Vec2[] = []
      let u = start
      let v = first
      let guard = 0
      while (guard++ < 100000) {
        visited.add(he(u, v))
        poly.push(nodes.get(v)!)
        const vn = adj.get(v)!
        const idx = vn.indexOf(u)
        if (idx === -1) break
        const next = vn[(idx - 1 + vn.length) % vn.length]
        u = v
        v = next
        if (u === start && v === first) break
      }
      if (poly.length >= 3) faces.push(poly)
    }
  }

  if (faces.length === 0) return []

  // ---- classify: the outer boundary is the largest-|area| face ----
  const computed = faces.map((p) => ({ p, s: signedArea(p) }))
  let maxAbs = 0
  let outerSign = 1
  for (const f of computed) {
    if (Math.abs(f.s) > maxAbs) {
      maxAbs = Math.abs(f.s)
      outerSign = Math.sign(f.s)
    }
  }

  const rooms: Room[] = []
  const seen = new Set<string>()
  for (const f of computed) {
    if (Math.sign(f.s) === outerSign) continue // skip the unbounded/outer face
    const area = Math.abs(f.s)
    if (area < 0.05) continue // ignore slivers (< 0.05 m²)
    const key = f.p.map(nodeKey).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const centroid = f.p.reduce(
      (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
      { x: 0, y: 0 },
    )
    centroid.x /= f.p.length
    centroid.y /= f.p.length
    rooms.push({ key, polygon: f.p, area, centroid })
  }
  return rooms
}

/** Ray-casting point-in-polygon test (meters). */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersect) inside = !inside
  }
  return inside
}
