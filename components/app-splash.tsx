'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { APP_SESSION_KEY, appHome } from '@/lib/app-start'
import type { Locale } from '@/lib/i18n/config'
import type { AppSplashText } from '@/lib/i18n/app-splash'

const MIN_MS = 1400
// The SPIKE hub's 5x5 light matrix; the lit cells draw the RoboEasy smile (as in the icon).
const SMILE = ['1,1', '3,1', '0,3', '1,4', '2,4', '3,4', '4,3']

/**
 * The app's start screen: the installed app opens here instead of the site's landing,
 * shows the hub's smile lighting up while the home screen loads, then replaces itself.
 */
export function AppSplash({ lang, t }: { lang: Locale; t: AppSplashText }) {
  const router = useRouter()

  useEffect(() => {
    const home = appHome(lang)
    try {
      sessionStorage.setItem(APP_SESSION_KEY, '1')
    } catch {
      // Without storage the app still starts; only the landing redirect is lost.
    }
    router.prefetch(home)
    const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => router.replace(home), quick ? 300 : MIN_MS)
    return () => window.clearTimeout(timer)
  }, [lang, router])

  return (
    <main id="main" className="app-splash grid min-h-dvh place-items-center px-6 py-10 text-center">
      <div className="grid justify-items-center gap-5">
        <svg viewBox="0 0 120 120" className="app-splash-hub size-36" aria-hidden="true">
          <rect x="4" y="4" width="112" height="112" rx="30" fill="#FFD23F" stroke="#15171A" strokeWidth="6" />
          {Array.from({ length: 25 }, (_, i) => {
            const col = i % 5
            const row = Math.floor(i / 5)
            const order = SMILE.indexOf(`${col},${row}`)
            return (
              <rect
                key={i}
                x={20 + col * 17}
                y={20 + row * 17}
                width="12"
                height="12"
                rx="3.2"
                fill="#15171A"
                className={order === -1 ? 'app-splash-dim' : 'app-splash-lit'}
                style={order === -1 ? undefined : { animationDelay: `${120 + order * 110}ms` }}
              />
            )
          })}
        </svg>
        <div className="grid gap-1">
          <p className="m-0 font-display text-4xl leading-none font-extrabold tracking-tight">RoboEasy</p>
          <p className="m-0 text-base text-muted-foreground">{t.tagline}</p>
        </div>
        <div className="app-splash-bar h-2 w-44 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-card" role="progressbar" aria-label={t.loading}>
          <span className="block h-full w-full origin-left bg-primary" />
        </div>
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      </div>
    </main>
  )
}
