import Link from 'next/link'
import { ArrowRight, Box, Code2, Gamepad2, Mic } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Locale } from '@/lib/i18n/config'
import { getPythonWorkflowText } from '@/lib/i18n/python-workflow'
import { getRobotPracticeText } from '@/lib/i18n/robot-practice'

const TABS = [
  { key: 'sandbox', path: '/sandbox', Icon: Code2 },
  { key: 'voice', path: '/voice', Icon: Mic },
  { key: 'controller', path: '/controller', Icon: Gamepad2 },
  { key: 'simulator', path: '/compete/simulator', Icon: Box },
] as const

export type RobotPracticeSection = (typeof TABS)[number]['key']

export function RobotPractice({ lang }: { lang: Locale }) {
  const t = getRobotPracticeText(lang)
  const workflow = getPythonWorkflowText(lang)
  const choices = [
    { href: `/${lang}/sandbox?mode=manual`, title: workflow.manual, text: t.manual, Icon: Code2 },
    { href: `/${lang}/voice#voice-assignment`, title: workflow.dictate, text: t.voice, Icon: Mic },
    { href: `/${lang}/controller`, title: t.record, text: t.route, Icon: Gamepad2 },
  ]

  return (
    <section id="robot-practice" aria-labelledby="robot-practice-title" className="container scroll-mt-[calc(var(--header-h)+1rem)] py-6 md:py-9">
      <Card className="gap-5 bg-surface-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid max-w-2xl gap-2">
            <h2 id="robot-practice-title" className="m-0 text-(length:--text-2xl)">{t.title}</h2>
            <p className="m-0 text-muted-foreground">{t.intro}</p>
          </div>
          <a href={`/${lang}/compete/simulator`} className={buttonVariants({ size: 'sm' })}>
            <Box aria-hidden="true" />
            {t.tabs.simulator}
          </a>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
          {choices.map(({ href, title, text, Icon }) => (
            <li key={href} className="min-w-0">
              <Link href={href} prefetch={false} className="group flex h-full flex-col gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4 no-underline shadow-(--shadow-hard-sm) hover:bg-background">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="m-0 flex-1 text-base text-foreground">{title}</h3>
                  <ArrowRight className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                </div>
                <p className="m-0 text-sm text-muted-foreground">{text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

export function RobotPracticeNav({ lang, current }: { lang: Locale; current: RobotPracticeSection }) {
  const t = getRobotPracticeText(lang)

  return (
    <nav className="container pt-4" aria-label={t.title}>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:flex sm:flex-wrap">
        {TABS.map(({ key, path, Icon }) => {
          // BIOGLOW needs a document navigation to apply its isolation headers.
          const Tab = key === 'simulator' ? 'a' : Link
          const active = key === current
          return (
            <li key={key} className="min-w-0">
              <Tab href={`/${lang}${path}`} prefetch={key === 'simulator' ? undefined : false}
                aria-current={active ? 'page' : undefined}
                className={buttonVariants({ size: 'sm', variant: active ? 'primary' : 'secondary', className: 'w-full min-w-0 whitespace-normal px-2 text-center sm:px-3.5' })}>
                <Icon aria-hidden="true" />
                {t.tabs[key]}
              </Tab>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
