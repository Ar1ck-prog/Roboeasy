import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { UnoExplorer } from '@/components/electronics/uno-explorer'
import { isLocale } from '@/lib/i18n'
import { getElectronicsText } from '@/lib/i18n/electronics'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getElectronicsText(lang).uno
  return { title: `${t.title} — RoboEasy`, description: t.lead, alternates: { canonical: `/${lang}/electronics/uno` } }
}

export default async function UnoPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getElectronicsText(lang)
  return (
    <AppShell lang={lang}>
      <div className="container grid gap-5 py-6 md:py-8">
        <header className="grid gap-3">
          <Link href={`/${lang}/electronics`} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.lab.backToHub}
          </Link>
          <h1 className="m-0 text-3xl md:text-4xl">{t.uno.title}</h1>
          <p className="m-0 max-w-3xl text-muted-foreground">{t.uno.lead}</p>
        </header>
        <UnoExplorer t={t} />
      </div>
    </AppShell>
  )
}
