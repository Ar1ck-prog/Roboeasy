'use client'

import Link from 'next/link'
import { ArrowRight, Blocks, Box, Brain, Gauge, Puzzle, Repeat, Route, Star, Zap } from 'lucide-react'

import { QuestsCard } from '@/components/learn/quests-card'
import { Card, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { PlayText } from '@/lib/i18n/play'
import { bestStars, paidRoundsLeft } from '@/lib/learn/economy'
import { MAZE_LEVELS } from '@/lib/learn/games/maze'
import { PUZZLES } from '@/lib/learn/games/puzzle'
import { useHydrated } from '@/lib/learn/store'
import { useProgress } from '@/lib/learn/use-progress'

type Lang = 'ru' | 'kk' | 'en'

const GAMES = [
  { id: 'maze', icon: Route, color: 'var(--blk-move)' },
  { id: 'puzzle', icon: Puzzle, color: 'var(--blk-events)' },
  { id: 'memory', icon: Brain, color: 'var(--blk-sound)' },
  { id: 'blitz', icon: Zap, color: 'var(--blk-control)' },
] as const

/** /play: daily quests, the four games and more practice. */
export function PlayHub({ lang, t }: { lang: Lang; t: PlayText }) {
  const hydrated = useHydrated()
  const p = useProgress()
  const maze = bestStars(p.state, 'maze')
  const puzzle = bestStars(p.state, 'puzzle')
  const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0)

  const status = (id: (typeof GAMES)[number]['id']): string | null => {
    if (!hydrated) return null
    if (id === 'maze') return `${fill(t.play.levels, { done: maze.size, total: MAZE_LEVELS.length })} · ${fill(t.play.stars, { n: sum(maze) })}`
    if (id === 'puzzle') return `${fill(t.play.levels, { done: puzzle.size, total: PUZZLES.length })} · ${fill(t.play.stars, { n: sum(puzzle) })}`
    const left = paidRoundsLeft(p.state, id, p.now)
    return left > 0 ? fill(t.play.paidLeft, { n: left }) : t.play.noPaid
  }

  const practice = [
    { href: '/review', icon: Repeat, ...t.play.review },
    { href: '/path/challenge', icon: Star, ...t.play.challenge },
    { href: '/learn/placement', icon: Gauge, ...t.play.placement },
    { href: '/sandbox', icon: Blocks, ...t.play.sandbox },
    { href: '/compete/simulator', icon: Box, ...t.play.simulator },
  ]

  return (
    <div className="container grid gap-6 py-8 md:py-12">
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl md:text-5xl">{t.play.title}</h1>
        <p className="m-0 max-w-[60ch] text-lg text-muted-foreground">{t.play.lead}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {GAMES.map(({ id, icon: Icon, color }) => (
            <li key={id}>
              <Card className="h-full gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-14 shrink-0 place-items-center rounded-(--radius-md) border-(length:--stroke) border-outline text-(--blk-text) shadow-(--shadow-press)"
                    style={{ background: color }}
                  >
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <div className="grid gap-1">
                    <h2 className="m-0 text-xl">{t.play.games[id].title}</h2>
                    <p className="m-0 text-sm text-muted-foreground">{t.play.games[id].text}</p>
                  </div>
                </div>
                <p className="m-0 min-h-5 text-sm font-bold">{status(id)}</p>
                <Link className={buttonVariants({ variant: 'primary', className: 'mt-auto justify-self-start' })} href={`/${lang}/play/${id}`}>
                  {t.play.playCta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Card>
            </li>
          ))}
        </ul>
        {hydrated && p.state.profile ? <QuestsCard lang={lang} t={t} quests={p.quests} magnet={p.ledger.tiers.magnet} className="h-fit" /> : <div />}
      </div>

      <section className="grid gap-3">
        <h2 className="m-0 text-2xl">{t.play.practice}</h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {practice.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link
                href={`/${lang}${href}`}
                className="block h-full rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4 hover:bg-surface-2"
              >
                <CardTitle className="mb-1 text-lg">
                  <Icon className="size-5" aria-hidden="true" />
                  {title}
                </CardTitle>
                <span className="text-sm text-muted-foreground">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
