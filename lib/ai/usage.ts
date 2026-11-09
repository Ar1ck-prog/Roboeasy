/**
 * Counts AI requests in `ai_usage`: what kind, which model, cached or not, how
 * it ended. Never the text of a child's request. A failure here must not
 * affect the answer, so errors are only logged.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export const AI_KINDS = ['generate', 'mentor', 'site_mentor', 'fll_plan', 'video', 'vibe'] as const
export type AiKind = (typeof AI_KINDS)[number]
export type AiFailure = 'quota' | 'overload' | 'timeout' | 'invalid' | 'other'

export interface UsageRow {
  kind: AiKind
  model?: string | null
  cached?: boolean
  ok: boolean
  error?: AiFailure
}

export async function recordUsage(row: UsageRow): Promise<void> {
  const sb = supabaseAdmin()
  if (!sb) return
  try {
    const { error } = await sb
      .from('ai_usage')
      .insert({ kind: row.kind, model: row.model ?? null, cached: row.cached ?? false, ok: row.ok, error: row.error ?? null })
    if (error) console.warn('[ai-usage] not recorded:', error.message)
  } catch (error) {
    console.warn('[ai-usage] not recorded:', error instanceof Error ? error.message : error)
  }
}
