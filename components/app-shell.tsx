import type { ReactNode } from 'react'

import { AppTabBar } from '@/components/app-tab-bar'
import { AchievementWatcher } from '@/components/learn/achievement-watcher'
import { CloudSync } from '@/components/learn/use-cloud'
import { RobotPracticeNav, type RobotPracticeSection } from '@/components/robot-practice'
import { SiteHeader } from '@/components/site-header'
import { getDictionary } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/config'
import { getLearnText } from '@/lib/i18n/learn'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getPlayText } from '@/lib/i18n/play'

/** Header, page content and (on phones) the bottom tab bar, shared by all app sections. */
export function AppShell({ lang, children, className, practice }: {
  lang: Locale
  children: ReactNode
  className?: string
  practice?: RobotPracticeSection
}) {
  const nav = getLearnText(lang).nav
  return (
    <>
      <SiteHeader lang={lang} t={getDictionary(lang).nav} sections={nav} coinsLabel={getPlayText(lang).coinsLabel} variant="app" />
      <main id="main" className={className}>
        {practice && <RobotPracticeNav lang={lang} current={practice} />}
        {children}
      </main>
      <AppTabBar lang={lang} names={nav} />
      <AchievementWatcher lang={lang} app={getLearnAppText(lang)} />
      <CloudSync />
    </>
  )
}
