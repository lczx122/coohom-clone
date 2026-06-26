// ---------------------------------------------------------------------------
// Flooring presets (per-room). `kind` selects the procedural texture drawn in
// the 3D view; `color` is the base tint used in both 2D and 3D.
// ---------------------------------------------------------------------------

export type FloorKind = 'wood' | 'tile' | 'carpet' | 'stone' | 'concrete'

export interface Flooring {
  key: string
  name: string
  kind: FloorKind
  color: string
}

export const floorings: Flooring[] = [
  { key: 'oak-wood', name: 'Oak Wood', kind: 'wood', color: '#c19a6b' },
  { key: 'walnut-wood', name: 'Walnut Wood', kind: 'wood', color: '#8a6240' },
  { key: 'grey-tile', name: 'Grey Tile', kind: 'tile', color: '#b8bcc2' },
  { key: 'marble-tile', name: 'Marble Tile', kind: 'tile', color: '#e8e9ec' },
  { key: 'beige-carpet', name: 'Beige Carpet', kind: 'carpet', color: '#cfc3aa' },
  { key: 'grey-carpet', name: 'Grey Carpet', kind: 'carpet', color: '#9aa0a8' },
  { key: 'stone', name: 'Natural Stone', kind: 'stone', color: '#9c9488' },
  { key: 'concrete', name: 'Polished Concrete', kind: 'concrete', color: '#8d9097' },
]

export const DEFAULT_FLOORING = 'oak-wood'

export const flooringByKey = (key: string): Flooring =>
  floorings.find((f) => f.key === key) ?? floorings[0]
