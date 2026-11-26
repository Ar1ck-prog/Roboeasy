'use client'

/**
 * The WeDo icon editor for small hands: a Start block, then blocks in a row
 * from left to right (wrapping to the next line). Tap a block in the palette
 * to add it at the end (or inside the selected repeat); tap a block in the
 * program to change it, move it with the arrows or remove it. Numbers change
 * only with big "−" / "+" buttons, never by typing.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eraser, LogOut, Minus, Plus, Trash2, Undo2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { WedoText } from '@/lib/i18n/wedo'
import { type Path, addBlock, canAdd, getAt, moveAt, removeAt, updateAt } from '@/lib/wedo/edit'
import { MOTION_EVENTS, TILT_STATES, WEDO_COLORS, WEDO_LIMITS, type WedoOp, type WedoStep, defaultStep, wedoBlocks } from '@/lib/wedo/types'
import { cn } from '@/lib/utils'

import { BlockTile, LIGHT_HEX, TILT_ICON, blockLabel, blockValue } from './blocks'

interface EditorProps {
  program: WedoStep[]
  onChange?: (steps: WedoStep[]) => void
  palette: readonly WedoOp[]
  t: WedoText
  /** The block running in the simulator right now (its path). */
  highlight?: string | null
  readOnly?: boolean
  /** "Start over" puts this program back. */
  initial?: WedoStep[]
  label: string
}

const bigBtn = 'min-h-14 min-w-14 text-lg'

/** The green Start block (our own drawing). */
function StartBlock({ label }: { label: string }) {
  return (
    <span className="grid shrink-0 justify-items-center gap-1" role="img" aria-label={label}>
      <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="var(--blk-sensors)" stroke="var(--outline)" strokeWidth="3" />
        <path d="M25 19 L47 32 L25 45 Z" fill="#14110a" />
      </svg>
      <span className="text-xs font-extrabold">{label}</span>
    </span>
  )
}

/** Big "−" value "+" control. */
function Stepper({ value, min, max, step, onChange, format, label, t }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; label: string; t: WedoText }) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 10) / 10)
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={buttonVariants({ size: 'icon', className: bigBtn })} onClick={() => set(value - step)} disabled={value <= min} aria-label={t.editor.less}>
        <Minus aria-hidden="true" />
      </button>
      <span className="min-w-20 text-center font-display text-3xl font-extrabold" aria-live="polite">
        {format(value)}
      </span>
      <button type="button" className={buttonVariants({ size: 'icon', className: bigBtn })} onClick={() => set(value + step)} disabled={value >= max} aria-label={t.editor.more}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}

/** Picture buttons for one choice (colour, tilt, motion, direction). */
function Choices<T extends string>({ options, value, onChange, render, name }: { options: readonly T[]; value: T; onChange: (v: T) => void; render: (v: T) => { label: string; node: React.ReactNode }; name: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const { label, node } = render(o)
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            aria-label={label}
            title={label}
            onClick={() => onChange(o)}
            className={cn(
              'grid min-h-14 min-w-14 cursor-pointer place-items-center gap-0.5 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card p-1.5 text-xs font-bold shadow-(--shadow-press) focus-visible:ring-3 focus-visible:ring-(--focus)',
              value === o && 'bg-primary text-primary-foreground ring-3 ring-(--focus)',
            )}
          >
            {node}
          </button>
        )
      })}
    </div>
  )
}

function ParamPanel({ step, onChange, t }: { step: WedoStep; onChange: (s: WedoStep) => void; t: WedoText }) {
  switch (step.op) {
    case 'motor_on_for':
    case 'wait':
      return (
        <Stepper
          t={t}
          label={t.blocks[step.op]}
          value={step.seconds}
          min={0.5}
          max={WEDO_LIMITS.seconds.max}
          step={0.5}
          onChange={(seconds) => onChange({ ...step, seconds })}
          format={(v) => fill(t.editor.seconds, { n: v })}
        />
      )
    case 'motor_power':
      return <Stepper t={t} label={t.blocks.motor_power} value={step.power} min={0} max={10} step={1} onChange={(power) => onChange({ ...step, power })} format={String} />
    case 'sound':
      return <Stepper t={t} label={t.blocks.sound} value={step.sound} min={1} max={20} step={1} onChange={(sound) => onChange({ ...step, sound })} format={String} />
    case 'motor_direction':
      return (
        <Choices
          name={t.blocks.motor_direction}
          options={['this', 'that'] as const}
          value={step.dir}
          onChange={(dir) => onChange({ ...step, dir })}
          render={(d) => {
            const I = d === 'this' ? ChevronRight : ChevronLeft
            return { label: t.dir[d], node: (<><I className="size-7" aria-hidden="true" /><span>{t.dir[d]}</span></>) }
          }}
        />
      )
    case 'light':
      return (
        <Choices
          name={t.blocks.light}
          options={WEDO_COLORS}
          value={step.color}
          onChange={(color) => onChange({ ...step, color })}
          render={(c) => ({
            label: t.colors[c],
            node: <span className="size-8 rounded-full border-(length:--stroke-thin) border-outline" style={{ background: c === 'off' ? 'repeating-linear-gradient(45deg,#6b7280 0 4px,#9ca3af 4px 8px)' : LIGHT_HEX[c] }} />,
          })}
        />
      )
    case 'wait_tilt':
      return (
        <Choices
          name={t.blocks.wait_tilt}
          options={TILT_STATES}
          value={step.state}
          onChange={(state) => onChange({ ...step, state })}
          render={(s) => {
            const I = TILT_ICON[s]
            return { label: t.tilt[s], node: (<><I className="size-7" aria-hidden="true" /><span>{t.tilt[s]}</span></>) }
          }}
        />
      )
    case 'wait_motion':
      return (
        <Choices
          name={t.blocks.wait_motion}
          options={MOTION_EVENTS}
          value={step.event}
          onChange={(event) => onChange({ ...step, event })}
          render={(e) => ({
            label: t.motion[e],
            node: (
              <>
                <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
                  <rect x="1" y="6" width="10" height="12" rx="2" fill="currentColor" />
                  {e !== 'far' && <circle cx={e === 'near' ? 20 : 26} cy="12" r="5" fill="currentColor" opacity={e === 'change' ? 0.5 : 1} />}
                  {e !== 'near' && <circle cx="34" cy="12" r="5" fill="currentColor" />}
                </svg>
                <span>{t.motion[e]}</span>
              </>
            ),
          })}
        />
      )
    case 'repeat':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Stepper
            t={t}
            label={t.blocks.repeat}
            value={step.times === 'forever' ? WEDO_LIMITS.times.max : step.times}
            min={WEDO_LIMITS.times.min}
            max={WEDO_LIMITS.times.max}
            step={1}
            onChange={(times) => onChange({ ...step, times })}
            format={(v) => (step.times === 'forever' ? '∞' : String(v))}
          />
          <button
            type="button"
            aria-pressed={step.times === 'forever'}
            className={buttonVariants({ variant: step.times === 'forever' ? 'primary' : 'secondary', className: bigBtn })}
            onClick={() => onChange({ ...step, times: step.times === 'forever' ? 2 : 'forever' })}
          >
            ∞ {t.editor.forever}
          </button>
        </div>
      )
    case 'display':
      return (
        <div className="grid gap-3">
          <Choices
            name={t.blocks.display}
            options={['text', 'number'] as const}
            value={step.kind}
            onChange={(kind) => onChange({ ...step, kind, value: kind === 'number' ? '1' : 'HI' })}
            render={(k) => ({ label: t.editor[k], node: <span className="px-2 text-sm">{t.editor[k]}</span> })}
          />
          {step.kind === 'number' ? (
            <Stepper t={t} label={t.editor.number} value={Number(step.value) || 0} min={0} max={99} step={1} onChange={(v) => onChange({ ...step, value: String(v) })} format={String} />
          ) : (
            <input
              className="input max-w-xs font-mono text-2xl uppercase"
              value={step.value}
              maxLength={WEDO_LIMITS.displayChars}
              aria-label={t.editor.text}
              autoComplete="off"
              onChange={(e) => onChange({ ...step, value: e.target.value.toUpperCase().slice(0, WEDO_LIMITS.displayChars) || ' ' })}
            />
          )}
        </div>
      )
    default:
      return null
  }
}

export function WedoEditor({ program, onChange, palette, t, highlight, readOnly = false, initial = [], label }: EditorProps) {
  const [selected, setSelected] = useState<Path | null>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const [focusPath, setFocusPath] = useState<Path | null>(null)
  const selectedStep = selected ? getAt(program, selected) : undefined
  const into = selectedStep?.op === 'repeat' ? selected : null
  const full = wedoBlocks(program) >= WEDO_LIMITS.maxBlocks

  useEffect(() => {
    if (focusPath) refs.current.get(focusPath)?.focus()
    setFocusPath(null)
  }, [focusPath, program])

  // A block that disappeared (reset, clear) cannot stay selected.
  useEffect(() => {
    if (selected && !getAt(program, selected)) setSelected(null)
  }, [program, selected])

  const change = (steps: WedoStep[]) => onChange?.(steps)

  const add = (op: WedoOp) => {
    const r = addBlock(program, op, into)
    if (!r) return
    change(r.steps)
    // A new repeat is selected, so the next blocks go inside it.
    if (op === 'repeat') setSelected(r.path)
  }

  const move = (by: -1 | 1) => {
    if (!selected) return
    const r = moveAt(program, selected, by)
    change(r.steps)
    setSelected(r.path)
    setFocusPath(r.path)
  }

  const remove = () => {
    if (!selected) return
    change(removeAt(program, selected))
    setSelected(null)
  }

  let n = 0
  const renderList = (steps: WedoStep[], prefix: string): React.ReactNode =>
    steps.map((s, i) => {
      const path = prefix ? `${prefix}.${i}` : String(i)
      n++
      const blockButton = (
        <button
          type="button"
          ref={(el) => {
            if (el) refs.current.set(path, el)
            else refs.current.delete(path)
          }}
          aria-label={blockLabel(s, n, t)}
          aria-pressed={readOnly ? undefined : selected === path}
          onClick={() => !readOnly && setSelected(selected === path ? null : path)}
          onKeyDown={(e) => {
            if (readOnly) return
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              change(removeAt(program, path))
              setSelected(null)
            }
            if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault()
              const r = moveAt(program, path, e.key === 'ArrowLeft' ? -1 : 1)
              change(r.steps)
              setSelected(r.path)
              setFocusPath(r.path)
            }
          }}
          className={cn(
            'grid cursor-pointer justify-items-center gap-1 rounded-(--radius-md) p-1 focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none',
            selected === path && 'bg-surface-2 ring-3 ring-(--focus)',
            readOnly && 'cursor-default',
          )}
        >
          <BlockTile step={s} t={t} active={highlight === path} />
          <span className="max-w-20 truncate text-xs font-extrabold">{blockValue(s, t) || t.blocks[s.op]}</span>
        </button>
      )
      if (s.op !== 'repeat') return <li key={path}>{blockButton}</li>
      return (
        <li key={path} className="flex max-w-full">
          <div
            className={cn(
              'flex max-w-full flex-wrap items-start gap-1 rounded-(--radius-md) border-(length:--stroke) border-dashed border-outline p-1.5',
              into === path && 'border-solid bg-(--wedo-accent-soft)',
            )}
            style={{ borderColor: 'var(--blk-events)' }}
          >
            {blockButton}
            <ol className="m-0 flex min-h-16 list-none flex-wrap items-start gap-1 p-0">
              {renderList(s.steps, path)}
              {!s.steps.length && <li className="self-center px-2 text-sm text-muted-foreground">…</li>}
            </ol>
          </div>
        </li>
      )
    })

  return (
    <section className="grid gap-3" aria-label={label}>
      <div className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 p-3">
        <ol className="m-0 flex list-none flex-wrap items-start gap-1 p-0" aria-label={t.editor.program}>
          <li>
            <StartBlock label={t.editor.start} />
          </li>
          {renderList(program, '')}
        </ol>
        {!program.length && !readOnly && <p className="m-0 mt-2 text-muted-foreground">{t.editor.empty}</p>}
        {readOnly && <p className="sr-only">{t.editor.readOnly}</p>}
      </div>

      {!readOnly && selectedStep && (
        <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3" aria-label={t.editor.params} role="group">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto font-display text-lg font-extrabold">{t.blocks[selectedStep.op]}</span>
            <button type="button" className={buttonVariants({ size: 'icon', className: bigBtn })} onClick={() => move(-1)} aria-label={t.editor.left} title={t.editor.left}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className={buttonVariants({ size: 'icon', className: bigBtn })} onClick={() => move(1)} aria-label={t.editor.right} title={t.editor.right}>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" className={buttonVariants({ variant: 'danger', size: 'icon', className: bigBtn })} onClick={remove} aria-label={t.editor.remove} title={t.editor.remove}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <ParamPanel step={selectedStep} onChange={(s) => selected && change(updateAt(program, selected, s))} t={t} />
          {into && (
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-bold">
              {t.editor.inside}
              <button type="button" className={buttonVariants({ variant: 'ghost', size: 'sm' })} onClick={() => setSelected(null)}>
                <LogOut aria-hidden="true" />
                {t.editor.outside}
              </button>
            </p>
          )}
        </div>
      )}

      {!readOnly && (
        <>
          <div className="grid gap-2" role="group" aria-label={t.editor.palette}>
            <span className="text-sm font-extrabold text-muted-foreground">{t.editor.palette}</span>
            <div className="flex flex-wrap gap-2">
              {palette.map((op) => {
                const sample = defaultStep(op)
                return (
                    <button
                      key={op}
                      type="button"
                      className="grid min-h-14 min-w-14 cursor-pointer justify-items-center gap-1 rounded-(--radius-md) p-1 hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => add(op)}
                      disabled={!canAdd(program, op, into)}
                      aria-label={t.blocks[op]}
                      title={t.blocks[op]}
                    >
                      <BlockTile step={sample} t={t} />
                      <span className="max-w-20 text-center text-xs leading-tight font-bold">{t.blocks[op]}</span>
                    </button>
                )
              })}
            </div>
            {full && <p className="m-0 text-sm font-bold">{t.editor.full}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => (change(initial), setSelected(null))}>
              <Undo2 aria-hidden="true" />
              {t.editor.reset}
            </button>
            <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => (change([]), setSelected(null))} disabled={!program.length}>
              <Eraser aria-hidden="true" />
              {t.editor.clear}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

