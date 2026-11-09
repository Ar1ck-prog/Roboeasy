import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PILOT_QUESTIONS } from '@/lib/pilot/content'

function localStack() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const get = (k: string) => new RegExp(`^${k}="?([^"\\n]+)"?`, 'm').exec(out)?.[1] ?? ''
  return { url: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY') }
}

const stack = localStack()
const service = createClient(stack.url, stack.service, { auth: { persistSession: false } })
const client = () => createClient(stack.url, stack.anon, { auth: { persistSession: false } })
const created: string[] = []

async function teacher(): Promise<{ id: string; sb: SupabaseClient }> {
  const email = `teacher-${randomUUID().slice(0, 8)}@test.local`
  const password = `pw-${randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error
  created.push(data.user.id)
  const sb = client()
  await sb.auth.signInWithPassword({ email, password })
  return { id: data.user.id, sb }
}

async function anonymous(): Promise<{ id: string; sb: SupabaseClient }> {
  const sb = client()
  const { data, error } = await sb.auth.signInAnonymously()
  if (error || !data.user) throw error
  created.push(data.user.id)
  return { id: data.user.id, sb }
}

async function join(sb: SupabaseClient, code: string, nick: string, pin = '1234') {
  const { data, error } = await sb.rpc('join_class', { p_code: code, p_nickname: nick, p_pin: pin })
  if (error) throw error
  return data?.[0] as { member_id: string; class_id: string } | undefined
}

const allRight = Object.fromEntries(PILOT_QUESTIONS.map((q) => [q.id, q.correct]))

let owner: Awaited<ReturnType<typeof teacher>>
let otherTeacher: Awaited<ReturnType<typeof teacher>>
let cls: { id: string; code: string }

beforeAll(async () => {
  owner = await teacher()
  otherTeacher = await teacher()
  const { data, error } = await owner.sb.rpc('create_class', { p_name: '7А' })
  if (error) throw error
  cls = data
})

afterAll(async () => {
  for (const id of created) await service.auth.admin.deleteUser(id).catch(() => {})
})

describe('classes', () => {
  it('the code has six unambiguous characters', () => {
    expect(cls.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('an anonymous learner cannot create a class', async () => {
    const kid = await anonymous()
    expect((await kid.sb.rpc('create_class', { p_name: 'x' })).error?.message).toMatch(/teacher_account_required/)
  })

  it('nobody can insert a class or a membership directly', async () => {
    const kid = await anonymous()
    expect((await owner.sb.from('classes').insert({ teacher_id: owner.id, name: 'x', code: 'ABCDEF' })).error).not.toBeNull()
    expect((await kid.sb.from('class_members').insert({ class_id: cls.id, user_id: kid.id, nickname: 'x' })).error).not.toBeNull()
  })

  it('a teacher sees only their own classes', async () => {
    expect((await owner.sb.from('classes').select('id').eq('id', cls.id)).data).toHaveLength(1)
    expect((await otherTeacher.sb.from('classes').select('id').eq('id', cls.id)).data).toEqual([])
    expect((await otherTeacher.sb.from('classes').update({ post_open: true }).eq('id', cls.id).select()).data).toEqual([])
    // Without a session the policy's helper is not even callable: an error, and no rows.
    expect((await client().from('classes').select('id').eq('id', cls.id)).data ?? []).toEqual([])
  })

  it('a learner cannot read the class or its code', async () => {
    const kid = await anonymous()
    await join(kid.sb, cls.code, `reader-${randomUUID().slice(0, 4)}`)
    expect((await kid.sb.from('classes').select('code')).data).toEqual([])
  })
})

describe('joining', () => {
  it('rejects a wrong code', async () => {
    const kid = await anonymous()
    await expect(join(kid.sb, 'ZZZZZZ', 'x')).rejects.toMatchObject({ message: expect.stringMatching(/class_not_found/) })
  })

  it('needs a four-digit PIN', async () => {
    const kid = await anonymous()
    await expect(join(kid.sb, cls.code, 'y', '12')).rejects.toMatchObject({ message: expect.stringMatching(/bad_pin/) })
  })

  it('code is not case sensitive', async () => {
    const kid = await anonymous()
    expect(await join(kid.sb, cls.code.toLowerCase(), `lower-${randomUUID().slice(0, 4)}`)).toBeDefined()
  })

  it('returning with the same nickname and PIN from another device keeps the results', async () => {
    const nick = `back-${randomUUID().slice(0, 4)}`
    const first = await anonymous()
    const m1 = await join(first.sb, cls.code, nick)
    await first.sb.rpc('submit_pilot_test', { p_member: m1!.member_id, p_kind: 'pre', p_answers: allRight })

    const second = await anonymous()
    const m2 = await join(second.sb, cls.code, nick.toUpperCase())
    expect(m2!.member_id).toBe(m1!.member_id)
    const { data } = await second.sb.rpc('my_class_status')
    expect(data[0].pre_score).toBe(20)
    expect((await first.sb.rpc('my_class_status')).data).toEqual([])
  })

  it('a taken nickname with a wrong PIN gets nothing, and repeated guesses lock it', async () => {
    const nick = `lock-${randomUUID().slice(0, 4)}`
    const first = await anonymous()
    await join(first.sb, cls.code, nick, '1111')
    const thief = await anonymous()
    for (let i = 0; i < 5; i++) expect(await join(thief.sb, cls.code, nick, '2222')).toBeUndefined()
    await expect(join(thief.sb, cls.code, nick, '1111')).rejects.toMatchObject({ message: expect.stringMatching(/pin_locked/) })
  })

  it('PINs cannot be read from the browser', async () => {
    const kid = await anonymous()
    const { data } = await kid.sb.from('class_member_secrets').select('*')
    expect(data).toEqual([])
    expect((await owner.sb.from('class_member_secrets').select('*')).data).toEqual([])
  })
})

describe('pilot results', () => {
  let kid: Awaited<ReturnType<typeof anonymous>>
  let classmate: Awaited<ReturnType<typeof anonymous>>
  let member: string

  beforeAll(async () => {
    kid = await anonymous()
    classmate = await anonymous()
    member = (await join(kid.sb, cls.code, `kid-${randomUUID().slice(0, 4)}`))!.member_id
    await join(classmate.sb, cls.code, `mate-${randomUUID().slice(0, 4)}`)
  })

  it('the score is computed by the database and only the first attempt counts', async () => {
    const wrong = Object.fromEntries(PILOT_QUESTIONS.map((q) => [q.id, (q.correct + 1) % 4]))
    expect((await kid.sb.rpc('submit_pilot_test', { p_member: member, p_kind: 'pre', p_answers: wrong })).data).toBe(0)
    expect((await kid.sb.rpc('submit_pilot_test', { p_member: member, p_kind: 'pre', p_answers: allRight })).data).toBe(0)
  })

  it('the answer key is closed', async () => {
    expect((await kid.sb.from('pilot_answer_key').select('*')).data).toEqual([])
    expect((await owner.sb.from('pilot_answer_key').select('*')).data).toEqual([])
  })

  it('results cannot be written directly', async () => {
    expect((await kid.sb.from('pilot_tests').insert({ member_id: member, kind: 'post', score: 20, total: 20 })).error).not.toBeNull()
    expect((await kid.sb.from('pilot_surveys').insert({ member_id: member, clarity: 5 })).error).not.toBeNull()
    expect((await kid.sb.from('pilot_tasks').insert({ member_id: member, task_id: 't', passed: true, hints: 0, attempts: 1, seconds: 1 })).error).not.toBeNull()
    expect((await kid.sb.from('class_attendance').insert({ member_id: member, day: '2026-01-01' })).error).not.toBeNull()
  })

  it('the final test stays closed until the teacher opens it', async () => {
    expect((await kid.sb.rpc('submit_pilot_test', { p_member: member, p_kind: 'post', p_answers: allRight })).error?.message).toMatch(/post_test_closed/)
    await owner.sb.from('classes').update({ post_open: true }).eq('id', cls.id)
    expect((await kid.sb.rpc('submit_pilot_test', { p_member: member, p_kind: 'post', p_answers: allRight })).data).toBe(20)
  })

  it('a classmate cannot act for someone else or see their results', async () => {
    expect((await classmate.sb.rpc('submit_pilot_survey', { p_member: member, p_clarity: 1 })).error?.message).toMatch(/not_your_membership/)
    expect((await classmate.sb.rpc('mark_attendance', { p_member: member, p_lessons: 1 })).error?.message).toMatch(/not_your_membership/)
    expect((await classmate.sb.from('pilot_tests').select('*').eq('member_id', member)).data).toEqual([])
    expect((await classmate.sb.from('class_members').select('*').eq('id', member)).data).toEqual([])
  })

  it('a solved task stays solved with the numbers of the winning try', async () => {
    const rec = (passed: boolean, hints: number) =>
      kid.sb.rpc('record_pilot_task', { p_member: member, p_task: 'p1', p_passed: passed, p_hints: hints, p_attempts: 2, p_seconds: 30 })
    await rec(false, 3)
    await rec(true, 1)
    await rec(true, 0)
    const { data } = await kid.sb.from('pilot_tasks').select('passed, hints').eq('member_id', member).eq('task_id', 'p1').single()
    expect(data).toEqual({ passed: true, hints: 1 })
  })

  it('the teacher sees results of their class only', async () => {
    expect(((await owner.sb.from('pilot_tests').select('score').eq('member_id', member)).data ?? []).length).toBe(2)
    for (const table of ['pilot_tests', 'pilot_tasks']) expect((await otherTeacher.sb.from(table).select('*').eq('member_id', member)).data).toEqual([])
    expect((await otherTeacher.sb.from('class_members').select('*').eq('id', member)).data).toEqual([])
    expect((await otherTeacher.sb.from('class_members').delete().eq('id', member).select()).data).toEqual([])
    expect((await client().from('pilot_tests').select('*').eq('member_id', member)).data ?? []).toEqual([])
  })

  it('counts one attendance per day and never lowers the lessons', async () => {
    await kid.sb.rpc('mark_attendance', { p_member: member, p_lessons: 5 })
    await kid.sb.rpc('mark_attendance', { p_member: member, p_lessons: 2 })
    const { data } = await owner.sb.from('class_attendance').select('day').eq('member_id', member)
    expect(data).toHaveLength(1)
    expect((await owner.sb.from('class_members').select('lessons_done').eq('id', member).single()).data).toEqual({ lessons_done: 5 })
  })

  it('leaving deletes the results', async () => {
    const leaver = await anonymous()
    const m = (await join(leaver.sb, cls.code, `leave-${randomUUID().slice(0, 4)}`))!.member_id
    await leaver.sb.rpc('submit_pilot_test', { p_member: m, p_kind: 'pre', p_answers: allRight })
    expect((await leaver.sb.rpc('leave_class', { p_member: m })).error).toBeNull()
    const { count } = await service.from('pilot_tests').select('*', { count: 'exact', head: true }).eq('member_id', m)
    expect(count).toBe(0)
  })
})
