import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { SandboxTabs } from '@/components/studio/sandbox-tabs'
import { Studio } from '@/components/studio/studio'
import { getDictionary, isLocale } from '@/lib/i18n'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getDictionary(lang)
  return {
    title: t.meta.studioTitle,
    alternates: { canonical: `/${lang}/sandbox` },
  }
}

export default async function WorkspacePage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getDictionary(lang)
  return (
    <AppShell lang={lang}>
      <SandboxTabs lang={lang} current="ai" />
      <Studio lang={lang} t={t.studio} labels={t.blocks} />
    </AppShell>
  )
}
