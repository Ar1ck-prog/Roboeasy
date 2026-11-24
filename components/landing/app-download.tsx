import { Apple, Download, Laptop, Smartphone } from 'lucide-react'

import { InstallApp } from '@/components/landing/install-app'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import { APK, type AppDownloadText } from '@/lib/i18n/app-download'

/**
 * "Get the app": the Android package to download and the desktop install button.
 * The scenes are SVG in theme colours; motion is CSS (.app-* in globals.css).
 */
function PhoneScene() {
  return (
    <svg viewBox="0 0 220 150" className="block h-36 w-full" aria-hidden="true">
      <rect x="70" y="8" width="80" height="138" rx="14" fill="var(--outline)" />
      <rect x="76" y="20" width="68" height="114" rx="6" fill="var(--surface)" />
      {/* A download arrow lands on the screen, then the app icon appears. */}
      <g className="app-drop">
        <path d="M110 30 V58 M98 47 L110 59 L122 47" fill="none" stroke="var(--link)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="84" y="96" width="52" height="7" rx="3.5" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="1" />
      <rect x="84" y="96" width="52" height="7" rx="3.5" fill="var(--success)" className="app-progress" />
      <g className="app-icon">
        <rect x="94" y="62" width="32" height="28" rx="8" fill="var(--accent)" stroke="var(--outline)" strokeWidth="2.5" />
        <circle cx="104" cy="74" r="3" fill="var(--outline)" />
        <circle cx="116" cy="74" r="3" fill="var(--outline)" />
        <path d="M103 82 Q110 86 117 82" fill="none" stroke="var(--outline)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <text x="110" y="120" textAnchor="middle" fontSize="10" style={{ fill: 'var(--text)', fontWeight: 800 }}>
        RoboEasy
      </text>
      {/* Bluetooth waves to a hub next to the phone */}
      <g className="app-waves">
        <path d="M156 64 q8 10 0 20 M164 58 q12 16 0 32" fill="none" stroke="var(--link)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <rect x="176" y="56" width="34" height="40" rx="8" fill="#ffd23f" stroke="var(--outline)" strokeWidth="2.5" />
      <rect x="183" y="63" width="20" height="20" rx="3" fill="var(--outline)" />
      <circle cx="193" cy="90" r="3" fill="var(--outline)" />
    </svg>
  )
}

function LaptopScene() {
  return (
    <svg viewBox="0 0 220 150" className="block h-36 w-full" aria-hidden="true">
      <rect x="30" y="16" width="160" height="100" rx="10" fill="var(--outline)" />
      <rect x="38" y="24" width="144" height="84" rx="4" fill="var(--surface-2)" />
      <path d="M14 120 H206 L196 134 H24 Z" fill="var(--outline)" />
      {/* The app's own window opens over the desktop. */}
      <g className="app-window">
        <rect x="56" y="34" width="108" height="66" rx="6" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2" />
        <rect x="56" y="34" width="108" height="13" rx="6" fill="var(--accent)" stroke="var(--outline)" strokeWidth="2" />
        <circle cx="66" cy="40.5" r="2.5" fill="var(--outline)" />
        <text x="110" y="44" textAnchor="middle" fontSize="8" style={{ fill: 'var(--outline)', fontWeight: 800 }}>
          RoboEasy
        </text>
        <rect x="64" y="54" width="40" height="38" rx="4" fill="#fff" stroke="var(--border-strong)" strokeWidth="1" />
        <g className="app-bot">
          <rect x="72" y="76" width="14" height="11" rx="3" fill="var(--accent)" stroke="var(--outline)" strokeWidth="1.5" />
        </g>
        <rect x="110" y="56" width="46" height="6" rx="3" fill="var(--blk-motion, #e8442e)" />
        <rect x="114" y="66" width="38" height="6" rx="3" fill="var(--blk-control, #ff9f1c)" />
        <rect x="114" y="76" width="30" height="6" rx="3" fill="var(--blk-motion, #e8442e)" />
      </g>
      <g className="app-cursor">
        <path
          d="M150 92 L150 108 L154 104 L158 112 L161 110 L157 102 L163 102 Z"
          fill="#fff"
          stroke="var(--outline)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

export function AppDownload({ t }: { t: AppDownloadText }) {
  return (
    <section className="section reveal" id="app">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">
            <Download className="inline size-4 align-[-2px]" aria-hidden="true" /> {t.eyebrow}
          </p>
          <h2 className="section-title">{t.title}</h2>
          <p className="lead">{t.lead}</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Card className="gap-4">
            <div className="overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[18px_18px]">
              <PhoneScene />
            </div>
            <h3 className="m-0 flex items-center gap-2 text-xl">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                <Smartphone className="size-5" aria-hidden="true" />
              </span>
              {t.android.title}
            </h3>
            <p className="m-0 text-muted-foreground">{t.android.text}</p>
            <ol className="m-0 grid list-decimal gap-1.5 pl-5 text-sm marker:font-bold">
              {t.android.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <a
                className={buttonVariants({ variant: 'primary', size: 'lg', className: 'max-sm:w-full' })}
                href={APK.href}
                download="RoboEasy.apk"
                data-testid="apk-download"
              >
                <Download aria-hidden="true" />
                {t.android.button}
              </a>
              <span className="text-sm text-muted-foreground">{fill(t.android.meta, { v: APK.version, mb: APK.sizeMb })}</span>
            </div>
            <p className="m-0 text-xs text-muted-foreground">{t.android.note}</p>
          </Card>
          <Card className="gap-4">
            <div className="overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[18px_18px]">
              <LaptopScene />
            </div>
            <h3 className="m-0 flex items-center gap-2 text-xl">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
                <Laptop className="size-5" aria-hidden="true" />
              </span>
              {t.desktop.title}
            </h3>
            <p className="m-0 text-muted-foreground">{t.desktop.text}</p>
            <div className="mt-auto">
              <InstallApp t={t.desktop} />
            </div>
            <p className="m-0 flex items-start gap-2 border-t border-outline/20 pt-3 text-sm text-muted-foreground">
              <Apple className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground">{t.ios.title}:</strong> {t.ios.text}
              </span>
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}
