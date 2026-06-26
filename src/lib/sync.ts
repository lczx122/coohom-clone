import * as cloud from './cloud'
import * as storage from './storage'

// ---------------------------------------------------------------------------
// Sync controller. Local storage is always the working cache; when cloud sync
// is active (user signed in) we mirror changes to Supabase and merge on login.
// All functions are no-ops until setSyncActive(true) is called.
// ---------------------------------------------------------------------------

let active = false
export function setSyncActive(v: boolean) {
  active = v
}
export function isSyncActive() {
  return active
}

/** Two-way merge between local and cloud on sign-in (newest wins per id). */
export async function syncOnLogin(): Promise<void> {
  const [cloudProjects, cloudModels] = await Promise.all([cloud.listProjects(), cloud.listModels()])

  // ---- projects ----
  const localMetas = storage.listProjects()
  const localById = new Map(localMetas.map((m) => [m.id, m]))
  const cloudById = new Map(cloudProjects.map((p) => [p.meta.id, p]))
  const ids = new Set<string>([...localById.keys(), ...cloudById.keys()])

  const pushes: Promise<unknown>[] = []
  for (const id of ids) {
    const localMeta = localById.get(id)
    const cloudProj = cloudById.get(id)
    if (localMeta && !cloudProj) {
      const data = storage.loadProject(id)
      if (data) pushes.push(cloud.upsertProject(data).catch(() => {}))
    } else if (!localMeta && cloudProj) {
      storage.putProject(cloudProj)
    } else if (localMeta && cloudProj) {
      if ((localMeta.updatedAt ?? 0) > (cloudProj.meta.updatedAt ?? 0)) {
        const data = storage.loadProject(id)
        if (data) pushes.push(cloud.upsertProject(data).catch(() => {}))
      } else if ((cloudProj.meta.updatedAt ?? 0) > (localMeta.updatedAt ?? 0)) {
        storage.putProject(cloudProj)
      }
    }
  }

  // ---- cabinet models ---- (pull all cloud, push local-only)
  const localModels = storage.listModels()
  const localModelIds = new Set(localModels.map((m) => m.id))
  const cloudModelIds = new Set(cloudModels.map((m) => m.id))
  for (const m of cloudModels) storage.putModel(m)
  for (const m of localModels) {
    if (!cloudModelIds.has(m.id)) pushes.push(cloud.upsertModel(m).catch(() => {}))
  }
  void localModelIds // (kept for clarity; no deletions on merge)

  await Promise.all(pushes)
}

// ---- debounced project push ----
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function pushProject(id: string) {
  if (!active) return
  const existing = timers.get(id)
  if (existing) clearTimeout(existing)
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id)
      const data = storage.loadProject(id)
      if (data) cloud.upsertProject(data).catch(() => {})
    }, 700),
  )
}

export function deleteProject(id: string) {
  if (!active) return
  cloud.deleteProject(id).catch(() => {})
}

export function pushModel(id: string) {
  if (!active) return
  const model = storage.listModels().find((m) => m.id === id)
  if (model) cloud.upsertModel(model).catch(() => {})
}

export function deleteModel(id: string) {
  if (!active) return
  cloud.deleteModel(id).catch(() => {})
}
