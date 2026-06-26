import { supabase } from './supabase'
import type { CabinetModelTemplate } from '../types'
import type { ProjectData } from './storage'

// ---------------------------------------------------------------------------
// Supabase data access. Tables (see README for the SQL):
//   projects(id text pk, user_id uuid, name text, data jsonb, updated_at int8)
//   cabinet_models(id text pk, user_id uuid, data jsonb, updated_at int8)
// Row-level security restricts every row to its owner (user_id = auth.uid()).
// ---------------------------------------------------------------------------

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// ---- auth ----
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// ---- projects ----
export async function listProjects(): Promise<ProjectData[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('projects').select('data')
  if (error) throw error
  return (data ?? []).map((r) => r.data as ProjectData)
}

export async function upsertProject(data: ProjectData): Promise<void> {
  if (!supabase) return
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase.from('projects').upsert({
    id: data.meta.id,
    user_id: uid,
    name: data.meta.name,
    data,
    updated_at: data.meta.updatedAt,
  })
  if (error) throw error
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// ---- cabinet models ----
export async function listModels(): Promise<CabinetModelTemplate[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('cabinet_models').select('data')
  if (error) throw error
  return (data ?? []).map((r) => r.data as CabinetModelTemplate)
}

export async function upsertModel(model: CabinetModelTemplate): Promise<void> {
  if (!supabase) return
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase
    .from('cabinet_models')
    .upsert({ id: model.id, user_id: uid, data: model, updated_at: Date.now() })
  if (error) throw error
}

export async function deleteModel(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('cabinet_models').delete().eq('id', id)
  if (error) throw error
}
