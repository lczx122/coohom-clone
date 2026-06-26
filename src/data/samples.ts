import type { DesignSnapshot, EnvKind, PlacedItem, Vec2, Wall } from '../types'
import { company } from '../config/company'
import { defaultCabinet } from './cabinet'
import { uid } from '../lib/geometry'

// ---------------------------------------------------------------------------
// Demo / sample scenes. Each builds a fresh design (walls + items) plus an
// environment. Loaded via the "Samples" menu in the toolbar.
// ---------------------------------------------------------------------------

export interface SampleResult {
  name: string
  snapshot: DesignSnapshot
  environment: EnvKind
  roomNames?: Record<string, string>
  roomFloors?: Record<string, string>
}

export interface SampleInfo {
  key: string
  name: string
  description: string
}

export const sampleList: SampleInfo[] = [
  { key: 'kitchen', name: 'Studio Kitchen', description: 'A small kitchen with a cabinet run and ceiling lights.' },
  { key: 'living', name: 'Living Room', description: 'A furnished living room with a sofa, table and lamps.' },
  { key: 'patio', name: 'Outdoor Patio', description: 'An open patio scene under a procedural sky.' },
]

const t = company.defaults.wallThickness
const h = company.defaults.wallHeight

/** Build a chain of walls through the given points (optionally closed). */
function wallChain(points: Vec2[], closed = true): Wall[] {
  const walls: Wall[] = []
  const n = closed ? points.length : points.length - 1
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    walls.push({ id: uid('wall'), start: a, end: b, thickness: t, height: h })
  }
  return walls
}

function product(productId: string, position: Vec2, rotation = 0): PlacedItem {
  return { id: uid('item'), productId, position, rotation }
}

function light(position: Vec2): PlacedItem {
  return { id: uid('item'), productId: 'light', position, rotation: 0, light: { color: '#fff3da', intensity: 1.5, height: 2.5 } }
}

function cabinet(position: Vec2, rotation: number, width: number): PlacedItem {
  const spec = defaultCabinet('Base Cabinet')
  spec.width = width
  return { id: uid('item'), productId: 'custom-cabinet', position, rotation, cabinet: spec }
}

export function buildSample(key: string): SampleResult | null {
  switch (key) {
    case 'kitchen': {
      const walls = wallChain([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ])
      // cabinet run along the top wall (facing down/into room)
      const items: PlacedItem[] = [
        cabinet({ x: 0.4, y: 0.35 }, Math.PI, 0.6),
        cabinet({ x: 1.05, y: 0.35 }, Math.PI, 0.6),
        cabinet({ x: 1.75, y: 0.35 }, Math.PI, 0.8),
        product('fridge', { x: 3.6, y: 0.4 }, Math.PI),
        product('dining-table', { x: 2.2, y: 2.0 }, 0),
        product('dining-chair', { x: 1.7, y: 2.0 }, Math.PI / 2),
        product('dining-chair', { x: 2.7, y: 2.0 }, -Math.PI / 2),
        light({ x: 1.3, y: 1.5 }),
        light({ x: 2.8, y: 1.5 }),
      ]
      return {
        name: 'Studio Kitchen',
        snapshot: { walls, openings: [], items },
        environment: 'studio',
        roomFloors: {},
      }
    }
    case 'living': {
      const walls = wallChain([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ])
      const items: PlacedItem[] = [
        product('sofa-3', { x: 2.5, y: 0.6 }, 0),
        product('coffee-table', { x: 2.5, y: 1.7 }, 0),
        product('armchair', { x: 0.7, y: 1.8 }, Math.PI / 2),
        product('bookshelf', { x: 4.6, y: 2.5 }, -Math.PI / 2),
        light({ x: 2.5, y: 2.0 }),
        light({ x: 1.0, y: 3.2 }),
      ]
      return {
        name: 'Living Room',
        snapshot: { walls, openings: [], items },
        environment: 'studio',
        roomFloors: {},
      }
    }
    case 'patio': {
      // a low corner wall + outdoor furniture, no enclosed room
      const walls = [
        ...wallChain(
          [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
          ],
          false,
        ),
      ].map((w) => ({ ...w, height: 0.5, color: '#b9a890' }))
      const items: PlacedItem[] = [
        product('sofa-3', { x: 2.4, y: 0.7 }, 0),
        product('armchair', { x: 0.9, y: 1.6 }, Math.PI / 3),
        product('coffee-table', { x: 2.4, y: 1.8 }, 0),
        product('dining-table', { x: 3.6, y: 3.0 }, 0),
        product('dining-chair', { x: 3.1, y: 3.0 }, Math.PI / 2),
        product('dining-chair', { x: 4.1, y: 3.0 }, -Math.PI / 2),
      ]
      return {
        name: 'Outdoor Patio',
        snapshot: { walls, openings: [], items },
        environment: 'outdoor',
        roomFloors: {},
      }
    }
    default:
      return null
  }
}
