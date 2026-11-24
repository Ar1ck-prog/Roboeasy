'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n/config'
import { getPythonWorkflowText } from '@/lib/i18n/python-workflow'
import { createSpeechRecognition } from '@/lib/speech'

type Problem = 'unsupported' | 'denied' | 'empty' | 'failed'

function speechProblem(error: string): Problem {
  if (['not-allowed', 'service-not-allowed', 'NotAllowedError', 'SecurityError'].includes(error)) return 'denied'
  return error === 'no-speech' ? 'empty' : 'failed'
}

export function DictateAssignment({ lang, onText }: { lang: Locale; onText: (text: string) => void }) {
  const t = getPythonWorkflowText(lang)
  const active = useRef<NonNullable<ReturnType<typeof createSpeechRecognition>> | null>(null)
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  useEffect(() => {
    const cancel = () => {
      const recognition = active.current
      active.current = null
      recognition?.abort()
    }
    const onPageHide = () => {
      cancel()
      setListening(false)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      cancel()
    }
  }, [])

  function toggle() {
    if (active.current) {
      active.current.stop()
      return
    }
    const recognition = createSpeechRecognition(lang)
    if (!recognition) {
      setProblem('unsupported')
      return
    }

    let heard = false
    const end = (error: Problem | null) => {
      if (active.current !== recognition) return
      active.current = null
      setListening(false)
      setProblem(error)
    }
    recognition.interimResults = false
    recognition.onresult = ({ results }) => {
      if (active.current !== recognition || heard) return
      const text = Array.from(results, (entry) => entry[0].transcript).join(' ').trim()
      if (!text) return
      heard = true
      onText(text)
    }
    recognition.onerror = ({ error }) => end(speechProblem(error))
    recognition.onend = () => end(heard ? null : 'empty')
    active.current = recognition
    setProblem(null)
    setListening(true)
    try {
      recognition.start()
    } catch (error) {
      end(speechProblem((error as Error).name))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={toggle} aria-pressed={listening} variant={listening ? 'danger' : 'secondary'}>
        {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        {listening ? t.stopDictation : t.dictate}
      </Button>
      {listening && <span role="status" className="text-sm font-bold">{t.listening}</span>}
      {problem && <p role="alert" className="alert alert-warn m-0 basis-full text-sm">{t[problem]}</p>}
    </div>
  )
}
