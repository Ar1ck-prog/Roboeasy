'use client'

import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Activity, Check, Cpu, FlaskConical, GripVertical, Layers, Lightbulb, MessageSquareText, Plug, RotateCw, ScanSearch, Usb, Wifi, Zap } from 'lucide-react'

import { Esp32Board, UnoBoard } from '@/components/electronics/bench'
import type { Board3DId } from '@/components/electronics/three/boards'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

/**
 * A board on a 3D workbench (components/electronics/three): environment
 * reflections, soft shadows, a cutting mat with tools around, callout cards
 * linked to the parts by dashed leaders, part picking with hover and focus,
 * "take apart", and below it the parts, pinout, specifications and a quiz.
 */

type View = 'iso' | 'top' | 'front'
type Tab = 'parts' | 'pinout' | 'specs' | 'quiz'
type Info = { title: string; maker: string; tagline: string; level: string; parts: Record<string, [string, string]>; pinout: [string, string][]; specs: [string, string][] }

/** Parts that get a callout card around the stage, with their icons. */
const CALLOUTS: Record<Board3DId, [string, ComponentType<{ className?: string }>][]> = {
  uno: [
    ['digital', GripVertical],
    ['usb', Usb],
    ['mcu', Cpu],
    ['led', Lightbulb],
    ['power', Plug],
    ['analog', Activity],
  ],
  esp32: [
    ['gpio', GripVertical],
    ['module', Cpu],
    ['antenna', Wifi],
    ['usb', Usb],
    ['led', Lightbulb],
    ['regulator', Zap],
  ],
}
const CARD_W = 256
const CARD_H = 78

/** The first sentence of a description, for a callout card. */
const firstSentence = (text: string) => {
  const m = /^(.+?[.!?])(\s|$)/.exec(text)
  return m ? m[1] : text
}

interface Api {
  select: (id: string | null) => void
  view: (v: View) => void
  spin: (on: boolean) => void
  explode: (on: boolean) => void
}

type Slot = { id: string; x: number; y: number; side: 'left' | 'right' }

export function BoardExplorer({ board, t, lang }: { board: Board3DId; t: ElectronicsText; lang: Locale }) {
  const u = t.uno
  const info: Info = board === 'uno' ? t.uno : t.esp32
  const partIds = Object.keys(info.parts)
  const callouts = CALLOUTS[board].filter(([id]) => info.parts[id])
  const stage = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const labelEls = useRef<Record<string, HTMLSpanElement | null>>({})
  const lineEls = useRef<Record<string, SVGPathElement | null>>({})
  const dotEls = useRef<Record<string, SVGCircleElement | null>>({})
  const slotsRef = useRef<Slot[]>([])
  const api = useRef<Api | null>(null)
  const onPickRef = useRef<(id: string) => void>(() => {})
  const hoverRef = useRef<string | null>(null)
  const details = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'nogl'>('loading')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [showCallouts, setShowCallouts] = useState(true)
  const [slots, setSlots] = useState<Slot[]>([])
  const [spin, setSpin] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [tab, setTab] = useState<Tab>('parts')
  const [quiz, setQuiz] = useState<{ order: string[]; i: number; right: number; missed: boolean; feedback: string | null } | null>(null)
  const calloutsOn = showCallouts && slots.length > 0 && !quiz
  const calloutsRef = useRef(calloutsOn)
  calloutsRef.current = calloutsOn

  const select = useCallback((id: string | null) => {
    setSelected(id)
    api.current?.select(id)
  }, [])

  onPickRef.current = (id: string) => {
    if (tab === 'quiz' && quiz && quiz.i < quiz.order.length) {
      const target = quiz.order[quiz.i]
      if (id === target) {
        api.current?.select(id)
        setQuiz({ ...quiz, i: quiz.i + 1, right: quiz.right + (quiz.missed ? 0 : 1), missed: false, feedback: u.quizRight })
      } else setQuiz({ ...quiz, missed: true, feedback: u.quizWrong.replace('{name}', info.parts[id]?.[0] ?? id) })
      return
    }
    select(id)
    setTab('parts')
  }

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    void (async () => {
      const [THREE, { OrbitControls }, { RoundedBoxGeometry }, { RoomEnvironment }, { createKit }, { BUILDERS }, { buildWorkbench }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('@/components/electronics/three/kit'),
        import('@/components/electronics/three/boards'),
        import('@/components/electronics/three/workbench'),
      ])
      const el = host.current
      if (disposed || !el) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      } catch {
        setState('nogl')
        return
      }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      el.appendChild(renderer.domElement)
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.touchAction = 'none'

      const scene = new THREE.Scene()
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.85
      const camera = new THREE.PerspectiveCamera(34, 1, 1, 2000)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4252, 0.55))
      const key = new THREE.DirectionalLight(0xffffff, 2.1)
      key.position.set(-40, 90, 50)
      key.castShadow = true
      key.shadow.mapSize.set(2048, 2048)
      for (const side of ['left', 'bottom'] as const) key.shadow.camera[side] = -130
      for (const side of ['right', 'top'] as const) key.shadow.camera[side] = 130
      key.shadow.bias = -0.0004
      key.shadow.radius = 4
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xbfd8ff, 0.7)
      rim.position.set(50, 30, -60)
      scene.add(rim)

      const kit = createKit(THREE, RoundedBoxGeometry)
      const built = BUILDERS[board](THREE, kit)
      scene.add(built.root)
      const bench = buildWorkbench(THREE, theme, built.floor - 0.05, built.size)
      scene.add(bench.root)
      scene.background = new THREE.Color(bench.sky)

      // Each part gets its own materials so it can light up; LEDs are collected to glow.
      type Mat = InstanceType<typeof THREE.MeshStandardMaterial>
      const partMats = new Map<string, Mat[]>()
      const ledMats: { mat: Mat; color: number; part: string | null }[] = []
      built.root.traverse((o) => {
        const mesh = o as InstanceType<typeof THREE.Mesh>
        if (!mesh.isMesh) return
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : (mesh.material as Mat).clone()
        let p: InstanceType<typeof THREE.Object3D> | null = mesh
        while (p && !p.userData.part) p = p.parent
        const partId = (p?.userData.part as string | undefined) ?? null
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Mat[]
        if (mesh.userData.ledColor !== undefined) {
          ledMats.push({ mat: mats[0], color: mesh.userData.ledColor as number, part: partId })
          return
        }
        if (!partId) return
        const list = partMats.get(partId) ?? []
        for (const m of mats) if ('emissive' in m) list.push(m)
        partMats.set(partId, list)
      })
      for (const m of partMats.values()) for (const mat of m) mat.userData.base = { e: mat.emissive.getHex(), i: mat.emissiveIntensity }
      for (const g of built.parts.values()) g.userData.home = g.position.clone()
      const baseLift = built.baseLift ?? 0

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = !reduce
      controls.dampingFactor = 0.08
      controls.minDistance = 20
      controls.maxDistance = 320
      controls.maxPolarAngle = Math.PI * 0.47
      controls.autoRotateSpeed = 1.1
      // A plain wheel scrolls the page; Ctrl/⌘ + wheel (and a pinch) zooms.
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
      }
      el.addEventListener('wheel', onWheel, { capture: true })

      // The camera keeps the board in frame: distance from its bounding sphere and the field of view.
      const sphere = new THREE.Box3().setFromObject(built.root).getBoundingSphere(new THREE.Sphere())
      let spread = 1
      const fitDistance = () => {
        const v = THREE.MathUtils.degToRad(camera.fov)
        const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect)
        // Room for the callout cards on the sides of a wide stage.
        const room = camera.aspect > 1.3 ? 1.45 : 0.95
        return (sphere.radius / Math.sin(Math.min(v, h) / 2)) * 0.82 * room * spread
      }
      let camGoal: InstanceType<typeof THREE.Vector3> | null = null
      const targetGoal = new THREE.Vector3()
      let explodeGoal = 0
      let explodeNow = 0
      const setView = (v: View) => {
        camGoal = new THREE.Vector3(...built.views[v]).setLength(fitDistance())
        targetGoal.set(0, explodeGoal * 7, 0)
        if (reduce) {
          camera.position.copy(camGoal)
          controls.target.copy(targetGoal)
          camGoal = null
        }
      }
      const refit = () => {
        camGoal = camera.position.clone().sub(controls.target).setLength(fitDistance()).add(targetGoal)
        if (reduce) {
          camera.position.copy(camGoal)
          camGoal = null
        }
      }

      let selectedId: string | null = null
      let hoverId: string | null = null
      const paint = () => {
        for (const [id, mats] of partMats) {
          const sel = id === selectedId
          const hov = id === hoverId && !sel
          for (const m of mats) {
            const base = m.userData.base as { e: number; i: number }
            m.emissive.setHex(sel ? 0xffc400 : hov ? 0x4fb3ff : base.e)
            m.emissiveIntensity = sel ? 0.42 : hov ? 0.22 : base.i
          }
        }
      }
      const focus = (id: string | null) => {
        selectedId = id
        paint()
        const a = id ? built.anchors.get(id) : null
        targetGoal.set(a ? a.x * 0.3 : 0, explodeGoal * 7, a ? a.z * 0.3 : 0)
      }

      // Picking: hover follows the pointer, a click (not a drag) selects.
      const ray = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      const pickAt = (cx: number, cy: number): string | null => {
        const rect = renderer.domElement.getBoundingClientRect()
        ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        const hit = ray.intersectObjects([...built.parts.values()], true)[0]
        let o: InstanceType<typeof THREE.Object3D> | null = hit?.object ?? null
        while (o && !o.userData.part) o = o.parent
        return (o?.userData.part as string | undefined) ?? null
      }
      let down: { x: number; y: number } | null = null
      let dragging = false
      const onDown = (e: PointerEvent) => {
        down = { x: e.clientX, y: e.clientY }
        dragging = false
      }
      const onMove = (e: PointerEvent) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) dragging = true
        if (dragging || e.pointerType === 'touch') return
        const id = pickAt(e.clientX, e.clientY)
        if (id !== hoverId) {
          hoverId = id
          hoverRef.current = id
          setHovered(id)
          renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
          paint()
        }
      }
      const onUp = (e: PointerEvent) => {
        const wasDrag = dragging || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
        down = null
        dragging = false
        if (wasDrag) return
        const id = pickAt(e.clientX, e.clientY)
        if (id) onPickRef.current(id)
      }
      const onLeave = () => {
        if (!hoverId) return
        hoverId = null
        hoverRef.current = null
        setHovered(null)
        paint()
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerup', onUp)
      renderer.domElement.addEventListener('pointerleave', onLeave)

      const v = new THREE.Vector3()
      const anchorScreen = (id: string, w: number, h: number) => {
        const a = built.anchors.get(id)
        if (!a) return null
        v.copy(a)
        v.y += explodeNow * ((built.lift.get(id) ?? 10) + baseLift)
        v.project(camera)
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 }
      }

      /** Callout cards sit in two columns beside the board, ordered by where their parts are. */
      const layoutCallouts = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        if (w < 900) {
          slotsRef.current = []
          setSlots([])
          return
        }
        const ids = CALLOUTS[board].map(([id]) => id)
        const placed = ids.map((id) => ({ id, p: anchorScreen(id, w, h) })).filter((x): x is { id: string; p: NonNullable<ReturnType<typeof anchorScreen>> } => Boolean(x.p))
        const left = placed.filter((x) => x.p.x < w / 2).sort((a, b) => a.p.y - b.p.y)
        const right = placed.filter((x) => x.p.x >= w / 2).sort((a, b) => a.p.y - b.p.y)
        // Keep the columns balanced.
        while (left.length > right.length + 1) right.push(left.pop()!)
        while (right.length > left.length + 1) left.push(right.shift()!)
        left.sort((a, b) => a.p.y - b.p.y)
        right.sort((a, b) => a.p.y - b.p.y)
        const column = (list: typeof placed, side: 'left' | 'right', top: number): Slot[] => {
          const bottom = h - 190
          const gap = list.length > 1 ? Math.max(CARD_H + 12, (bottom - top - CARD_H) / (list.length - 1)) : 0
          return list.map((x, i) => ({ id: x.id, side, x: side === 'left' ? 20 : w - CARD_W - 20, y: top + i * gap }))
        }
        const next = [...column(left, 'left', 290), ...column(right, 'right', 76)]
        slotsRef.current = next
        setSlots(next)
      }

      const resize = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = `${w}px`
        renderer.domElement.style.height = `${h}px`
        camera.aspect = w / Math.max(1, h)
        camera.updateProjectionMatrix()
      }
      const ro = new ResizeObserver(() => {
        resize()
        layoutCallouts()
      })
      ro.observe(el)
      resize()
      camera.position.set(...built.views.iso).setLength(fitDistance())
      controls.update()
      const fogFar = fitDistance() * 3.2
      scene.fog = new THREE.Fog(bench.sky, fitDistance() * 1.3, fogFar)
      layoutCallouts()
      // On a narrow stage there is no room for cards: labels start hidden and the button shows them as pills.
      if (el.clientWidth < 900) setShowCallouts(false)

      // Draw only while the view is on screen.
      let visible = true
      const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
      io.observe(el)

      const clock = new THREE.Clock()
      let frameId = 0
      const loop = () => {
        frameId = requestAnimationFrame(loop)
        if (!visible) return
        const time = clock.getElapsedTime()
        if (camGoal) {
          camera.position.lerp(camGoal, 0.1)
          if (camera.position.distanceTo(camGoal) < 0.3) camGoal = null
        }
        controls.target.lerp(targetGoal, reduce ? 1 : 0.08)
        explodeNow += (explodeGoal - explodeNow) * (reduce ? 1 : 0.1)
        built.root.position.y = explodeNow * baseLift
        for (const [id, g] of built.parts) {
          const home = g.userData.home as InstanceType<typeof THREE.Vector3>
          g.position.y = home.y + explodeNow * (built.lift.get(id) ?? 10)
        }
        // The board is powered: the power LED is on, the built-in LED blinks like Blink.
        for (const l of ledMats) {
          const blink = l.part && built.blink.includes(l.part)
          const on = blink ? Math.sin(time * Math.PI) > 0 : l.part === 'on' || l.part === 'pwr'
          l.mat.emissive.setHex(l.color)
          l.mat.emissiveIntensity = on ? 2.4 : 0.05
        }
        controls.update()
        renderer.render(scene, camera)
        const w = el.clientWidth
        const h = el.clientHeight
        for (const id of partIds) {
          const span = labelEls.current[id]
          const p = anchorScreen(id, w, h)
          if (!span || !p) continue
          span.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y - 6}px)`
          span.style.opacity = p.visible ? '' : '0'
        }
        // Leaders from the callout cards to their parts, with an elbow near the card.
        if (calloutsRef.current)
          for (const s of slotsRef.current) {
            const line = lineEls.current[s.id]
            const dot = dotEls.current[s.id]
            const p = anchorScreen(s.id, w, h)
            if (!line || !dot || !p) continue
            const sx = s.side === 'left' ? s.x + CARD_W : s.x
            const sy = s.y + CARD_H / 2
            const ex = s.side === 'left' ? sx + 28 : sx - 28
            line.setAttribute('d', `M${sx} ${sy} H${ex} L${p.x} ${p.y}`)
            dot.setAttribute('cx', String(p.x))
            dot.setAttribute('cy', String(p.y))
          }
      }
      loop()

      api.current = {
        select: focus,
        view: setView,
        spin: (on) => {
          controls.autoRotate = on
        },
        explode: (on) => {
          if (explodeGoal === (on ? 1 : 0)) return
          explodeGoal = on ? 1 : 0
          // Taken apart, the parts rise: step back to keep them in frame.
          spread = on ? 1.45 : 1
          targetGoal.y = on ? 7 : 0
          refit()
        },
      }
      setState('ready')

      cleanup = () => {
        cancelAnimationFrame(frameId)
        ro.disconnect()
        io.disconnect()
        el.removeEventListener('wheel', onWheel, { capture: true })
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointermove', onMove)
        renderer.domElement.removeEventListener('pointerup', onUp)
        renderer.domElement.removeEventListener('pointerleave', onLeave)
        controls.dispose()
        scene.traverse((o) => {
          const mesh = o as InstanceType<typeof THREE.Mesh>
          if (!mesh.isMesh) return
          mesh.geometry.dispose()
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            ;(m as Mat).map?.dispose()
            m.dispose()
          }
        })
        scene.environment?.dispose()
        pmrem.dispose()
        renderer.dispose()
        renderer.domElement.remove()
        api.current = null
      }
    })()
    return () => {
      disposed = true
      cleanup()
    }
    // partIds depends only on the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board])

  useEffect(() => api.current?.spin(spin), [spin, state])
  useEffect(() => api.current?.explode(exploded), [exploded, state])

  const startQuiz = () => {
    const order = [...partIds].sort(() => Math.random() - 0.5).slice(0, 6)
    select(null)
    setExploded(false)
    setQuiz({ order, i: 0, right: 0, missed: false, feedback: null })
    setTab('quiz')
    details.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const tabs: Tab[] = ['parts', 'pinout', 'specs', 'quiz']
  const quizOver = quiz && quiz.i >= quiz.order.length
  const glass = 'rounded-(--radius-lg) border border-white/60 bg-white/72 text-[#1b1f2a] shadow-[0_10px_30px_rgba(20,30,50,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-[#151a24]/72 dark:text-white'
  const boards: { id: Board3DId; name: string }[] = [
    { id: 'uno', name: 'Arduino Uno R3' },
    { id: 'esp32', name: 'ESP32 DevKit V1' },
  ]

  return (
    <div className="grid gap-5">
      <section
        ref={stage}
        className="relative h-[min(82vh,780px)] min-h-[560px] overflow-hidden rounded-(--radius-xl) border-(length:--stroke) border-outline bg-[#dde4ec] shadow-(--shadow-hard) dark:bg-[#1a1f2b]"
        aria-label={info.title}
      >
        <div ref={host} className="absolute inset-0" data-testid="board-3d" />
        {state === 'loading' && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="m-0 animate-pulse rounded-(--radius-pill) bg-white/80 px-4 py-2 text-sm font-bold text-[#454b5c]">{u.loading}</p>
          </div>
        )}
        {state === 'nogl' && <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-muted-foreground">{u.noWebgl}</p>}

        {/* Leaders and callout cards */}
        {state === 'ready' && calloutsOn && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {slots.map((s) => (
              <g key={s.id}>
                <path
                  ref={(n) => {
                    lineEls.current[s.id] = n
                  }}
                  fill="none"
                  stroke={selected === s.id ? '#e8a400' : '#e8710a'}
                  strokeWidth={1.8}
                  strokeDasharray="5 5"
                />
                <circle
                  ref={(n) => {
                    dotEls.current[s.id] = n
                  }}
                  r={5}
                  fill={selected === s.id ? '#ffc531' : '#e8710a'}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </g>
            ))}
          </svg>
        )}
        {state === 'ready' &&
          calloutsOn &&
          slots.map((s) => {
            const Icon = callouts.find(([id]) => id === s.id)?.[1] ?? Cpu
            const [name, text] = info.parts[s.id]
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  select(selected === s.id ? null : s.id)
                  setTab('parts')
                }}
                onPointerEnter={() => setHovered(s.id)}
                onPointerLeave={() => setHovered(hoverRef.current)}
                className={cn(
                  glass,
                  'absolute flex cursor-pointer items-start gap-2.5 p-3 text-left transition-[transform,box-shadow] hover:-translate-y-0.5',
                  selected === s.id && 'ring-2 ring-[#ffc531]',
                )}
                style={{ left: s.x, top: s.y, width: CARD_W, height: CARD_H }}
                data-callout={s.id}
              >
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[12.5px] font-extrabold tracking-wide uppercase">{name}</span>
                  <span className="line-clamp-2 text-xs leading-snug opacity-75">{firstSentence(text)}</span>
                </span>
              </button>
            )
          })}

        {/* Pill labels: hover and selection, or every part when callouts are off */}
        {state === 'ready' &&
          partIds.map((id) => {
            const show = selected === id || hovered === id || (!calloutsOn && showCallouts && !quiz)
            return (
              <span
                key={id}
                ref={(node) => {
                  labelEls.current[id] = node
                }}
                className={cn(
                  'pointer-events-none absolute top-0 left-0 rounded-(--radius-pill) px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap shadow-md ring-1 ring-black/10 transition-opacity duration-150',
                  selected === id ? 'bg-primary text-primary-foreground' : 'bg-white/95 text-[#1b1f2a]',
                  !show && 'invisible',
                )}
              >
                {info.parts[id][0]}
              </span>
            )
          })}

        {/* Title card */}
        <div className={cn(glass, 'absolute top-4 left-4 grid max-w-[min(360px,calc(100%-2rem))] gap-2 p-4 sm:p-5')}>
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] font-bold tracking-[0.14em] uppercase opacity-70">
            <span>{info.maker}</span>
            <span>
              {boards.findIndex((b) => b.id === board) + 1} / {boards.length}
            </span>
          </div>
          <h1 className="m-0 text-2xl leading-tight sm:text-3xl">{info.title}</h1>
          <p className="m-0 text-sm opacity-80">{info.tagline}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link className={buttonVariants({ size: 'sm', variant: 'primary' })} href={`/${lang}/electronics/lab${board === 'esp32' ? '?board=esp32' : ''}`}>
              <FlaskConical aria-hidden="true" />
              {t.hub.openLab}
            </Link>
            <span className="rounded-(--radius-pill) border border-current/20 px-2.5 py-1 text-xs font-bold opacity-80">{info.level}</span>
          </div>
        </div>

        {/* Views */}
        {state === 'ready' && (
          <div className={cn(glass, 'absolute top-4 right-4 hidden gap-1 rounded-(--radius-pill) p-1 sm:flex')}>
            {(['iso', 'top', 'front'] as const).map((view) => (
              <button key={view} type="button" onClick={() => api.current?.view(view)} className="cursor-pointer rounded-(--radius-pill) px-3 py-1.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10">
                {u.views[view]}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar and the board strip */}
        <div className="absolute inset-x-3 bottom-3 grid justify-items-center gap-2">
          {state === 'ready' && (
            <div className={cn(glass, 'flex flex-wrap items-center justify-center gap-1 rounded-(--radius-pill) p-1.5')}>
              {[
                { on: spin, label: u.rotate, icon: RotateCw, act: () => setSpin((x) => !x), id: 'spin' },
                { on: showCallouts, label: u.callouts, icon: MessageSquareText, act: () => setShowCallouts((x) => !x), id: 'callouts' },
                { on: tab === 'quiz', label: u.findPart, icon: ScanSearch, act: startQuiz, id: 'quiz' },
                { on: exploded, label: exploded ? u.assemble : u.explode, icon: Layers, act: () => setExploded((x) => !x), id: 'explode' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={b.act}
                  aria-pressed={b.on}
                  data-testid={b.id === 'explode' ? 'explode' : undefined}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-(--radius-pill) px-3 py-2 text-sm font-extrabold transition-colors',
                    b.on ? 'bg-[#0f7d87] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10',
                  )}
                >
                  <b.icon className="size-4" aria-hidden="true" />
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <nav aria-label={u.boardsNav} className={cn(glass, 'flex max-w-full gap-2 overflow-x-auto p-2')}>
            {boards.map((b) => (
              <Link
                key={b.id}
                href={`/${lang}/electronics/${b.id}`}
                aria-current={b.id === board ? 'page' : undefined}
                className={cn(
                  'grid w-36 shrink-0 justify-items-center gap-1 rounded-(--radius-md) px-2 pt-2 pb-1.5 text-xs font-extrabold transition-colors',
                  b.id === board ? 'bg-white shadow-sm dark:bg-white/15' : 'opacity-75 hover:bg-white/60 hover:opacity-100 dark:hover:bg-white/10',
                )}
              >
                <svg viewBox={b.id === 'uno' ? '2 34 306 242' : '16 96 268 148'} className="h-11 w-24" aria-hidden="true">
                  {b.id === 'uno' ? <UnoBoard builtin={1} tx={false} on /> : <Esp32Board builtin={1} tx={false} on />}
                </svg>
                {b.name}
                {b.id === board && <span className="h-0.5 w-6 rounded-full bg-[#0f7d87]" />}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <Card ref={details} className="gap-4 p-4 sm:p-6">
        <div role="tablist" aria-label={info.title} className="flex flex-wrap gap-1.5">
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
          <div role="tabpanel" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {selected ? (
              <div className="h-fit rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-(--ok-bg) p-4" aria-live="polite">
                <h2 className="m-0 text-xl">{info.parts[selected][0]}</h2>
                <p className="m-0 mt-1.5 text-muted-foreground">{info.parts[selected][1]}</p>
              </div>
            ) : (
              <p className="m-0 text-muted-foreground">{u.pickHint}</p>
            )}
            <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
              {partIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => select(selected === id ? null : id)}
                    onPointerEnter={() => setHovered(id)}
                    onPointerLeave={() => setHovered(hoverRef.current)}
                    aria-pressed={selected === id}
                    className={cn(
                      'w-full cursor-pointer rounded-(--radius-sm) border-(length:--stroke-thin) px-3 py-2 text-left text-sm font-bold transition-colors',
                      selected === id ? 'border-outline bg-primary text-primary-foreground' : 'border-border bg-card hover:border-outline hover:bg-surface-2',
                    )}
                  >
                    {info.parts[id][0]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'pinout' && (
          <dl role="tabpanel" className="m-0 grid gap-3 md:grid-cols-2">
            {info.pinout.map(([pins, text]) => (
              <div key={pins} className="grid gap-0.5 border-l-4 border-primary pl-3">
                <dt className="font-mono font-extrabold">{pins}</dt>
                <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === 'specs' && (
          <table role="tabpanel" className="w-full max-w-3xl border-collapse text-sm">
            <tbody>
              {info.specs.map(([k, val]) => (
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
          <div role="tabpanel" className="grid max-w-2xl gap-3" aria-live="polite">
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
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(quiz.i / quiz.order.length) * 100}%` }} />
                </div>
                <p className="m-0 text-sm font-bold text-muted-foreground">
                  {quiz.i + 1} / {quiz.order.length}
                </p>
                <p className="m-0 text-xl font-extrabold">{u.quizFind.replace('{name}', info.parts[quiz.order[quiz.i]][0])}</p>
                {quiz.feedback && <p className={cn('m-0 font-bold', quiz.feedback === u.quizRight ? 'text-success' : 'text-destructive')}>{quiz.feedback}</p>}
                {state === 'nogl' && (
                  <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
                    {partIds.map((id) => (
                      <li key={id}>
                        <button type="button" className="w-full cursor-pointer rounded-(--radius-sm) border border-border bg-card px-2 py-1.5 text-left text-sm" onClick={() => onPickRef.current(id)}>
                          {info.parts[id][0]}
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
