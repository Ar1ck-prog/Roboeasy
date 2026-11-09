import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { isLocale } from '@/lib/i18n'
import { getPilotText } from '@/lib/i18n/pilot'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getPilotText(lang).consent.title} — RoboEasy`, robots: { index: false } }
}

export default async function ConsentPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getPilotText(lang).consent
  return (
    <AppShell lang={lang}>
      <article className="container grid max-w-2xl gap-4 py-10">
        <p className="alert alert-warn m-0" role="note">
          {t.badge}
        </p>
        <h1 className="m-0 text-3xl">{t.title}</h1>
        <p className="m-0">{t.intro}</p>
        <h2 className="m-0 text-xl">{t.collectTitle}</h2>
        <ul className="m-0 grid gap-1 pl-5">
          {t.collect.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h2 className="m-0 text-xl">{t.whoTitle}</h2>
        <p className="m-0">{t.who}</p>
        <h2 className="m-0 text-xl">{t.rightsTitle}</h2>
        <p className="m-0">{t.rights}</p>
        <h2 className="m-0 text-xl">{t.signTitle}</h2>
        <p className="m-0 whitespace-pre-line">{t.sign}</p>
      </article>
    </AppShell>
  )
}
