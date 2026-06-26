import type { CabinetSection, CabinetSpec, DoorConfig, SectionFront } from '../types'
import { uid } from '../lib/geometry'

// ---------------------------------------------------------------------------
// Cabinet configurator presets (tailorable per company).
// ---------------------------------------------------------------------------

export interface Material {
  key: string
  name: string
  color: string
}

export const materials: Material[] = [
  { key: 'white', name: 'White Melamine', color: '#eef0f2' },
  { key: 'cream', name: 'Cream Matte', color: '#e9e2d0' },
  { key: 'oak', name: 'Natural Oak', color: '#c8a06a' },
  { key: 'walnut', name: 'Walnut', color: '#6b4a32' },
  { key: 'grey', name: 'Dust Grey', color: '#8a8f98' },
  { key: 'graphite', name: 'Graphite', color: '#3b3f45' },
  { key: 'navy', name: 'Navy Blue', color: '#2c3e5c' },
  { key: 'sage', name: 'Sage Green', color: '#7e8b6e' },
]

export const materialColor = (key: string): string =>
  materials.find((m) => m.key === key)?.color ?? '#cccccc'

export interface HingeType {
  key: string
  name: string
}

export const hingeTypes: HingeType[] = [
  { key: 'concealed', name: 'Concealed (standard)' },
  { key: 'soft-close', name: 'Soft-close' },
  { key: 'push-open', name: 'Push-to-open' },
  { key: 'inset', name: 'Inset' },
  { key: 'overlay', name: 'Full overlay' },
]

export interface AccessoryType {
  key: string
  name: string
  color: string
  price?: number
}

export const accessoryTypes: AccessoryType[] = [
  { key: 'drawer', name: 'Drawer', color: '#b9bec4', price: 45 },
  { key: 'trash', name: 'Pull-out Trash Bin', color: '#4a4f57', price: 120 },
  { key: 'dish-rack', name: 'Dish Basket', color: '#c9ccd1', price: 85 },
  { key: 'cutlery', name: 'Cutlery Tray', color: '#9c8157', price: 35 },
  { key: 'wine', name: 'Wine Rack', color: '#7a5236', price: 95 },
  { key: 'basket', name: 'Wire Pull-out Basket', color: '#c2c6cc', price: 70 },
  { key: 'spice', name: 'Spice Pull-out', color: '#a07b4a', price: 60 },
]

export const accessoryType = (key: string): AccessoryType | undefined =>
  accessoryTypes.find((a) => a.key === key)

export function newSection(width = 1, front: SectionFront = 'door-double'): CabinetSection {
  return { id: uid('sec'), width, front, drawers: 3, shelves: 1, accessories: [] }
}

/** A sensible default base cabinet. */
export function defaultCabinet(name = 'New Cabinet'): CabinetSpec {
  return {
    name,
    width: 0.6,
    height: 0.9,
    depth: 0.6,
    panelThickness: 0.018,
    material: 'white',
    color: materialColor('white'),
    doors: 'double',
    hingeType: 'soft-close',
    shelves: 1,
    accessories: [],
    toeKick: 0.1,
    sections: [newSection(1, 'door-double')],
  }
}

const doorToFront: Record<DoorConfig, SectionFront> = {
  none: 'none',
  'single-left': 'door-left',
  'single-right': 'door-right',
  double: 'door-double',
}

/** Ensure a spec has a sections array, synthesising one from legacy fields. */
export function ensureSections(spec: CabinetSpec): CabinetSection[] {
  if (spec.sections && spec.sections.length > 0) return spec.sections
  return [
    {
      id: uid('sec'),
      width: 1,
      front: doorToFront[spec.doors] ?? 'door-double',
      drawers: 3,
      shelves: spec.shelves ?? 1,
      accessories: spec.accessories ?? [],
    },
  ]
}

export function newAccessory(type: string, level = 0.5) {
  return { id: uid('acc'), type, level }
}
