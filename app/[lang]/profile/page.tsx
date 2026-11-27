import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { ProfileView } from '@/components/learn/profile-view'
import { isLocale } from '@/lib/i18n'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getWedoText } from '@/lib/i18n/wedo'
import { getPlayText } from '@/lib/i18n/play'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: `${getLearnAppText(lang).profile.title} — RoboEasy`, robots: { index: false } }
}

export default async function ProfilePage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <AppShell lang={lang}>
      <ProfileView lang={lang} app={getLearnAppText(lang)} play={getPlayText(lang)} wt={getWedoText(lang)} />
    </AppShell>
  )
}
