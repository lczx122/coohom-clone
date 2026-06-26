import { create } from 'zustand'
import { isCloudEnabled, supabase } from '../lib/supabase'
import * as cloud from '../lib/cloud'
import * as sync from '../lib/sync'
import { useDesignStore } from './useDesignStore'

type Status = 'disabled' | 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  status: Status
  email: string | null
  error: string | null
  syncing: boolean
  init: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

let subscribed = false

export const useAuthStore = create<AuthState>((set, get) => {
  const handleSignedIn = async (email: string | null) => {
    sync.setSyncActive(true)
    set({ status: 'signedIn', email, syncing: true, error: null })
    try {
      await sync.syncOnLogin()
      useDesignStore.getState().reloadFromStorage()
    } catch {
      // keep working from the local cache if the merge fails
    }
    set({ syncing: false })
  }

  return {
    status: 'loading',
    email: null,
    error: null,
    syncing: false,

    init: () => {
      if (!isCloudEnabled || !supabase) {
        set({ status: 'disabled' })
        return
      }
      set({ status: 'loading' })
      if (!subscribed) {
        subscribed = true
        supabase.auth.onAuthStateChange((_event, session) => {
          const user = session?.user
          if (user) {
            if (get().status === 'signedIn') {
              set({ email: user.email ?? null })
              return
            }
            void handleSignedIn(user.email ?? null)
          } else {
            sync.setSyncActive(false)
            set({ status: 'signedOut', email: null })
          }
        })
      }
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) set({ status: 'signedOut' })
        // an existing session is handled by onAuthStateChange (INITIAL_SESSION)
      })
    },

    signIn: async (email, password) => {
      set({ error: null })
      try {
        await cloud.signIn(email, password)
      } catch (e) {
        set({ error: message(e) })
        throw e
      }
    },

    signUp: async (email, password) => {
      set({ error: null })
      try {
        await cloud.signUp(email, password)
        // If email confirmation is enabled, there is no active session yet.
        const { data } = await supabase!.auth.getSession()
        return Boolean(data.session)
      } catch (e) {
        set({ error: message(e) })
        throw e
      }
    },

    signOut: async () => {
      await cloud.signOut()
      sync.setSyncActive(false)
      set({ status: 'signedOut', email: null })
    },

    clearError: () => set({ error: null }),
  }
})
