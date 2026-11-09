'use client'

/**
 * Voice for the mentor, with the browser's own speech tools (Web Speech API).
 * Chrome sends recognised audio to Google, so listening starts only on a click.
 */

import type { Locale } from './i18n/config'

const SPEECH_LOCALE: Record<Locale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' }

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type RecognitionConstructor = new () => Recognition

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = () => recognitionClass() !== null
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Listens for one phrase. Returns a function that stops listening. */
export function listen(lang: Locale, onText: (text: string) => void, onEnd: (failed: boolean) => void): () => void {
  const Recognition = recognitionClass()
  if (!Recognition) {
    onEnd(true)
    return () => {}
  }
  const r = new Recognition()
  let failed = false
  r.lang = SPEECH_LOCALE[lang]
  r.interimResults = false
  r.maxAlternatives = 1
  r.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript?.trim()
    if (text) onText(text)
  }
  r.onerror = () => {
    failed = true
  }
  r.onend = () => onEnd(failed)
  r.start()
  return () => r.stop()
}

export function speak(text: string, lang: Locale) {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = SPEECH_LOCALE[lang]
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
