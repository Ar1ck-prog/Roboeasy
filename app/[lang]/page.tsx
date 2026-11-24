import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppTabBar } from '@/components/app-tab-bar'
import { AppRedirect } from '@/components/app-redirect'
import { LearnLanding } from '@/components/learn-landing'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getLearnText } from '@/lib/i18n/learn'
import { getLearnLanding } from '@/lib/i18n/learn-landing'
import { getPlayText } from '@/lib/i18n/play'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getLearnLanding(lang)
  return { title: `RoboEasy — ${t.hero.title} ${t.hero.accent}`, description: t.hero.sub, alternates: { canonical: `/${lang}` } }
}

/** Home: the learning platform's landing. */
export default async function HomePage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = getDictionary(lang)
  const nav = getLearnText(lang).nav
  return (
    <>
      <AppRedirect lang={lang} />
      <SiteHeader lang={lang} t={dict.nav} sections={nav} coinsLabel={getPlayText(lang).coinsLabel} variant="app" />
      <main id="main">
        <LearnLanding lang={lang} t={getLearnLanding(lang)} />
      </main>
      <SiteFooter lang={lang} t={dict.footer} />
      <AppTabBar lang={lang} names={nav} />
    </>
  )
}
