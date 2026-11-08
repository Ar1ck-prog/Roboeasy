'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Lightbulb, Lock, Play, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'

import { GameHeader, type Reward, RewardLine, Stars, finishRound } from '@/components/learn/games/game-kit'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fill } from '@/lib/i18n/config'
import type { PlayText } from '@/lib/i18n/play'
import { bestStars } from '@/lib/learn/economy'
import {
  LOOP_TOKENS,
  MAZE_LEVELS,
  type MazeRun,
  type Move,
  type Token,
  blockCount,
  cell,
  mazeStars,
  parseMaze,
  runMaze,
  shortestMoves,
} from '@/lib/learn/games/maze'
import { SENSOR_MAZE_HINT, colorHex } from '@/lib/learn/shop'
import { useHydrated } from '@/lib/learn/store'
import { useProgress } from '@/lib/learn/use-progress'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'
const C = 40
const MAX_TOKENS = 30
const MOVE_ICON: Record<Move, typeof ArrowUp> = { F: ArrowUp, L: RotateCcw, R: RotateCw }

function Board({ level, run, step, color, label }: { level: (typeof MAZE_LEVELS)[number]; run: MazeRun | null; step: number; color: string; label: string }) {
  const maze = useMemo(() => parseMaze(level.rows), [level])
  const pos = run ? run.trace[Math.min(step, run.trace.length - 1)] : maze.start
  const taken = new Set<string>()
  if (run)
    for (let i = 1; i <= Math.min(step, run.trace.length - 1); i++)
      if (maze.gems.includes(cell(run.trace[i].x, run.trace[i].y))) taken.add(cell(run.trace[i].x, run.trace[i].y))
  const crashed = run?.outcome === 'crash' && step >= run.trace.length - 1
  return (
    <svg
      viewBox={`0 0 ${maze.w * C} ${maze.h * C}`}
      className="block h-auto w-full max-w-[28rem] rounded-(--radius-sm) border-(length:--stroke) border-outline bg-[#fbf7ef]"
      role="img"
      aria-label={label}
    >
      {level.rows.map((row, y) =>
        [...row].map((ch, x) =>
          ch === '#' ? (
            <rect key={`${x},${y}`} x={x * C + 1} y={y * C + 1} width={C - 2} height={C - 2} rx="6" fill="#3b4256" />
          ) : (
            <rect key={`${x},${y}`} x={x * C + 1} y={y * C + 1} width={C - 2} height={C - 2} rx="6" fill="#fff" stroke="#e7dfcf" strokeWidth="2" />
          ),
        ),
      )}
      {/* Finish */}
      <g transform={`translate(${maze.goal.x * C + 8} ${maze.goal.y * C + 8})`}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={(i % 2) * 12} y={Math.floor(i / 2) * 12} width="12" height="12" fill={(i + Math.floor(i / 2)) % 2 ? '#fff' : '#1b1f2a'} />
        ))}
        <rect width="24" height="24" fill="none" stroke="#1b1f2a" strokeWidth="2" />
      </g>
      {maze.gems.map((g) => {
        const [x, y] = g.split(',').map(Number)
        return taken.has(g) ? null : (
          <path
            key={g}
            d={`M${x * C + 20} ${y * C + 8} L${x * C + 31} ${y * C + 18} L${x * C + 20} ${y * C + 33} L${x * C + 9} ${y * C + 18} Z`}
            fill="#4fc3f7"
            stroke="#1b1f2a"
            strokeWidth="2.5"
          />
        )
      })}
      {/* Path so far */}
      {run && step > 0 && (
        <polyline
          points={run.trace
            .slice(0, step + 1)
            .map((p) => `${p.x * C + C / 2},${p.y * C + C / 2}`)
            .join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      )}
      <g
        transform={`translate(${pos.x * C + C / 2} ${pos.y * C + C / 2}) rotate(${pos.d * 90})`}
        style={{ transition: 'transform 0.25s' }}
        className="motion-reduce:transition-none"
      >
        <rect x="-14" y="-12" width="28" height="26" rx="7" fill={crashed ? '#e8442e' : color} stroke="#1b1f2a" strokeWidth="3" />
        <rect x="-17" y="-8" width="5" height="14" rx="2" fill="#1b1f2a" />
        <rect x="12" y="-8" width="5" height="14" rx="2" fill="#1b1f2a" />
        <path d="M-6 -14 L0 -21 L6 -14 Z" fill="#1b1f2a" />
        <circle cx="-5" cy="-3" r="2.5" fill="#1b1f2a" />
        <circle cx="5" cy="-3" r="2.5" fill="#1b1f2a" />
      </g>
    </svg>
  )
}

/** The program as chips; loops are shown as brackets with their body indented. */
function ProgramView({ tokens, t }: { tokens: Token[]; t: PlayText }) {
  if (!tokens.length) return <p className="m-0 text-sm text-muted-foreground">{t.maze.empty}</p>
  let depth = 0
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0" aria-label={t.maze.program}>
      {tokens.map((tok, i) => {
        if (tok === 'end') depth = Math.max(0, depth - 1)
        const d = depth
        if (tok.startsWith('x')) depth++
        const Icon = tok === 'F' || tok === 'L' || tok === 'R' ? MOVE_ICON[tok] : null
        return (
          <li
            key={i}
            className={cn(
              'flex h-9 items-center gap-1 rounded-(--radius-xs) border-(length:--stroke-thin) border-outline px-2 text-sm font-extrabold',
              Icon ? 'bg-[var(--blk-move)] text-(--blk-text)' : 'bg-[var(--blk-control)] text-(--blk-text)',
            )}
            style={d ? { boxShadow: `inset ${d * 4}px 0 0 rgba(27,31,42,.35)` } : undefined}
            title={
              Icon
                ? t.maze[tok === 'F' ? 'forward' : tok === 'L' ? 'left' : 'right']
                : tok === 'end'
                  ? t.maze.endTitle
                  : fill(t.maze.loopTitle, { n: tok.slice(1) })
            }
          >
            {Icon ? (
              <Icon className="size-4" aria-label={t.maze[tok === 'F' ? 'forward' : tok === 'L' ? 'left' : 'right']} />
            ) : tok === 'end' ? (
              `] ${t.maze.end}`
            ) : (
              `[ ${fill(t.maze.loop, { n: tok.slice(1) })}`
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function MazeGame({ lang, t }: { lang: Lang; t: PlayText }) {
  const hydrated = useHydrated()
  const p = useProgress()
  const [levelId, setLevelId] = useState<number | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [run, setRun] = useState<MazeRun | null>(null)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<{ stars: number; reward: Reward } | null>(null)
  const [hint, setHint] = useState(false)
  const started = useRef(Date.now())
  const best = useMemo(() => bestStars(p.state, 'maze'), [p.state])

  const firstOpen = MAZE_LEVELS.find((l) => !best.get(l.id))?.id ?? MAZE_LEVELS[MAZE_LEVELS.length - 1].id
  const level = MAZE_LEVELS.find((l) => l.id === (levelId ?? firstOpen))!
  const maze = useMemo(() => parseMaze(level.rows), [level])
  const loops: Token[] = []
  for (const tok of tokens) {
    if (tok.startsWith('x')) loops.push(tok)
    else if (tok === 'end') loops.pop()
  }
  const openDepth = loops.length
  const openLoop = loops[loops.length - 1]
  const running = run !== null && step < run.trace.length - 1
  const sensor = p.ledger.tiers.sensor
  const hintMoves = useMemo(() => (sensor ? (shortestMoves(maze) ?? []).slice(0, SENSOR_MAZE_HINT[sensor]) : []), [maze, sensor])

  // Plays the run step by step.
  useEffect(() => {
    if (!run || step >= run.trace.length - 1) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setStep((s) => s + 1), reduce ? 90 : 320)
    return () => clearTimeout(timer)
  }, [run, step])

  // When the run ends with a win, record it once.
  useEffect(() => {
    if (!run || step < run.trace.length - 1 || run.outcome !== 'win' || result) return
    const stars = mazeStars(level, tokens)
    // Stay on this level: recording the win changes which level is "first open".
    setLevelId(level.id)
    setResult({ stars, reward: finishRound('maze', level.id, stars, blockCount(tokens), (Date.now() - started.current) / 1000) })
  }, [run, step, level, tokens, result])

  if (!hydrated) return <Skeleton className="container my-10 h-[32rem]" />

  const add = (tok: Token) => {
    if (tokens.length >= MAX_TOKENS || running) return
    if (tok === 'end' && openDepth === 0) return
    setTokens((x) => [...x, tok])
    setRun(null)
    setResult(null)
  }
  const reset = () => {
    setRun(null)
    setStep(0)
    setResult(null)
  }
  const pick = (id: number) => {
    setLevelId(id)
    setTokens([])
    setHint(false)
    reset()
    started.current = Date.now()
  }
  const go = () => {
    setResult(null)
    setStep(0)
    setRun(runMaze(maze, tokens))
  }

  const ended = run && step >= run.trace.length - 1
  const message = ended ? { win: t.maze.win, crash: t.maze.crash, short: t.maze.short, gems: t.maze.gems, loops: t.maze.loops }[run.outcome] : null
  const nextLevel = MAZE_LEVELS.find((l) => l.id === level.id + 1)
  const unlocked = (id: number) => id === 1 || (best.get(id - 1) ?? 0) > 0 || (best.get(id) ?? 0) > 0

  return (
    <div className="container grid gap-5 py-6 md:py-10">
      <GameHeader lang={lang} t={t} title={t.play.games.maze.title}>
        <p className="m-0 font-bold">
          {fill(t.game.level, { n: level.id })} · <Stars n={best.get(level.id) ?? 0} className="align-[-3px]" />
        </p>
      </GameHeader>

      <nav aria-label={t.game.levels} className="-mx-4 overflow-x-auto px-4 pb-1">
        <ol className="m-0 flex list-none gap-2 p-0">
          {MAZE_LEVELS.map((l) => {
            const open = unlocked(l.id)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  disabled={!open}
                  aria-current={l.id === level.id ? 'step' : undefined}
                  onClick={() => pick(l.id)}
                  className={cn(
                    'grid h-14 w-12 place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card text-sm font-extrabold disabled:opacity-40',
                    l.id === level.id && 'bg-primary text-primary-foreground',
                  )}
                  aria-label={`${fill(t.game.level, { n: l.id })}${open ? '' : `, ${t.game.locked}`}`}
                >
                  {open ? l.id : <Lock className="size-4" aria-hidden="true" />}
                  <Stars n={best.get(l.id) ?? 0} className="text-[9px]" />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className="grid content-start gap-3">
          <p className="m-0 font-bold">{t.maze.goal}</p>
          <Board level={level} run={run} step={step} color={colorHex(p.looks.color)} label={t.maze.field} />
          {message && (
            <p role="status" className={cn('alert m-0', run?.outcome === 'win' ? 'alert-ok' : 'alert-warn')}>
              {message}
            </p>
          )}
          {result && (
            <Card className="items-start gap-2">
              <Stars n={result.stars} className="text-3xl" label={fill(t.game.stars, { n: result.stars })} />
              <RewardLine reward={result.reward} t={t} />
              <div className="flex flex-wrap gap-2">
                {nextLevel && (
                  <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => pick(nextLevel.id)}>
                    {t.game.next}
                  </button>
                )}
                <button type="button" className={buttonVariants()} onClick={() => (setTokens([]), reset())}>
                  {t.game.again}
                </button>
              </div>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-3">
          <Card className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-xl">{t.maze.program}</h2>
              <span className="text-sm font-bold text-muted-foreground">{fill(t.maze.blocks, { n: blockCount(tokens), par: level.par })}</span>
            </div>
            <ProgramView tokens={tokens} t={t} />
            {openLoop && <p className="m-0 text-sm font-bold text-link">{fill(t.maze.openLoop, { n: openLoop.slice(1) })}</p>}
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {(['F', 'L', 'R'] as const).map((m) => {
              const Icon = MOVE_ICON[m]
              const name = t.maze[m === 'F' ? 'forward' : m === 'L' ? 'left' : 'right']
              return (
                <button
                  key={m}
                  type="button"
                  className={buttonVariants({ size: 'lg', className: 'bg-[var(--blk-move)] px-2 text-(--blk-text)' })}
                  onClick={() => add(m)}
                  disabled={running}
                >
                  <Icon aria-hidden="true" />
                  {name}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {LOOP_TOKENS.map((l) => (
              <button
                key={l}
                type="button"
                className={buttonVariants({ className: 'bg-[var(--blk-control)] px-1 text-(--blk-text)' })}
                onClick={() => add(l)}
                disabled={running}
                title={fill(t.maze.loopTitle, { n: l.slice(1) })}
                aria-label={fill(t.maze.loopTitle, { n: l.slice(1) })}
              >
                {fill(t.maze.loop, { n: l.slice(1) })}
              </button>
            ))}
            <button
              type="button"
              className={buttonVariants({ className: 'bg-[var(--blk-control)] px-1 text-(--blk-text)' })}
              onClick={() => add('end')}
              disabled={running || openDepth === 0}
              title={t.maze.endTitle}
            >
              {t.maze.end}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonVariants({ variant: 'primary', size: 'lg', className: 'flex-1' })}
              onClick={go}
              disabled={!tokens.length || running}
            >
              <Play aria-hidden="true" />
              {t.maze.run}
            </button>
            <button
              type="button"
              className={buttonVariants({ size: 'lg' })}
              onClick={() => (setTokens((x) => x.slice(0, -1)), reset())}
              disabled={!tokens.length || running}
              aria-label={t.maze.undo}
            >
              <Undo2 aria-hidden="true" />
              <span className="hidden sm:inline">{t.maze.undo}</span>
            </button>
            <button
              type="button"
              className={buttonVariants({ size: 'lg' })}
              onClick={() => (setTokens([]), reset())}
              disabled={!tokens.length || running}
              aria-label={t.maze.clear}
            >
              <Trash2 aria-hidden="true" />
              <span className="hidden sm:inline">{t.maze.clear}</span>
            </button>
          </div>
          {sensor > 0 ? (
            <div className="grid gap-1">
              <button type="button" className={buttonVariants({ variant: 'ghost', className: 'justify-self-start' })} onClick={() => setHint(true)}>
                <Lightbulb aria-hidden="true" />
                {t.maze.hint}
              </button>
              {hint && (
                <p className="m-0 text-sm font-bold">
                  {fill(t.maze.hintText, { moves: hintMoves.map((m) => t.maze[m === 'F' ? 'forward' : m === 'L' ? 'left' : 'right']).join(' → ') })}
                </p>
              )}
            </div>
          ) : (
            <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb className="size-4" aria-hidden="true" />
              {t.maze.hintLocked}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
