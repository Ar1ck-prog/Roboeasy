'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { COURSE } from './course'
import { ledger } from './economy'
import { type LearningPath, dueSkills, effectiveLearningPath } from './progress'
import { questStatus } from './quests'
import { DEFAULT_COSMETICS, completedLessons } from './state'
import { getGuestPath, setLearningPath, subscribeLearn, useLearn } from './store'
import { dayKeyer, streakInfo } from './streak'
import { levelFor } from './xp'

/** Current time, refreshed every minute (streak days roll over at midnight). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * The learner's path (lib/learn/progress.ts effectiveLearningPath), or the
 * guest's pick before onboarding. Learners with SPIKE progress from before
 * paths existed get 'spike' written into their profile on the first visit.
 */
export function useLearningPath(): LearningPath {
  const state = useLearn()
  const guest = useSyncExternalStore(subscribeLearn, getGuestPath, () => null)
  const path = effectiveLearningPath(state, COURSE)
  const migrate = !!state.profile && state.profile.learningPath === null && path !== null
  useEffect(() => {
    if (migrate && path) setLearningPath(path)
  }, [migrate, path])
  return state.profile ? path : (path ?? guest)
}

/** Everything the path, map, garage and profile show, computed from the event log. */
export function useProgress() {
  const state = useLearn()
  const now = useNow()
  const path = useLearningPath()
  return useMemo(() => {
    const money = ledger(state)
    const streak = streakInfo(state, now, money.maxFreezes)
    const keyOf = dayKeyer(state.profile?.timezone ?? 'UTC')
    const todayEvents = state.events.filter((e) => keyOf(e.at) === streak.today.key)
    const profile = state.profile
    return {
      state,
      now,
      path,
      done: completedLessons(state),
      xp: money.xp,
      coins: money.coins,
      ledger: money,
      level: levelFor(money.xp),
      streak,
      quests: questStatus(streak.today.key, todayEvents),
      due: dueSkills(state, COURSE, now),
      looks: { ...DEFAULT_COSMETICS, ...profile?.cosmetics, model: profile?.buddy.model ?? 'rover' },
    }
  }, [state, now, path])
}
