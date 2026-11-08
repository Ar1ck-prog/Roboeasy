'use client'

import { useEffect, useRef, useState } from 'react'

import { GameHeader, type Reward, RewardLine, Stars, finishRound } from '@/components/learn/games/game-kit'
import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fill } from '@/lib/i18n/config'
import type { PlayText } from '@/lib/i18n/play'
import { type MemoryCard, memoryDeck, memoryStars } from '@/lib/learn/games/quiz'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'
const PAIRS = 6

export function MemoryGame({ lang, t }: { lang: Lang; t: PlayText }) {
  const [seed, setSeed] = useState<number | null>(null)
  const [deck, setDeck] = useState<MemoryCard[]>([])
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<Set<string>>(new Set())
  const [tries, setTries] = useState(0)
  const [result, setResult] = useState<{ stars: number; reward: Reward } | null>(null)
  const started = useRef(Date.now())

  // A new deck after hydration (random), and on "play again".
  useEffect(() => {
    if (seed === null) setSeed(Math.floor(Math.random() * 1e9))
  }, [seed])
  useEffect(() => {
    if (seed === null) return
    setDeck(memoryDeck(lang, seed, PAIRS))
    setOpen([])
    setFound(new Set())
    setTries(0)
    setResult(null)
    started.current = Date.now()
  }, [seed, lang])

  // Two open cards: keep them if they match, otherwise turn them back.
  useEffect(() => {
    if (open.length !== 2) return
    const [a, b] = open
    if (deck[a].pair === deck[b].pair) {
      const next = new Set(found).add(deck[a].pair)
      setFound(next)
      setOpen([])
      if (next.size === PAIRS) {
        const stars = memoryStars(tries, PAIRS)
        setResult({ stars, reward: finishRound('memory', 0, stars, tries, (Date.now() - started.current) / 1000) })
      }
      return
    }
    const timer = setTimeout(() => setOpen([]), 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || found.has(deck[i].pair)) return
    if (open.length === 1) setTries((n) => n + 1)
    setOpen((o) => [...o, i])
  }

  return (
    <div className="container grid gap-5 py-6 md:py-10">
      <GameHeader lang={lang} t={t} title={t.play.games.memory.title}>
        <p className="m-0 flex gap-3 font-bold" aria-live="polite">
          <span>{fill(t.memory.pairs, { n: found.size, total: PAIRS })}</span>
          <span>{fill(t.memory.tries, { n: tries })}</span>
        </p>
      </GameHeader>
      <p className="m-0 text-muted-foreground">{t.memory.lead}</p>

      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 sm:gap-3" data-testid="memory-grid">
        {deck.map((c, i) => {
          const shown = open.includes(i) || found.has(c.pair)
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => flip(i)}
                aria-label={shown ? c.text : fill(t.memory.card, { n: i + 1 })}
                aria-pressed={shown}
                data-pair={c.pair}
                className={cn(
                  'grid aspect-[4/3] w-full place-items-center rounded-(--radius-md) border-(length:--stroke) border-outline p-1.5 text-center shadow-(--shadow-press) transition-colors motion-reduce:transition-none sm:aspect-[3/2]',
                  !shown && 'cursor-pointer bg-primary bg-[radial-gradient(rgba(27,31,42,.25)_1.5px,transparent_2px)] bg-size-[14px_14px]',
                  shown && !found.has(c.pair) && 'bg-card',
                  found.has(c.pair) && 'bg-(--ok-bg)',
                )}
              >
                {shown ? (
                  <span
                    className={cn(
                      'grid min-w-0 gap-0.5 leading-tight [overflow-wrap:anywhere] hyphens-auto',
                      c.face === 'term' ? 'font-display text-[0.95rem] font-extrabold sm:text-lg' : 'text-[0.72rem] font-bold sm:text-sm',
                    )}
                  >
                    {c.icon && (
                      <span className="text-xl">
                        <AnimIcon name={c.icon} />
                      </span>
                    )}
                    {c.text}
                  </span>
                ) : (
                  <span className="font-display text-2xl font-extrabold text-primary-foreground" aria-hidden="true">
                    ?
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {result && (
        <Card className="items-start gap-2">
          <p className="alert alert-ok m-0" role="status">
            {t.memory.win}
          </p>
          <Stars n={result.stars} className="text-3xl" label={fill(t.game.stars, { n: result.stars })} />
          <RewardLine reward={result.reward} t={t} />
          <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
            {t.game.again}
          </button>
        </Card>
      )}
    </div>
  )
}
