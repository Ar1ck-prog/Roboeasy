'use client'

/** Browser side of classes and the pilot. Every call goes through RLS or a checked database function. */

import { cloud } from '@/lib/learn/cloud'

import type { ReportInput } from './report'

function need() {
  const sb = cloud()
  if (!sb) throw new PilotError('unavailable')
  return sb
}

export type PilotErrorCode = 'unavailable' | 'class_not_found' | 'wrong_pin' | 'pin_locked' | 'failed'

export class PilotError extends Error {
  constructor(readonly code: PilotErrorCode) {
    super(code)
  }
}

function toError(message: string | undefined): PilotError {
  const text = message ?? ''
  if (text.includes('class_not_found')) return new PilotError('class_not_found')
  if (text.includes('pin_locked')) return new PilotError('pin_locked')
  if (text.includes('Anonymous sign-ins are disabled')) return new PilotError('unavailable')
  return new PilotError('failed')
}

export interface ClassRow {
  id: string
  name: string
  code: string
  post_open: boolean
}

export interface StudentStatus {
  member_id: string
  class_id: string
  class_name: string
  nickname: string
  post_open: boolean
  pre_score: number | null
  post_score: number | null
  total: number
  tasks_done: string[]
  survey_done: boolean
}

// ── Teacher ──────────────────────────────────────────────────────────────

export async function myClasses(): Promise<ClassRow[]> {
  const { data, error } = await need().from('classes').select('id, name, code, post_open').order('created_at', { ascending: false })
  if (error) throw toError(error.message)
  return data ?? []
}

export async function createClass(name: string): Promise<void> {
  const { error } = await need().rpc('create_class', { p_name: name })
  if (error) throw toError(error.message)
}

export async function setPostOpen(id: string, open: boolean): Promise<void> {
  const { error } = await need().from('classes').update({ post_open: open }).eq('id', id)
  if (error) throw toError(error.message)
}

export async function removeMember(id: string): Promise<void> {
  const { error } = await need().from('class_members').delete().eq('id', id)
  if (error) throw toError(error.message)
}

export interface ClassData extends Omit<ReportInput, 'taskCount'> {
  name: string
}

/** Everything the teacher's report needs; RLS returns nothing for someone else's class. */
export async function classData(classId: string): Promise<ClassData | null> {
  const sb = need()
  const { data: cls } = await sb.from('classes').select('name').eq('id', classId).maybeSingle<{ name: string }>()
  if (!cls) return null
  const { data: members, error } = await sb.from('class_members').select('id, nickname, lessons_done').eq('class_id', classId)
  if (error) throw toError(error.message)
  const ids = (members ?? []).map((m) => m.id)
  const [tests, tasks, surveys, attendance] = await Promise.all([
    sb.from('pilot_tests').select('member_id, kind, score, total').in('member_id', ids),
    sb.from('pilot_tasks').select('member_id, task_id, passed, hints').in('member_id', ids),
    sb.from('pilot_surveys').select('member_id, clarity').in('member_id', ids),
    sb.from('class_attendance').select('member_id, day').in('member_id', ids),
  ])
  return {
    name: cls.name,
    members: members ?? [],
    tests: tests.data ?? [],
    tasks: tasks.data ?? [],
    surveys: surveys.data ?? [],
    attendance: attendance.data ?? [],
  }
}

// ── Learner ──────────────────────────────────────────────────────────────

async function ensureSession() {
  const sb = need()
  const { data } = await sb.auth.getSession()
  if (data.session) return
  const { error } = await sb.auth.signInAnonymously()
  if (error) throw toError(error.message)
}

export async function joinClass(code: string, nickname: string, pin: string): Promise<void> {
  await ensureSession()
  const { data, error } = await need().rpc('join_class', { p_code: code, p_nickname: nickname, p_pin: pin })
  if (error) throw toError(error.message)
  // The database answers with no row, rather than an error, when the PIN is wrong.
  if (!data?.length) throw new PilotError('wrong_pin')
}

export async function studentStatus(): Promise<StudentStatus | null> {
  const { data, error } = await need().rpc('my_class_status')
  if (error) throw toError(error.message)
  return (data as StudentStatus[] | null)?.[0] ?? null
}

export async function markAttendance(member: string, lessons: number): Promise<void> {
  await need().rpc('mark_attendance', { p_member: member, p_lessons: lessons })
}

export async function submitTest(member: string, kind: 'pre' | 'post', answers: Record<string, number>): Promise<number> {
  const { data, error } = await need().rpc('submit_pilot_test', { p_member: member, p_kind: kind, p_answers: answers })
  if (error) throw toError(error.message)
  return data as number
}

export async function recordTask(member: string, task: string, result: { hints: number; attempts: number; seconds: number }): Promise<void> {
  const { error } = await need().rpc('record_pilot_task', {
    p_member: member,
    p_task: task,
    p_passed: true,
    p_hints: result.hints,
    p_attempts: result.attempts,
    p_seconds: result.seconds,
  })
  if (error) throw toError(error.message)
}

export async function submitSurvey(member: string, clarity: number): Promise<void> {
  const { error } = await need().rpc('submit_pilot_survey', { p_member: member, p_clarity: clarity })
  if (error) throw toError(error.message)
}

export async function leaveClass(member: string): Promise<void> {
  const { error } = await need().rpc('leave_class', { p_member: member })
  if (error) throw toError(error.message)
}
