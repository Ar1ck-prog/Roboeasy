'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Box, Check, Cpu, FlaskConical, Sparkles, Zap } from 'lucide-react'

import { Esp32Board, UnoBoard } from '@/components/electronics/bench'
import { PartArt } from '@/components/electronics/part-art'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DEFAULT_PROPS, type PartType } from '@/lib/electronics/board'
import { MISSION_IDS, type MissionId } from '@/lib/electronics/missions'
import { loadProgress } from '@/lib/electronics/progress'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'

/** The part that pictures each mission on its card. */
const MISSION_PART: Record<MissionId, { type: PartType; box: string; props?: object }> = {
  blink: { type: 'led', box: '-6 -30 22 34', props: { color: 'yellow' } },
  led: { type: 'led', box: '-6 -30 22 34' },
  button: { type: 'button', box: '-6 -2 32 34' },
  dimmer: { type: 'pot', box: '-6 -32 32 36' },
  traffic: { type: 'led', box: '-6 -30 22 34', props: { color: 'green' } },
  melody: { type: 'buzzer', box: '-2 -34 34 36' },
  servo: { type: 'servo', box: '-40 -6 100 70' },
  radar: { type: 'ultrasonic', box: '-62 -82 154 84' },
  night: { type: 'ldr', box: '-4 -24 28 28' },
  rgb: { type: 'rgb', box: '-6 -34 42 40' },
  alarm: { type: 'pir', box: '-44 -108 108 112' },
  thermo: { type: 'dht', box: '-16 -80 52 84' },
}

export function ElectronicsHub({ lang, t }: { lang: Locale; t: ElectronicsText }) {
  const h = t.hub
  const [done, setDone] = useState<Set<string>>(new Set())
  useEffect(() => setDone(new Set(loadProgress().done)), [])

  return (
    <div className="container grid gap-10 py-8 md:py-12">
      <header className="relative grid gap-3 overflow-hidden rounded-(--radius-xl) border-(length:--stroke) border-outline bg-[#0f2a33] p-6 text-white shadow-(--shadow-hard) sm:p-8 md:p-10">
        {/* A faint circuit behind the title */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30" aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 300">
          <defs>
            <pattern id="hub-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#5fd3c6" />
            </pattern>
          </defs>
          <rect width="800" height="300" fill="url(#hub-dots)" opacity="0.35" />
          <g fill="none" stroke="#5fd3c6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M420 40 h120 l30 30 h120" />
            <path d="M450 260 h90 l40 -40 h140" />
            <path d="M520 150 h60 l20 -20 h90 l20 20 h60" />
            <path d="M640 40 v60 l-30 30" />
          </g>
          <g fill="#ffd56a">
            <circle cx="420" cy="40" r="5" />
            <circle cx="690" cy="70" r="5" />
            <circle cx="450" cy="260" r="5" />
            <circle cx="720" cy="220" r="5" />
            <circle cx="520" cy="150" r="5" />
            <circle cx="770" cy="150" r="5" />
          </g>
        </svg>
        <p className="relative m-0 inline-flex w-fit items-center gap-2 rounded-(--radius-pill) bg-white/10 px-3 py-1 text-sm font-extrabold tracking-wide uppercase">
          <Cpu className="size-4" aria-hidden="true" />
          Arduino · ESP32
        </p>
        <h1 className="relative m-0 text-4xl text-white md:text-6xl">{h.title}</h1>
        <p className="relative m-0 max-w-2xl text-lg text-white/80">{h.lead}</p>
        <div className="relative mt-2 flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/electronics/lab`}>
            <FlaskConical aria-hidden="true" />
            {h.labCta}
          </Link>
          <Link className={buttonVariants({ variant: 'secondary' })} href={`/${lang}/electronics/uno`}>
            <Box aria-hidden="true" />
            {h.boardCta}
          </Link>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="justify-between gap-5 bg-primary text-primary-foreground">
          <div className="grid gap-2">
            <FlaskConical className="size-9" aria-hidden="true" />
            <h2 className="m-0 text-2xl">{h.labTitle}</h2>
            <p className="m-0 opacity-85">{h.labText}</p>
          </div>
          <svg viewBox="-70 -95 360 130" className="h-28 w-full" aria-hidden="true">
            <rect x={-70} y={-12} width={360} height={30} rx={6} fill="#f6f3ec" opacity={0.9} />
            <g transform="translate(-40 0)">
              <PartArt part={{ id: 'h1', type: 'resistor', x: 0, y: 0, rot: 0, props: DEFAULT_PROPS.resistor }} />
            </g>
            <g transform="translate(20 0)">
              <PartArt part={{ id: 'h2', type: 'led', x: 0, y: 0, rot: 0, props: { color: 'red' } }} brightness={1} />
            </g>
            <g transform="translate(60 0)">
              <PartArt part={{ id: 'h3', type: 'button', x: 0, y: 0, rot: 0, props: {} }} />
            </g>
            <g transform="translate(110 0)">
              <PartArt part={{ id: 'h4', type: 'pot', x: 0, y: 0, rot: 0, props: { pos: 0.7 } }} />
            </g>
            <g transform="translate(200 4)">
              <PartArt part={{ id: 'h5', type: 'ultrasonic', x: 0, y: 0, rot: 0, props: { distance: 30 } }} cm={t.lab.cm} />
            </g>
          </svg>
          <Link className={buttonVariants({ variant: 'secondary', className: 'w-fit' })} href={`/${lang}/electronics/lab`}>
            {h.labCta}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Card>

        <Card className="justify-between gap-5">
          <div className="grid gap-2">
            <Box className="size-9" aria-hidden="true" />
            <h2 className="m-0 text-2xl">{h.boardTitle}</h2>
            <p className="m-0 text-muted-foreground">{h.boardText}</p>
          </div>
          <div className="grid grid-cols-2 items-center gap-3">
            <svg viewBox="2 34 306 242" className="h-32 w-full [--bench-bg:var(--color-card)]" aria-hidden="true">
              <UnoBoard builtin={1} tx={false} on />
            </svg>
            <svg viewBox="16 96 268 148" className="h-28 w-full" aria-hidden="true">
              <defs>
                <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
                  <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
                  <stop offset="1" stopColor="#5f6368" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <Esp32Board builtin={1} tx={false} on />
            </svg>
          </div>
          <Link className={buttonVariants({ variant: 'primary', className: 'w-fit' })} href={`/${lang}/electronics/uno`}>
            {h.boardCta}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Card>
      </div>

      <section className="grid gap-4" aria-labelledby="missions-title">
        <div className="grid gap-1">
          <h2 id="missions-title" className="m-0 text-2xl md:text-3xl">
            {h.missionsTitle}
          </h2>
          <p className="m-0 text-muted-foreground">{h.missionsLead}</p>
        </div>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {MISSION_IDS.map((id, i) => {
            const m = t.missions[id]
            const art = MISSION_PART[id]
            return (
              <li key={id}>
                <Card flat className="relative h-full flex-row items-start gap-4 p-4 sm:p-4">
                  <svg viewBox={art.box} className="h-14 w-16 shrink-0" aria-hidden="true">
                    <PartArt part={{ id, type: art.type, x: 0, y: 0, rot: 0, props: { ...DEFAULT_PROPS[art.type], ...art.props } }} brightness={art.type === 'led' ? 1 : 0} cm={t.lab.cm} />
                  </svg>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="m-0 text-xs font-extrabold text-muted-foreground">{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="m-0 text-lg">
                      <Link href={`/${lang}/electronics/lab?mission=${id}`} className="after:absolute after:inset-0 hover:underline">
                        {m.title}
                      </Link>
                    </h3>
                    <p className="m-0 text-sm text-muted-foreground">{m.story}</p>
                  </div>
                  {done.has(id) && (
                    <Badge variant="success" className="shrink-0">
                      <Check aria-hidden="true" />
                      {h.done}
                    </Badge>
                  )}
                </Card>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="grid gap-3" aria-labelledby="boards-title">
          <h2 id="boards-title" className="m-0 text-2xl">
            {h.boardsTitle}
          </h2>
          {(['uno', 'esp32'] as const).map((id) => (
            <Card key={id} flat className="gap-2 p-4 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-lg">{h[id].name}</h3>
                {id === 'esp32' && (
                  <Badge variant="success">
                    <Sparkles aria-hidden="true" />
                    Wi-Fi
                  </Badge>
                )}
              </div>
              <p className="m-0 text-sm text-muted-foreground">{h[id].text}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link className={buttonVariants({ size: 'sm' })} href={`/${lang}/electronics/${id}`}>
                  <Box aria-hidden="true" />
                  {h.open3d}
                </Link>
                <Link className={buttonVariants({ size: 'sm', variant: 'ghost' })} href={`/${lang}/electronics/lab${id === 'esp32' ? '?board=esp32' : ''}`}>
                  <FlaskConical aria-hidden="true" />
                  {h.openLab}
                </Link>
              </div>
            </Card>
          ))}
        </section>
        <section className="grid content-start gap-3" aria-labelledby="physics-title">
          <h2 id="physics-title" className="m-0 text-2xl">
            {h.physicsTitle}
          </h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {h.physics.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Zap className="mt-0.5 size-5 shrink-0 text-(--sun-700)" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
