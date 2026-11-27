import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { BoardExplorer } from '@/components/electronics/board-explorer'
import type { Board3DId } from '@/components/electronics/three/boards'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'

/** A board's 3D page: the workbench stage (title, tools and the board strip are on it) and the details below. */
export function BoardPage({ lang, t, board }: { lang: Locale; t: ElectronicsText; board: Board3DId }) {
  return (
    <div className="container grid gap-4 py-5 md:py-6">
      <Link href={`/${lang}/electronics`} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.lab.backToHub}
      </Link>
      <BoardExplorer board={board} t={t} lang={lang} />
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">{board === 'uno' ? t.uno.lead : t.esp32.lead}</p>
    </div>
  )
}
