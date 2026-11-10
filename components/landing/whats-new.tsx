import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Bluetooth, BookOpenCheck, Brain, Mic, PenLine, Smartphone, Sparkles, Activity, Users, Video } from 'lucide-react'

import { Buddy } from '@/components/learn/buddy'
import { Card } from '@/components/ui/card'
import type { Locale } from '@/lib/i18n/config'
import type { LandingNewsCopy } from '@/lib/i18n/landing-news'

/**
 * "What's new in 2.0": one card per new feature, each with a small live scene.
 * Scenes are SVG in theme colours; their motion is CSS (.wn-* in globals.css)
 * and only runs when the visitor has not asked for less motion. Without it,
 * every scene shows its finished state.
 */

const BUDDIES = [
  { model: 'android', color: 'sky', hat: 'none', eyes: 'happy', sticker: 'bolt' },
  { model: 'drone', color: 'mint', hat: 'headphones', eyes: 'round', sticker: 'star' },
]

const TEXT = { fill: 'var(--text)', fontFamily: 'var(--font-body), sans-serif', fontWeight: 800 } as const
const MUTED = { fill: 'var(--text-2)', fontFamily: 'var(--font-body), sans-serif', fontWeight: 700 } as const

function Scene({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="h-40 overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[18px_18px]">
      <svg viewBox="0 0 300 140" className="block h-full w-full" role="img" aria-label={label}>
        {children}
      </svg>
    </div>
  )
}

/** Splits a caption into two lines near its middle, at a space. */
function twoLines(text: string): [string, string] {
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index ?? 0)
  if (!spaces.length) return [text, '']
  const cut = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best))
  return [text.slice(0, cut), text.slice(cut + 1)]
}

function Caption({ x, y, text, size, style, oneLineUpTo }: { x: number; y: number; text: string; size: number; style: object; oneLineUpTo: number }) {
  if (text.length <= oneLineUpTo)
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={size} style={style}>
        {text}
      </text>
    )
  const [first, second] = twoLines(text)
  return (
    <text x={x} y={y - size * 0.6} textAnchor="middle" fontSize={size} style={style}>
      <tspan x={x}>{first}</tspan>
      <tspan x={x} dy={size * 1.25}>
        {second}
      </tspan>
    </text>
  )
}

/** A small robot seen from above, nose to the right. */
function Bot({ fill = 'var(--accent)' }: { fill?: string }) {
  return (
    <g>
      <rect x="-13" y="-10" width="26" height="20" rx="5" fill={fill} stroke="var(--outline)" strokeWidth="2.5" />
      <path d="M13 -5 L19 0 L13 5 Z" fill="var(--outline)" />
    </g>
  )
}

function GeneratorScene({ t }: { t: LandingNewsCopy['gen'] }) {
  return (
    <Scene label={t.title}>
      <g className="wn-pop">
        <rect x="14" y="44" width="118" height="48" rx="12" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2.5" />
        <Caption x={73} y={73} text={t.bubble} size={12} style={TEXT} oneLineUpTo={16} />
      </g>
      <path d="M140 68 H168" stroke="var(--outline)" strokeWidth="3" strokeLinecap="round" />
      <path d="M164 62 L172 68 L164 74 Z" fill="var(--outline)" />
      <circle cx="226" cy="70" r="44" fill="none" stroke="var(--border-strong)" strokeWidth="3" strokeDasharray="6 7" />
      <circle cx="226" cy="70" r="44" fill="none" stroke="var(--link)" strokeWidth="4" pathLength={100} className="wn-trace" strokeLinecap="round" />
      {/* The robot sits on top of the circle; the whole group turns around its centre. */}
      <g className="wn-orbit" style={{ transformOrigin: '226px 70px' }}>
        <g transform="translate(226 26)">
          <Bot />
        </g>
      </g>
    </Scene>
  )
}

function DrawScene({ t }: { t: LandingNewsCopy['draw'] }) {
  return (
    <Scene label={t.title}>
      <path
        d="M24 112 C40 96 52 60 70 58 S96 92 118 84 S140 34 168 30 S210 70 236 64 S266 30 280 24"
        fill="none"
        stroke="var(--text-3)"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        className="wn-draw"
        opacity="0.6"
      />
      <path
        d="M24 112 L70 58 L118 84 L168 30 L236 64 L280 24"
        fill="none"
        stroke="var(--link)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={100}
        className="wn-draw-late"
      />
      {[
        [70, 58],
        [118, 84],
        [168, 30],
        [236, 64],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="5" fill="var(--accent)" stroke="var(--outline)" strokeWidth="2" className="wn-dot" />
      ))}
      <g transform="translate(24 112) rotate(-48)">
        <Bot />
      </g>
    </Scene>
  )
}

/** A wavy reading, drawn twice so that scrolling it left loops without a seam. */
const WAVE = Array.from({ length: 41 }, (_, i) => `${i * 15},${70 - Math.sin(i * 0.7) * 22 - Math.sin(i * 1.9) * 8}`).join(' ')

function TelemetryScene({ t }: { t: LandingNewsCopy['telemetry'] }) {
  return (
    <Scene label={t.title}>
      <defs>
        <clipPath id="wn-chart">
          <rect x="16" y="24" width="268" height="86" rx="6" />
        </clipPath>
      </defs>
      <rect x="16" y="24" width="268" height="86" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1" />
      {[46, 68, 90].map((y) => (
        <line key={y} x1="16" x2="284" y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
      ))}
      <g clipPath="url(#wn-chart)">
        <g className="wn-scroll">
          <polyline points={WAVE} fill="none" stroke="var(--link)" strokeWidth="2.5" strokeLinejoin="round" transform="translate(16 0)" />
        </g>
      </g>
      <text x="22" y="18" fontSize="11" style={MUTED}>
        {t.label}
      </text>
      <circle cx="270" cy="15" r="5" fill="#e5484d" className="wn-blink" />
      <text x="262" y="19" textAnchor="end" fontSize="11" style={TEXT}>
        LIVE
      </text>
      {['#e5484d', '#e5484d', '#ffffff', '#1b1f2a', '#4a86f7', '#2bb673'].map((c, i) => (
        <rect key={i} x={16 + i * 22} y="118" width="20" height="12" rx="3" fill={c} stroke="var(--outline)" strokeWidth="1.5" />
      ))}
    </Scene>
  )
}

function VideoScene({ t }: { t: LandingNewsCopy['video'] }) {
  return (
    <Scene label={t.title}>
      <rect x="20" y="14" width="66" height="112" rx="12" fill="var(--outline)" />
      <rect x="26" y="24" width="54" height="86" rx="6" fill="var(--surface)" />
      <g transform="translate(53 76) rotate(-70)">
        <Bot />
      </g>
      <path d="M53 98 A24 24 0 0 0 33 70" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="4 4" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={102 + i * 30}
          y="22"
          width="24"
          height="18"
          rx="3"
          fill="var(--surface)"
          stroke="var(--outline)"
          strokeWidth="2"
          className="wn-frame"
          style={{ animationDelay: `${i * 0.5}s` }}
        />
      ))}
      <g className="wn-pop" style={{ animationDelay: '0.8s' }}>
        <rect x="100" y="56" width="186" height="52" rx="12" fill="var(--accent)" stroke="var(--outline)" strokeWidth="2.5" />
        <Caption x={193} y={86} text={t.bubble} size={11} style={{ ...TEXT, fill: 'var(--on-accent)' }} oneLineUpTo={26} />
      </g>
    </Scene>
  )
}

function Hand({ open }: { open: boolean }) {
  return (
    <g>
      <rect x="-14" y="-4" width="28" height="26" rx="9" fill="#f5c9a0" stroke="var(--outline)" strokeWidth="2.5" />
      {[-10, -3, 4, 11].map((fx) => (
        <rect key={fx} x={fx - 3} y={open ? -24 : -9} width="6" height={open ? 22 : 8} rx="3" fill="#f5c9a0" stroke="var(--outline)" strokeWidth="2" />
      ))}
    </g>
  )
}

function AiScene({ t }: { t: LandingNewsCopy['ai'] }) {
  return (
    <Scene label={t.title}>
      <g transform="translate(52 70)">
        <g className="wn-swap-a">
          <Hand open />
          <text y="44" textAnchor="middle" fontSize="12" style={TEXT}>
            {t.go}
          </text>
        </g>
        <g className="wn-swap-b">
          <Hand open={false} />
          <text y="44" textAnchor="middle" fontSize="12" style={TEXT}>
            {t.stop}
          </text>
        </g>
      </g>
      <path d="M92 70 H120" stroke="var(--outline)" strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(146 70)">
        <path
          d="M-18 4 Q-24 -10 -10 -16 Q-4 -26 6 -20 Q18 -22 20 -9 Q28 0 18 12 Q10 22 0 16 Q-14 22 -18 4 Z"
          fill="#c9a2f5"
          stroke="var(--outline)"
          strokeWidth="2.5"
          className="wn-think"
        />
      </g>
      <path d="M176 70 H200" stroke="var(--outline)" strokeWidth="3" strokeLinecap="round" />
      <line x1="210" x2="290" y1="98" y2="98" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="5 5" />
      <g transform="translate(222 84)">
        <g className="wn-drive">
          <Bot />
        </g>
      </g>
    </Scene>
  )
}

function TeacherScene({ t }: { t: LandingNewsCopy['teacher'] }) {
  const bars = [
    { label: t.before, value: 47, color: 'var(--chart-before)' },
    { label: t.after, value: 73, color: 'var(--chart-after)' },
  ]
  return (
    <Scene label={`${t.chart}: ${t.before} 47%, ${t.after} 73%`}>
      <text x="16" y="22" fontSize="11" style={MUTED}>
        {t.chart} · {t.sample}
      </text>
      {bars.map((b, i) => (
        <g key={b.label}>
          <text x="16" y={52 + i * 34} fontSize="12" style={TEXT}>
            {b.label}
          </text>
          <rect x="70" y={38 + i * 34} width="190" height="20" rx="4" fill="var(--surface)" />
          <rect x="70" y={38 + i * 34} width={1.9 * b.value} height="20" rx="4" fill={b.color} className="wn-bar" style={{ animationDelay: `${i * 0.3}s` }} />
          <text x={76 + 1.9 * b.value} y={53 + i * 34} fontSize="12" style={TEXT}>
            {b.value}%
          </text>
        </g>
      ))}
      {[
        [40, 72],
        [55, 90],
        [35, 75],
        [60, 80],
        [25, 65],
      ].map(([a, b], i) => (
        <g key={i} transform={`translate(${70 + i * 40} 118)`}>
          <line x1="0" x2="22" y1="0" y2="0" stroke="var(--border-strong)" strokeWidth="2" />
          <circle cx={(a / 100) * 22} r="3.5" fill="var(--chart-before)" />
          <circle cx={(b / 100) * 22} r="3.5" fill="var(--chart-after)" />
        </g>
      ))}
    </Scene>
  )
}

function FeatureCard({
  icon,
  title,
  text,
  cta,
  href,
  scene,
  wide = false,
}: {
  icon: ReactNode
  title: string
  text: string
  cta: string
  href: string
  scene: ReactNode
  wide?: boolean
}) {
  return (
    <li className={wide ? 'lg:col-span-2' : undefined}>
      <Card className="group h-full gap-4 transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none">
        {scene}
        <h3 className="m-0 flex items-center gap-2 text-xl">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
            {icon}
          </span>
          {title}
        </h3>
        <p className="m-0 text-muted-foreground">{text}</p>
        <Link href={href} className="mt-auto inline-flex items-center gap-1 font-extrabold text-link after:absolute after:inset-0">
          {cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </Card>
    </li>
  )
}

export function WhatsNew({ lang, t }: { lang: Locale; t: LandingNewsCopy }) {
  const extrasIcons = [Bluetooth, Mic, Smartphone, BookOpenCheck]
  return (
    <section className="section reveal" id="new">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">
            <Sparkles className="inline size-4 align-[-2px]" aria-hidden="true" /> {t.eyebrow}
          </p>
          <h2 className="section-title">{t.title}</h2>
          <p className="lead">{t.lead}</p>
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3 [&>li>*]:relative">
          <FeatureCard
            wide
            icon={<Sparkles className="size-5" aria-hidden="true" />}
            {...t.gen}
            href={`/${lang}/sandbox`}
            scene={<GeneratorScene t={t.gen} />}
          />
          <FeatureCard icon={<PenLine className="size-5" aria-hidden="true" />} {...t.draw} href={`/${lang}/sandbox/draw`} scene={<DrawScene t={t.draw} />} />
          <FeatureCard
            icon={<Activity className="size-5" aria-hidden="true" />}
            {...t.telemetry}
            href={`/${lang}/sandbox`}
            scene={<TelemetryScene t={t.telemetry} />}
          />
          <FeatureCard icon={<Video className="size-5" aria-hidden="true" />} {...t.video} href={`/${lang}/sandbox/video`} scene={<VideoScene t={t.video} />} />
          <FeatureCard icon={<Brain className="size-5" aria-hidden="true" />} {...t.ai} href={`/${lang}/learn/ai-basics`} scene={<AiScene t={t.ai} />} />
          <FeatureCard
            wide
            icon={<Users className="size-5" aria-hidden="true" />}
            {...t.teacher}
            href={`/${lang}/teacher`}
            scene={<TeacherScene t={t.teacher} />}
          />
          {/* Full width on tablets, where it would otherwise sit alone in half a row. */}
          <li className="md:col-span-2 lg:col-span-1">
            <Card className="h-full gap-3 bg-primary text-primary-foreground">
              <h3 className="m-0 text-xl">{t.extras.title}</h3>
              <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 lg:grid-cols-1">
                {t.extras.items.map((item, i) => {
                  const Icon = extrasIcons[i]
                  return (
                    <li key={item} className="flex items-center gap-3 font-bold">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card text-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-auto flex items-end justify-center gap-2 pt-2" aria-hidden="true">
                {BUDDIES.map((b, i) => (
                  <div key={b.model} className={i === 1 ? 'w-24 lg:w-16' : 'w-20 lg:w-14'}>
                    <div className="float-y" style={{ ['--delay' as string]: `${i * 0.4}s` }}>
                      <Buddy {...b} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </li>
        </ul>
      </div>
    </section>
  )
}
