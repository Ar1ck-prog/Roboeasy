'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, RotateCw, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

/**
 * Arduino Uno in 3D, built procedurally in the browser: the board's texture
 * (traces, silkscreen, pin labels) is drawn on a canvas and every part is
 * made of primitives — no model files, no photos. Units are millimetres.
 */

const PART_IDS = ['mcu', 'usb', 'bridge', 'jack', 'regulator', 'crystal', 'reset', 'digital', 'analog', 'power', 'led', 'txrx', 'on', 'icsp'] as const
type PartId = (typeof PART_IDS)[number]
type View = 'iso' | 'top' | 'front'
type Tab = 'parts' | 'pinout' | 'specs' | 'quiz'

const L = 68.6
const W = 53.3
const T = 1.6
/** Board millimetres (from the left edge, from the top edge) to world coordinates. */
const wx = (mm: number) => mm - L / 2
const wz = (mm: number) => mm - W / 2

const TOP10 = ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8']
const TOP8 = ['7', '~6', '~5', '4', '~3', '2', 'TX 1', 'RX 0']
const POWER8 = ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN']
const ANALOG6 = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']
const PITCH = 2.54
const X_TOP10 = 18.4
const X_TOP8 = 45.4
const X_POWER = 27.9
const X_ANALOG = 50.8
const Z_TOP = 2.4
const Z_BOTTOM = W - 2.4

/** Where each part's label points, in world coordinates. */
const ANCHORS: Record<PartId, [number, number, number]> = {
  mcu: [wx(50), 6, wz(40)],
  usb: [wx(4), 12, wz(16)],
  bridge: [wx(19), 3, wz(17)],
  jack: [wx(5), 12, wz(45)],
  regulator: [wx(19), 6, wz(46)],
  crystal: [wx(36), 5, wz(33)],
  reset: [wx(7), 5, wz(4)],
  digital: [wx(40), 10, wz(Z_TOP)],
  analog: [wx(57), 10, wz(Z_BOTTOM)],
  power: [wx(36), 10, wz(Z_BOTTOM)],
  led: [wx(29), 3, wz(11)],
  txrx: [wx(29), 3, wz(17)],
  on: [wx(60), 3, wz(19)],
  icsp: [wx(65), 6, wz(29)],
}

/** A tiny seeded random generator, so the traces look the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

/** The top of the board: copper traces, vias, mounting holes and the white silkscreen. */
function drawBoardTexture(): HTMLCanvasElement {
  const s = 20 // px per mm
  const c = document.createElement('canvas')
  c.width = Math.round(L * s)
  c.height = Math.round(W * s)
  const g = c.getContext('2d')!
  g.fillStyle = '#0e7c86'
  g.fillRect(0, 0, c.width, c.height)
  const r = rng(7)
  g.strokeStyle = '#13939e'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let i = 0; i < 70; i++) {
    let x = (8 + r() * (L - 16)) * s
    let y = (6 + r() * (W - 12)) * s
    g.lineWidth = (0.25 + r() * 0.35) * s
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 3; k++) {
      const len = (3 + r() * 12) * s
      const dir = Math.floor(r() * 8) * (Math.PI / 4)
      x = Math.max(4 * s, Math.min((L - 4) * s, x + Math.cos(dir) * len))
      y = Math.max(4 * s, Math.min((W - 4) * s, y + Math.sin(dir) * len))
      g.lineTo(x, y)
    }
    g.stroke()
    g.fillStyle = '#c9b26a'
    g.beginPath()
    g.arc(x, y, 0.45 * s, 0, Math.PI * 2)
    g.fill()
  }
  // Mounting holes with their gold rings
  for (const [hx, hy] of [
    [14, 2.5],
    [15.2, W - 2.5],
    [66, 7.6],
    [66, 35.5],
  ]) {
    g.fillStyle = '#c9b26a'
    g.beginPath()
    g.arc(hx * s, hy * s, 2.3 * s, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#0a0a0a'
    g.beginPath()
    g.arc(hx * s, hy * s, 1.6 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#ffffff'
  g.textBaseline = 'middle'
  const label = (text: string, x: number, y: number, size: number, rotate = 0, weight = 700, align: CanvasTextAlign = 'center', italic = false) => {
    g.save()
    g.translate(x * s, y * s)
    g.rotate(rotate)
    g.textAlign = align
    g.font = `${italic ? 'italic ' : ''}${weight} ${size * s}px system-ui, sans-serif`
    g.fillText(text, 0, 0)
    g.restore()
  }
  TOP10.forEach((t, i) => label(t, X_TOP10 + i * PITCH, Z_TOP + 3, 1.15, -Math.PI / 2, 700, 'right'))
  TOP8.forEach((t, i) => label(t, X_TOP8 + i * PITCH, Z_TOP + 3, 1.15, -Math.PI / 2, 700, 'right'))
  POWER8.forEach((t, i) => t && label(t, X_POWER + i * PITCH, Z_BOTTOM - 3, 1.15, -Math.PI / 2, 700, 'left'))
  ANALOG6.forEach((t, i) => label(t, X_ANALOG + i * PITCH, Z_BOTTOM - 3, 1.15, -Math.PI / 2, 700, 'left'))
  label('DIGITAL (PWM ~)', 46, 11.5, 1.5, 0, 800)
  label('POWER', 35, W - 11, 1.5, 0, 800)
  label('ANALOG IN', 57, W - 11, 1.5, 0, 800)
  label('UNO', 50, 22, 6.5, 0, 900, 'center', true)
  label('R3 · RoboEasy', 50, 27, 1.6, 0, 700)
  label('L', 27, 11, 1.2)
  label('TX', 27, 16, 1.1)
  label('RX', 27, 18.2, 1.1)
  label('ON', 62.2, 19, 1.1)
  label('RESET', 7, 8.5, 1.1)
  label('ICSP', 65, 23.5, 1.1)
  return c
}

export function UnoExplorer({ t }: { t: ElectronicsText }) {
  const u = t.uno
  const host = useRef<HTMLDivElement>(null)
  const labelEls = useRef<Partial<Record<PartId, HTMLSpanElement | null>>>({})
  const api = useRef<{ select: (id: PartId | null) => void; view: (v: View) => void; spin: (on: boolean) => void } | null>(null)
  const onPickRef = useRef<(id: PartId) => void>(() => {})
  const [state, setState] = useState<'loading' | 'ready' | 'nogl'>('loading')
  const [selected, setSelected] = useState<PartId | null>(null)
  const [labels, setLabels] = useState(false)
  const [spin, setSpin] = useState(false)
  const [tab, setTab] = useState<Tab>('parts')
  const [quiz, setQuiz] = useState<{ order: PartId[]; i: number; right: number; missed: boolean; feedback: string | null } | null>(null)

  const select = useCallback((id: PartId | null) => {
    setSelected(id)
    api.current?.select(id)
  }, [])

  // Picking a part on the board: the quiz checks it, otherwise it is selected.
  onPickRef.current = (id: PartId) => {
    if (tab === 'quiz' && quiz && quiz.i < quiz.order.length) {
      const target = quiz.order[quiz.i]
      if (id === target) {
        api.current?.select(id)
        setQuiz({ ...quiz, i: quiz.i + 1, right: quiz.right + (quiz.missed ? 0 : 1), missed: false, feedback: u.quizRight })
      } else setQuiz({ ...quiz, missed: true, feedback: u.quizWrong.replace('{name}', u.parts[id][0]) })
      return
    }
    select(id)
    setTab('parts')
  }

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    void (async () => {
      const THREE = await import('three')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
      const el = host.current
      if (disposed || !el) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        setState('nogl')
        return
      }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      el.appendChild(renderer.domElement)
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.touchAction = 'none'

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6))
      const sun = new THREE.DirectionalLight(0xffffff, 2.2)
      sun.position.set(-40, 90, 50)
      scene.add(sun)

      const parts = new Map<PartId, InstanceType<typeof THREE.Group>>()
      const group = (id: PartId) => {
        const g = new THREE.Group()
        g.userData.part = id
        parts.set(id, g)
        scene.add(g)
        return g
      }
      const mat = (color: number, metal = 0, rough = 0.6) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough })
      const box = (g: InstanceType<typeof THREE.Group>, w: number, h: number, d: number, x: number, y: number, z: number, m: InstanceType<typeof THREE.MeshStandardMaterial>) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
        mesh.position.set(x, y, z)
        g.add(mesh)
        return mesh
      }
      const top = T / 2

      // The board itself, with its drawn texture on top.
      const texture = new THREE.CanvasTexture(drawBoardTexture())
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      const side = mat(0x0b6a73)
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(L, T, W), [side, side, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }), mat(0x0a5c64), side, side])
      scene.add(pcb)

      const metal = mat(0xc4c8cc, 0.9, 0.3)
      const black = mat(0x1d1d1f, 0.1, 0.5)
      const gold = mat(0xd4af37, 1, 0.3)

      // USB-B socket sticking out of the left edge
      box(group('usb'), 16, 11, 12, wx(16 / 2 - 6.3), top + 5.5, wz(16), metal)
      // Power jack
      const jack = group('jack')
      box(jack, 14, 11, 9, wx(14 / 2 - 1.8), top + 5.5, wz(45), black)
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 24), mat(0x333333))
      hole.rotation.z = Math.PI / 2
      hole.position.set(wx(-1.9), top + 5.5, wz(45))
      jack.add(hole)
      // Voltage regulator with its metal tab
      const reg = group('regulator')
      box(reg, 6.5, 2.3, 6, wx(19), top + 1.15, wz(46), black)
      box(reg, 6.5, 0.6, 3, wx(19), top + 0.3, wz(42), metal)
      // USB bridge chip, a small square turned 45°
      box(group('bridge'), 5, 1, 5, wx(19), top + 0.5, wz(17), black).rotation.y = Math.PI / 4
      // Crystal (an oval can)
      const crystal = group('crystal')
      const can = new THREE.Mesh(new THREE.CapsuleGeometry(1.9, 7, 6, 16), metal)
      can.rotation.z = Math.PI / 2
      can.position.set(wx(36), top + 2, wz(33))
      crystal.add(can)
      // Reset button
      const reset = group('reset')
      box(reset, 6, 3, 6, wx(7), top + 1.5, wz(4.5), mat(0xdadce0, 0.4, 0.4))
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.2, 20), mat(0xc5221f))
      cap.position.set(wx(7), top + 3.6, wz(4.5))
      reset.add(cap)
      // ATmega328P in its socket, with 28 legs and its name
      const mcu = group('mcu')
      box(mcu, 36, 2.5, 10.5, wx(50), top + 1.25, wz(40), mat(0x2a2a2a))
      const chipCanvas = document.createElement('canvas')
      chipCanvas.width = 720
      chipCanvas.height = 180
      const cg = chipCanvas.getContext('2d')!
      cg.fillStyle = '#1b1b1b'
      cg.fillRect(0, 0, 720, 180)
      cg.fillStyle = '#d0d0d0'
      cg.font = '700 64px system-ui, sans-serif'
      cg.textAlign = 'center'
      cg.textBaseline = 'middle'
      cg.fillText('ATMEGA328P', 360, 90)
      cg.beginPath()
      cg.arc(26, 90, 14, -Math.PI / 2, Math.PI / 2)
      cg.fill()
      const chipTex = new THREE.CanvasTexture(chipCanvas)
      chipTex.colorSpace = THREE.SRGBColorSpace
      const chipTop = new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.6 })
      const chip = new THREE.Mesh(new THREE.BoxGeometry(35, 3.5, 7.5), [black, black, chipTop, black, black, black])
      chip.position.set(wx(50), top + 2.5 + 1.75, wz(40))
      mcu.add(chip)
      for (let i = 0; i < 14; i++) for (const zz of [-4.2, 4.2]) box(mcu, 0.6, 2.4, 1.2, wx(50 - 16.5 + i * PITCH), top + 3.4, wz(40) + zz, metal)
      // Female headers with their sockets
      const header = (id: PartId, x0: number, n: number, z: number) => {
        const g = parts.get(id) ?? group(id)
        box(g, n * PITCH, 8.5, PITCH, wx(x0 + ((n - 1) * PITCH) / 2), top + 4.25, wz(z), black)
        for (let i = 0; i < n; i++) box(g, 1, 0.2, 1, wx(x0 + i * PITCH), top + 8.55, wz(z), mat(0x050505))
      }
      header('digital', X_TOP10, 10, Z_TOP)
      header('digital', X_TOP8, 8, Z_TOP)
      header('power', X_POWER, 8, Z_BOTTOM)
      header('analog', X_ANALOG, 6, Z_BOTTOM)
      // ICSP: six gold pins on a black base
      const icsp = group('icsp')
      box(icsp, 5.1, 2.5, 7.6, wx(65), top + 1.25, wz(29), black)
      for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) box(icsp, 0.64, 6, 0.64, wx(65 - 1.27 + i * PITCH), top + 4, wz(29 - PITCH + k * PITCH), gold)
      // LEDs
      const led = (id: PartId, x: number, z: number, color: number) => {
        const g = parts.get(id) ?? group(id)
        const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
        box(g, 2, 0.8, 1.2, wx(x), top + 0.4, wz(z), m)
      }
      led('led', 29.5, 11, 0xffb300)
      led('txrx', 29.5, 16, 0xffb300)
      led('txrx', 29.5, 18.2, 0xffb300)
      led('on', 60, 19, 0x34a853)

      // Each part gets its own materials so it can light up when selected.
      for (const g of parts.values())
        g.traverse((o) => {
          const mesh = o as InstanceType<typeof THREE.Mesh>
          if (!mesh.isMesh) return
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : (mesh.material as InstanceType<typeof THREE.Material>).clone()
        })

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = !reduce
      controls.minDistance = 35
      controls.maxDistance = 220
      controls.autoRotateSpeed = 1.2
      // A plain wheel scrolls the page; Ctrl/⌘ + wheel (and a pinch) zooms the board.
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
      }
      el.addEventListener('wheel', onWheel, { capture: true })

      const views: Record<View, [number, number, number]> = { iso: [-48, 60, 66], top: [0, 104, 0.01], front: [0, 26, 100] }
      let goal: InstanceType<typeof THREE.Vector3> | null = null
      const setView = (v: View) => {
        goal = new THREE.Vector3(...views[v])
        if (reduce) {
          camera.position.copy(goal)
          goal = null
        }
      }
      camera.position.set(...views.iso)
      controls.target.set(0, 0, 0)

      const highlight = (id: PartId | null) => {
        for (const [pid, g] of parts)
          g.traverse((o) => {
            const mesh = o as InstanceType<typeof THREE.Mesh>
            if (!mesh.isMesh) return
            for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as InstanceType<typeof THREE.MeshStandardMaterial>[]) {
              if (!('emissive' in m)) continue
              if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.emissive.getHex()
              if (m.userData.baseIntensity === undefined) m.userData.baseIntensity = m.emissiveIntensity
              const on = pid === id
              m.emissive.setHex(on ? 0xffc400 : m.userData.baseEmissive)
              m.emissiveIntensity = on ? 0.55 : m.userData.baseIntensity
            }
          })
      }

      // Click (not drag) picks the part under the pointer.
      const ray = new THREE.Raycaster()
      let down: { x: number; y: number } | null = null
      const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY })
      const onUp = (e: PointerEvent) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
        const rect = renderer.domElement.getBoundingClientRect()
        ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera)
        const hit = ray.intersectObjects([...parts.values()], true)[0]
        let o: InstanceType<typeof THREE.Object3D> | null = hit?.object ?? null
        while (o && !o.userData.part) o = o.parent
        if (o) onPickRef.current(o.userData.part as PartId)
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointerup', onUp)

      const resize = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = `${w}px`
        renderer.domElement.style.height = `${h}px`
        camera.aspect = w / Math.max(1, h)
        camera.updateProjectionMatrix()
      }
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      resize()

      const v = new THREE.Vector3()
      let frameId = 0
      const loop = () => {
        frameId = requestAnimationFrame(loop)
        if (goal) {
          camera.position.lerp(goal, 0.12)
          if (camera.position.distanceTo(goal) < 0.5) goal = null
        }
        controls.update()
        renderer.render(scene, camera)
        // Labels follow their parts on screen.
        const w = el.clientWidth
        const h = el.clientHeight
        for (const id of PART_IDS) {
          const span = labelEls.current[id]
          if (!span) continue
          v.set(...ANCHORS[id]).project(camera)
          const visible = v.z < 1
          span.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
          span.style.opacity = visible ? '' : '0'
        }
      }
      loop()

      api.current = {
        select: highlight,
        view: setView,
        spin: (on) => {
          controls.autoRotate = on
        },
      }
      setState('ready')

      cleanup = () => {
        cancelAnimationFrame(frameId)
        ro.disconnect()
        el.removeEventListener('wheel', onWheel, { capture: true })
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointerup', onUp)
        controls.dispose()
        scene.traverse((o) => {
          const mesh = o as InstanceType<typeof THREE.Mesh>
          if (!mesh.isMesh) return
          mesh.geometry.dispose()
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            ;(m as InstanceType<typeof THREE.MeshStandardMaterial>).map?.dispose()
            m.dispose()
          }
        })
        renderer.dispose()
        renderer.domElement.remove()
        api.current = null
      }
    })()
    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  useEffect(() => api.current?.spin(spin), [spin, state])

  const startQuiz = () => {
    const order = [...PART_IDS].sort(() => Math.random() - 0.5).slice(0, 6)
    select(null)
    setLabels(false)
    setQuiz({ order, i: 0, right: 0, missed: false, feedback: null })
    setTab('quiz')
  }

  const tabs: Tab[] = ['parts', 'pinout', 'specs', 'quiz']
  const quizOver = quiz && quiz.i >= quiz.order.length

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card className="gap-3 p-3 sm:p-4">
        <div className="relative aspect-square overflow-hidden sm:aspect-[4/3] rounded-(--radius-md) bg-[radial-gradient(circle_at_50%_35%,var(--surface-2),var(--bg))]">
          <div ref={host} className="absolute inset-0" data-testid="uno-3d" />
          {state === 'loading' && <p className="absolute inset-0 m-0 grid place-items-center text-muted-foreground">{u.loading}</p>}
          {state === 'nogl' && <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-muted-foreground">{u.noWebgl}</p>}
          {state === 'ready' &&
            PART_IDS.map((id) => (
              <span
                key={id}
                ref={(node) => {
                  labelEls.current[id] = node
                }}
                className={cn(
                  'pointer-events-none absolute top-0 left-0 rounded-(--radius-pill) px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap shadow-sm transition-opacity',
                  selected === id ? 'bg-primary text-primary-foreground' : 'bg-card/90 text-foreground',
                  !labels && selected !== id && 'invisible',
                )}
              >
                {u.parts[id][0]}
              </span>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['iso', 'top', 'front'] as const).map((v) => (
            <Button key={v} size="sm" variant="ghost" onClick={() => api.current?.view(v)} disabled={state !== 'ready'}>
              {u.views[v]}
            </Button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant={spin ? 'primary' : 'secondary'} onClick={() => setSpin((s) => !s)} aria-pressed={spin} disabled={state !== 'ready'}>
            <RotateCw aria-hidden="true" />
            {u.rotate}
          </Button>
          <Button size="sm" variant={labels ? 'primary' : 'secondary'} onClick={() => setLabels((s) => !s)} aria-pressed={labels} disabled={state !== 'ready'}>
            <Tag aria-hidden="true" />
            {u.labels}
          </Button>
        </div>
      </Card>

      <Card className="gap-4 p-4 sm:p-5">
        <div role="tablist" aria-label={u.title} className="flex flex-wrap gap-1.5">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => (id === 'quiz' && !quiz ? startQuiz() : setTab(id))}
              className={cn(
                'cursor-pointer rounded-(--radius-pill) border-(length:--stroke-thin) border-outline px-3 py-1.5 text-sm font-bold',
                tab === id ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-surface-2',
              )}
            >
              {u.tabs[id]}
            </button>
          ))}
        </div>

        {tab === 'parts' && (
          <div role="tabpanel" className="grid gap-3">
            {selected ? (
              <div className="rounded-(--radius-md) bg-surface-2 p-3" aria-live="polite">
                <h2 className="m-0 text-lg">{u.parts[selected][0]}</h2>
                <p className="m-0 mt-1 text-muted-foreground">{u.parts[selected][1]}</p>
              </div>
            ) : (
              <p className="m-0 text-muted-foreground">{u.pickHint}</p>
            )}
            <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
              {PART_IDS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => select(selected === id ? null : id)}
                    aria-pressed={selected === id}
                    className={cn(
                      'w-full cursor-pointer rounded-(--radius-sm) border-(length:--stroke-thin) px-3 py-2 text-left text-sm font-bold',
                      selected === id ? 'border-outline bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-surface-2',
                    )}
                  >
                    {u.parts[id][0]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'pinout' && (
          <dl role="tabpanel" className="m-0 grid gap-3">
            {u.pinout.map(([pins, text]) => (
              <div key={pins} className="grid gap-0.5">
                <dt className="font-mono font-extrabold">{pins}</dt>
                <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === 'specs' && (
          <table role="tabpanel" className="w-full border-collapse text-sm">
            <tbody>
              {u.specs.map(([k, val]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-bold text-muted-foreground">
                    {k}
                  </th>
                  <td className="py-2 font-bold">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'quiz' && quiz && (
          <div role="tabpanel" className="grid gap-3" aria-live="polite">
            {quizOver ? (
              <>
                <p className="m-0 flex items-center gap-2 text-lg font-extrabold">
                  <Check className="size-6 text-success" aria-hidden="true" />
                  {u.quizDone.replace('{right}', String(quiz.right)).replace('{total}', String(quiz.order.length))}
                </p>
                <Button className="w-fit" onClick={startQuiz}>
                  {u.quizAgain}
                </Button>
              </>
            ) : (
              <>
                <p className="m-0 text-sm font-bold text-muted-foreground">
                  {quiz.i + 1} / {quiz.order.length}
                </p>
                <p className="m-0 text-xl font-extrabold">{u.quizFind.replace('{name}', u.parts[quiz.order[quiz.i]][0])}</p>
                {quiz.feedback && <p className={cn('m-0 font-bold', quiz.feedback === u.quizRight ? 'text-success' : 'text-destructive')}>{quiz.feedback}</p>}
                {state === 'nogl' && (
                  <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
                    {PART_IDS.map((id) => (
                      <li key={id}>
                        <button type="button" className="w-full cursor-pointer rounded-(--radius-sm) border border-border bg-card px-2 py-1.5 text-left text-sm" onClick={() => onPickRef.current(id)}>
                          {u.parts[id][0]}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
