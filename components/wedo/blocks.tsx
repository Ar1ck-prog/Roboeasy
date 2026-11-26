'use client'

/**
 * How WeDo blocks look: a big icon tile per block. Each category has its own
 * colour AND its own tile shape (motor: round, light and sound: square,
 * waits: leaf, repeat: bracket), so colour is never the only cue.
 */

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cog,
  Gauge,
  Hand,
  Hourglass,
  Infinity as InfinityIcon,
  Lightbulb,
  Minus,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Square,
  Tablet,
  Timer,
  Vibrate,
  Volume2,
  Waves,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import { fill } from '@/lib/i18n/config'
import type { WedoText } from '@/lib/i18n/wedo'
import { OP_CATEGORY, type TiltState, type WedoCategory, type WedoColor, type WedoOp, type WedoStep } from '@/lib/wedo/types'
import { cn } from '@/lib/utils'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

/** Smarthub light colours on screen. */
export const LIGHT_HEX: Record<WedoColor, string> = {
  off: '#6b7280',
  pink: '#ff7eb6',
  violet: '#9b5de5',
  blue: '#3a86ff',
  azure: '#4cc9f0',
  teal: '#2ec4b6',
  green: '#38b000',
  yellow: '#ffd60a',
  orange: '#ff8c00',
  red: '#ef233c',
  white: '#ffffff',
}

export const CATEGORY_BG: Record<WedoCategory, string> = {
  motor: 'var(--blk-motor)',
  look: 'var(--blk-light)',
  wait: 'var(--blk-control)',
  flow: 'var(--blk-events)',
}

/** Tile shape per category (not only colour). */
export const CATEGORY_SHAPE: Record<WedoCategory, string> = {
  motor: 'rounded-full',
  look: 'rounded-(--radius-sm)',
  wait: 'rounded-tl-[1.6rem] rounded-br-[1.6rem] rounded-tr-md rounded-bl-md',
  flow: 'rounded-(--radius-sm)',
}

export const TILT_ICON: Record<TiltState, Icon> = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight, flat: Minus, shake: Vibrate }

/** The main icon and a small badge icon of a block. */
export function blockIcons(step: WedoStep): { main: Icon; badge?: Icon } {
  switch (step.op) {
    case 'motor_on_for':
      return { main: Cog, badge: Timer }
    case 'motor_on':
      return { main: Cog, badge: Play }
    case 'motor_off':
      return { main: Cog, badge: Square }
    case 'motor_power':
      return { main: Gauge }
    case 'motor_direction':
      return { main: step.dir === 'this' ? RotateCw : RotateCcw }
    case 'light':
      return { main: Lightbulb }
    case 'sound':
      return { main: Volume2 }
    case 'display':
      return { main: Tablet }
    case 'wait':
      return { main: Hourglass }
    case 'wait_motion':
      return { main: Hand, badge: step.event === 'change' ? Waves : undefined }
    case 'wait_tilt':
      return { main: TILT_ICON[step.state] }
    case 'repeat':
      return { main: step.times === 'forever' ? InfinityIcon : Repeat }
  }
}

/** Short value under the icon ("2 с", "8", "red"…), also read by screen readers. */
export function blockValue(step: WedoStep, t: WedoText): string {
  switch (step.op) {
    case 'motor_on_for':
    case 'wait':
      return fill(t.editor.seconds, { n: step.seconds })
    case 'motor_power':
      return String(step.power)
    case 'motor_direction':
      return t.dir[step.dir]
    case 'light':
      return t.colors[step.color]
    case 'sound':
      return String(step.sound)
    case 'display':
      return step.value
    case 'wait_motion':
      return t.motion[step.event]
    case 'wait_tilt':
      return t.tilt[step.state]
    case 'repeat':
      return step.times === 'forever' ? t.editor.forever : fill(t.editor.times, { n: step.times })
    default:
      return ''
  }
}

export function blockLabel(step: WedoStep, n: number, t: WedoText): string {
  return fill(t.aria[step.op], { n, v: blockValue(step, t) })
}

/** A block tile: icon, badge, value; `size` 'lg' for the program, 'md' for the palette. */
export function BlockTile({ step, t, active, className }: { step: WedoStep; t: WedoText; active?: boolean; className?: string }) {
  const cat = OP_CATEGORY[step.op]
  const { main: Main, badge: Badge } = blockIcons(step)
  return (
    <span
      className={cn(
        'relative grid size-16 shrink-0 place-items-center border-(length:--stroke) border-outline text-[#14110a] shadow-(--shadow-press)',
        CATEGORY_SHAPE[cat],
        active && 'ring-4 ring-(--focus) ring-offset-2 ring-offset-background',
        className,
      )}
      style={{ background: CATEGORY_BG[cat] }}
      aria-hidden="true"
    >
      <Main className="size-8" />
      {Badge && (
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card text-foreground">
          <Badge className="size-3.5" />
        </span>
      )}
      {step.op === 'light' && (
        <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full border-(length:--stroke-thin) border-outline" style={{ background: LIGHT_HEX[step.color] }} />
      )}
    </span>
  )
}

/** Palette names of the ops, for buttons that add a block. */
export function opTitle(op: WedoOp, t: WedoText) {
  return t.blocks[op]
}
