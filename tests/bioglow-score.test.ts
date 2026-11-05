import { describe, expect, it } from 'vitest'

import { MAX_SCORE, SCORE_SHEET, bestAnswers, scoreBreakdown, startAnswers, totalScore } from '@/lib/fll/bioglow-score'
import { SEASONS } from '@/lib/fll/seasons'

describe('BIOGLOW score sheet', () => {
  it('starts a match with habitats in place and six precision tokens', () => {
    expect(totalScore(startAnswers())).toBe(20 + 50)
  })

  it('adds up to the season maximum', () => {
    expect(totalScore(bestAnswers())).toBe(MAX_SCORE)
  })

  it('applies conditions and bonuses only with their main task', () => {
    const a = startAnswers()
    expect(scoreBreakdown({ ...a, m01_bonus: true }).m01).toBe(0)
    expect(scoreBreakdown({ ...a, m01_drone: true, m01_bonus: true }).m01).toBe(30)
    expect(scoreBreakdown({ ...a, m06_frags: 3 }).m06).toBe(0)
    expect(scoreBreakdown({ ...a, m06_ant: true, m06_frags: 3 }).m06).toBe(30)
    expect(scoreBreakdown({ ...a, m14_in: 2, m14_mat: 4 }).m14).toBe(20)
    expect(scoreBreakdown({ ...a, m15_hatch: true, m15_dock: 2 }).m15).toBe(20)
    expect(scoreBreakdown({ ...a, m15_hatch: true, m15_dock: 0 }).m15).toBe(10)
    expect(scoreBreakdown({ ...a, tokens: 3 }).tokens).toBe(25)
  })

  it('has a score card for every mission of the season, with matching maximums', () => {
    const season = SEASONS['bioglow-2026']
    const best = scoreBreakdown(bestAnswers())
    for (const m of season.missions) {
      const id = m.id.toLowerCase()
      expect(
        SCORE_SHEET.some((g) => g.id === id),
        m.id,
      ).toBe(true)
      expect(best[id], m.id).toBe(m.points)
    }
  })
})
