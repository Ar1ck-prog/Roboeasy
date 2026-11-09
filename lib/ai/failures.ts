/**
 * Log of generations that failed a check, for improving the prompt. Written
 * only by the server, read only by admins. A child can type anything, so the
 * request is trimmed and anything that looks like contact details is removed.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_PROMPT = 300
const MAX_ANSWER = 4000
const MAX_ERROR = 1000

export function scrubPrompt(prompt: string): string {
  return prompt
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/\+?\d[\d\s()-]{8,}\d/g, '[number]')
    .slice(0, MAX_PROMPT)
}

export interface FailureRow {
  prompt: string
  lang: string
  mode: string
  answer: unknown
  error: string
  attempt: number
}

export async function recordFailure(row: FailureRow): Promise<void> {
  const sb = supabaseAdmin()
  if (!sb) return
  try {
    const { error } = await sb.from('generation_failures').insert({
      prompt: scrubPrompt(row.prompt),
      lang: row.lang,
      mode: row.mode,
      answer: JSON.stringify(row.answer ?? null).slice(0, MAX_ANSWER),
      error: row.error.slice(0, MAX_ERROR),
      attempt: row.attempt,
    })
    if (error) console.warn('[generation-failures] not recorded:', error.message)
  } catch (error) {
    console.warn('[generation-failures] not recorded:', error instanceof Error ? error.message : error)
  }
}
