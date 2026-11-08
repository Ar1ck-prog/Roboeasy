'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Lock, RotateCcw } from 'lucide-react'

import { GameHeader, type Reward, RewardLine, Stars, finishRound } from '@/components/learn/games/game-kit'
import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fill } from '@/lib/i18n/config'
import type { PlayText } from '@/lib/i18n/play'
import { bestStars } from '@/lib/learn/economy'
import { PUZZLES, firstMistake, puzzleStars, shuffledOrder } from '@/lib/learn/games/puzzle'
import { useHydrated, useLearn } from '@/lib/learn/store'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'

function Line({ text, indent, tone }: { text: string; indent: number; tone: 'event' | 'control' | 'action' | 'code' }) {
  return (
    <span
      className={cn(
        'block rounded-(--radius-xs) border-(length:--stroke-thin) border-outline px-3 py-2 text-left font-bold',
        tone === 'event' && 'bg-[var(--blk-events)] text-(--blk-text)',
        tone === 'control' && 'bg-[var(--blk-control)] text-(--blk-text)',
        tone === 'action' && 'bg-[var(--blk-move)] text-(--blk-text)',
        tone === 'code' && 'bg-[#1b1f2a] font-mono text-[#e6f1ff]',
      )}
      style={{ marginLeft: indent * 20 }}
    >
      {text}
    </span>
  )
}

const toneOf = (text: string, python: boolean): 'event' | 'control' | 'action' | 'code' =>
  python ? 'code' : /:$/.test(text) ? 'control' : /^(Когда|Бағдарлама іске|When)/.test(text) ? 'event' : 'action'

export function PuzzleGame({ lang, t }: { lang: Lang; t: PlayText }) {
  const hydrated = useHydrated()
  const learn = useLearn()
  const best = useMemo(() => bestStars(learn, 'puzzle'), [learn])
  const [levelId, setLevelId] = useState<number | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [wrongAt, setWrongAt] = useState<number | null>(null)
  const [result, setResult] = useState<{ stars: number; reward: Reward } | null>(null)
  const started = useRef(Date.now())

  if (!hydrated) return <Skeleton className="container my-10 h-[32rem]" />

  const firstOpen = PUZZLES.find((l) => !best.get(l.id))?.id ?? PUZZLES[0].id
  const level = PUZZLES.find((l) => l.id === (levelId ?? firstOpen))!
  const python = level.id === 8
  const order = shuffledOrder(level.lines.length, level.id * 7 + 3)
  const pool = order.filter((i) => !picked.includes(i))
  const unlocked = (id: number) => id === 1 || (best.get(id - 1) ?? 0) > 0 || (best.get(id) ?? 0) > 0

  const pick = (id: number) => {
    setLevelId(id)
    setPicked([])
    setMistakes(0)
    setWrongAt(null)
    setResult(null)
    started.current = Date.now()
  }
  const check = () => {
    const at = firstMistake(level, picked, lang)
    if (at === -1) {
      const stars = puzzleStars(mistakes)
      setWrongAt(null)
      setResult({ stars, reward: finishRound('puzzle', level.id, stars, level.lines.length, (Date.now() - started.current) / 1000) })
    } else {
      setMistakes((m) => m + 1)
      setWrongAt(at)
    }
  }
  const next = PUZZLES.find((l) => l.id === level.id + 1)

  return (
    <div className="container grid gap-5 py-6 md:py-10">
      <GameHeader lang={lang} t={t} title={t.play.games.puzzle.title}>
        <p className="m-0 font-bold">
          {fill(t.game.level, { n: level.id })} · <Stars n={best.get(level.id) ?? 0} className="align-[-3px]" />
        </p>
      </GameHeader>

      <nav aria-label={t.game.levels} className="-mx-4 overflow-x-auto px-4 pb-1">
        <ol className="m-0 flex list-none gap-2 p-0">
          {PUZZLES.map((l) => {
            const open = unlocked(l.id)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  disabled={!open}
                  aria-current={l.id === level.id ? 'step' : undefined}
                  onClick={() => pick(l.id)}
                  className={cn(
                    'grid h-14 w-12 place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card text-lg disabled:opacity-40',
                    l.id === level.id && 'bg-primary text-primary-foreground',
                  )}
                  aria-label={`${fill(t.game.level, { n: l.id })}: ${l.title[lang]}`}
                >
                  {open ? <AnimIcon name={l.icon} /> : <Lock className="size-4" aria-hidden="true" />}
                  <Stars n={best.get(l.id) ?? 0} className="text-[9px]" />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card className="gap-1 bg-primary text-primary-foreground">
        <h2 className="m-0 text-2xl">
          <AnimIcon name={level.icon} /> {level.title[lang]}
        </h2>
        <p className="m-0 text-lg font-bold">{level.goal[lang]}</p>
      </Card>

      <p className="m-0 text-sm text-muted-foreground">{t.puzzle.tapHint}</p>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="grid content-start gap-2">
          <h2 className="m-0 text-xl">{t.puzzle.program}</h2>
          <ol
            className="m-0 grid min-h-24 list-none gap-1.5 rounded-(--radius-md) border-(length:--stroke-thin) border-dashed border-outline bg-surface-2 p-2"
            data-testid="puzzle-program"
          >
            {picked.map((i, k) => (
              <li key={i}>
                <button
                  type="button"
                  className={cn('block w-full cursor-pointer rounded-(--radius-xs)', wrongAt === k && 'ring-3 ring-(--accent)')}
                  onClick={() => !result && (setPicked((x) => x.filter((v) => v !== i)), setWrongAt(null))}
                  disabled={!!result}
                >
                  <Line text={level.lines[i].text[lang]} indent={level.lines[i].indent} tone={toneOf(level.lines[i].text[lang], python)} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="grid content-start gap-2">
          <h2 className="m-0 text-xl">{t.puzzle.pool}</h2>
          <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="puzzle-pool">
            {pool.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  className="block w-full cursor-pointer rounded-(--radius-xs)"
                  onClick={() => (setPicked((x) => [...x, i]), setWrongAt(null))}
                >
                  <Line text={level.lines[i].text[lang]} indent={0} tone={toneOf(level.lines[i].text[lang], python)} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {wrongAt !== null && (
        <p role="status" className="alert alert-warn m-0">
          {fill(t.puzzle.wrong, { n: wrongAt + 1 })}
        </p>
      )}
      {result ? (
        <Card className="items-start gap-2">
          <p className="alert alert-ok m-0" role="status">
            {t.puzzle.right}
          </p>
          <Stars n={result.stars} className="text-3xl" label={fill(t.game.stars, { n: result.stars })} />
          <RewardLine reward={result.reward} t={t} />
          <div className="flex flex-wrap gap-2">
            {next && (
              <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => pick(next.id)}>
                {t.game.next}
              </button>
            )}
            <button type="button" className={buttonVariants()} onClick={() => pick(level.id)}>
              {t.game.again}
            </button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg' })} disabled={picked.length !== level.lines.length} onClick={check}>
            <Check aria-hidden="true" />
            {t.puzzle.check}
          </button>
          <button type="button" className={buttonVariants({ size: 'lg' })} onClick={() => (setPicked([]), setWrongAt(null))} disabled={!picked.length}>
            <RotateCcw aria-hidden="true" />
            {t.puzzle.reset}
          </button>
          <span className="text-sm font-bold text-muted-foreground">{fill(t.puzzle.mistakes, { n: mistakes })}</span>
        </div>
      )}
    </div>
  )
}
