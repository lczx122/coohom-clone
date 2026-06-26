import type { CabinetModelTemplate, DesignSnapshot, EnvKind } from '../types'
import type { Unit } from './units'
import { uid } from './geometry'

// ---------------------------------------------------------------------------
// Local project persistence.
//
// This module is the ONLY place that touches the storage backend. Today it uses
// the browser's localStorage; to move projects to a real cloud database later
// (e.g. Supabase / Vercel Postgres), reimplement these functions to call an API
// and nothing else in the app needs to change.
// ---------------------------------------------------------------------------

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
}

export interface ProjectData {
  meta: ProjectMeta
  snapshot: DesignSnapshot
  roomNames: Record<string, string>
  roomFloors: Record<string, string>
  unit: Unit
  environment: EnvKind
}

const INDEX_KEY = 'floorplanner.projects.index'
const CURRENT_KEY = 'floorplanner.currentProjectId'
const projectKey = (id: string) => `floorplanner.project.${id}`
const LEGACY_KEY = 'floorplanner.design.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / disabled */
  }
}

export function listProjects(): ProjectMeta[] {
  return (read<ProjectMeta[]>(INDEX_KEY) ?? []).sort((a, b) => b.updatedAt - a.updatedAt)
}

function writeIndex(metas: ProjectMeta[]) {
  write(INDEX_KEY, metas)
}

export function loadProject(id: string): ProjectData | null {
  return read<ProjectData>(projectKey(id))
}

export function getCurrentId(): string | null {
  return read<string>(CURRENT_KEY)
}

export function setCurrentId(id: string) {
  write(CURRENT_KEY, id)
}

/** Write a project to local storage verbatim (without touching updatedAt). */
export function putProject(data: ProjectData) {
  write(projectKey(data.meta.id), data)
  const metas = listProjects().filter((m) => m.id !== data.meta.id)
  metas.push(data.meta)
  writeIndex(metas)
}

export function saveProject(data: ProjectData) {
  data.meta.updatedAt = nowSafe()
  putProject(data)
}

/** Write a cabinet model to local storage verbatim. */
export function putModel(model: CabinetModelTemplate) {
  saveModel(model)
}

export function createProject(name: string): ProjectData {
  const data: ProjectData = {
    meta: { id: uid('proj'), name, updatedAt: nowSafe() },
    snapshot: { walls: [], openings: [], items: [] },
    roomNames: {},
    roomFloors: {},
    unit: 'mm',
    environment: 'studio',
  }
  saveProject(data)
  setCurrentId(data.meta.id)
  return data
}

export function renameProject(id: string, name: string) {
  const data = loadProject(id)
  if (!data) return
  data.meta.name = name
  saveProject(data)
}

export function deleteProject(id: string) {
  try {
    localStorage.removeItem(projectKey(id))
  } catch {
    /* ignore */
  }
  writeIndex(listProjects().filter((m) => m.id !== id))
  if (getCurrentId() === id) {
    const remaining = listProjects()
    setCurrentId(remaining[0]?.id ?? '')
  }
}

/**
 * Returns the project to open on launch, creating a default one (and migrating
 * any pre-multi-project save) if none exist.
 */
export function bootstrap(): ProjectData {
  const currentId = getCurrentId()
  if (currentId) {
    const existing = loadProject(currentId)
    if (existing) return existing
  }
  const metas = listProjects()
  if (metas.length > 0) {
    const first = loadProject(metas[0].id)
    if (first) {
      setCurrentId(first.meta.id)
      return first
    }
  }
  // migrate a legacy single-document save, if present
  const legacy = read<DesignSnapshot>(LEGACY_KEY)
  if (legacy && (legacy.walls?.length || legacy.items?.length)) {
    const data: ProjectData = {
      meta: { id: uid('proj'), name: 'My First Plan', updatedAt: nowSafe() },
      snapshot: legacy,
      roomNames: {},
      roomFloors: {},
      unit: 'mm',
      environment: 'studio',
    }
    saveProject(data)
    setCurrentId(data.meta.id)
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      /* ignore */
    }
    return data
  }
  return createProject('Untitled Plan')
}

// ---------------------------------------------------------------------------
// Saved cabinet models (reusable templates, shared across all projects).
// ---------------------------------------------------------------------------

const MODELS_KEY = 'floorplanner.models'

export function listModels(): CabinetModelTemplate[] {
  return read<CabinetModelTemplate[]>(MODELS_KEY) ?? []
}

export function saveModel(model: CabinetModelTemplate) {
  const models = listModels().filter((m) => m.id !== model.id)
  models.push(model)
  write(MODELS_KEY, models)
}

export function deleteModel(id: string) {
  write(MODELS_KEY, listModels().filter((m) => m.id !== id))
}

// Date.now is fine in the app (browser); guarded only to be safe.
function nowSafe(): number {
  try {
    return Date.now()
  } catch {
    return 0
  }
}
