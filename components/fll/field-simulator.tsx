'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Gamepad2, Keyboard, Maximize, Minimize, MousePointer2, RotateCw, Timer, Video } from 'lucide-react'

import { Buddy } from '@/components/learn/buddy'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FLL_SIM_ORIGINAL, FLL_SIM_SRC, type SimulatorText } from '@/lib/i18n/simulator'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'
const HOW_ICONS = [MousePointer2, Keyboard, Timer, Video]
/** After this long without a load event, suggest reloading or the new tab. */
const SLOW_MS = 40_000
/** Set while we reload once to get cross-origin isolation (see useIsolation). */
const ISOLATION_KEY = 'roboeasy:fll-sim-isolation-reload'

/**
 * The simulator pauses a running Python program through a SharedArrayBuffer,
 * which needs cross-origin isolation of this page and the frame (COOP/COEP in
 * next.config.mjs). Headers only apply to a full page load, so after a
 * client-side navigation the page reloads once. If the browser cannot isolate
 * the page, the simulator still runs (pausing works partly) and we do not
 * reload again this session.
 */
function useIsolation(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let reloading = false
    try {
      if (window.crossOriginIsolated) sessionStorage.removeItem(ISOLATION_KEY)
      else if (window.isSecureContext && !sessionStorage.getItem(ISOLATION_KEY)) {
        sessionStorage.setItem(ISOLATION_KEY, '1')
        reloading = true
        window.location.reload()
      }
    } catch {
      // Storage blocked: run without isolation rather than risk a reload loop.
    }
    if (!reloading) setReady(true)
  }, [])
  return ready
}

/**
 * The BIOGLOW 3D field simulator by fll-bioglow-sim: a copy of the built site
 * in public/fll-sim (hosted with the author's permission), shown in a frame
 * with our header, a loading screen, full screen and a new-tab fallback.
 */
export function FieldSimulator({ lang, t, toPlanner }: { lang: Lang; t: SimulatorText['three']; toPlanner: string }) {
  const box = useRef<HTMLDivElement>(null)
  const ready = useIsolation()
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const [full, setFull] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loaded) return
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [loaded, attempt])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.().catch(() => {})
  }
  const reload = () => {
    setLoaded(false)
    setSlow(false)
    setAttempt((n) => n + 1)
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-3xl gap-3">
          <p className="eyebrow m-0">{t.eyebrow}</p>
          <h1 className="m-0 text-4xl md:text-5xl">{t.title}</h1>
          <p className="lead m-0">{t.lead}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {t.badges.map((b) => (
              <li key={b}>
                <Badge variant="outline">{b}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonVariants({ size: 'sm', className: 'max-md:hidden' })} onClick={toggleFull}>
            {full ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
            {t.fullscreen}
          </button>
          <button type="button" className={buttonVariants({ size: 'sm' })} onClick={reload} aria-label={t.reload} title={t.reload}>
            <RotateCw aria-hidden="true" />
          </button>
          <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={FLL_SIM_SRC} target="_blank" rel="noopener">
            <ExternalLink aria-hidden="true" />
            {t.newTab}
          </a>
        </div>
      </header>

      <p className="alert alert-warn m-0 md:hidden" role="note">
        {t.phone}
      </p>

      <div
        ref={box}
        className={cn(
          'relative overflow-hidden rounded-(--radius-lg) border-(length:--stroke) border-outline bg-[#141826] shadow-(--shadow-hard)',
          full ? 'rounded-none border-0' : 'h-[72dvh] min-h-[480px] md:h-[min(80dvh,860px)]',
        )}
      >
        {ready && (
          <iframe
            key={attempt}
            src={FLL_SIM_SRC}
            title={t.frame}
            className="absolute inset-0 size-full border-0"
            allow="fullscreen; gamepad; clipboard-write; cross-origin-isolated"
            allowFullScreen
            onLoad={() => setLoaded(true)}
          />
        )}
        {/* Loading screen: fades out once the simulator's page has loaded. */}
        <div
          className={cn(
            'absolute inset-0 grid place-items-center bg-[radial-gradient(rgba(255,255,255,.08)_1.6px,transparent_2px)] bg-[#141826] bg-size-[22px_22px] p-6 text-center text-white transition-opacity duration-500 motion-reduce:transition-none',
            loaded ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          aria-hidden={loaded}
        >
          <div className="grid max-w-md justify-items-center gap-4">
            <div className="w-36">
              <Buddy model="rover" color="sun" hat="antenna" eyes="happy" animate />
            </div>
            <p className="m-0 font-display text-2xl font-extrabold" role="status">
              {t.loading}
            </p>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="sim-loading-bar h-full w-1/3 rounded-full bg-primary" />
            </div>
            <p className="m-0 text-sm text-white/75">{t.loadingHint}</p>
            {slow && (
              <div className="grid justify-items-center gap-3">
                <p className="m-0 text-sm font-bold">{t.slow}</p>
                <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={FLL_SIM_SRC} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden="true" />
                  {t.newTab}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-4" aria-labelledby="sim-how">
        <h2 id="sim-how" className="m-0 flex items-center gap-2 text-2xl">
          <Gamepad2 className="size-6" aria-hidden="true" />
          {t.howTitle}
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.map((h, i) => {
            const Icon = HOW_ICONS[i]
            return (
              <li key={h.title}>
                <Card className="h-full gap-2">
                  <span className="grid size-11 place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="m-0 text-lg">{h.title}</h3>
                  <p className="m-0 text-sm text-muted-foreground">{h.text}</p>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      <Card className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between" flat>
        <p className="m-0 font-bold">{t.tip}</p>
        <Link className={buttonVariants({ size: 'sm' })} href={`/${lang}/compete`}>
          {toPlanner}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Card>

      <p className="m-0 text-sm text-muted-foreground">
        {t.credit}{' '}
        <a className="font-bold text-link underline underline-offset-4" href={FLL_SIM_ORIGINAL} target="_blank" rel="noopener noreferrer">
          {new URL(FLL_SIM_ORIGINAL).host}
        </a>
      </p>
    </div>
  )
}
