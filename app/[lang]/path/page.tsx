import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { PathHome } from '@/components/learn/path-home'
import { getWedoText } from '@/lib/i18n/wedo'
import { isLocale } from '@/lib/i18n'
import { getLearnText } from '@/lib/i18n/learn'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getPlayText } from '@/lib/i18n/play'
import { CHALLENGES } from '@/lib/learn/challenge'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getLearnText(lang).nav.path} — RoboEasy`, alternates: { canonical: `/${lang}/path` } }
}

export default async function PathPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <PathHome lang={lang} app={getLearnAppText(lang)} play={getPlayText(lang)} wt={getWedoText(lang)} challengeTitles={CHALLENGES.map((c) => c.title[lang])} />
    </AppShell>
  )
}
