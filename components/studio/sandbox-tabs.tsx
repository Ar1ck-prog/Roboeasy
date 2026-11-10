import Link from 'next/link'
import { PenLine, Sparkles, Video } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n/config'
import { getDrawText } from '@/lib/i18n/draw'
import { getVideoText } from '@/lib/i18n/video'

/** Switches between the two ways of making a program in the sandbox. */
export function SandboxTabs({ lang, current }: { lang: Locale; current: 'ai' | 'draw' | 'video' }) {
  const t = getDrawText(lang).tabs
  const tabs = [
    { key: 'ai', href: `/${lang}/sandbox`, label: t.ai, Icon: Sparkles },
    { key: 'draw', href: `/${lang}/sandbox/draw`, label: t.draw, Icon: PenLine },
    { key: 'video', href: `/${lang}/sandbox/video`, label: getVideoText(lang).tab, Icon: Video },
  ] as const
  return (
    // On phones three equal buttons, with the label under the icon, so all of them stay in view.
    <nav className="container grid grid-cols-3 gap-2 pt-6 sm:flex" aria-label={t.label}>
      {tabs.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? 'page' : undefined}
          className={buttonVariants({
            variant: current === key ? 'primary' : 'ghost',
            size: 'sm',
            className:
              'max-sm:h-auto max-sm:min-h-14 max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:py-2 max-sm:text-center max-sm:text-xs max-sm:whitespace-normal',
          })}
        >
          <Icon aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
