'use client'

/** "Read aloud" for WeDo steps: the browser's own speech, shown only where it exists. */

import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { canSpeak, speak, stopSpeaking } from '@/lib/speech'

type Lang = 'ru' | 'kk' | 'en'

/** Markdown marks out, so the voice reads words only. */
export function plainText(s: string): string {
  return s.replace(/\*\*|__|`|#+\s/g, '').replace(/\n+/g, ' ').trim()
}

export function ReadAloud({ text, lang, label, stopLabel }: { text: string; lang: Lang; label: string; stopLabel: string }) {
  const [available, setAvailable] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => setAvailable(canSpeak()), [])
  // Stop when the step changes or the page closes.
  useEffect(() => () => stopSpeaking(), [text])
  useEffect(() => {
    if (!speaking) return
    const id = setInterval(() => {
      if (!window.speechSynthesis.speaking) setSpeaking(false)
    }, 300)
    return () => clearInterval(id)
  }, [speaking])

  if (!available || !text) return null
  return (
    <button
      type="button"
      className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })}
      aria-pressed={speaking}
      onClick={() => {
        if (speaking) {
          stopSpeaking()
          setSpeaking(false)
        } else {
          speak(plainText(text), lang)
          setSpeaking(true)
        }
      }}
    >
      {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {speaking ? stopLabel : label}
    </button>
  )
}
