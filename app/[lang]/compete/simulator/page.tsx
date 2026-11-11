import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { FieldSimulator } from '@/components/fll/field-simulator'
import { isLocale } from '@/lib/i18n'
import { getSimulatorText } from '@/lib/i18n/simulator'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getSimulatorText(lang).three
  return { title: `${t.title} — RoboEasy`, description: t.lead, alternates: { canonical: `/${lang}/compete/simulator` } }
}

export default async function SimulatorPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getSimulatorText(lang)
  return (
    <AppShell lang={lang}>
      <div className="container py-6 md:py-8">
        <FieldSimulator lang={lang} t={t.three} toPlanner={t.toPlanner} />
      </div>
    </AppShell>
  )
}
