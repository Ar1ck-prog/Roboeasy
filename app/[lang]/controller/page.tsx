import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { RobotController } from '@/components/robot-controller'
import { isLocale } from '@/lib/i18n'
import { getControllerText } from '@/lib/i18n/controller'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getControllerText(lang).title} — RoboEasy`, alternates: { canonical: `/${lang}/controller` } }
}

export default async function ControllerPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <RobotController lang={lang} t={getControllerText(lang)} />
    </AppShell>
  )
}
