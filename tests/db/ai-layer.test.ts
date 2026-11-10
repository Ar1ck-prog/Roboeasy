import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Keys of the running local stack (`supabase status`), never hard-coded. */
function localStack() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const get = (k: string) => new RegExp(`^${k}="?([^"\\n]+)"?`, 'm').exec(out)?.[1] ?? ''
  return { url: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY') }
}

const stack = localStack()
const service = createClient(stack.url, stack.service, { auth: { persistSession: false } })
const anon = createClient(stack.url, stack.anon, { auth: { persistSession: false } })
const created: string[] = []

async function signedIn(): Promise<{ id: string; sb: SupabaseClient }> {
  const email = `ai-${randomUUID().slice(0, 8)}@test.local`
  const password = `pw-${randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error
  created.push(data.user.id)
  const sb = createClient(stack.url, stack.anon, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({ email, password })
  return { id: data.user.id, sb }
}

const cacheRow = () => ({ key: randomUUID().replace(/-/g, '').padEnd(64, '0'), mode: 'blocks', dsl_version: 1, response: { kind: 'program' }, expires_at: new Date(Date.now() + 60_000).toISOString() })

let user: Awaited<ReturnType<typeof signedIn>>
let admin: Awaited<ReturnType<typeof signedIn>>

beforeAll(async () => {
  user = await signedIn()
  admin = await signedIn()
  await service.from('admins').insert({ user_id: admin.id })
})

afterAll(async () => {
  for (const id of created) await service.auth.admin.deleteUser(id).catch(() => {})
})

describe('AI tables are closed to the browser', () => {
  it('gen_cache: only the server reads and writes', async () => {
    const row = cacheRow()
    expect((await service.from('gen_cache').insert(row)).error).toBeNull()
    for (const client of [anon, user.sb, admin.sb]) {
      expect((await client.from('gen_cache').select('key').eq('key', row.key)).data).toEqual([])
      expect((await client.from('gen_cache').insert(cacheRow())).error).not.toBeNull()
    }
  })

  it('rate_limits: not readable, and the counter function is server-only', async () => {
    expect((await service.rpc('rate_limit_hit', { p_key: `t:${randomUUID()}`, p_limit: 5, p_window_seconds: 60 })).error).toBeNull()
    for (const client of [anon, user.sb]) {
      expect((await client.from('rate_limits').select('key')).data).toEqual([])
      expect((await client.rpc('rate_limit_hit', { p_key: 'x', p_limit: 5, p_window_seconds: 60 })).error).not.toBeNull()
    }
  })

  it('ai_usage: only an admin reads, nobody but the server writes', async () => {
    const marker = `model-${randomUUID().slice(0, 8)}`
    expect((await service.from('ai_usage').insert({ kind: 'generate', model: marker, ok: true })).error).toBeNull()
    expect((await anon.from('ai_usage').select('id').eq('model', marker)).data).toEqual([])
    expect((await user.sb.from('ai_usage').select('id').eq('model', marker)).data).toEqual([])
    expect((await admin.sb.from('ai_usage').select('id').eq('model', marker)).data).toHaveLength(1)
    expect((await user.sb.from('ai_usage').insert({ kind: 'generate', ok: true })).error).not.toBeNull()
    expect((await admin.sb.from('ai_usage').insert({ kind: 'generate', ok: true })).error).not.toBeNull()
  })

  it('prune_ai_tables cannot be called from the browser', async () => {
    expect((await anon.rpc('prune_ai_tables')).error).not.toBeNull()
    expect((await service.rpc('prune_ai_tables')).error).toBeNull()
  })
})

describe('shared rate limit', () => {
  it('holds under parallel requests', async () => {
    const key = `parallel:${randomUUID()}`
    const hit = () => service.rpc('rate_limit_hit', { p_key: key, p_limit: 5, p_window_seconds: 3600 })
    const answers = await Promise.all(Array.from({ length: 12 }, hit))
    const allowed = answers.filter((a) => a.data?.[0]?.allowed).length
    expect(allowed).toBe(5)
    const denied = answers.find((a) => a.data?.[0]?.allowed === false)
    expect(denied?.data?.[0]?.retry_after).toBeGreaterThan(0)
    expect(denied?.data?.[0]?.remaining).toBe(0)
  })
})

describe('generation_failures', () => {
  const row = (prompt: string) => ({ prompt, lang: 'ru', mode: 'blocks', answer: '{}', error: 'bad', attempt: 1 })

  it('only the server writes and only an admin reads', async () => {
    const marker = `failure-${randomUUID()}`
    expect((await service.from('generation_failures').insert(row(marker))).error).toBeNull()
    expect((await anon.from('generation_failures').select('id').eq('prompt', marker)).data).toEqual([])
    expect((await user.sb.from('generation_failures').select('id').eq('prompt', marker)).data).toEqual([])
    expect((await admin.sb.from('generation_failures').select('id').eq('prompt', marker)).data).toHaveLength(1)
    expect((await user.sb.from('generation_failures').insert(row('x'))).error).not.toBeNull()
    expect((await admin.sb.from('generation_failures').insert(row('x'))).error).not.toBeNull()
  })
})
