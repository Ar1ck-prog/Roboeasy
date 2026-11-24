import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppSplash } from '@/components/app-splash'
import { isLocale } from '@/lib/i18n'
import { getAppSplashText } from '@/lib/i18n/app-splash'

type Params = { params: Promise<{ lang: string }> }

export const metadata: Metadata = { title: 'RoboEasy', robots: { index: false } }

/** Start screen of the installed app (APK and desktop install open /app instead of the landing). */
export default async function AppStartPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return <AppSplash lang={lang} t={getAppSplashText(lang)} />
}
