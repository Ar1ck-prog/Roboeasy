import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Blocks,
  BookOpen,
  Bot,
  Box,
  Brain,
  Check,
  CircleCheckBig,
  Code2,
  Cog,
  Compass,
  Flame,
  Gamepad2,
  Gauge,
  Gift,
  Hammer,
  Languages,
  Library,
  Lightbulb,
  Palette,
  Plus,
  Puzzle,
  Radar,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react'

import { HeroScene } from '@/components/landing/hero-scene'
import { SimDemo } from '@/components/landing/sim-demo'
import { Buddy } from '@/components/learn/buddy'
import { CoinIcon } from '@/components/learn/coin'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Locale } from '@/lib/i18n/config'
import type { LearnLandingCopy, TrackKey } from '@/lib/i18n/learn-landing'

const TRACKS: { key: TrackKey; icon: typeof Rocket; color: string; kit: 'none' | 'part' }[] = [
  { key: 'start', icon: Rocket, color: 'var(--blk-events)', kit: 'none' },
  { key: 'build', icon: Hammer, color: 'var(--blk-control)', kit: 'part' },
  { key: 'blocks', icon: Blocks, color: 'var(--blk-move)', kit: 'none' },
  { key: 'sensors', icon: Radar, color: 'var(--blk-sensors)', kit: 'none' },
  { key: 'navigation', icon: Compass, color: 'var(--blk-motor)', kit: 'none' },
  { key: 'python', icon: Code2, color: 'var(--blk-light)', kit: 'none' },
  { key: 'mechanisms', icon: Cog, color: 'var(--blk-sound)', kit: 'part' },
  { key: 'fll', icon: Trophy, color: 'var(--blk-events)', kit: 'part' },
]

const GAMES = [
  { icon: Route, color: 'var(--blk-move)', href: '/play/maze' },
  { icon: Puzzle, color: 'var(--blk-events)', href: '/play/puzzle' },
  { icon: Brain, color: 'var(--blk-sound)', href: '/play/memory' },
  { icon: Zap, color: 'var(--blk-control)', href: '/play/blitz' },
]

const STAT_ICONS = [Route, Gamepad2, Bot, Languages]

/** Sample robots for the buddy section (all are free or in the garage). */
const SAMPLE_ROBOTS = [
  { model: 'rover', color: 'sun', hat: 'cap', eyes: 'happy', sticker: 'star' },
  { model: 'tank', color: 'grape', hat: 'headphones', eyes: 'round', sticker: 'bolt' },
  { model: 'racer', color: 'brick', hat: 'none', eyes: 'visor', sticker: 'fire', wheels: 'racing' },
  { model: 'spider', color: 'mint', hat: 'crown', eyes: 'heart', sticker: 'none' },
]

function Head({ eyebrow, title, lead, center }: { eyebrow: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={center ? 'section-head mx-auto text-center [&_.lead]:mx-auto' : 'section-head'}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  )
}

/** The home page: self-paced robotics with a robot buddy, games and daily quests. */
export function LearnLanding({ lang, t }: { lang: Locale; t: LearnLandingCopy }) {
  const stepIcons = [BookOpen, Wrench, CircleCheckBig]
  const motivationIcons = [Flame, Star, Award]
  const buddyIcons = [Gauge, Palette, CoinIcon]
  const selfIcons = [Timer, Lightbulb, Library]

  return (
    <>
      {/* Hero */}
      <section className="container grid items-center gap-8 pt-6 pb-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:pt-12 md:pb-16">
        <div className="grid gap-5 md:gap-6">
          <Badge variant="outline" className="py-1.5">
            <Bot aria-hidden="true" />
            {t.hero.badge}
          </Badge>
          <h1 className="m-0 text-(length:--text-4xl) leading-[1.08]">
            {t.hero.title}{' '}
            <span className="mt-1 inline-block -rotate-2 rounded-(--radius-sm) border-(length:--stroke) border-outline bg-primary px-3 pb-1 text-primary-foreground shadow-(--shadow-hard-sm)">
              {t.hero.accent}
            </span>
          </h1>
          <p className="lead m-0">{t.hero.sub}</p>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants({ variant: 'primary', size: 'lg', className: 'max-sm:w-full' })} href={`/${lang}/path`}>
              {t.hero.cta}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className={buttonVariants({ size: 'lg', className: 'max-sm:w-full' })} href={`/${lang}/learn/placement`}>
              {t.hero.ctaTest}
            </Link>
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {t.hero.chips.map((c) => (
              <li key={c}>
                <Badge>
                  <Check aria-hidden="true" />
                  {c}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <HeroScene stats={t.hero.stats} />
      </section>

      {/* Numbers */}
      <section className="container pb-4">
        <ul className="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-(--radius-lg) border-(length:--stroke) border-outline bg-outline p-0 shadow-(--shadow-hard) lg:grid-cols-4">
          {t.stats.map((s, i) => {
            const Icon = STAT_ICONS[i]
            return (
              <li key={s.label} className="flex items-center gap-3 bg-card p-4 sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="grid">
                  <strong className="font-display text-3xl leading-none font-extrabold">{s.value}</strong>
                  <span className="text-sm leading-snug text-muted-foreground">{s.label}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* How */}
      <section className="section reveal" id="how">
        <div className="container">
          <Head eyebrow={t.how.eyebrow} title={t.how.title} />
          <div className="relative">
            {/* A marching dashed line between the steps (desktop) */}
            <div className="absolute top-[52px] right-[16%] left-[16%] hidden h-1 overflow-hidden md:block" aria-hidden="true">
              <div className="march h-full w-[calc(100%+24px)] bg-[repeating-linear-gradient(90deg,var(--outline)_0_12px,transparent_12px_24px)]" />
            </div>
            <ol className="relative m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-8">
              {t.how.steps.map((s, i) => {
                const Icon = stepIcons[i]
                return (
                  <li key={s.title}>
                    <Card className="h-full items-start transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none">
                      <span className="relative grid size-14 place-items-center rounded-(--radius-md) border-(length:--stroke) border-outline bg-primary text-primary-foreground shadow-(--shadow-press)">
                        <Icon className="size-7" aria-hidden="true" />
                        <span className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card font-display text-sm font-extrabold text-foreground">
                          {i + 1}
                        </span>
                      </span>
                      <h3 className="m-0 text-xl">{s.title}</h3>
                      <p className="m-0 text-muted-foreground">{s.text}</p>
                    </Card>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Virtual robot: a live demo */}
      <section className="section reveal" id="demo">
        <div className="container grid gap-8">
          <Head eyebrow={t.virtual.eyebrow} title={t.virtual.title} lead={t.virtual.text} />
          <Card className="mx-auto w-full max-w-4xl gap-5 bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[20px_20px]">
            <SimDemo t={t.virtual.demo} />
          </Card>
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
            {t.virtual.points.map((p) => (
              <li key={p} className="flex items-center gap-2 font-bold">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-(--ok-bg) text-success">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Robot buddy */}
      <section className="section reveal" id="buddy">
        <div className="container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Head eyebrow={t.buddy.eyebrow} title={t.buddy.title} lead={t.buddy.text} />
            <ul className="m-0 grid list-none gap-4 p-0">
              {t.buddy.points.map((pt, i) => {
                const Icon = buddyIcons[i]
                return (
                  <li key={pt.title} className="flex gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card shadow-(--shadow-press)">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="grid gap-0.5">
                      <strong className="font-display text-lg">{pt.title}</strong>
                      <span className="text-muted-foreground">{pt.text}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
          <Card className="gap-5">
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4" aria-hidden="true">
              {SAMPLE_ROBOTS.map((r, i) => (
                <li key={r.model} className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 p-2 pt-4">
                  <div className="float-y" style={{ ['--delay' as string]: `${i * 0.5}s` }}>
                    <Buddy {...r} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid gap-2">
              <p className="m-0 flex items-center gap-2 font-display text-lg font-extrabold">
                <Wrench className="size-5" aria-hidden="true" />
                {t.buddy.shop.title}
              </p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {t.buddy.shop.items.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-center justify-between gap-3 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card px-3 py-2"
                  >
                    <span className="font-bold">
                      {it.name} <span className="font-normal text-muted-foreground">· {it.effect}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-display font-extrabold">
                      <CoinIcon className="size-4" />
                      {it.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </section>

      {/* Games */}
      <section className="section reveal" id="games">
        <div className="container">
          <Head eyebrow={t.games.eyebrow} title={t.games.title} lead={t.games.lead} />
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {t.games.items.map((g, i) => {
              const { icon: Icon, color, href } = GAMES[i]
              return (
                <li key={g.title}>
                  <Link
                    href={`/${lang}${href}`}
                    className="group flex h-full flex-col gap-3 rounded-(--radius-lg) border-(length:--stroke) border-outline bg-card p-5 shadow-(--shadow-hard) transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none"
                  >
                    <span
                      className="grid size-14 place-items-center rounded-(--radius-md) border-(length:--stroke) border-outline text-(--blk-text) shadow-(--shadow-press) transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none"
                      style={{ background: color }}
                    >
                      <Icon className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="m-0 text-lg">{g.title}</h3>
                    <p className="m-0 text-sm text-muted-foreground">{g.text}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-extrabold text-link">
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <p className="m-0 flex items-center gap-2 font-bold">
              <Gift className="size-5 text-[#c98a00]" aria-hidden="true" />
              {t.games.quests}
            </p>
            <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/play`}>
              {t.games.title}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="section reveal" id="tracks">
        <div className="container">
          <Head eyebrow={t.tracks.eyebrow} title={t.tracks.title} lead={t.tracks.lead} />
          <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map(({ key, icon: Icon, color, kit }, i) => {
              const tr = t.tracks.items[key]
              return (
                <li key={key}>
                  <Card className="h-full gap-3 transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="grid size-12 place-items-center rounded-(--radius-sm) border-(length:--stroke) border-outline text-(--blk-text) shadow-(--shadow-press)"
                        style={{ background: color }}
                      >
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-sm font-semibold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="m-0 text-lg">{tr.title}</h3>
                    <p className="m-0 text-sm text-muted-foreground">{tr.text}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Badge>{tr.time}</Badge>
                      <Badge variant={kit === 'none' ? 'success' : 'warn'}>{kit === 'none' ? t.tracks.noKit : t.tracks.partKit}</Badge>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Motivation */}
      <section className="section reveal">
        <div className="container">
          <Head eyebrow={t.motivation.eyebrow} title={t.motivation.title} />
          <div className="grid gap-4 md:grid-cols-3">
            {t.motivation.items.map((m, i) => {
              const Icon = motivationIcons[i]
              return (
                <Card key={m.title} className="gap-3">
                  <span className="grid size-12 place-items-center rounded-full border-(length:--stroke) border-outline bg-primary text-primary-foreground shadow-(--shadow-press)">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <h3 className="m-0 text-xl">{m.title}</h3>
                  <p className="m-0 text-muted-foreground">{m.text}</p>
                </Card>
              )
            })}
          </div>
          <p className="mt-6 mb-0 flex items-center gap-2 font-bold text-muted-foreground">
            <Sparkles className="size-5 shrink-0" aria-hidden="true" />
            {t.motivation.note}
          </p>
        </div>
      </section>

      {/* Learning on your own */}
      <section className="section reveal" id="self">
        <div className="container">
          <Head eyebrow={t.self.eyebrow} title={t.self.title} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {t.self.items.map((it, i) => {
              const Icon = selfIcons[i]
              return (
                <Card key={it.title} className="gap-3">
                  <Icon className="size-7" aria-hidden="true" />
                  <h3 className="m-0 text-xl">{it.title}</h3>
                  <p className="m-0 text-muted-foreground">{it.text}</p>
                </Card>
              )
            })}
            <Card className="gap-3 bg-surface-2" flat>
              <h3 className="m-0 flex items-center gap-2 text-xl">
                <ShieldCheck className="size-6" aria-hidden="true" />
                {t.self.parents.title}
              </h3>
              <ul className="checklist">
                {t.self.parents.items.map((it) => (
                  <li key={it}>
                    <Check size={18} aria-hidden="true" />
                    {it}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Mentor */}
      <section className="section reveal">
        <div className="container grid items-center gap-10 md:grid-cols-2">
          <div>
            <Head eyebrow={t.mentor.eyebrow} title={t.mentor.title} lead={t.mentor.text} />
            <ol className="m-0 grid list-none gap-2 p-0">
              {t.mentor.levels.map((l, i) => (
                <li key={l} className="flex items-center gap-3 font-bold">
                  <span className="grid size-8 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card font-display">{i + 1}</span>
                  {l}
                </li>
              ))}
            </ol>
          </div>
          <Card className="gap-3">
            <p className="m-0 max-w-[85%] self-end rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 px-3 py-2 font-bold">
              {t.mentor.question}
            </p>
            <div className="flex max-w-[90%] gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                <Lightbulb className="size-5" aria-hidden="true" />
              </span>
              <p className="m-0 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card px-3 py-2">{t.mentor.answer}</p>
            </div>
            <Badge variant="outline" className="self-start">
              1 / 3 · {t.mentor.levels[0]}
            </Badge>
          </Card>
        </div>
      </section>

      {/* Competitions */}
      <section className="section reveal">
        <div className="container">
          <Card className="items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2">
              <p className="eyebrow m-0">{t.compete.eyebrow}</p>
              <h2 className="m-0 text-(length:--text-2xl)">{t.compete.title}</h2>
              <p className="m-0 max-w-[60ch] text-muted-foreground">{t.compete.text}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className={buttonVariants({ variant: 'primary', size: 'lg' })} href={`/${lang}/compete/simulator`}>
                <Box aria-hidden="true" />
                {t.compete.sim}
              </Link>
              <Link className={buttonVariants({ size: 'lg' })} href={`/${lang}/compete`}>
                <Trophy aria-hidden="true" />
                {t.compete.cta}
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container">
          <Head eyebrow="FAQ" title={t.faq.title} />
          <div className="faq">
            {t.faq.items.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Plus size={20} aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-band grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div>
              <h2>{t.final.title}</h2>
              <p>{t.final.text}</p>
              <Link className={buttonVariants({ size: 'lg' })} href={`/${lang}/path`}>
                {t.final.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="relative z-10 flex items-end justify-center gap-2" aria-hidden="true">
              {SAMPLE_ROBOTS.slice(0, 3).map((r, i) => (
                <div key={r.model} className={i === 1 ? 'w-32 md:w-36' : 'w-24 md:w-28'}>
                  <div className="float-y" style={{ ['--delay' as string]: `${i * 0.4}s` }}>
                    <Buddy {...r} />
                  </div>
                </div>
              ))}
            </div>
            <div className="cta-studs" aria-hidden="true" />
          </div>
        </div>
      </section>
    </>
  )
}
