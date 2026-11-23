'use client'

import { useEffect, useState } from 'react'
import { Check, MonitorDown } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import type { AppDownloadText } from '@/lib/i18n/app-download'

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/**
 * Installs the site as a desktop app. Chrome and Edge offer it through `beforeinstallprompt`;
 * elsewhere (or before the browser is ready) the button explains where the install icon is.
 */
export function InstallApp({ t }: { t: AppDownloadText['desktop'] }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [state, setState] = useState<'idle' | 'installed' | 'manual' | 'done'>('idle')

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setState('installed')
    const offer = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    const installed = () => setState('done')
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  async function install() {
    if (!prompt) return setState('manual')
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome === 'accepted') setState('done')
  }

  if (state === 'installed')
    return (
      <p className="m-0 inline-flex items-center gap-2 font-bold text-success">
        <Check className="size-5" aria-hidden="true" />
        {t.installed}
      </p>
    )
  return (
    <div className="grid justify-items-start gap-2 max-sm:justify-items-stretch">
      <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'max-sm:w-full max-sm:whitespace-normal' })} onClick={() => void install()}>
        <MonitorDown aria-hidden="true" />
        {t.button}
      </button>
      {(state === 'manual' || state === 'done') && (
        <p className="m-0 text-sm" role="status">
          {state === 'done' ? t.done : t.manual}
        </p>
      )}
    </div>
  )
}
