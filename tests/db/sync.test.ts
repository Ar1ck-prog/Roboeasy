import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type NewEvent, appendEvents, EMPTY_STATE } from '@/lib/learn/state'

/** Keys of the running local stack (`supabase status`), never hard-coded. */
function localStack(): { url: string; anon: string; service: string } {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const get = (k: string) => new RegExp(`^${k}="?([^"\\n]+)"?`, 'm').exec(out)?.[1] ?? ''
  return { url: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY') }
}

const stack = localStack()
const admin = createClient(stack.url, stack.service, { auth: { persistSession: false } })
const created: string[] = []

async function user(nickname: string, ageRange: '13-15' | '16-plus' = '13-15'): Promise<{ id: string; sb: SupabaseClient }> {
  const email = `${nickname.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`
  const password = `pw-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error
  created.push(data.user.id)
  const sb = createClient(stack.url, stack.anon, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({ email, password })
  const { error: pe } = await sb.from('profiles').insert({ id: data.user.id, nickname, age_range: ageRange, parent_consent: ageRange !== '16-plus' })
  if (pe) throw pe
  return { id: data.user.id, sb }
}

const events: NewEvent[] = [
  { kind: 'step_done', lesson: 'start-01', step: 'match-parts', stepType: 'quiz', firstTry: true, hints: 0 },
  {
    kind: 'step_done',
    lesson: 'start-01',
    step: 'first-program',
    stepType: 'code',
    firstTry: false,
    hints: 1,
    program: [{ op: 'move', direction: 'forward', value: 40, unit: 'cm' }],
  },
  { kind: 'mistake', lesson: 'start-01', step: 'first-program' },
  { kind: 'lesson_done', lesson: 'start-01', track: 'start', unit: 'start-robot', project: false, seconds: 300 },
  { kind: 'review_done', skills: ['motion'], correct: 4, total: 5 },
  { kind: 'game_done', game: 'maze', level: 1, stars: 3, score: 5 },
  { kind: 'purchase', item: 'hat:cap' },
]
const local = appendEvents(EMPTY_STATE, events, Date.parse('2026-10-20T10:00:00Z'))

let kid: Awaited<ReturnType<typeof user>>
let other: Awaited<ReturnType<typeof user>>

beforeAll(async () => {
  kid = await user('Kid')
  other = await user('Other', '16-plus')
})

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {})
})

describe('progress on the server', () => {
  it('stores every event kind once per id', async () => {
    const first = await kid.sb.rpc('record_events', { events: local.events })
    expect(first.error).toBeNull()
    expect(first.data).toBe(local.events.length)
    const again = await kid.sb.rpc('record_events', { events: local.events })
    expect(again.data).toBe(local.events.length)
    const { data } = await kid.sb.from('learn_events').select('id, kind, data').order('at')
    expect(data?.map((r) => r.kind).sort()).toEqual(local.events.map((e) => e.kind).sort())
    expect(data?.find((r) => r.kind === 'purchase')?.data).toEqual({ item: 'hat:cap' })
  })

  it('keeps learners apart', async () => {
    const { data } = await other.sb.from('learn_events').select('id').eq('user_id', kid.id)
    expect(data).toEqual([])
    const forged = await other.sb.from('learn_events').insert({ user_id: kid.id, id: 'x', kind: 'mistake', at: new Date().toISOString() })
    expect(forged.error).not.toBeNull()
    const { data: profiles } = await other.sb.from('profiles').select('nickname')
    expect(profiles).toEqual([{ nickname: 'Other' }])
  })

  it('rejects unknown event kinds and does not allow edits', async () => {
    const bad = await kid.sb.rpc('record_events', { events: [{ id: 'x1', kind: 'teacher_note', at: Date.now() }] })
    expect(bad.error).not.toBeNull()
    await kid.sb.from('learn_events').update({ kind: 'mistake' }).eq('id', 'lesson:start-01')
    const { data } = await kid.sb.from('learn_events').select('kind').eq('id', 'lesson:start-01').single()
    expect(data?.kind).toBe('lesson_done')
  })

  it('requires consent under 16', async () => {
    const { data } = await admin.auth.admin.createUser({
      email: `noconsent-${randomUUID().slice(0, 8)}@test.local`,
      password: 'pw-123456789',
      email_confirm: true,
    })
    created.push(data.user!.id)
    const { error } = await admin.from('profiles').insert({ id: data.user!.id, nickname: 'Kid2', age_range: '10-12', parent_consent: false })
    expect(error?.message).toMatch(/consent_under_16/)
  })

  it('deleting an account removes its data', async () => {
    expect((await kid.sb.rpc('delete_my_account')).error).toBeNull()
    const { count } = await admin.from('learn_events').select('*', { count: 'exact', head: true }).eq('user_id', kid.id)
    expect(count).toBe(0)
    const { count: profiles } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('id', kid.id)
    expect(profiles).toBe(0)
  })
})
