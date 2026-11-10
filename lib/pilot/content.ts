/**
 * The pilot's entry and final test and its practice tasks. Server only: the
 * files hold the correct answers and the reference solutions, and the pages
 * send the browser only what is stripped down below.
 */

import { z } from 'zod'

import tasksJson from '../../content/pilot/tasks.json'
import testJson from '../../content/pilot/test.json'
import { countSteps } from '../dsl/types'
import type { ClientStep } from '../learn/content'
import { challengeFileSchema, localized } from '../learn/schema'

export const QUESTION_COUNT = 20
export const TASK_COUNT = 5

const testSchema = z.object({
  questions: z
    .array(
      z.object({ id: z.string().regex(/^[a-z0-9-]+$/), question: localized, options: z.array(localized).length(4), correct: z.number().int().min(0).max(3) }),
    )
    .length(QUESTION_COUNT),
})

export const PILOT_QUESTIONS = testSchema.parse(testJson).questions
export const PILOT_TASKS = challengeFileSchema.parse(tasksJson).challenges

export type ClientQuestion = Omit<(typeof PILOT_QUESTIONS)[number], 'correct'>
export type ClientPilotTask = Extract<ClientStep, { type: 'code' }>

export const clientQuestions = (): ClientQuestion[] => PILOT_QUESTIONS.map(({ correct: _correct, ...rest }) => rest)

export const clientPilotTasks = (): ClientPilotTask[] => PILOT_TASKS.map(({ reference, ...rest }) => ({ ...rest, referenceBlocks: countSteps(reference) }))
