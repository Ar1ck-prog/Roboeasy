import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { DrawRoute } from '@/components/studio/draw-route'
import { SandboxTabs } from '@/components/studio/sandbox-tabs'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getDrawText } from '@/lib/i18n/draw'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getDrawText(lang).title} — RoboEasy`, alternates: { canonical: `/${lang}/sandbox/draw` } }
}

export default async function DrawRoutePage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <SandboxTabs lang={lang} current="draw" />
      <DrawRoute lang={lang} t={getDrawText(lang)} labels={getDictionary(lang).blocks} />
    </AppShell>
  )
}
