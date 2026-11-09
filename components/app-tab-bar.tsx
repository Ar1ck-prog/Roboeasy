'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gamepad2, GraduationCap, LogIn, Map as MapIcon, UserRound, Wrench } from 'lucide-react'

import { APP_SECTIONS, type AppSection, currentSection } from '@/components/site-header'
import type { Locale } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import { useHydrated, useLearn } from '@/lib/learn/store'
import { cn } from '@/lib/utils'

const ICONS: Record<AppSection, typeof MapIcon> = {
  path: MapIcon,
  learn: GraduationCap,
  play: Gamepad2,
  garage: Wrench,
  profile: UserRound,
}

/** Bottom tab bar on phones: the five app sections within thumb reach. */
export function AppTabBar({ lang, names }: { lang: Locale; names: LearnText['nav'] }) {
  const pathname = usePathname() ?? `/${lang}`
  const current = currentSection(pathname.replace(/^\/(ru|kk|en)(?=\/|$)/, ''))
  const hydrated = useHydrated()
  const learn = useLearn()
  const newHere = hydrated && !learn.profile
  return (
    <>
      <div className="h-[calc(64px+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />
      <nav
        aria-label={names.path}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t-(length:--stroke) border-outline bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {APP_SECTIONS.map((s) => {
          const signIn = s === 'profile' && newHere
          const Icon = signIn ? LogIn : ICONS[s]
          const active = current === s
          return (
            <Link
              prefetch={false}
              key={s}
              href={`/${lang}/${s}${signIn ? '#account' : ''}`}
              aria-current={active ? 'page' : undefined}
              className={cn('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted-foreground', active && 'text-foreground')}
            >
              <span
                className={cn(
                  'grid h-7 w-12 place-items-center rounded-full',
                  active && 'border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate px-1">{signIn ? names.signIn : names[s]}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
