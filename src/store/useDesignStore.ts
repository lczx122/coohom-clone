import { create } from 'zustand'
import type {
  CabinetModelTemplate,
  CabinetSpec,
  DesignSnapshot,
  EnvKind,
  Opening,
  OpeningKind,
  PlacedItem,
  Selection,
  Tool,
  Vec2,
  Wall,
} from '../types'
import { company } from '../config/company'
import { dist, uid } from '../lib/geometry'
import type { Unit } from '../lib/units'
import * as storage from '../lib/storage'
import type { ProjectMeta } from '../lib/storage'
import * as sync from '../lib/sync'
import { buildSample } from '../data/samples'

interface Camera {
  zoom: number
  panX: number
  panY: number
}

const JOINT_EPS = 0.005 // 5 mm — endpoints closer than this are the same joint

interface DesignState {
  // --- document ---
  walls: Wall[]
  openings: Opening[]
  items: PlacedItem[]
  roomNames: Record<string, string>
  roomFloors: Record<string, string>
  environment: EnvKind

  // --- projects ---
  projects: ProjectMeta[]
  currentProjectId: string
  currentProjectName: string

  // --- editor ui ---
  tool: Tool
  selection: Selection | null
  placingProductId: string | null
  /** when set, the next canvas click places a cabinet (model id, or '__new__') */
  placingModelId: string | null
  /** when true, the next canvas click places a light fixture */
  placingLight: boolean
  /** item id whose cabinet is open in the cabinet editor, or null */
  editingItemId: string | null
  camera: Camera

  // --- saved cabinet models ---
  models: CabinetModelTemplate[]

  // --- grid / snapping / units ---
  gridSize: number
  snapIncrement: number
  snapEnabled: boolean
  orthoEnabled: boolean
  unit: Unit

  // --- history ---
  past: DesignSnapshot[]
  future: DesignSnapshot[]

  // --- actions ---
  setTool: (tool: Tool) => void
  setSelection: (sel: Selection | null) => void
  setPlacingProduct: (productId: string | null) => void

  addWall: (start: Vec2, end: Vec2) => string
  updateWall: (id: string, patch: Partial<Wall>) => void
  /** Set a wall's length, keeping `start` fixed and moving the end joint. */
  setWallLength: (id: string, lengthMeters: number) => void
  /** Move every wall endpoint coincident with `from` to `to` (drag a corner). */
  moveJoint: (from: Vec2, to: Vec2) => void

  addOpening: (wallId: string, t: number, kind: OpeningKind) => void
  updateOpening: (id: string, patch: Partial<Opening>) => void

  addItem: (productId: string, position: Vec2) => string
  /** Add many items in a single undo step (used by sketch-to-cabinet). */
  addItems: (items: PlacedItem[]) => void
  updateItem: (id: string, patch: Partial<PlacedItem>) => void
  /** Duplicate an item (offset slightly) and select the copy. */
  duplicateItem: (id: string) => void
  removeItem: (id: string) => void

  // cabinets
  setPlacingModel: (modelId: string | null) => void
  addCabinetItem: (spec: CabinetSpec, position: Vec2) => string
  updateCabinet: (itemId: string, spec: CabinetSpec) => void
  openCabinetEditor: (itemId: string) => void
  closeCabinetEditor: () => void
  saveModel: (spec: CabinetSpec) => void
  deleteModel: (id: string) => void

  // lights & environment
  setPlacingLight: (v: boolean) => void
  addLightItem: (position: Vec2) => string
  setEnvironment: (env: EnvKind) => void

  // rooms
  setRoomFloor: (key: string, flooringKey: string) => void

  // samples
  loadSample: (key: string) => void

  /** Re-read projects/models/current project from local storage (after a cloud sync). */
  reloadFromStorage: () => void

  deleteSelection: () => void

  setCamera: (patch: Partial<Camera>) => void
  panBy: (dx: number, dy: number) => void

  setSnapEnabled: (v: boolean) => void
  setOrthoEnabled: (v: boolean) => void
  setUnit: (u: Unit) => void
  setRoomName: (key: string, name: string) => void

  // projects
  newProject: (name: string) => void
  switchProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void

  loadSnapshot: (snap: DesignSnapshot) => void
  exportSnapshot: () => DesignSnapshot

  undo: () => void
  redo: () => void
}

const boot = storage.bootstrap()

export const useDesignStore = create<DesignState>((set, get) => {
  const checkpoint = () => {
    const { walls, openings, items, past } = get()
    return {
      past: [...past, { walls, openings, items }].slice(-50),
      future: [],
    }
  }

  /** Persist the current project to storage. */
  const save = () => {
    const s = get()
    storage.saveProject({
      meta: { id: s.currentProjectId, name: s.currentProjectName, updatedAt: 0 },
      snapshot: { walls: s.walls, openings: s.openings, items: s.items },
      roomNames: s.roomNames,
      roomFloors: s.roomFloors,
      unit: s.unit,
      environment: s.environment,
    })
    set({ projects: storage.listProjects() })
    sync.pushProject(s.currentProjectId)
  }

  return {
    walls: boot.snapshot.walls,
    openings: boot.snapshot.openings,
    items: boot.snapshot.items,
    roomNames: boot.roomNames ?? {},
    roomFloors: boot.roomFloors ?? {},
    environment: boot.environment ?? 'studio',

    projects: storage.listProjects(),
    currentProjectId: boot.meta.id,
    currentProjectName: boot.meta.name,

    tool: 'wall',
    selection: null,
    placingProductId: null,
    placingModelId: null,
    placingLight: false,
    editingItemId: null,
    models: storage.listModels(),
    camera: { zoom: 1, panX: 480, panY: 320 },

    gridSize: 1,
    snapIncrement: 0.05,
    snapEnabled: true,
    orthoEnabled: true,
    unit: boot.unit ?? 'mm',

    past: [],
    future: [],

    setTool: (tool) => set({ tool, selection: null }),
    setSelection: (selection) => set({ selection }),
    setPlacingProduct: (placingProductId) =>
      set({ placingProductId, placingModelId: null, placingLight: false, tool: placingProductId ? 'place' : 'select' }),

    addWall: (start, end) => {
      const id = uid('wall')
      set((s) => ({
        ...checkpoint(),
        walls: [
          ...s.walls,
          { id, start, end, thickness: company.defaults.wallThickness, height: company.defaults.wallHeight },
        ],
      }))
      save()
      return id
    },

    updateWall: (id, patch) => {
      set((s) => ({ ...checkpoint(), walls: s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
      save()
    },

    setWallLength: (id, lengthMeters) => {
      const w = get().walls.find((x) => x.id === id)
      if (!w) return
      const len = dist(w.start, w.end)
      let dir: Vec2
      if (len < 1e-6) dir = { x: 1, y: 0 }
      else dir = { x: (w.end.x - w.start.x) / len, y: (w.end.y - w.start.y) / len }
      const newEnd = { x: w.start.x + dir.x * lengthMeters, y: w.start.y + dir.y * lengthMeters }
      get().moveJoint(w.end, newEnd)
    },

    moveJoint: (from, to) => {
      set((s) => ({
        ...checkpoint(),
        walls: s.walls.map((w) => {
          let { start, end } = w
          if (dist(start, from) <= JOINT_EPS) start = to
          if (dist(end, from) <= JOINT_EPS) end = to
          return start === w.start && end === w.end ? w : { ...w, start, end }
        }),
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
            width: kind === 'door' ? company.defaults.doorWidth : company.defaults.windowWidth,
            sill: kind === 'door' ? 0 : 0.9,
            height: kind === 'door' ? 2.1 : 1.2,
          },
        ],
      }))
      save()
    },

    updateOpening: (id, patch) => {
      set((s) => ({ ...checkpoint(), openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
      save()
    },

    addItem: (productId, position) => {
      const id = uid('item')
      set((s) => ({ ...checkpoint(), items: [...s.items, { id, productId, position, rotation: 0 }] }))
      save()
      return id
    },

    addItems: (newItems) => {
      if (newItems.length === 0) return
      set((s) => ({ ...checkpoint(), items: [...s.items, ...newItems] }))
      save()
    },

    updateItem: (id, patch) => {
      set((s) => ({ ...checkpoint(), items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
      save()
    },

    duplicateItem: (id) => {
      const src = get().items.find((it) => it.id === id)
      if (!src) return
      const copy: PlacedItem = {
        ...src,
        id: uid('item'),
        position: { x: src.position.x + 0.2, y: src.position.y + 0.2 },
        cabinet: src.cabinet
          ? { ...src.cabinet, sections: src.cabinet.sections?.map((sec) => ({ ...sec, accessories: sec.accessories.map((a) => ({ ...a })) })) }
          : undefined,
        light: src.light ? { ...src.light } : undefined,
      }
      set((s) => ({ ...checkpoint(), items: [...s.items, copy], selection: { kind: 'item', id: copy.id } }))
      save()
    },

    removeItem: (id) => {
      set((s) => ({
        ...checkpoint(),
        items: s.items.filter((it) => it.id !== id),
        selection: s.selection?.kind === 'item' && s.selection.id === id ? null : s.selection,
      }))
      save()
    },

    // ---- cabinets ----
    setPlacingModel: (placingModelId) =>
      set({ placingModelId, placingProductId: null, placingLight: false, tool: placingModelId ? 'place' : 'select' }),

    addCabinetItem: (spec, position) => {
      const id = uid('item')
      set((s) => ({
        ...checkpoint(),
        items: [...s.items, { id, productId: 'custom-cabinet', position, rotation: 0, cabinet: spec }],
      }))
      save()
      return id
    },

    updateCabinet: (itemId, spec) => {
      set((s) => ({
        ...checkpoint(),
        items: s.items.map((it) => (it.id === itemId ? { ...it, cabinet: spec } : it)),
      }))
      save()
    },

    openCabinetEditor: (editingItemId) => set({ editingItemId }),
    closeCabinetEditor: () => set({ editingItemId: null }),

    saveModel: (spec) => {
      const model: CabinetModelTemplate = { id: uid('model'), spec: { ...spec } }
      storage.saveModel(model)
      set({ models: storage.listModels() })
      sync.pushModel(model.id)
    },

    deleteModel: (id) => {
      storage.deleteModel(id)
      set({ models: storage.listModels() })
      sync.deleteModel(id)
    },

    // ---- lights & environment ----
    setPlacingLight: (placingLight) =>
      set({ placingLight, placingProductId: null, placingModelId: null, tool: placingLight ? 'place' : 'select' }),

    addLightItem: (position) => {
      const id = uid('item')
      set((s) => ({
        ...checkpoint(),
        items: [
          ...s.items,
          { id, productId: 'light', position, rotation: 0, light: { color: '#fff3da', intensity: 1.4, height: 2.5 } },
        ],
      }))
      save()
      return id
    },

    setEnvironment: (environment) => {
      set({ environment })
      save()
    },

    // ---- rooms ----
    setRoomFloor: (key, flooringKey) => {
      set((s) => ({ roomFloors: { ...s.roomFloors, [key]: flooringKey } }))
      save()
    },

    // ---- samples ----
    loadSample: (key) => {
      const sample = buildSample(key)
      if (!sample) return
      const data = storage.createProject(sample.name)
      const full = {
        ...data,
        snapshot: sample.snapshot,
        roomFloors: sample.roomFloors ?? {},
        roomNames: sample.roomNames ?? {},
        environment: sample.environment,
      }
      storage.saveProject(full)
      storage.setCurrentId(full.meta.id)
      sync.pushProject(full.meta.id)
      set({
        walls: full.snapshot.walls,
        openings: full.snapshot.openings,
        items: full.snapshot.items,
        roomNames: full.roomNames,
        roomFloors: full.roomFloors,
        environment: full.environment,
        unit: full.unit,
        currentProjectId: full.meta.id,
        currentProjectName: full.meta.name,
        projects: storage.listProjects(),
        selection: null,
        past: [],
        future: [],
      })
    },

    reloadFromStorage: () => {
      const data = storage.bootstrap()
      set({
        walls: data.snapshot.walls,
        openings: data.snapshot.openings,
        items: data.snapshot.items,
        roomNames: data.roomNames ?? {},
        roomFloors: data.roomFloors ?? {},
        environment: data.environment ?? 'studio',
        unit: data.unit ?? 'mm',
        currentProjectId: data.meta.id,
        currentProjectName: data.meta.name,
        projects: storage.listProjects(),
        models: storage.listModels(),
        selection: null,
        past: [],
        future: [],
      })
    },

    deleteSelection: () => {
      const { selection } = get()
      if (!selection || selection.kind === 'room') return
      set((s) => {
        const base = checkpoint()
        if (selection.kind === 'wall') {
          return {
            ...base,
            walls: s.walls.filter((w) => w.id !== selection.id),
            openings: s.openings.filter((o) => o.wallId !== selection.id),
            selection: null,
          }
        }
        if (selection.kind === 'opening') {
          return { ...base, openings: s.openings.filter((o) => o.id !== selection.id), selection: null }
        }
        return { ...base, items: s.items.filter((it) => it.id !== selection.id), selection: null }
      })
      save()
    },

    setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
    panBy: (dx, dy) =>
      set((s) => ({ camera: { ...s.camera, panX: s.camera.panX + dx, panY: s.camera.panY + dy } })),

    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    setOrthoEnabled: (orthoEnabled) => set({ orthoEnabled }),
    setUnit: (unit) => {
      set({ unit })
      save()
    },
    setRoomName: (key, name) => {
      set((s) => ({ roomNames: { ...s.roomNames, [key]: name } }))
      save()
    },

    // ---- projects ----
    newProject: (name) => {
      const data = storage.createProject(name || 'Untitled Plan')
      sync.pushProject(data.meta.id)
      set({
        walls: [],
        openings: [],
        items: [],
        roomNames: {},
        roomFloors: {},
        environment: 'studio',
        currentProjectId: data.meta.id,
        currentProjectName: data.meta.name,
        projects: storage.listProjects(),
        selection: null,
        past: [],
        future: [],
      })
    },

    switchProject: (id) => {
      const s = get()
      // persist current before switching
      storage.saveProject({
        meta: { id: s.currentProjectId, name: s.currentProjectName, updatedAt: 0 },
        snapshot: { walls: s.walls, openings: s.openings, items: s.items },
        roomNames: s.roomNames,
        roomFloors: s.roomFloors,
        unit: s.unit,
        environment: s.environment,
      })
      sync.pushProject(s.currentProjectId)
      const data = storage.loadProject(id)
      if (!data) return
      storage.setCurrentId(id)
      set({
        walls: data.snapshot.walls,
        openings: data.snapshot.openings,
        items: data.snapshot.items,
        roomNames: data.roomNames ?? {},
        roomFloors: data.roomFloors ?? {},
        environment: data.environment ?? 'studio',
        unit: data.unit ?? 'mm',
        currentProjectId: data.meta.id,
        currentProjectName: data.meta.name,
        projects: storage.listProjects(),
        selection: null,
        past: [],
        future: [],
      })
    },

    renameProject: (id, name) => {
      storage.renameProject(id, name)
      sync.pushProject(id)
      set((s) => ({
        projects: storage.listProjects(),
        currentProjectName: s.currentProjectId === id ? name : s.currentProjectName,
      }))
    },

    deleteProject: (id) => {
      storage.deleteProject(id)
      sync.deleteProject(id)
      const remaining = storage.listProjects()
      if (get().currentProjectId === id) {
        if (remaining.length > 0) {
          get().switchProject(remaining[0].id)
        } else {
          get().newProject('Untitled Plan')
        }
      } else {
        set({ projects: remaining })
      }
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
