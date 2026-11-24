import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { VoiceControl } from '@/components/voice-control'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getLearnText } from '@/lib/i18n/learn'
import { getVoiceText } from '@/lib/i18n/voice'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getVoiceText(lang).title} — RoboEasy`, alternates: { canonical: `/${lang}/voice` } }
}

export default async function VoicePage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang} practice="voice">
      <VoiceControl lang={lang} t={getVoiceText(lang)} blocks={getDictionary(lang).blocks} sim={getLearnText(lang).sim} />
    </AppShell>
  )
}
