'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Blocks, Box, ExternalLink, Search, Sparkles, Trophy } from 'lucide-react'

import { Card, CardTitle } from '@/components/ui/card'
import type { LearnText } from '@/lib/i18n/learn'
import type { PlayText } from '@/lib/i18n/play'
import { GLOSSARY } from '@/lib/learn/glossary'
import { SOURCES } from '@/lib/learn/sources'

type Lang = 'ru' | 'kk' | 'en'

/** /library: the glossary with search, and resources for learning on your own. */
export function LibraryView({ lang, t, nav }: { lang: Lang; t: PlayText; nav: LearnText['nav'] }) {
  const id = useId()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const terms = GLOSSARY.filter((g) => !query || `${g.term[lang]} ${g.text[lang]}`.toLowerCase().includes(query))
  const tools = [
    { href: '/sandbox', icon: Blocks, title: nav.sandbox },
    { href: '/compete', icon: Trophy, title: nav.compete },
    { href: '/compete/simulator', icon: Box, title: t.play.simulator.title },
    { href: '/ai', icon: Sparkles, title: 'RoboEasy AI' },
  ]

  return (
    <div className="container grid gap-6 py-8 md:py-12">
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl md:text-5xl">{t.library.title}</h1>
        <p className="m-0 max-w-[60ch] text-lg text-muted-foreground">{t.library.lead}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="grid content-start gap-3" aria-labelledby={`${id}-terms`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${id}-terms`} className="m-0 text-2xl">
              {t.library.terms}
            </h2>
            <label className="relative w-full max-w-xs">
              <span className="sr-only">{t.library.search}</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" className="input w-full pl-9" placeholder={t.library.search} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          {terms.length ? (
            <dl className="m-0 grid gap-2 sm:grid-cols-2">
              {terms.map((g) => (
                <div key={g.id} className="flex gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-surface-2 text-xl"
                    aria-hidden="true"
                  >
                    {g.icon}
                  </span>
                  <div className="grid content-start gap-0.5">
                    <dt className="font-display text-lg font-extrabold">{g.term[lang]}</dt>
                    <dd className="m-0 text-sm">{g.text[lang]}</dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-muted-foreground">{t.library.none}</p>
          )}
        </section>

        <aside className="grid content-start gap-4">
          <Card className="gap-3">
            <CardTitle>{t.library.sources}</CardTitle>
            <p className="m-0 text-sm text-muted-foreground">{t.library.sourcesNote}</p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {SOURCES.map((s) => (
                <li key={s.id} className="grid gap-0.5">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-link underline underline-offset-4"
                  >
                    <span aria-hidden="true">{s.icon}</span>
                    {s.title}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                  <span className="text-sm">
                    {s.text[lang]}
                    {s.english && lang !== 'en' && <span className="text-muted-foreground"> ({t.library.english})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="gap-3" flat>
            <CardTitle>{t.library.inApp}</CardTitle>
            <ul className="m-0 grid list-none gap-2 p-0">
              {tools.map(({ href, icon: Icon, title }) => (
                <li key={href}>
                  <Link href={`/${lang}${href}`} className="inline-flex items-center gap-2 font-bold text-link underline underline-offset-4">
                    <Icon className="size-4" aria-hidden="true" />
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
