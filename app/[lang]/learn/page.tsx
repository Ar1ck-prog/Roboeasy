import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { LearnMap } from '@/components/learn/learn-map'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isLocale } from '@/lib/i18n'
import { getElectronicsText } from '@/lib/i18n/electronics'
import { getLearnAppText } from '@/lib/i18n/learn-app'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getLearnAppText(lang)
  return { title: `${t.map.title} — RoboEasy`, description: t.map.lead, alternates: { canonical: `/${lang}/learn` } }
}

export default async function LearnPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getElectronicsText(lang)
  const lessons = [
    { mission: 'led', title: t.missions.led.title },
    { mission: 'button', title: t.missions.button.title },
    { mission: 'dimmer', title: 'PWM' },
    { mission: 'radar', title: 'Serial' },
  ] as const

  return (
    <AppShell lang={lang}>
      <LearnMap lang={lang} app={getLearnAppText(lang)}>
        <section aria-labelledby="arduino-lessons" className="grid gap-4">
          <h2 id="arduino-lessons" className="m-0 text-2xl md:text-3xl">{t.hub.uno.name}</h2>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {lessons.map(({ mission, title }) => (
              <li key={mission}>
                <Card className="h-full gap-3">
                  <h3 id={`arduino-${mission}`} className="m-0 text-xl">{title}</h3>
                  <p className="m-0 text-muted-foreground">{t.missions[mission].story}</p>
                  <Link
                    id={`open-arduino-${mission}`}
                    aria-labelledby={`open-arduino-${mission} arduino-${mission}`}
                    className={buttonVariants({ size: 'sm', className: 'mt-auto self-start' })}
                    href={`/${lang}/electronics/lab?mission=${mission}&setup=example`}
                  >
                    {t.hub.labCta}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="esp32-lessons">
          <Card flat className="gap-2">
            <h2 id="esp32-lessons" className="m-0 text-2xl">{t.hub.esp32.name}</h2>
            <p className="m-0 text-muted-foreground">{t.hub.esp32.lessonsUnavailable}</p>
          </Card>
        </section>
      </LearnMap>
    </AppShell>
  )
}
