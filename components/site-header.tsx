'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, LogIn, Menu, UserRound, X } from 'lucide-react'

import { CoinChip } from '@/components/learn/coin-chip'
import { LogoMark } from '@/components/logo'
import { ThemeSwitch } from '@/components/theme-switch'
import { buttonVariants } from '@/components/ui/button'
import { type Locale, LOCALE_COOKIE, localeLabels, locales } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { Dictionary } from '@/lib/i18n/ru'
import { getAiSchoolText } from '@/lib/i18n/ai-school'
import { useHydrated, useLearn } from '@/lib/learn/store'

interface SiteHeaderProps {
  lang: Locale
  t: Dictionary['nav']
  /** Names of the app sections (Мой путь, Уроки, …). */
  sections: LearnText['nav']
  /** Label of the coin balance. */
  coinsLabel?: string
  /** Landing shows section links; app pages show the app sections. */
  variant?: 'landing' | 'app'
}

/** The phone tab bar sections, in order (docs/product/information-architecture.md). */
export const APP_SECTIONS = ['path', 'learn', 'play', 'garage', 'profile'] as const
export type AppSection = (typeof APP_SECTIONS)[number]
/** All header sections; the last ones are in the header and the menu only. */
const HEADER_SECTIONS = ['path', 'learn', 'play', 'garage', 'library', 'sandbox', 'compete'] as const
type HeaderSection = (typeof HEADER_SECTIONS)[number]

const AI_SCHOOL_PATH = '/learn/ai-basics'

export function currentSection(rest: string): AppSection | null {
  return (
    APP_SECTIONS.find((s) => rest === `/${s}` || rest.startsWith(`/${s}/`)) ??
    (rest.startsWith('/review') ? 'play' : rest.startsWith('/cert') ? 'profile' : null)
  )
}

function currentHeaderSection(rest: string): HeaderSection | null {
  return HEADER_SECTIONS.find((s) => rest === `/${s}` || rest.startsWith(`/${s}/`)) ?? (rest.startsWith('/review') ? 'play' : null)
}

function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

/*
 * Navigation links do not prefetch: they are on every page, and prefetching
 * every section's code on each load costs more than it saves on phones.
 */
export function SiteHeader({ lang, t, sections: names, coinsLabel = '', variant = 'landing' }: SiteHeaderProps) {
  const pathname = usePathname() ?? `/${lang}`
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const rest = pathname.replace(/^\/(ru|kk|en)(?=\/|$)/, '')
  const home = `/${lang}`
  // On a new device there is no profile yet: this is the way in to an existing account.
  const hydrated = useHydrated()
  const learn = useLearn()
  const newHere = hydrated && !learn.profile
  const profileHref = `${home}/profile${newHere ? '#account' : ''}`
  const profileName = newHere ? names.signIn : names.profile
  const sections =
    variant === 'landing'
      ? [
          { href: '#how', label: t.how },
          { href: '#examples', label: t.examples },
          { href: '#faq', label: t.faq },
        ]
      : []
  // App sections, marked current by path. Profile sits with the actions.
  const current = currentSection(rest)
  const currentHeader = currentHeaderSection(rest)
  const inAiSchool = rest === AI_SCHOOL_PATH || rest.startsWith(`${AI_SCHOOL_PATH}/`)
  const pages = HEADER_SECTIONS.flatMap((p) => {
    const page = { href: `${home}/${p}`, label: names[p], current: currentHeader === p && !(p === 'learn' && inAiSchool), extra: p === 'sandbox' || p === 'compete' }
    return p === 'learn' ? [page, { href: `${home}${AI_SCHOOL_PATH}`, label: getAiSchoolText(lang).nav, current: inAiSchool, extra: false }] : [page]
  })

  return (
    <>
      {/* Outside the header: its backdrop-filter would become the containing block of this fixed link. */}
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="site-header" data-scrolled={scrolled}>
        <div className="container">
          <Link prefetch={false} className="brand" href={home}>
            <LogoMark />
            <span className="brand-name">RoboEasy</span>
            <span className="brand-ai">AI</span>
          </Link>

          <nav className="main-nav" aria-label={t.menu}>
            {sections.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            {variant === 'app' &&
              pages.map((p) => (
                // Sandbox and competitions fit the header only on wide screens; the menu always has them.
                <Link
                  prefetch={false}
                  key={p.href}
                  href={p.href}
                  aria-current={p.current ? 'page' : undefined}
                  className={p.extra ? 'max-[1439px]:hidden' : undefined}
                >
                  {p.label}
                </Link>
              ))}
          </nav>

          <div className="header-actions">
            <nav className="lang-switch" aria-label={t.language}>
              {/* Plain links: each language has its own root layout, so a full load keeps the theme script working. */}
              {locales.map((l) => (
                <a
                  key={l}
                  href={`/${l}${rest}`}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === lang ? 'true' : undefined}
                  title={localeLabels[l].name}
                  onClick={() => rememberLocale(l)}
                >
                  {localeLabels[l].short}
                </a>
              ))}
            </nav>
            <ThemeSwitch
              labels={{
                theme: t.theme,
                system: t.themeSystem,
                light: t.themeLight,
                dark: t.themeDark,
              }}
            />
            {variant === 'landing' ? (
              <>
                <Link
                  prefetch={false}
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'header-wide',
                  })}
                  href={`${home}/compete`}
                >
                  {names.compete}
                </Link>
                <Link
                  prefetch={false}
                  className={buttonVariants({
                    variant: 'primary',
                    size: 'sm',
                    className: 'header-wide',
                  })}
                  href={`${home}/path`}
                >
                  {names.path}
                </Link>
              </>
            ) : (
              <>
                <CoinChip href={`${home}/garage`} label={coinsLabel} />
                <Link
                  prefetch={false}
                  className={buttonVariants({
                    variant: current === 'profile' || newHere ? 'secondary' : 'ghost',
                    size: 'sm',
                    className: 'header-wide',
                  })}
                  href={profileHref}
                  aria-current={current === 'profile' ? 'page' : undefined}
                >
                  {newHere ? <LogIn aria-hidden="true" /> : <UserRound aria-hidden="true" />}
                  {profileName}
                </Link>
              </>
            )}
            <button
              type="button"
              className={buttonVariants({
                size: 'icon',
                className: 'menu-toggle',
              })}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={t.menu}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div id="mobile-nav" className="mobile-nav" data-open={open}>
          {sections.map((l) => (
            <a key={l.href} className="mobile-link" href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          {variant === 'app' && (
            <Link prefetch={false} className="mobile-link" href={home} onClick={() => setOpen(false)}>
              <House aria-hidden="true" className="inline size-4 align-[-2px]" /> {t.home}
            </Link>
          )}
          {[
            ...pages,
            {
              href: profileHref,
              label: profileName,
              current: current === 'profile',
            },
          ].map((p) => (
            <Link
              prefetch={false}
              key={p.href}
              href={p.href}
              aria-current={p.current ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className="mobile-link"
            >
              {p.label}
            </Link>
          ))}
          {variant === 'landing' && (
            <Link prefetch={false} className={buttonVariants({ variant: 'primary', block: true })} href={`${home}/path`} onClick={() => setOpen(false)}>
              {names.path}
            </Link>
          )}
        </div>
      </header>
    </>
  )
}
