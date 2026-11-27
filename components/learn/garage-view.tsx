'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Cpu, Gauge, Lock, Magnet, Radar, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Buddy, type BuddyLooks } from '@/components/learn/buddy'
import { CoinAmount, CoinIcon } from '@/components/learn/coin'
import { ProgressBar } from '@/components/learn/learn-map'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { PlayText } from '@/lib/i18n/play'
import { ACHIEVEMENTS, recordedAchievements } from '@/lib/learn/achievements'
import {
  BUFFS,
  LOOKS,
  ROBOTS,
  SENSOR_BLITZ_SECONDS,
  type ShopItem,
  UPGRADES,
  type UpgradeLine,
  canBuyTier,
  isUnlocked,
  itemKey,
  priceOf,
} from '@/lib/learn/shop'
import { refreshProgress } from '@/components/learn/use-cloud'
import { ledger } from '@/lib/learn/economy'
import { getLearnState, record, updateProfile, useHydrated } from '@/lib/learn/store'
import { useProgress } from '@/lib/learn/use-progress'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'
type Tab = 'upgrades' | 'robots' | 'looks'
type LookKind = 'color' | 'hat' | 'eyes' | 'sticker' | 'wheels'

const LINE_ICONS: Record<UpgradeLine, typeof Gauge> = { motor: Gauge, cpu: Cpu, battery: BatteryCharging, sensor: Radar, magnet: Magnet }
const LINES: UpgradeLine[] = ['motor', 'cpu', 'battery', 'sensor', 'magnet']
const LOOK_KINDS: LookKind[] = ['color', 'hat', 'eyes', 'sticker', 'wheels']

/** Text for each active buff. */
export function buffTexts(t: PlayText, tiers: Record<UpgradeLine, number>): string[] {
  const out: string[] = []
  if (tiers.motor) out.push(fill(t.garage.buff.motor, { n: Math.round(BUFFS.motor[tiers.motor] * 100) }))
  if (tiers.cpu) out.push(fill(t.garage.buff.cpu, { n: Math.round(BUFFS.cpu[tiers.cpu] * 100) }))
  if (tiers.battery) out.push(fill(t.garage.buff.battery, { n: 2 + BUFFS.battery[tiers.battery] }))
  if (tiers.sensor) out.push(fill(t.garage.buff.sensor, { s: SENSOR_BLITZ_SECONDS[tiers.sensor] }))
  if (tiers.magnet) out.push(t.garage.buff.magnet)
  return out
}

export function GarageView({ lang, app, t }: { lang: Lang; app: LearnAppText; t: PlayText }) {
  const hydrated = useHydrated()
  const p = useProgress()
  const id = useId()
  const [tab, setTab] = useState<Tab>('upgrades')
  const [preview, setPreview] = useState<Partial<BuddyLooks> | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)
  const [botName, setBotName] = useState('')
  const profile = p.state.profile

  useEffect(() => {
    if (profile) setBotName(profile.buddy.name)
    // Only when the profile first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(profile)])

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(null), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  if (!hydrated) return <Skeleton className="container my-10 h-[32rem]" />
  if (!profile)
    return (
      <div className="container grid max-w-xl justify-items-center gap-4 py-16 text-center">
        <Buddy className="w-40" animate />
        <h1 className="m-0 text-4xl">{t.garage.title}</h1>
        <p className="m-0 text-lg text-muted-foreground">{t.garage.noProfile}</p>
        <Link className={buttonVariants({ variant: 'primary', size: 'lg' })} href={`/${lang}/path`}>
          {t.garage.toPath}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    )

  const achievements = new Set(recordedAchievements(p.state).keys())
  const owned = p.ledger.owned
  const looks = { ...p.looks, ...preview }
  const robot = ROBOTS.find((r) => r.id === profile.buddy.model) ?? ROBOTS[0]

  const lockText = (i: ShopItem): string | null => {
    if (!i.unlock || 'price' in i.unlock) return null
    if ('level' in i.unlock) return fill(t.garage.lockedLevel, { n: i.unlock.level + 1 })
    const ach = i.unlock.achievement
    return fill(t.garage.lockedAchievement, { name: ACHIEVEMENTS.find((a) => a.id === ach)?.title[lang] ?? '' })
  }

  const buy = (i: ShopItem) => {
    const key = itemKey(i)
    const price = priceOf(i) ?? 0
    if (buying || p.coins < price || owned.has(key) || !canBuyTier(i, owned)) return
    if (confirming !== key) return setConfirming(key)
    setConfirming(null)
    setBuying(true)
    // Coins may have been spent on another device: check the balance against the server first.
    void refreshProgress().then(() => {
      setBuying(false)
      const fresh = ledger(getLearnState())
      if (fresh.owned.has(key)) return
      if (fresh.coins < price) {
        toast.error(t.garage.spentElsewhere)
        return
      }
      record([{ kind: 'purchase', item: key }])
      toast.success(fill(t.garage.bought, { name: i.title[lang] }))
      if (i.kind === 'model') choose(i.id)
      else if (i.kind !== 'upgrade') equip(i.kind as LookKind, i.id)
    })
  }
  const equip = (kind: LookKind, value: string) => {
    updateProfile({ cosmetics: { ...profile.cosmetics, [kind]: value } })
    setPreview(null)
  }
  const choose = (model: string) => {
    updateProfile({ buddy: { ...profile.buddy, model } })
    setPreview(null)
  }

  /** The buy button of a priced item, with a second tap to confirm. */
  const buyButton = (item: ShopItem) => {
    const price = priceOf(item) ?? 0
    const key = itemKey(item)
    const short = price - p.coins
    const blocked = !canBuyTier(item, owned)
    return (
      <button
        type="button"
        className={buttonVariants({ size: 'sm', variant: confirming === key ? 'primary' : 'secondary', className: 'gap-1.5' })}
        disabled={short > 0 || blocked || buying}
        onClick={() => buy(item)}
        title={blocked ? t.garage.needTier : short > 0 ? fill(t.garage.notEnough, { n: short }) : undefined}
      >
        {confirming === key ? (
          t.garage.confirm
        ) : (
          <>
            {t.garage.buy} <CoinIcon className="size-4" /> {price}
          </>
        )}
      </button>
    )
  }

  const buffs = buffTexts(t, p.ledger.tiers)

  return (
    <div className="container grid gap-6 py-8 md:py-12">
      {/* The robot */}
      <section className="grid gap-6 rounded-(--radius-xl) border-(length:--stroke) border-outline bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[20px_20px] p-5 shadow-(--shadow-hard) md:grid-cols-[minmax(0,18rem)_1fr] md:p-8">
        <div className="grid justify-items-center gap-2">
          <Buddy {...looks} tiers={p.ledger.tiers} className="w-56 max-w-full" animate title={profile.buddy.name || robot.title[lang]} />
          {preview && (
            <button type="button" className={buttonVariants({ size: 'sm', variant: 'ghost' })} onClick={() => setPreview(null)}>
              ✕ {t.garage.preview}
            </button>
          )}
        </div>
        <div className="grid content-center gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 text-4xl">{t.garage.title}</h1>
            <span
              className="flex items-center gap-2 rounded-full border-(length:--stroke) border-outline bg-card px-4 py-1.5 text-2xl shadow-(--shadow-press)"
              data-testid="coins"
            >
              <CoinAmount n={p.coins} />
              <span className="sr-only">{t.coinsLabel}</span>
            </span>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              updateProfile({ buddy: { ...profile.buddy, name: botName.trim().slice(0, 16) } })
              toast.success(t.garage.renamed)
            }}
          >
            <label className="grid gap-1 font-bold" htmlFor={`${id}-name`}>
              {t.buddy.name}
              <input
                id={`${id}-name`}
                className="input w-56"
                value={botName}
                maxLength={16}
                placeholder={robot.title[lang]}
                onChange={(e) => setBotName(e.target.value)}
              />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              {t.garage.rename}
            </button>
          </form>
          <div className="grid max-w-md gap-1">
            <p className="m-0 font-bold">
              {fill(app.path.level, { n: p.level.index + 1, title: p.level.title[lang] })} · {p.xp} XP
            </p>
            <ProgressBar value={p.level.progress} label={app.path.level} />
            <p className="m-0 text-sm text-muted-foreground">{t.garage.level}</p>
          </div>
          <div className="grid gap-1">
            <p className="m-0 flex items-center gap-2 font-extrabold">
              <Sparkles className="size-5 text-[#c98a00]" aria-hidden="true" />
              {t.garage.buffs}
            </p>
            {buffs.length ? (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {buffs.map((b) => (
                  <li key={b} className="rounded-full border-(length:--stroke-thin) border-outline bg-(--ok-bg) px-3 py-1 text-sm font-bold">
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">{t.garage.noBuffs}</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.garage.title}>
            {(['upgrades', 'robots', 'looks'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                className={buttonVariants({ size: 'sm', variant: tab === k ? 'primary' : 'secondary' })}
                onClick={() => setTab(k)}
              >
                {t.garage.tabs[k]}
              </button>
            ))}
          </div>

          {tab === 'upgrades' && (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {LINES.map((line) => {
                const tiers = UPGRADES.filter((u) => u.upgrade?.line === line)
                const have = p.ledger.tiers[line]
                const next = tiers.find((u) => (u.upgrade?.tier ?? 0) === have + 1)
                const current = tiers.find((u) => (u.upgrade?.tier ?? 0) === have)
                const Icon = LINE_ICONS[line]
                return (
                  <li key={line}>
                    <Card className="h-full gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-(--radius-sm) border-(length:--stroke) border-outline bg-primary text-primary-foreground shadow-(--shadow-press)">
                          <Icon className="size-6" aria-hidden="true" />
                        </span>
                        <div className="grid">
                          <h2 className="m-0 text-xl">{t.garage.lines[line]}</h2>
                          <span className="text-sm font-bold text-muted-foreground">{fill(t.garage.tier, { n: have, max: tiers.length })}</span>
                        </div>
                      </div>
                      <div className="flex gap-1" aria-hidden="true">
                        {tiers.map((u) => (
                          <span
                            key={u.id}
                            className={cn(
                              'h-2.5 flex-1 rounded-full border-(length:--stroke-thin) border-outline',
                              (u.upgrade?.tier ?? 0) <= have ? 'bg-success' : 'bg-surface-2',
                            )}
                          />
                        ))}
                      </div>
                      {current && <p className="m-0 text-sm">✓ {current.description?.[lang]}</p>}
                      {next ? (
                        <div className="mt-auto grid gap-2">
                          <p className="m-0 text-sm text-muted-foreground">
                            <strong className="text-foreground">{next.title[lang]}:</strong> {next.description?.[lang]}
                          </p>
                          <div>{buyButton(next)}</div>
                        </div>
                      ) : (
                        <p className="mt-auto mb-0 font-extrabold text-success">{t.garage.maxed}</p>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'robots' && (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
              {ROBOTS.map((r) => {
                const open = isUnlocked(r, p.level.index, achievements, owned)
                const mine = profile.buddy.model === r.id
                return (
                  <li key={r.id}>
                    <Card className={cn('h-full items-center gap-2 p-3 text-center', mine && 'ring-3 ring-(--focus)')}>
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-(--radius-sm)"
                        onClick={() => setPreview({ model: r.id })}
                        aria-label={`${t.garage.preview}: ${r.title[lang]}`}
                      >
                        <Buddy {...p.looks} model={r.id} className="mx-auto w-28" />
                      </button>
                      <h2 className="m-0 text-lg">{r.title[lang]}</h2>
                      <p className="m-0 text-xs text-muted-foreground">{r.description?.[lang]}</p>
                      <div className="mt-auto">
                        {mine ? (
                          <span className="font-extrabold text-success">{t.garage.chosen}</span>
                        ) : open ? (
                          <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => choose(r.id)}>
                            {t.garage.choose}
                          </button>
                        ) : (
                          buyButton(r)
                        )}
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'looks' &&
            LOOK_KINDS.map((kind) => (
              <section key={kind} className="grid gap-2">
                <h2 className="m-0 text-xl">{t.garage.kinds[kind]}</h2>
                <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 xl:grid-cols-4">
                  {LOOKS.filter((i) => i.kind === kind).map((i) => {
                    const open = isUnlocked(i, p.level.index, achievements, owned)
                    const worn = profile.cosmetics[kind] === i.id
                    const locked = lockText(i)
                    return (
                      <li key={i.id}>
                        <div
                          className={cn(
                            'grid h-full gap-1.5 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-2 text-center',
                            worn && 'ring-3 ring-(--focus)',
                            !open && !priceOf(i) && 'bg-surface-2',
                          )}
                        >
                          <button
                            type="button"
                            className="cursor-pointer rounded-(--radius-sm) bg-surface-2"
                            onClick={() => setPreview({ [kind]: i.id })}
                            aria-label={`${t.garage.preview}: ${i.title[lang]}`}
                          >
                            <Buddy {...p.looks} {...{ [kind]: i.id }} className="mx-auto w-20" />
                          </button>
                          <span className="text-sm font-bold leading-tight">{i.title[lang]}</span>
                          {worn ? (
                            <span className="text-sm font-extrabold text-success">{t.garage.equipped}</span>
                          ) : open ? (
                            <button type="button" className={buttonVariants({ size: 'sm', className: 'min-h-9' })} onClick={() => equip(kind, i.id)}>
                              {t.garage.equip}
                            </button>
                          ) : locked ? (
                            <span className="flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground">
                              <Lock className="size-3.5" aria-hidden="true" />
                              {locked}
                            </span>
                          ) : (
                            buyButton(i)
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
        </div>

        <Card className="h-fit gap-3" flat>
          <CardTitle>
            <CoinIcon />
            {t.garage.earnTitle}
          </CardTitle>
          <ul className="m-0 grid gap-1.5 pl-5 text-sm">
            {t.garage.earn.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
