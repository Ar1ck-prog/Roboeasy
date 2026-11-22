'use client'

/**
 * Blockly workspace with RoboEasy blocks (one per DSL command). Loaded only
 * in the browser (next/dynamic, ssr: false). The program is kept as DSL:
 * every change is converted to steps and validated like any program.
 */

import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly/core'
import * as En from 'blockly/msg/en'
import * as Ru from 'blockly/msg/ru'

import { type ReadResult, stateToSteps, stepsToState } from '@/lib/blockly/convert'
import { blockDefs, toolboxBlocks } from '@/lib/blockly/defs'
import type { ProgramFunction, Step, StepOp } from '@/lib/dsl/types'
import type { Dictionary } from '@/lib/i18n/ru'

interface BlocklyEditorProps {
  lang: 'ru' | 'kk' | 'en'
  t: Dictionary['blocks']
  toolbox: readonly StepOp[]
  initial: Step[]
  /** Own blocks of the starting program. */
  initialFunctions?: ProgramFunction[]
  /** Changing it reloads `initial` (the "Reset" button). */
  resetKey: number
  /** Step path to highlight while the simulator runs. */
  highlight: string | null
  onChange: (r: ReadResult) => void
  label: string
}

declare global {
  interface Window {
    __roboeasyBlockly?: { load: (steps: Step[], functions?: ProgramFunction[]) => void; steps: () => Step[] }
  }
}

const THEME = Blockly.Theme.defineTheme('roboeasy', {
  name: 'roboeasy',
  base: Blockly.Themes.Classic,
  fontStyle: { family: 'var(--font-body), Nunito, sans-serif', weight: '800', size: 12 },
  componentStyles: { workspaceBackgroundColour: 'transparent', toolboxBackgroundColour: 'transparent', flyoutBackgroundColour: '#fffdf8', flyoutOpacity: 1, scrollbarOpacity: 0.5, insertionMarkerOpacity: 0.3 },
  startHats: true,
})

export default function BlocklyEditor({ lang, t, toolbox, initial, initialFunctions, resetKey, highlight, onChange, label }: BlocklyEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const ws = useRef<Blockly.WorkspaceSvg | null>(null)
  const ids = useRef<Record<string, string>>({})
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  const toolboxKey = toolbox.join(',')

  // Create the workspace for this language and palette.
  useEffect(() => {
    if (!host.current) return
    Blockly.setLocale((lang === 'en' ? En : Ru) as unknown as Record<string, string>)
    Blockly.common.defineBlocksWithJsonArray(blockDefs(t, lang))
    const workspace = Blockly.inject(host.current, {
      toolbox: { kind: 'flyoutToolbox', contents: toolboxBlocks(toolbox as StepOp[]).map((type) => ({ kind: 'block', type })) },
      renderer: 'zelos',
      theme: THEME,
      trashcan: true,
      sounds: false,
      zoom: { controls: true, wheel: false, startScale: 0.72, maxScale: 1.4, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 24, length: 2, colour: 'rgba(27,31,42,0.18)', snap: true },
    })
    ws.current = workspace

    const emit = () => {
      const r = stateToSteps(Blockly.serialization.workspaces.save(workspace))
      ids.current = r.ids
      onChangeRef.current(r)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    workspace.addChangeListener((e) => {
      if (e.isUiEvent) return
      clearTimeout(timer)
      timer = setTimeout(emit, 120)
    })
    // Test hook (development only): E2E tests load a program into the editor like a learner would build it.
    if (process.env.NODE_ENV !== 'production')
      window.__roboeasyBlockly = {
        load: (steps: Step[], functions?: ProgramFunction[]) => Blockly.serialization.workspaces.load(stepsToState(steps, functions), workspace),
        steps: () => stateToSteps(Blockly.serialization.workspaces.save(workspace)).steps,
      }
    const ro = new ResizeObserver(() => Blockly.svgResize(workspace))
    ro.observe(host.current)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
      workspace.dispose()
      ws.current = null
    }
    // `t` follows `lang`; the palette changes with the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, toolboxKey])

  // Load the starting program (also on Reset).
  useEffect(() => {
    const workspace = ws.current
    if (!workspace) return
    Blockly.Events.disable()
    try {
      workspace.clear()
      Blockly.serialization.workspaces.load(stepsToState(initial, initialFunctions), workspace)
    } finally {
      Blockly.Events.enable()
    }
    const r = stateToSteps(Blockly.serialization.workspaces.save(workspace))
    ids.current = r.ids
    onChangeRef.current(r)
    workspace.scrollCenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, lang, toolboxKey])

  useEffect(() => {
    const workspace = ws.current
    if (!workspace) return
    // Inside an own block the simulator reports "<call path>.call.<n>": the call block lights up.
    workspace.highlightBlock(highlight ? (ids.current[highlight] ?? ids.current[highlight.split('.call')[0]] ?? null) : null)
  }, [highlight])

  return <div ref={host} className="re-blockly h-full min-h-[320px] w-full" role="application" aria-label={label} />
}
