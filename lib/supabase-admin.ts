/**
 * Supabase with the service role, for tables only the server may touch
 * (cache, rate limits, usage). Server-only: SUPABASE_SERVICE_ROLE_KEY must
 * never reach the browser. Without it these features quietly stay off.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

let cached: { url: string; key: string; client: SupabaseClient } | null = null

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (cached?.url !== url || cached.key !== key) {
    cached = { url, key, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
  }
  return cached.client
}
