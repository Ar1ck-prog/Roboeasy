import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { BoardPage } from '@/components/electronics/board-page'
import { isLocale } from '@/lib/i18n'
import { getElectronicsText } from '@/lib/i18n/electronics'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getElectronicsText(lang).esp32
  return { title: `${t.title} — RoboEasy`, description: t.lead, alternates: { canonical: `/${lang}/electronics/esp32` } }
}

export default async function Esp32Page({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <BoardPage lang={lang} t={getElectronicsText(lang)} board="esp32" />
    </AppShell>
  )
}
