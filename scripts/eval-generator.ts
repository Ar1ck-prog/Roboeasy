/**
 * Runs the real generator on part of eval/generator-tasks.json and prints the
 * success rate per category.
 *
 *   npm run eval:generator -- --limit 10
 *
 * Live requests use only GEMINI_API_KEY_DEV and stop at the first quota error.
 * Every attempt counts against the quota, so --limit is required and the run
 * stops once MAX_REQUESTS have been spent.
 */

import fs from 'node:fs'
import path from 'node:path'

import { GoogleGenAI } from '@google/genai'
import { loadEnvConfig } from '@next/env'

import { GenerationError, runGeneration } from '../lib/ai/generator'
import { parseRobot } from '../lib/dsl/schema'
import { usesOp, programSteps } from '../lib/dsl/types'
import { GeminiError, modelsFor } from '../lib/gemini'
import type { Lang } from '../lib/spike/prompts'

export const MAX_REQUESTS = 15

export interface EvalTask {
  id: string
  lang: Lang
  category: string
  prompt: string
  feasible: boolean
  expectOps?: string[]
  reference?: unknown
}

export function readTasks(file = path.resolve('eval/generator-tasks.json')): EvalTask[] {
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { tasks: EvalTask[] }).tasks
}

export function parseLimit(args: string[]): number | null {
  const i = args.indexOf('--limit')
  const n = i === -1 ? NaN : Number(args[i + 1])
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Takes tasks from every category in turn, so that a small limit still covers them all. */
export function pickTasks(tasks: EvalTask[], limit: number): EvalTask[] {
  const groups = new Map<string, EvalTask[]>()
  for (const t of tasks) groups.set(t.category, [...(groups.get(t.category) ?? []), t])
  const picked: EvalTask[] = []
  for (let round = 0; picked.length < limit; round++) {
    let added = false
    for (const group of groups.values()) {
      if (round < group.length && picked.length < limit) {
        picked.push(group[round])
        added = true
      }
    }
    if (!added) break
  }
  return picked
}

async function main() {
  const limit = parseLimit(process.argv.slice(2))
  if (limit === null) {
    console.error('Запускать только с ограничением: npm run eval:generator -- --limit 10')
    process.exit(1)
  }
  loadEnvConfig(process.cwd())
  const key = process.env.GEMINI_API_KEY_DEV
  if (!key || key === 'YOUR_API_KEY_HERE') {
    console.error('Нет GEMINI_API_KEY_DEV в .env.local. Рабочий ключ для проверок не используется, запуск отменён.')
    process.exit(1)
  }
  if (!modelsFor('main').length) {
    console.error('Не заданы модели: GEMINI_MODEL_MAIN и GEMINI_MODEL_LIGHT.')
    process.exit(1)
  }

  const ai = new GoogleGenAI({ apiKey: key })
  const robot = parseRobot({})
  const stats = new Map<string, { passed: number; total: number }>()
  let requests = 0
  let stopped = ''

  for (const task of pickTasks(readTasks(), limit)) {
    if (requests >= MAX_REQUESTS) {
      stopped = `дошли до предела ${MAX_REQUESTS} запросов`
      break
    }
    const signal = AbortSignal.timeout(60_000)
    let passed = false
    let note = ''
    try {
      const result = await runGeneration(
        { prompt: task.prompt, format: 'blocks', lang: task.lang, robot },
        { ai, signal, singleModel: true, onAttempt: () => (requests += 1) },
      )
      if (!task.feasible) {
        passed = result.kind === 'unsupported'
        note = result.kind
      } else if (result.kind === 'program') {
        const wanted = task.expectOps ?? []
        passed = !wanted.length || usesOp(programSteps(result.program), (s) => wanted.includes(s.op))
        note = passed ? 'ok' : 'другие команды'
      } else {
        note = result.kind === 'unsupported' ? `отказ: ${result.reason}` : result.kind
      }
    } catch (error) {
      if (error instanceof GeminiError && error.kind === 'busy') {
        stopped = 'квота или перегрузка Gemini'
        break
      }
      note = error instanceof GenerationError ? 'не прошло проверки' : error instanceof Error ? error.message : 'ошибка'
    }
    const s = stats.get(task.category) ?? { passed: 0, total: 0 }
    s.total += 1
    if (passed) s.passed += 1
    stats.set(task.category, s)
    console.log(`${passed ? 'OK ' : 'NO '} ${task.id}: ${note}`)
  }

  console.log('\nКатегория: успех')
  let passed = 0
  let total = 0
  for (const [category, s] of stats) {
    console.log(`  ${category}: ${s.passed}/${s.total} (${Math.round((100 * s.passed) / s.total)} %)`)
    passed += s.passed
    total += s.total
  }
  if (total) console.log(`Итого: ${passed}/${total} (${Math.round((100 * passed) / total)} %)`)
  console.log(`Запросов к Gemini: ${requests}`)
  if (stopped) console.log(`Остановлено: ${stopped}`)
}

// Only as a command: the tests import the helpers above.
if (process.argv[1]?.endsWith('eval-generator.ts')) void main()
