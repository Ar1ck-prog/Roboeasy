import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { Lab } from '@/components/electronics/lab'
import { isLocale } from '@/lib/i18n'
import { getElectronicsText } from '@/lib/i18n/electronics'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getElectronicsText(lang)
  return { title: `${t.lab.title} — RoboEasy`, description: t.hub.labText, alternates: { canonical: `/${lang}/electronics/lab` } }
}

export default async function ElectronicsLabPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <Lab lang={lang} t={getElectronicsText(lang)} />
    </AppShell>
  )
}
