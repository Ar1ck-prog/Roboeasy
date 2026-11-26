'use client'

/**
 * A pad to tilt the virtual tilt sensor: four big arrows around "flat", and
 * "shake" below. Works with a mouse, a finger and the keyboard (Tab to a
 * button, or arrow keys anywhere on the pad).
 */

import type { KeyboardEvent } from 'react'

import type { WedoText } from '@/lib/i18n/wedo'
import type { TiltState } from '@/lib/wedo/types'
import { cn } from '@/lib/utils'

import { TILT_ICON } from './blocks'

const KEYS: Record<string, TiltState> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ' ': 'flat' }

export function TiltPad({ value, onTilt, t, disabled }: { value: TiltState; onTilt: (s: TiltState) => void; t: WedoText; disabled?: boolean }) {
  const cell = (state: TiltState, area: string) => {
    const Icon = TILT_ICON[state]
    return (
      <button
        type="button"
        className={cn(
          'grid min-h-14 min-w-14 cursor-pointer place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card shadow-(--shadow-press) focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none disabled:opacity-50',
          value === state && 'bg-primary text-primary-foreground',
        )}
        style={{ gridArea: area }}
        aria-pressed={value === state}
        aria-label={t.tilt[state]}
        title={t.tilt[state]}
        disabled={disabled}
        onClick={() => onTilt(state)}
      >
        <Icon className="size-7" aria-hidden="true" />
      </button>
    )
  }

  const onKey = (e: KeyboardEvent) => {
    const s = KEYS[e.key]
    if (!s || disabled) return
    e.preventDefault()
    onTilt(s)
  }

  return (
    <div className="grid justify-items-center gap-2" role="group" aria-label={t.sim.tilt} onKeyDown={onKey}>
      <span className="text-sm font-extrabold">{t.sim.tilt}</span>
      <div className="grid gap-1.5" style={{ gridTemplateAreas: '". up ." "left flat right" ". down ."' }}>
        {cell('up', 'up')}
        {cell('left', 'left')}
        {cell('flat', 'flat')}
        {cell('right', 'right')}
        {cell('down', 'down')}
      </div>
      <button
        type="button"
        className={cn(
          'flex min-h-12 cursor-pointer items-center gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card px-4 font-bold shadow-(--shadow-press) focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none disabled:opacity-50',
          value === 'shake' && 'bg-primary text-primary-foreground',
        )}
        aria-pressed={value === 'shake'}
        disabled={disabled}
        onClick={() => onTilt('shake')}
      >
        {(() => {
          const I = TILT_ICON.shake
          return <I className="size-6" aria-hidden="true" />
        })()}
        {t.tilt.shake}
      </button>
    </div>
  )
}
