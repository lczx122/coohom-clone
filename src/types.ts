// Core domain types. All spatial coordinates are in METERS (world units).
// Rendering converts meters -> screen pixels via the camera transform.

export type Vec2 = { x: number; y: number }

export type Tool =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'place'
  | 'pan'

/** A straight wall segment between two points. */
export interface Wall {
  id: string
  start: Vec2
  end: Vec2
  /** wall thickness in meters */
  thickness: number
  /** wall height in meters (used by the 3D view) */
  height: number
}

export type OpeningKind = 'door' | 'window'

/** A door or window cut into a wall. */
export interface Opening {
  id: string
  wallId: string
  /** position along the wall, 0..1 from start to end */
  t: number
  /** width in meters */
  width: number
  kind: OpeningKind
  /** sill height for windows (meters from floor) */
  sill: number
  /** opening height in meters */
  height: number
}

/** A placed catalog product (furniture / cabinet) in the plan. */
export interface PlacedItem {
  id: string
  productId: string
  /** center position in meters */
  position: Vec2
  /** rotation in radians (around vertical axis) */
  rotation: number
}

/** Catalog product definition (the "company-tailored" inventory). */
export interface Product {
  id: string
  name: string
  category: string
  /** footprint width (x) in meters */
  width: number
  /** footprint depth (y) in meters */
  depth: number
  /** height (z) in meters, for 3D */
  height: number
  /** display / 3D color */
  color: string
  /** optional SKU or price metadata for a retailer */
  sku?: string
  price?: number
}

export type SelectionKind = 'wall' | 'opening' | 'item' | 'room'

export interface Selection {
  kind: SelectionKind
  id: string
}

export interface DesignSnapshot {
  walls: Wall[]
  openings: Opening[]
  items: PlacedItem[]
}
