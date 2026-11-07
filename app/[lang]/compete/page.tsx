import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import Link from 'next/link'
import { ArrowRight, Box } from 'lucide-react'

import { FllPlanner } from '@/components/fll/planner'
import { AppShell } from '@/components/app-shell'
import { buttonVariants } from '@/components/ui/button'
import { DEFAULT_SEASON_ID, SEASON_LIST } from '@/lib/fll/seasons'
import { getDictionary, isLocale } from '@/lib/i18n'
import { getSimulatorText } from '@/lib/i18n/simulator'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getDictionary(lang)
  return {
    title: t.fll.metaTitle,
    description: t.fll.lead,
    alternates: { canonical: `/${lang}/compete` },
  }
}

export default async function FllPage({ params }: Params) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const t = getDictionary(lang)
  const sim = getSimulatorText(lang).promo
  return (
    <AppShell lang={lang}>
      {/* The field simulators (the BIOGLOW 3D copy and ours) at /compete/simulator. */}
      <div className="container pt-6">
        <Link
          href={`/${lang}/compete/simulator`}
          className="group flex flex-col gap-4 rounded-(--radius-lg) border-(length:--stroke) border-outline bg-[#101626] bg-[radial-gradient(rgba(255,255,255,.07)_1.6px,transparent_2px)] bg-size-[20px_20px] p-5 text-white shadow-(--shadow-hard) transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none sm:flex-row sm:items-center"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-(--radius-md) border-(length:--stroke) border-outline bg-primary text-primary-foreground shadow-(--shadow-press) transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none">
            <Box className="size-7" aria-hidden="true" />
          </span>
          <span className="grid flex-1 gap-1">
            <strong className="font-display text-xl">{sim.title}</strong>
            <span className="text-sm text-white/75">{sim.text}</span>
          </span>
          <span className={buttonVariants({ variant: 'primary', className: 'self-start sm:self-auto' })}>
            {sim.cta}
            <ArrowRight aria-hidden="true" />
          </span>
        </Link>
      </div>
      <FllPlanner
        lang={lang}
        seasons={SEASON_LIST}
        defaultSeasonId={DEFAULT_SEASON_ID}
        t={t.fll}
        robotT={t.studio.robot}
        labels={t.blocks}
        formatT={{ blocks: t.studio.blocks, python: t.studio.python }}
      />
    </AppShell>
  )
}
