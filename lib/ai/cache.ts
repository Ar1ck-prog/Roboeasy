/**
 * Cache of generated programs in Supabase (`gen_cache`). The same request for
 * the same robot costs one Gemini call, not one per child. Only commands are
 * stored for DSL programs: blocks and Python are compiled again on every hit,
 * so a compiler fix reaches cached programs too.
 */

import { createHash } from 'node:crypto'

import type { Format } from '@/lib/api-types'
import { DSL_VERSION, type Program, type RobotProfile } from '@/lib/dsl/types'
import { supabaseAdmin } from '@/lib/supabase-admin'

const TTL_DAYS = 30

export type CachedResult =
  | { kind: 'program'; title: string; description: string; program: Program }
  | { kind: 'python'; title: string; description: string; code: string; warnings: string[] }
  | { kind: 'unsupported'; reason: string; suggestion: string }

export const normalizePrompt = (prompt: string) => prompt.toLowerCase().replace(/\s+/g, ' ').trim()

export function cacheKey(input: { prompt: string; format: Format; lang: string; robot: RobotProfile }, dslVersion: number = DSL_VERSION): string {
  // The language decides the wording of the title and description.
  const material = JSON.stringify([normalizePrompt(input.prompt), input.format, input.lang, input.robot, dslVersion])
  return createHash('sha256').update(material).digest('hex')
}

export async function readCache(key: string): Promise<CachedResult | null> {
  const sb = supabaseAdmin()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('gen_cache')
      .select('response')
      .eq('key', key)
      .eq('dsl_version', DSL_VERSION)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<{ response: CachedResult }>()
    if (error) console.warn('[gen-cache] read failed:', error.message)
    return data?.response ?? null
  } catch (error) {
    console.warn('[gen-cache] read failed:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function writeCache(key: string, format: Format, value: CachedResult): Promise<void> {
  const sb = supabaseAdmin()
  if (!sb) return
  try {
    const { error } = await sb.from('gen_cache').upsert({
      key,
      mode: format,
      dsl_version: DSL_VERSION,
      response: value,
      expires_at: new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString(),
    })
    if (error) console.warn('[gen-cache] write failed:', error.message)
    // Old rows are cleared now and then, on the way past.
    else if (Math.random() < 0.02) await sb.rpc('prune_ai_tables')
  } catch (error) {
    console.warn('[gen-cache] write failed:', error instanceof Error ? error.message : error)
  }
}
