import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { FieldSim } from '@/components/fll/field-sim'
import { DEFAULT_SEASON_ID, SEASONS } from '@/lib/fll/seasons'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getSimulatorText } from '@/lib/i18n/simulator'

type Params = { params: Promise<{ lang: string }> }

/** The simulator's score sheet follows the BIOGLOW rules, so it shows that season. */
const SEASON_ID = 'bioglow-2026'

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getSimulatorText(lang)
  return { title: `${t.title} — RoboEasy`, description: t.lead, alternates: { canonical: `/${lang}/compete/simulator` } }
}

export default async function SimulatorPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = getDictionary(lang)
  const season = SEASONS[SEASON_ID] ?? SEASONS[DEFAULT_SEASON_ID]
  return (
    <AppShell lang={lang}>
      <FieldSim lang={lang} t={getSimulatorText(lang)} season={season} bgT={dict.fll.background} blocksT={dict.blocks} />
    </AppShell>
  )
}
