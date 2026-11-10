import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { TeacherHome } from '@/components/pilot/teacher-home'
import { isLocale } from '@/lib/i18n'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getPilotText } from '@/lib/i18n/pilot'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getPilotText(lang).teacher.title} — RoboEasy`, robots: { index: false } }
}

export default async function TeacherPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <TeacherHome lang={lang} t={getPilotText(lang)} app={getLearnAppText(lang)} />
    </AppShell>
  )
}
