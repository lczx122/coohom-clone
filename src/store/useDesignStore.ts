import { create } from 'zustand'
import type {
  DesignSnapshot,
  Opening,
  OpeningKind,
  PlacedItem,
  Selection,
  Tool,
  Vec2,
  Wall,
} from '../types'
import { company } from '../config/company'
import { uid } from '../lib/geometry'

interface Camera {
  zoom: number
  panX: number
  panY: number
}

interface DesignState {
  // --- document ---
  walls: Wall[]
  openings: Opening[]
  items: PlacedItem[]

  // --- editor ui ---
  tool: Tool
  selection: Selection | null
  placingProductId: string | null
  camera: Camera

  // --- grid / snapping ---
  gridSize: number // meters between major grid lines
  snapIncrement: number // meters
  snapEnabled: boolean

  // --- history ---
  past: DesignSnapshot[]
  future: DesignSnapshot[]

  // --- actions ---
  setTool: (tool: Tool) => void
  setSelection: (sel: Selection | null) => void
  setPlacingProduct: (productId: string | null) => void

  addWall: (start: Vec2, end: Vec2) => string
  updateWall: (id: string, patch: Partial<Wall>) => void

  addOpening: (wallId: string, t: number, kind: OpeningKind) => void
  updateOpening: (id: string, patch: Partial<Opening>) => void

  addItem: (productId: string, position: Vec2) => string
  updateItem: (id: string, patch: Partial<PlacedItem>) => void

  deleteSelection: () => void

  setCamera: (patch: Partial<Camera>) => void
  panBy: (dx: number, dy: number) => void

  setSnapEnabled: (v: boolean) => void

  newPlan: () => void
  loadSnapshot: (snap: DesignSnapshot) => void
  exportSnapshot: () => DesignSnapshot

  undo: () => void
  redo: () => void
}

const STORAGE_KEY = 'floorplanner.design.v1'

function loadInitial(): DesignSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DesignSnapshot
  } catch {
    /* ignore corrupt storage */
  }
  return { walls: [], openings: [], items: [] }
}

function persist(snap: DesignSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
  } catch {
    /* storage may be full / disabled */
  }
}

const initial = loadInitial()

export const useDesignStore = create<DesignState>((set, get) => {
  /** Capture current doc into the undo stack before a mutating change. */
  const checkpoint = () => {
    const { walls, openings, items, past } = get()
    return {
      past: [...past, { walls, openings, items }].slice(-50),
      future: [],
    }
  }

  /** Persist the document portion of state after a change. */
  const save = () => {
    const { walls, openings, items } = get()
    persist({ walls, openings, items })
  }

  return {
    walls: initial.walls,
    openings: initial.openings,
    items: initial.items,

    tool: 'wall',
    selection: null,
    placingProductId: null,
    camera: { zoom: 1, panX: 480, panY: 320 },

    gridSize: 1,
    snapIncrement: 0.1,
    snapEnabled: true,

    past: [],
    future: [],

    setTool: (tool) => set({ tool, selection: null }),
    setSelection: (selection) => set({ selection }),
    setPlacingProduct: (placingProductId) =>
      set({ placingProductId, tool: placingProductId ? 'place' : 'select' }),

    addWall: (start, end) => {
      const id = uid('wall')
      set((s) => ({
        ...checkpoint(),
        walls: [
          ...s.walls,
          {
            id,
            start,
            end,
            thickness: company.defaults.wallThickness,
            height: company.defaults.wallHeight,
          },
        ],
      }))
      save()
      return id
    },

    updateWall: (id, patch) => {
      set((s) => ({
        ...checkpoint(),
        walls: s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      }))
      save()
    },

    addOpening: (wallId, t, kind) => {
      set((s) => ({
        ...checkpoint(),
        openings: [
          ...s.openings,
          {
            id: uid('open'),
            wallId,
            t,
            kind,
            width:
              kind === 'door'
                ? company.defaults.doorWidth
                : company.defaults.windowWidth,
            sill: kind === 'door' ? 0 : 0.9,
            height: kind === 'door' ? 2.1 : 1.2,
          },
        ],
      }))
      save()
    },

    updateOpening: (id, patch) => {
      set((s) => ({
        ...checkpoint(),
        openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      }))
      save()
    },

    addItem: (productId, position) => {
      const id = uid('item')
      set((s) => ({
        ...checkpoint(),
        items: [...s.items, { id, productId, position, rotation: 0 }],
      }))
      save()
      return id
    },

    updateItem: (id, patch) => {
      set((s) => ({
        ...checkpoint(),
        items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      }))
      save()
    },

    deleteSelection: () => {
      const { selection } = get()
      if (!selection) return
      set((s) => {
        const base = checkpoint()
        if (selection.kind === 'wall') {
          return {
            ...base,
            walls: s.walls.filter((w) => w.id !== selection.id),
            // drop openings that belonged to the deleted wall
            openings: s.openings.filter((o) => o.wallId !== selection.id),
            selection: null,
          }
        }
        if (selection.kind === 'opening') {
          return {
            ...base,
            openings: s.openings.filter((o) => o.id !== selection.id),
            selection: null,
          }
        }
        return {
          ...base,
          items: s.items.filter((it) => it.id !== selection.id),
          selection: null,
        }
      })
      save()
    },

    setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
    panBy: (dx, dy) =>
      set((s) => ({
        camera: { ...s.camera, panX: s.camera.panX + dx, panY: s.camera.panY + dy },
      })),

    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),

    newPlan: () => {
      set(() => ({
        ...checkpoint(),
        walls: [],
        openings: [],
        items: [],
        selection: null,
      }))
      save()
    },

    loadSnapshot: (snap) => {
      set((s) => ({
        past: [...s.past, { walls: s.walls, openings: s.openings, items: s.items }].slice(-50),
        future: [],
        walls: snap.walls ?? [],
        openings: snap.openings ?? [],
        items: snap.items ?? [],
        selection: null,
      }))
      save()
    },

    exportSnapshot: () => {
      const { walls, openings, items } = get()
      return { walls, openings, items }
    },

    undo: () => {
      const { past } = get()
      if (past.length === 0) return
      set((s) => {
        const prev = past[past.length - 1]
        return {
          past: s.past.slice(0, -1),
          future: [{ walls: s.walls, openings: s.openings, items: s.items }, ...s.future].slice(0, 50),
          walls: prev.walls,
          openings: prev.openings,
          items: prev.items,
          selection: null,
        }
      })
      save()
    },

    redo: () => {
      const { future } = get()
      if (future.length === 0) return
      set((s) => {
        const next = future[0]
        return {
          past: [...s.past, { walls: s.walls, openings: s.openings, items: s.items }].slice(-50),
          future: s.future.slice(1),
          walls: next.walls,
          openings: next.openings,
          items: next.items,
          selection: null,
        }
      })
      save()
    },
  }
})
