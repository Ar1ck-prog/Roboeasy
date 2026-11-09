import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { StudentClass } from '@/components/pilot/student-class'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getLearnText } from '@/lib/i18n/learn'
import { getPilotText } from '@/lib/i18n/pilot'
import { clientPilotTasks, clientQuestions } from '@/lib/pilot/content'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getPilotText(lang).join.title} — RoboEasy`, robots: { index: false } }
}

export default async function ClassPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <StudentClass lang={lang} t={getPilotText(lang)} learn={getLearnText(lang)} blocks={getDictionary(lang).blocks} questions={clientQuestions()} tasks={clientPilotTasks()} />
    </AppShell>
  )
}
