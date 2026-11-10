import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { SandboxTabs } from '@/components/studio/sandbox-tabs'
import { VideoDebug } from '@/components/studio/video-debug'
import { isLocale } from '@/lib/i18n'
import { getVideoText } from '@/lib/i18n/video'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getVideoText(lang).title} — RoboEasy`, alternates: { canonical: `/${lang}/sandbox/video` } }
}

export default async function VideoDebugPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <SandboxTabs lang={lang} current="video" />
      <VideoDebug lang={lang} t={getVideoText(lang)} />
    </AppShell>
  )
}
