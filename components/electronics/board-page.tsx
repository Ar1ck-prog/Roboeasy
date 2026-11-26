import Link from 'next/link'
import { ArrowLeft, FlaskConical } from 'lucide-react'

import { BoardExplorer } from '@/components/electronics/board-explorer'
import type { Board3DId } from '@/components/electronics/three/boards'
import { buttonVariants } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

/** A board's 3D page: back link, the switch between boards, title and the explorer. */
export function BoardPage({ lang, t, board }: { lang: Locale; t: ElectronicsText; board: Board3DId }) {
  const info = board === 'uno' ? t.uno : t.esp32
  const boards: { id: Board3DId; name: string }[] = [
    { id: 'uno', name: t.hub.uno.name },
    { id: 'esp32', name: t.hub.esp32.name },
  ]
  return (
    <div className="container grid gap-5 py-6 md:py-8">
      <header className="grid gap-3">
        <Link href={`/${lang}/electronics`} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t.lab.backToHub}
        </Link>
        <nav aria-label={t.uno.boardsNav} className="flex flex-wrap gap-2">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/${lang}/electronics/${b.id}`}
              aria-current={b.id === board ? 'page' : undefined}
              className={cn(
                'rounded-(--radius-pill) border-(length:--stroke-thin) border-outline px-3.5 py-1.5 text-sm font-extrabold',
                b.id === board ? 'bg-foreground text-background' : 'bg-card hover:bg-surface-2',
              )}
            >
              {b.name}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid max-w-3xl gap-2">
            <h1 className="m-0 text-3xl md:text-4xl">{info.title}</h1>
            <p className="m-0 text-muted-foreground">{board === 'uno' ? t.uno.lead : t.esp32.lead}</p>
          </div>
          <Link className={buttonVariants({ size: 'sm' })} href={`/${lang}/electronics/lab${board === 'esp32' ? '?board=esp32' : ''}`}>
            <FlaskConical aria-hidden="true" />
            {t.hub.openLab}
          </Link>
        </div>
      </header>
      <BoardExplorer board={board} t={t} />
    </div>
  )
}
