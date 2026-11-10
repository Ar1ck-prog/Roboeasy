'use client'

import { useEffect, useState } from 'react'

type CloudModule = typeof import('@/lib/learn/cloud')

/** Accounts are configured for this build (the client itself loads on demand). */
export const CLOUD_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let loading: Promise<CloudModule> | null = null
export function loadCloud(): Promise<CloudModule> {
  loading ??= import('@/lib/learn/cloud')
  return loading
}

/** The cloud module once loaded (null while loading or when accounts are off). */
export function useCloudModule(enabled = true): CloudModule | null {
  const [mod, setMod] = useState<CloudModule | null>(null)
  useEffect(() => {
    if (!CLOUD_CONFIGURED || !enabled) return
    let alive = true
    void loadCloud().then((m) => alive && setMod(m))
    return () => {
      alive = false
    }
  }, [enabled])
  return mod
}

/** The signed-in user (or null), following sign-in and sign-out. `undefined` while unknown. */
export function useCloudUser(mod: CloudModule | null) {
  const [user, setUser] = useState<{ id: string; email?: string; is_anonymous?: boolean } | null | undefined>(undefined)
  useEffect(() => {
    if (!mod) return
    const sb = mod.cloud()
    if (!sb) return
    let alive = true
    void sb.auth.getSession().then(({ data }) => alive && setUser(data.session?.user ?? null))
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [mod])
  return mod ? user : CLOUD_CONFIGURED ? undefined : null
}

function storedSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

/** Syncs progress in the background on every page when the learner has signed in before. */
export function CloudSync() {
  useEffect(() => {
    if (!CLOUD_CONFIGURED || !storedSession()) return
    let alive = true
    void loadCloud().then((m) => alive && void m.startSync())
    return () => {
      alive = false
      void loadCloud().then((m) => m.stopSync())
    }
  }, [])
  return null
}
