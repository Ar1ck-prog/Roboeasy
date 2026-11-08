'use client'

import Link from 'next/link'
import { Check, Gift } from 'lucide-react'

import { CoinAmount } from '@/components/learn/coin'
import { ProgressBar } from '@/components/learn/learn-map'
import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { fill } from '@/lib/i18n/config'
import type { PlayText } from '@/lib/i18n/play'
import { BUFFS } from '@/lib/learn/shop'
import { CHEST, type QuestStatus } from '@/lib/learn/quests'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'

/** Today's three quests with progress, rewards and the chest. */
export function QuestsCard({ lang, t, quests, magnet, className }: { lang: Lang; t: PlayText; quests: QuestStatus[]; magnet: number; className?: string }) {
  const all = quests.every((q) => q.done)
  const mult = BUFFS.magnet[magnet] ?? 1
  return (
    <Card className={cn('gap-3', className)} data-testid="quests">
      <CardTitle>{t.quests.title}</CardTitle>
      <ul className="m-0 grid list-none gap-2 p-0">
        {quests.map(({ quest, progress, done }) => (
          <li
            key={quest.id}
            className={cn('flex items-center gap-3 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline p-2', done ? 'bg-(--ok-bg)' : 'bg-card')}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-surface-2 text-xl"
              aria-hidden="true"
            >
              {done ? <Check className="size-5 text-success" /> : <AnimIcon name={quest.icon} />}
            </span>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="font-bold leading-tight">{quest.title[lang]}</span>
              <span className="flex items-center gap-2">
                <ProgressBar value={progress / quest.target} label={quest.title[lang]} className="h-2.5 flex-1" />
                <span className="text-xs font-bold text-muted-foreground tabular-nums">
                  {progress}/{quest.target}
                </span>
              </span>
            </span>
            {done ? (
              <span className="text-sm font-extrabold text-success">{t.quests.done}</span>
            ) : (
              <span className="grid justify-items-end gap-1">
                <CoinAmount n={quest.coins * mult} className="text-sm" />
                <Link
                  prefetch={false}
                  className={buttonVariants({ size: 'sm', variant: 'secondary', className: 'min-h-8 px-2.5 text-sm' })}
                  href={`/${lang}${quest.href}`}
                >
                  {t.quests.go}
                </Link>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={cn('m-0 flex items-center gap-2 text-sm font-bold', all ? 'text-success' : 'text-muted-foreground')}>
        <Gift className="size-5" aria-hidden="true" />
        {all ? t.quests.chestOpen : fill(t.quests.chest, { coins: CHEST.coins, xp: CHEST.xp })}
      </p>
    </Card>
  )
}
