import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { LearnMap } from '@/components/learn/learn-map'
import { isLocale } from '@/lib/i18n'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getWedoText } from '@/lib/i18n/wedo'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getLearnAppText(lang)
  return { title: `${t.map.title} — RoboEasy`, description: t.map.lead, alternates: { canonical: `/${lang}/learn` } }
}

export default async function LearnPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <LearnMap lang={lang} app={getLearnAppText(lang)} wt={getWedoText(lang)} />
    </AppShell>
  )
}
