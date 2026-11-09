'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Gauge, LogIn, Rocket, ShieldCheck } from 'lucide-react'

import { Buddy } from '@/components/learn/buddy'
import { AccountCard } from '@/components/learn/account-card'
import { CLOUD_CONFIGURED } from '@/components/learn/use-cloud'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { PlayText } from '@/lib/i18n/play'
import { ROBOTS } from '@/lib/learn/shop'
import { AGE_RANGES, type AgeRange, DEFAULT_COSMETICS, type Profile, randomId } from '@/lib/learn/state'
import { setProfile } from '@/lib/learn/store'
import { deviceTimeZone } from '@/lib/learn/streak'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'
const GOALS = { l1: { kind: 'lessons', n: 1 }, l2: { kind: 'lessons', n: 2 }, m15: { kind: 'minutes', n: 15 } } as const satisfies Record<
  string,
  Profile['goal']
>

export function needsConsent(age: AgeRange | null) {
  return age !== null && age !== '16-plus'
}

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
  labels,
}: {
  name: string
  value: T | null
  options: readonly T[]
  onChange: (v: T) => void
  labels: Record<T, string>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o}
          className={cn(
            'flex min-h-12 cursor-pointer items-center rounded-(--radius-sm) border-(length:--stroke) border-outline bg-card px-4 font-bold shadow-(--shadow-press) has-focus-visible:ring-3 has-focus-visible:ring-(--focus)',
            value === o && 'bg-primary text-primary-foreground',
          )}
        >
          <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
          {labels[o]}
        </label>
      ))}
    </div>
  )
}

const FREE_ROBOTS = ROBOTS.filter((r) => !r.unlock)

/** The four free robots as big radio cards. */
function RobotPicker({ name, value, onChange, lang }: { name: string; value: string; onChange: (v: string) => void; lang: Lang }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {FREE_ROBOTS.map((r) => (
        <label
          key={r.id}
          className={cn(
            'grid cursor-pointer justify-items-center gap-1 rounded-(--radius-md) border-(length:--stroke) border-outline bg-card p-3 text-center shadow-(--shadow-press) has-focus-visible:ring-3 has-focus-visible:ring-(--focus)',
            value === r.id && 'bg-primary text-primary-foreground',
          )}
        >
          <input type="radio" name={name} value={r.id} checked={value === r.id} onChange={() => onChange(r.id)} className="sr-only" />
          <Buddy model={r.id} color={value === r.id ? 'sky' : 'sun'} className="w-24" />
          <span className="font-display font-extrabold">{r.title[lang]}</span>
          <span className="text-xs leading-snug opacity-80">{r.description?.[lang]}</span>
        </label>
      ))}
    </div>
  )
}

/** First visit: nickname, robot buddy, age range, daily goal and, under 16, a grown-up's consent. Then: from scratch or placement. */
export function Onboarding({ lang, app, play, onSaved, onDone }: { lang: Lang; app: LearnAppText; play: PlayText; onSaved: () => void; onDone: () => void }) {
  const id = useId()
  const t = app.onboarding
  const [nickname, setNickname] = useState('')
  const [model, setModel] = useState('rover')
  const [botName, setBotName] = useState('')
  const [age, setAge] = useState<AgeRange | null>(null)
  const [goal, setGoal] = useState<keyof typeof GOALS>('l1')
  const [consent, setConsent] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  // The "Sign in" links in the header and tab bar point here.
  useEffect(() => {
    if (window.location.hash === '#account') setSigningIn(true)
  }, [])

  const valid = nickname.trim().length >= 1 && age !== null && (!needsConsent(age) || consent)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || !age) return
    setProfile({
      nickname: nickname.trim().slice(0, 24),
      ageRange: age,
      timezone: deviceTimeZone(),
      goal: GOALS[goal],
      skipWeekends: false,
      reminders: { enabled: false, time: '18:00' },
      cosmetics: DEFAULT_COSMETICS,
      buddy: { model, name: botName.trim().slice(0, 16) },
      parentConsent: needsConsent(age) ? consent : false,
      createdAt: Date.now(),
      anonId: randomId('anon'),
      tour: false,
    })
    setSaved(true)
    onSaved()
  }

  if (saved)
    return (
      <div className="container grid max-w-3xl gap-6 py-10">
        <h1 className="m-0 text-4xl">{t.howStart}</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="gap-3">
            <Rocket className="size-8" aria-hidden="true" />
            <h2 className="m-0 text-2xl">{t.fromScratch}</h2>
            <p className="m-0 text-muted-foreground">{t.fromScratchText}</p>
            <Link className={buttonVariants({ variant: 'primary', className: 'mt-auto justify-self-start' })} href={`/${lang}/learn/start/start-01`}>
              {app.map.start}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Card>
          <Card className="gap-3">
            <Gauge className="size-8" aria-hidden="true" />
            <h2 className="m-0 text-2xl">{t.placement}</h2>
            <p className="m-0 text-muted-foreground">{t.placementText}</p>
            <Link className={buttonVariants({ variant: 'secondary', className: 'mt-auto justify-self-start' })} href={`/${lang}/learn/placement`}>
              {app.map.placementCta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Card>
        </div>
        <button type="button" className={buttonVariants({ variant: 'ghost', className: 'justify-self-start' })} onClick={onDone}>
          {app.placement.toPath}
        </button>
      </div>
    )

  if (signingIn)
    return (
      <div className="container grid max-w-2xl gap-6 py-10">
        <h1 className="m-0 text-4xl">{t.haveAccount}</h1>
        <AccountCard lang={lang} app={app} />
        <button type="button" className={buttonVariants({ variant: 'ghost', className: 'justify-self-start' })} onClick={() => setSigningIn(false)}>
          <ArrowLeft aria-hidden="true" />
          {t.backToNew}
        </button>
      </div>
    )

  return (
    <div className="container grid max-w-2xl gap-6 py-10">
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl">{t.title}</h1>
        <p className="m-0 text-lg text-muted-foreground">{t.lead}</p>
      </header>
      {CLOUD_CONFIGURED && (
        <Card flat className="flex-row flex-wrap items-center justify-between gap-3" data-testid="have-account">
          <div className="grid gap-0.5">
            <p className="m-0 font-display text-lg font-bold">{t.haveAccount}</p>
            <p className="m-0 text-sm text-muted-foreground">{t.haveAccountText}</p>
          </div>
          <button type="button" className={buttonVariants({ variant: 'secondary' })} onClick={() => setSigningIn(true)}>
            <LogIn aria-hidden="true" />
            {app.account.signIn}
          </button>
        </Card>
      )}
      <Card>
        <form className="grid gap-6" onSubmit={save}>
          <div className="grid gap-2">
            <label htmlFor={`${id}-nick`} className="font-display text-lg font-bold">
              {t.nickname}
            </label>
            <input
              id={`${id}-nick`}
              className="input max-w-sm"
              value={nickname}
              maxLength={24}
              autoComplete="off"
              placeholder={t.nicknamePlaceholder}
              aria-describedby={`${id}-nick-hint`}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
            <p id={`${id}-nick-hint`} className="m-0 text-sm text-muted-foreground">
              {t.nicknameHint}
            </p>
          </div>

          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1 p-0 font-display text-lg font-bold">{play.buddy.pickTitle}</legend>
            <p className="m-0 mb-1 text-sm text-muted-foreground">{play.buddy.pickLead}</p>
            <RobotPicker name={`${id}-robot`} value={model} onChange={setModel} lang={lang} />
            <p className="m-0 text-sm text-muted-foreground">{play.buddy.more}</p>
            <label htmlFor={`${id}-bot`} className="mt-2 font-bold">
              {play.buddy.name}
            </label>
            <input
              id={`${id}-bot`}
              className="input max-w-sm"
              value={botName}
              maxLength={16}
              autoComplete="off"
              placeholder={play.buddy.namePlaceholder}
              onChange={(e) => setBotName(e.target.value)}
            />
          </fieldset>

          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-display text-lg font-bold">{t.age}</legend>
            <Choice name={`${id}-age`} value={age} options={AGE_RANGES} onChange={setAge} labels={t.ages} />
          </fieldset>

          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-display text-lg font-bold">{t.goal}</legend>
            <Choice name={`${id}-goal`} value={goal} options={['l1', 'l2', 'm15'] as const} onChange={setGoal} labels={t.goals} />
            <p className="m-0 text-sm text-muted-foreground">{t.goalHint}</p>
          </fieldset>

          {needsConsent(age) && (
            <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke) border-outline bg-surface-2 p-4">
              <h2 className="m-0 flex items-center gap-2 text-xl">
                <ShieldCheck className="size-6" aria-hidden="true" />
                {t.consentTitle}
              </h2>
              <p className="m-0">{t.consentText}</p>
              <label className="flex cursor-pointer items-start gap-3 font-bold">
                <input type="checkbox" className="mt-1 size-5 accent-(--success)" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                {t.consentCheck}
              </label>
              <Link className="text-link underline underline-offset-4" href={`/${lang}/parents`}>
                {t.parentsLink}
              </Link>
            </div>
          )}

          <button type="submit" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'justify-self-start' })} disabled={!valid}>
            {t.start}
            <ArrowRight aria-hidden="true" />
          </button>
        </form>
      </Card>
    </div>
  )
}
