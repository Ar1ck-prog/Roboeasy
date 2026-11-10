import type { Program, RobotProfile } from './dsl/types'
import type { Lang } from './spike/prompts'

/**
 * - blocks: the AI writes DSL commands, compiled to SPIKE word blocks
 * - python: the AI writes DSL commands, compiled to SPIKE 3 Python
 * - python-free: the AI writes SPIKE 3 Python itself (tasks the DSL cannot express)
 */
export type Format = 'blocks' | 'python' | 'python-free'

export interface GenerateRequest {
  prompt: string
  format: Format
  lang: Lang
  robot?: Partial<RobotProfile>
  /** The current result, when the user asks to change it. */
  previous?: { program?: Program; code?: string }
}

export type GenerateErrorCode =
  | 'bad_request'
  | 'prompt_too_long'
  | 'rate_limited'
  | 'not_configured'
  | 'ai_busy'
  | 'ai_failed'
  | 'empty_program'
  | 'unsupported'

export type GenerateResponse =
  | { ok: true; format: 'blocks'; title: string; description: string; program: Program; python: string; warnings: string[] }
  /** `program` is present when the Python was compiled from DSL commands. */
  | { ok: true; format: 'python'; title: string; description: string; code: string; program?: Program; warnings: string[] }
  /** `reason` and `suggestion` come with `unsupported`: why the robot cannot do it and what it could do instead. */
  | { ok: false; error: GenerateErrorCode; retryAfter?: number; reason?: string; suggestion?: string }

export const PROMPT_MAX = 800
