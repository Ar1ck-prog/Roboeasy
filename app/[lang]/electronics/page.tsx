import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { ElectronicsHub } from '@/components/electronics/electronics-hub'
import { isLocale } from '@/lib/i18n'
import { getElectronicsText } from '@/lib/i18n/electronics'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getElectronicsText(lang).hub
  return { title: `${t.title} — RoboEasy`, description: t.lead, alternates: { canonical: `/${lang}/electronics` } }
}

export default async function ElectronicsPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <ElectronicsHub lang={lang} t={getElectronicsText(lang)} />
    </AppShell>
  )
}
