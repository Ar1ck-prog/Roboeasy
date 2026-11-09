/** Numbers for the admin's "AI today" page, from the rows of `ai_usage`. Safe for the browser. */

export interface UsageRecord {
  kind: string
  model: string | null
  cached: boolean
  ok: boolean
  error: string | null
}

export interface UsageSummary {
  /** Requests that really went to Gemini (each one counts against the quota). */
  requests: number
  /** Answers served from the cache, without Gemini. */
  cached: number
  failed: number
  byKind: { name: string; requests: number; cached: number; failed: number }[]
  byModel: { name: string; requests: number; failed: number }[]
  errors: { name: string; count: number }[]
}

function bump<T extends { name: string }>(map: Map<string, T>, name: string, empty: () => T, change: (entry: T) => void) {
  let entry = map.get(name)
  if (!entry) map.set(name, (entry = empty()))
  change(entry)
}

const byUseDesc = (a: { requests: number; name: string }, b: { requests: number; name: string }) => b.requests - a.requests || a.name.localeCompare(b.name)

export function summarizeUsage(rows: UsageRecord[]): UsageSummary {
  const kinds = new Map<string, UsageSummary['byKind'][number]>()
  const models = new Map<string, UsageSummary['byModel'][number]>()
  const errors = new Map<string, UsageSummary['errors'][number]>()
  let requests = 0
  let cached = 0
  let failed = 0
  for (const r of rows) {
    if (r.cached) cached++
    else requests++
    if (!r.ok) failed++
    bump(
      kinds,
      r.kind,
      () => ({ name: r.kind, requests: 0, cached: 0, failed: 0 }),
      (k) => {
        if (r.cached) k.cached++
        else k.requests++
        if (!r.ok) k.failed++
      },
    )
    if (r.model && !r.cached)
      bump(
        models,
        r.model,
        () => ({ name: r.model as string, requests: 0, failed: 0 }),
        (m) => {
          m.requests++
          if (!r.ok) m.failed++
        },
      )
    if (r.error)
      bump(
        errors,
        r.error,
        () => ({ name: r.error as string, count: 0 }),
        (e) => e.count++,
      )
  }
  return {
    requests,
    cached,
    failed,
    byKind: [...kinds.values()].sort(byUseDesc),
    byModel: [...models.values()].sort(byUseDesc),
    errors: [...errors.values()].sort((a, b) => b.count - a.count),
  }
}
