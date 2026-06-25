import type { Product } from '../types'

// ---------------------------------------------------------------------------
// PRODUCT CATALOG (company-tailored inventory)
// ---------------------------------------------------------------------------
// Replace these with your real SKUs. Dimensions are in meters. `width` is the
// product's X footprint, `depth` is Y, `height` is Z (used by the 3D view).
// ---------------------------------------------------------------------------

export const categories = [
  'Base Cabinets',
  'Wall Cabinets',
  'Seating',
  'Tables',
  'Storage',
  'Appliances',
] as const

export const catalog: Product[] = [
  // --- Base Cabinets ---
  { id: 'bc-600', name: 'Base Cabinet 600', category: 'Base Cabinets', width: 0.6, depth: 0.6, height: 0.9, color: '#c8a06a', sku: 'BC-600', price: 180 },
  { id: 'bc-800', name: 'Base Cabinet 800', category: 'Base Cabinets', width: 0.8, depth: 0.6, height: 0.9, color: '#c8a06a', sku: 'BC-800', price: 220 },
  { id: 'bc-corner', name: 'Corner Base Unit', category: 'Base Cabinets', width: 0.9, depth: 0.9, height: 0.9, color: '#bf9760', sku: 'BC-CNR', price: 310 },

  // --- Wall Cabinets ---
  { id: 'wc-600', name: 'Wall Cabinet 600', category: 'Wall Cabinets', width: 0.6, depth: 0.35, height: 0.72, color: '#d8b985', sku: 'WC-600', price: 140 },
  { id: 'wc-900', name: 'Wall Cabinet 900', category: 'Wall Cabinets', width: 0.9, depth: 0.35, height: 0.72, color: '#d8b985', sku: 'WC-900', price: 175 },

  // --- Seating ---
  { id: 'sofa-3', name: '3-Seat Sofa', category: 'Seating', width: 2.1, depth: 0.95, height: 0.85, color: '#5b7a99', sku: 'SF-3', price: 899 },
  { id: 'armchair', name: 'Armchair', category: 'Seating', width: 0.85, depth: 0.9, height: 0.85, color: '#6b8aa9', sku: 'AC-1', price: 349 },
  { id: 'dining-chair', name: 'Dining Chair', category: 'Seating', width: 0.45, depth: 0.5, height: 0.9, color: '#7a6a55', sku: 'DC-1', price: 79 },

  // --- Tables ---
  { id: 'dining-table', name: 'Dining Table 1600', category: 'Tables', width: 1.6, depth: 0.9, height: 0.75, color: '#8a6b45', sku: 'DT-1600', price: 549 },
  { id: 'coffee-table', name: 'Coffee Table', category: 'Tables', width: 1.1, depth: 0.6, height: 0.42, color: '#8a6b45', sku: 'CT-1', price: 199 },

  // --- Storage ---
  { id: 'wardrobe-2', name: 'Wardrobe 2-Door', category: 'Storage', width: 1.0, depth: 0.6, height: 2.1, color: '#9c8157', sku: 'WD-2', price: 459 },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Storage', width: 0.8, depth: 0.3, height: 1.8, color: '#9c8157', sku: 'BS-1', price: 229 },

  // --- Appliances ---
  { id: 'fridge', name: 'Refrigerator', category: 'Appliances', width: 0.7, depth: 0.7, height: 1.8, color: '#cfd4da', sku: 'AP-FR', price: 999 },
  { id: 'oven', name: 'Range / Oven', category: 'Appliances', width: 0.6, depth: 0.6, height: 0.9, color: '#b9bec4', sku: 'AP-OV', price: 749 },
]

export const productById = (id: string): Product | undefined =>
  catalog.find((p) => p.id === id)
