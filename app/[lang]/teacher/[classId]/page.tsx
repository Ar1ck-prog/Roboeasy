import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { ClassReportView } from '@/components/pilot/class-report'
import { isLocale } from '@/lib/i18n'
import { getPilotText } from '@/lib/i18n/pilot'
import { TASK_COUNT } from '@/lib/pilot/content'

type Params = { params: Promise<{ lang: string; classId: string }> }

export const metadata: Metadata = { title: 'RoboEasy', robots: { index: false, follow: false } }

/** Row-level security decides what comes back: another teacher's class looks like no class at all. */
export default async function ClassReportPage({ params }: Params) {
  const { lang, classId } = await params
  if (!isLocale(lang) || !/^[0-9a-f-]{36}$/.test(classId)) notFound()
  return (
    <AppShell lang={lang}>
      <ClassReportView lang={lang} t={getPilotText(lang)} classId={classId} taskCount={TASK_COUNT} />
    </AppShell>
  )
}
