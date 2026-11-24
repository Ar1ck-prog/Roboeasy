'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { stageFllImport } from '@/lib/fll/python-import'
import type { Locale } from '@/lib/i18n/config'
import { getPythonWorkflowText } from '@/lib/i18n/python-workflow'

export function OpenPythonInFll({ lang, code, name, hint, disabled }: {
  lang: Locale
  code: string
  name: string
  hint?: string
  disabled?: boolean
}) {
  const t = getPythonWorkflowText(lang)
  const [error, setError] = useState(false)

  function open() {
    try {
      // A top-level navigation applies the simulator's COOP/COEP headers.
      window.location.assign(stageFllImport(lang, name, code, hint))
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="grid min-w-0 justify-items-start gap-2">
      <Button type="button" onClick={open} disabled={disabled || !code.trim()}>
        <ExternalLink aria-hidden="true" />
        {t.open}
      </Button>
      {error && <p role="alert" className="alert alert-warn m-0 text-sm">{t.transferError}</p>}
    </div>
  )
}
