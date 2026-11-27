'use client'

/**
 * Accounts and sync (Supabase). Optional: without NEXT_PUBLIC_SUPABASE_URL
 * the app stays local-only. Loaded on demand (dynamic import) so pages
 * without an account do not carry the client.
 *
 * Sync: the server keeps the same append-only event log as the browser,
 * keyed by (user, event id), so pushing the same events twice changes
 * nothing (record_events in the migration).
 *
 * The same account can be open on a computer and a phone at once, so after
 * the first full sync the page keeps pulling: when it comes back into view,
 * goes online, every 20 s while visible, and right before a purchase
 * (refreshNow). Otherwise coins spent on one device stay unspent on the other.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

import type { UsageRecord } from '@/lib/ai/usage-summary'

import { type LearnEvent, type Profile, appendEvents, eventSchema, profileSchema } from './state'
import { getLearnState, onRecord, replaceState, setProfile, subscribeLearn } from './store'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const cloudConfigured = Boolean(URL_ && KEY)

let client: SupabaseClient | null = null
export function cloud(): SupabaseClient | null {
  if (!cloudConfigured || typeof window === 'undefined') return null
  client ??= createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  return client
}

function need(): SupabaseClient {
  const sb = cloud()
  if (!sb) throw new Error('not configured')
  return sb
}

/** True when a session is stored in this browser (cheap check before loading the client). */
export function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

export async function currentUser() {
  const sb = cloud()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.user ?? null
}

export type AuthError = 'exists' | 'wrong' | 'confirm' | 'weak' | 'limit' | 'failed'
export type AuthResult = { ok: true } | { ok: false; error: AuthError }

function authError(e: { code?: string; message?: string; status?: number }): AuthError {
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return 'exists'
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'wrong'
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'confirm'
  if (code === 'weak_password' || msg.includes('password should')) return 'weak'
  if (e.status === 429 || code.includes('rate_limit')) return 'limit'
  return 'failed'
}

/**
 * A new account with email and password. No confirmation email: the project
 * has "Confirm email" turned off, so the learner is signed in right away. If
 * it is still on, Supabase returns no session and we say so.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = cloud()
  if (!sb) return { ok: false, error: 'failed' }
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password })
  if (error) return { ok: false, error: authError(error) }
  // With confirmations on, an address that is already taken comes back as a user without identities.
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: 'exists' }
  if (!data.session) return { ok: false, error: 'confirm' }
  return { ok: true }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = cloud()
  if (!sb) return { ok: false, error: 'failed' }
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  return error ? { ok: false, error: authError(error) } : { ok: true }
}

export async function signOut() {
  stopSync()
  await cloud()?.auth.signOut()
}

/** Deletes the account and everything on the server (the browser copy stays unless deleted separately). */
export async function deleteAccount(): Promise<boolean> {
  const sb = cloud()
  if (!sb) return false
  if (!(await currentUser())) return false
  // The account and every row with it (on delete cascade).
  const { error } = await sb.rpc('delete_my_account')
  if (error) return false
  stopSync()
  await sb.auth.signOut({ scope: 'local' })
  return true
}

// ── Profile ──────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string
  nickname: string
  age_range: Profile['ageRange']
  timezone: string
  settings: {
    goal?: Profile['goal']
    skipWeekends?: boolean
    reminders?: Profile['reminders']
    cosmetics?: Profile['cosmetics']
    buddy?: Profile['buddy']
    anonId?: string
    learningPath?: Profile['learningPath']
  }
  parent_consent: boolean
}

/** Exported for tests: the profile goes to the `profiles` row and back without losing fields. */
export function toRow(id: string, p: Profile): ProfileRow {
  return {
    id,
    nickname: p.nickname,
    age_range: p.ageRange,
    timezone: p.timezone,
    settings: { goal: p.goal, skipWeekends: p.skipWeekends, reminders: p.reminders, cosmetics: p.cosmetics, buddy: p.buddy, anonId: p.anonId, learningPath: p.learningPath },
    parent_consent: p.parentConsent,
  }
}

export function fromRow(row: ProfileRow): Profile | null {
  const r = profileSchema.safeParse({
    nickname: row.nickname,
    ageRange: row.age_range,
    timezone: row.timezone,
    goal: row.settings.goal ?? { kind: 'lessons', n: 1 },
    skipWeekends: row.settings.skipWeekends,
    reminders: row.settings.reminders,
    cosmetics: row.settings.cosmetics,
    buddy: row.settings.buddy,
    learningPath: row.settings.learningPath ?? null,
    parentConsent: row.parent_consent,
    createdAt: Date.now(),
    anonId: row.settings.anonId ?? `anon_${row.id.replace(/-/g, '').slice(0, 16)}`,
  })
  return r.success ? r.data : null
}

// ── Sync ─────────────────────────────────────────────────────────────────

let stop: (() => void) | null = null
let refresher: (() => Promise<void>) | null = null

/** Pulls what other devices added since the last pull (no-op when not syncing). */
export async function refreshNow(): Promise<void> {
  await refresher?.()
}

/** How far back an incremental pull looks: events can reach the server a little after their time. */
export const PULL_OVERLAP_MS = 10 * 60_000

function fromServer(row: { id: string; kind: string; at: string; data: Record<string, unknown> }): LearnEvent | null {
  const r = eventSchema.safeParse({ ...row.data, id: row.id, kind: row.kind, at: Date.parse(row.at) })
  return r.success ? r.data : null
}

async function push(sb: SupabaseClient, events: LearnEvent[]) {
  for (let i = 0; i < events.length; i += 400) {
    const { error } = await sb.rpc('record_events', { events: events.slice(i, i + 400) })
    if (error) throw error
  }
}

/** Two-way sync, then live pushes of new events and profile changes. Safe to call more than once. */
export async function startSync(): Promise<{ ok: boolean }> {
  const sb = cloud()
  if (!sb) return { ok: false }
  const user = await currentUser()
  // Class learners are anonymous: their results live in the class tables only.
  if (!user || user.is_anonymous) return { ok: false }
  stopSync()

  // Profile: the server copy wins when this browser has none; otherwise the browser's is saved.
  const { data: row } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>()
  const local = getLearnState().profile
  if (!local && row) {
    const p = fromRow(row)
    if (p) setProfile(p)
  } else if (local) {
    await sb.from('profiles').upsert(toRow(user.id, local))
  }

  // Events: pull what the server has, merge, push the rest.
  /** Server events at or after `since` (all of them without it); null on error. */
  const pull = async (since?: number): Promise<LearnEvent[] | null> => {
    const out: LearnEvent[] = []
    for (let from = 0; ; from += 1000) {
      let q = sb.from('learn_events').select('id, kind, at, data').eq('user_id', user.id)
      if (since !== undefined) q = q.gte('at', new Date(since).toISOString())
      const { data, error } = await q.order('at').range(from, from + 999)
      if (error) return null
      for (const r of data ?? []) {
        const e = fromServer(r)
        if (e) out.push(e)
      }
      if (!data || data.length < 1000) break
    }
    return out
  }
  const merge = (events: LearnEvent[]) => {
    const before = getLearnState()
    const merged = appendEvents(before, events)
    if (merged !== before) replaceState(merged)
  }
  const server = await pull()
  if (!server) return { ok: false }
  merge(server)
  let pulledUpTo = server.reduce((m, e) => Math.max(m, e.at), 0)
  const known = new Set(server.map((e) => e.id))
  await push(
    sb,
    getLearnState().events.filter((e) => !known.has(e.id)),
  ).catch(() => {})

  let queue: LearnEvent[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    const batch = queue
    queue = []
    if (batch.length) push(sb, batch).catch(() => (queue = [...batch, ...queue]))
  }
  const offRecord = onRecord((b, a) => {
    const seen = new Set(b.events.map((e) => e.id))
    queue.push(...a.events.filter((e) => !seen.has(e.id)))
    clearTimeout(timer)
    timer = setTimeout(flush, 1500)
  })
  let lastProfile = JSON.stringify(getLearnState().profile)

  // Later pulls: only the recent part of the log, and the profile when this browser has not changed it.
  let pulling: Promise<void> | null = null
  const refresh = () =>
    (pulling ??= (async () => {
      try {
        const fresh = await pull(pulledUpTo ? pulledUpTo - PULL_OVERLAP_MS : undefined)
        if (fresh) {
          merge(fresh)
          pulledUpTo = fresh.reduce((m, e) => Math.max(m, e.at), pulledUpTo)
        }
        const { data: row } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>()
        const mine = getLearnState().profile
        const theirs = row ? fromRow(row) : null
        // Looks or the robot changed on another device, and nothing is waiting to be saved here.
        if (mine && theirs && JSON.stringify(mine) === lastProfile) {
          const next = { ...theirs, createdAt: mine.createdAt, tour: mine.tour }
          if (JSON.stringify(next) !== lastProfile) {
            lastProfile = JSON.stringify(next)
            setProfile(next)
          }
        }
      } finally {
        pulling = null
      }
    })())
  refresher = refresh
  const onVisible = () => {
    if (document.visibilityState === 'visible') void refresh()
  }
  const onOnline = () => void refresh()
  window.addEventListener('focus', onVisible)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const poll = setInterval(() => document.visibilityState === 'visible' && void refresh(), 20_000)

  const offProfile = subscribeLearn(() => {
    const p = getLearnState().profile
    const json = JSON.stringify(p)
    if (p && json !== lastProfile) {
      lastProfile = json
      void sb.from('profiles').upsert(toRow(user.id, p))
    }
  })
  const flushOnHide = () => document.visibilityState === 'hidden' && flush()
  document.addEventListener('visibilitychange', flushOnHide)
  stop = () => {
    clearTimeout(timer)
    flush()
    offRecord()
    offProfile()
    document.removeEventListener('visibilitychange', flushOnHide)
    window.removeEventListener('focus', onVisible)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(poll)
    refresher = null
  }
  return { ok: true }
}

export function stopSync() {
  stop?.()
  stop = null
}

// ── Admin analytics ──────────────────────────────────────────────────────

export async function isAdmin(): Promise<boolean> {
  const sb = cloud()
  if (!sb) return false
  const { data } = await sb.rpc('is_admin')
  return data === true
}

/** Today's AI requests (RLS: admins only). */
export async function aiUsageToday(): Promise<UsageRecord[]> {
  const day = new Date().toISOString().slice(0, 10)
  const { data, error } = await need().from('ai_usage').select('kind, model, cached, ok, error').eq('day', day).limit(20000)
  if (error) throw error
  return data ?? []
}

/** Funnel events of every learner (RLS: admins only), one list per learner. */
export async function allLearnerEvents(): Promise<LearnEvent[][]> {
  const { data, error } = await need()
    .from('learn_events')
    .select('user_id, id, kind, at, data')
    .in('kind', ['lesson_start', 'lesson_done', 'step_done', 'mistake'])
    .order('at')
    .limit(50000)
  if (error) throw error
  const byUser = new Map<string, LearnEvent[]>()
  for (const r of data ?? []) {
    const e = fromServer(r)
    if (!e) continue
    let list = byUser.get(r.user_id)
    if (!list) byUser.set(r.user_id, (list = []))
    list.push(e)
  }
  return [...byUser.values()]
}
