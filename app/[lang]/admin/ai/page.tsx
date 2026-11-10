import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { AdminAiUsage } from '@/components/learn/admin-ai-usage'
import { isLocale } from '@/lib/i18n'

type Params = { params: Promise<{ lang: string }> }

export const metadata: Metadata = { title: 'AI usage — RoboEasy', robots: { index: false, follow: false } }

/** The numbers are protected by RLS (admins only); the page itself shows nothing without them. */
export default async function AdminAiPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <AdminAiUsage lang={lang} />
    </AppShell>
  )
}
