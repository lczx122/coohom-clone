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
  | 'sketch'

/** A straight wall segment between two points. */
export interface Wall {
  id: string
  start: Vec2
  end: Vec2
  /** wall thickness in meters */
  thickness: number
  /** wall height in meters (used by the 3D view) */
  height: number
  /** optional wall color (falls back to a default when unset) */
  color?: string
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
  /** when present, this item is a custom parametric cabinet */
  cabinet?: CabinetSpec
  /** when present, this item is a light fixture */
  light?: LightSpec
}

/** A placeable light fixture. */
export interface LightSpec {
  color: string
  /** luminous intensity (arbitrary 0..5-ish) */
  intensity: number
  /** mounting height in meters */
  height: number
}

/** 3D environment / backdrop for a project. */
export type EnvKind = 'studio' | 'outdoor'

// --- Parametric cabinets -----------------------------------------------------

export type DoorConfig = 'none' | 'single-left' | 'single-right' | 'double'

export interface CabinetAccessory {
  id: string
  /** key into accessoryTypes (e.g. 'trash', 'dish-rack', 'drawer') */
  type: string
  /** vertical position as a fraction of interior height, 0 (bottom) .. 1 (top) */
  level: number
}

/** How the front of a section is treated. */
export type SectionFront = 'none' | 'door-left' | 'door-right' | 'door-double' | 'drawers'

/** A vertical column of the cabinet, separated from neighbours by dividers. */
export interface CabinetSection {
  id: string
  /** relative width weight (sections fill the interior proportionally) */
  width: number
  front: SectionFront
  /** number of drawer fronts when front === 'drawers' */
  drawers: number
  /** interior shelves when not a drawer bank */
  shelves: number
  accessories: CabinetAccessory[]
  /** handle style for this section's doors/drawers */
  handle?: 'bar' | 'knob'
  /** handle placement on doors */
  handlePos?: 'top' | 'side'
}

export interface CabinetSpec {
  name: string
  /** all dimensions in meters */
  width: number
  height: number
  depth: number
  panelThickness: number
  /** key into materials presets */
  material: string
  /** resolved carcass/door color (allows custom override of the preset) */
  color: string
  doors: DoorConfig
  /** key into hingeTypes presets */
  hingeType: string
  shelves: number
  accessories: CabinetAccessory[]
  /** recessed plinth height under the carcass (meters) */
  toeKick?: number
  /** detailed interior layout; when present it supersedes doors/shelves */
  sections?: CabinetSection[]
  /** base = stands on floor; wall = mounted up the wall */
  kind?: 'base' | 'wall'
  /** for wall cabinets: height of the cabinet's underside above the floor (m) */
  mountHeight?: number
  /** base cabinets: render a worktop slab on top */
  worktop?: boolean
  worktopThickness?: number
  worktopColor?: string
}

/** A reusable saved cabinet template. */
export interface CabinetModelTemplate {
  id: string
  spec: CabinetSpec
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
