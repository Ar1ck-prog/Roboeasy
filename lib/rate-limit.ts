/**
 * Rate limiting. `limitRequester` keeps its counters in Supabase, so they are
 * shared by all server instances and survive a restart; when the database is
 * not configured or does not answer it falls back to the in-memory limiter.
 *
 * `rateLimit` itself is a best-effort sliding window for one process.
 */

import { createHmac } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase-admin'

/** Each bucket remembers its own window, so minute and day limits can share the map. */
const buckets = new Map<string, { hits: number[]; windowMs: number }>()
let lastSweep = Date.now()

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds: number
  /** Requests left in the window after this one. */
  remaining: number
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (!b.hits.length || now - b.hits[b.hits.length - 1] > b.windowMs) buckets.delete(k)
    lastSweep = now
  }
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, { hits, windowMs })
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)), remaining: 0 }
  }
  hits.push(now)
  buckets.set(key, { hits, windowMs })
  return { ok: true, retryAfterSeconds: 0, remaining: limit - hits.length }
}

export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'local'
}

interface LimitRow {
  allowed: boolean
  remaining: number
  retry_after: number
}

/** One hit against a shared counter; the in-memory limiter stands in when the database cannot answer. */
export async function hitLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const sb = supabaseAdmin()
  if (sb) {
    try {
      const { data, error } = await sb.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: Math.round(windowMs / 1000) })
      const row = (data as LimitRow[] | null)?.[0]
      if (!error && row) return { ok: row.allowed, retryAfterSeconds: row.retry_after, remaining: row.remaining }
      if (error) console.warn('[rate-limit] database unavailable:', error.message)
    } catch (error) {
      console.warn('[rate-limit] database unavailable:', error instanceof Error ? error.message : error)
    }
  }
  return rateLimit(key, limit, windowMs)
}

export const DEVICE_HEADER = 'x-rb-device'
const DEVICE_ID = /^[a-z0-9-]{8,64}$/i
/** A whole classroom often shares one internet address. */
const DEVICES_PER_ADDRESS = 15

/** Addresses and device ids are stored only as keyed hashes. */
function hashed(value: string): string {
  return createHmac('sha256', process.env.CERT_SECRET ?? 'roboeasy-rate-limit').update(value).digest('hex').slice(0, 32)
}

/**
 * Limits one device (the random id the browser keeps) and, more loosely, its
 * internet address, so that inventing new device ids does not get around the limit.
 */
export async function limitRequester(headers: Headers, scope: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const address = hashed(clientKey(headers))
  const device = headers.get(DEVICE_HEADER)
  if (!device || !DEVICE_ID.test(device)) return hitLimit(`${scope}:addr-only:${address}`, limit, windowMs)
  const shared = await hitLimit(`${scope}:addr:${address}`, limit * DEVICES_PER_ADDRESS, windowMs)
  if (!shared.ok) return shared
  return hitLimit(`${scope}:device:${hashed(device)}`, limit, windowMs)
}
