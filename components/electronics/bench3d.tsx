'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCw, SlidersHorizontal, Trash2, ZoomIn, ZoomOut } from 'lucide-react'

import { type Selection, removeSelection, terminalLabel, wireColorFor } from '@/components/electronics/bench'
import { BB_HOLES, BENCH, type CircuitDoc, P, type Part, type Wire, boardOf, legPoints, socketAtPoint } from '@/lib/electronics/board'
import type { FrameState } from '@/lib/electronics/sim'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

/**
 * The lab bench in 3D: the board, the breadboard, every part and the jumper
 * wires on a workbench. Same contract as the 2D bench (components/electronics/bench.tsx):
 * click a pin or a hole, then another, to add a wire; drag a part to move it;
 * R rotates, Delete removes. While running, LEDs glow, the servo turns and the display shows text.
 *
 * The look is a cartoon (toon shading, ink outlines, an isometric camera, no shadow maps) and the
 * scene is drawn only when something changes: it stays light on school laptops.
 */

interface Bench3DProps {
  doc: CircuitDoc
  onChange: (doc: CircuitDoc) => void
  frame: FrameState | null
  running: boolean
  selection: Selection
  onSelect: (s: Selection) => void
  t: ElectronicsText
  /** Bigger stage (full screen). */
  tall?: boolean
  /** Take the parent's height. */
  fill?: boolean
  /** Open the settings of the selected part. */
  onInspect?: () => void
  /** Filled with a function that shows a simulation frame at once, without a React render. */
  pushRef?: { current: ((f: FrameState | null, running: boolean) => void) | null }
}

type Hover = { terminal: string; x: number; y: number } | null
type Chip = { x: number; y: number; label: string } | null

interface Api {
  setDoc: (doc: CircuitDoc) => void
  setFrame: (f: FrameState | null, running: boolean) => void
  setSelection: (s: Selection) => void
  setWiring: (from: string | null) => void
  view: (top: boolean) => void
  zoom: (factor: number) => void
}

export function Bench3D({ doc, onChange, frame, running, selection, onSelect, t, tall = false, fill = false, onInspect, pushRef }: Bench3DProps) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const [ready, setReady] = useState<'loading' | 'ready' | 'nogl'>('loading')
  const [hover, setHover] = useState<Hover>(null)
  const [chip, setChip] = useState<Chip>(null)
  const [wiringFrom, setWiringFrom] = useState<string | null>(null)
  const [topView, setTopView] = useState(false)
  // Latest props for the event handlers inside the effect.
  const live = useRef({ doc, onChange, onSelect, running, t, wiringFrom, selection })
  live.current = { doc, onChange, onSelect, running, t, wiringFrom, selection }
  const board = boardOf(doc)

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    void (async () => {
      const [THREE, { OrbitControls }, { RoundedBoxGeometry }, { mergeGeometries }, { createKit }, { BUILDERS }, { createToon }, lab] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        import('three/examples/jsm/utils/BufferGeometryUtils.js'),
        import('@/components/electronics/three/kit'),
        import('@/components/electronics/three/boards'),
        import('@/components/electronics/three/toon'),
        import('@/components/electronics/three/lab-parts'),
      ])
      const el = host.current
      if (disposed || !el) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      } catch {
        setReady('nogl')
        return
      }
      const { toWorld, toBench, BB_TOP, createLabKit } = lab
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0x000000, 0)
      el.appendChild(renderer.domElement)
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.touchAction = 'none'
      renderer.domElement.tabIndex = 0
      renderer.domElement.setAttribute('aria-label', live.current.t.lab.bench)
      renderer.domElement.dataset.testid = 'bench-3d-canvas'
      // Draw-call and triangle counts for performance checks in development.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __bench3d?: unknown }).__bench3d = renderer

      const scene = new THREE.Scene()
      // An isometric camera: no perspective, like a drawing. Sizes are set in resize().
      const camera = new THREE.OrthographicCamera(-100, 100, 60, -60, -2000, 4000)
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd6dde8, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 1.9)
      key.position.set(-70, 160, 110)
      scene.add(key)

      const toon = createToon(THREE, mergeGeometries)
      /** Toon materials, ink lines, merged meshes; `keep` objects stay movable. */
      const cartoon = (root: InstanceType<typeof THREE.Object3D>, keep = new Set<InstanceType<typeof THREE.Object3D>>()) => {
        const seen = toon.toonify(root)
        toon.outline(root, keep)
        toon.flatten(root, keep)
        return seen
      }

      // A soft shadow under the board and the breadboard: a blurred dark patch instead of a shadow map.
      const blobTex = (() => {
        const c = document.createElement('canvas')
        c.width = 128
        c.height = 128
        const g = c.getContext('2d')!
        const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64)
        grad.addColorStop(0, 'rgba(20,24,36,0.30)')
        grad.addColorStop(0.6, 'rgba(20,24,36,0.16)')
        grad.addColorStop(1, 'rgba(20,24,36,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 128, 128)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        return tex
      })()
      const blob = (root: InstanceType<typeof THREE.Object3D>) => {
        const box = new THREE.Box3().setFromObject(root)
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }))
        m.rotation.x = -Math.PI / 2
        m.scale.set((box.max.x - box.min.x) * 1.25, (box.max.z - box.min.z) * 1.35, 1)
        m.position.set((box.min.x + box.max.x) / 2 + 3, 0.02, (box.min.z + box.max.z) / 2 + 4)
        m.renderOrder = -1
        m.raycast = () => {}
        return m
      }

      // The scene is drawn only when something changed.
      let dirty = true
      const kit = createKit(THREE, RoundedBoxGeometry)
      const labKit = createLabKit(THREE)
      const breadboard = labKit.breadboard()
      cartoon(breadboard)
      scene.add(breadboard, blob(breadboard))

      // ── The board, lined up with the bench by one of its header pins ──
      let boardGroup: InstanceType<typeof THREE.Group> | null = null
      let boardBlob: InstanceType<typeof THREE.Mesh> | null = null
      let boardLeds: { mat: InstanceType<typeof THREE.MeshStandardMaterial>; color: number; part: string | null }[] = []
      let socketY = 10
      let boardId = ''
      const buildBoard = (d: CircuitDoc) => {
        const b = boardOf(d)
        if (b.id === boardId) return
        boardId = b.id
        if (boardGroup) scene.remove(boardGroup)
        if (boardBlob) scene.remove(boardBlob)
        const built = BUILDERS[b.id](THREE, kit, { labPins: true })
        socketY = built.socketY
        const ref = b.headers.find((h) => h.terminal === built.pinRef.terminal)!
        const [wx, wz] = toWorld(ref.x, ref.y)
        built.root.position.set(wx - built.pinRef.local[0], 0, wz - built.pinRef.local[1])
        boardGroup = built.root
        boardLeds = []
        // Each board LED gets its own material (they light separately), then the whole board turns cartoon.
        built.root.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>
          if (m.isMesh && m.userData.ledColor !== undefined) m.material = (m.material as InstanceType<typeof THREE.MeshStandardMaterial>).clone()
        })
        cartoon(built.root)
        built.root.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>
          if (!m.isMesh || m.userData.ledColor === undefined) return
          let p: InstanceType<typeof THREE.Object3D> | null = m
          while (p && !p.userData.part) p = p.parent
          boardLeds.push({ mat: m.material as InstanceType<typeof THREE.MeshStandardMaterial>, color: m.userData.ledColor as number, part: (p?.userData.part as string) ?? null })
        })
        scene.add(built.root)
        boardBlob = blob(built.root)
        scene.add(boardBlob)
      }

      // ── Parts and wires, rebuilt when the document changes ──
      const partsRoot = new THREE.Group()
      const wiresRoot = new THREE.Group()
      scene.add(partsRoot, wiresRoot)
      type Built = ReturnType<typeof labKit.part> & { part: Part }
      let builtParts = new Map<string, Built>()
      let current: CircuitDoc = live.current.doc
      let terminals: { terminal: string; pos: InstanceType<typeof THREE.Vector3> }[] = []

      const legInserted = (p: Part) => legPoints(p).every((l) => socketAtPoint(l.x, l.y, boardOf(current).id))
      const baseY = (p: Part) => (legPoints(p).some((l) => BB_HOLES.some((h) => h.x === l.x && h.y === l.y)) ? BB_TOP : 0)
      const terminalPos = (terminal: string): InstanceType<typeof THREE.Vector3> | null => {
        const b = boardOf(current)
        const header = b.headers.find((h) => h.terminal === terminal)
        if (header) {
          const [x, z] = toWorld(header.x, header.y)
          return new THREE.Vector3(x, socketY, z)
        }
        const hole = BB_HOLES.find((h) => h.terminal === terminal)
        if (hole) {
          const [x, z] = toWorld(hole.x, hole.y)
          return new THREE.Vector3(x, BB_TOP, z)
        }
        const [id] = terminal.split('.')
        const part = current.parts.find((p) => p.id === id)
        const leg = part && legPoints(part).find((l) => l.terminal === terminal)
        if (!part || !leg) return null
        const [x, z] = toWorld(leg.x, leg.y)
        return new THREE.Vector3(x, baseY(part) + 2, z)
      }

      const placePart = (built: Built, p: Part) => {
        const [x, z] = toWorld(p.x, p.y)
        built.group.position.set(x, baseY(p), z)
        built.group.rotation.y = -p.rot * (Math.PI / 2)
      }

      const rebuild = (d: CircuitDoc) => {
        current = d
        buildBoard(d)
        const next = new Map<string, Built>()
        for (const p of d.parts) {
          const old = builtParts.get(p.id)
          const inserted = legInserted(p)
          // Geometry depends on type, colour, resistance and whether a module stands in holes.
          const keyOf = (q: Part, ins: boolean) => `${q.type}|${q.props.color}|${q.props.ohms}|${ins}`
          if (old && keyOf(old.part, (old.group.userData.inserted as boolean) ?? false) === keyOf(p, inserted)) {
            old.part = p
            placePart(old, p)
            next.set(p.id, old)
            continue
          }
          if (old) dispose(partsRoot, old.group)
          const raw = labKit.part(p, inserted)
          // Moving pieces (knob, horn, stick, cap, glow…) stay separate; the rest is merged.
          const keep = new Set(Object.values(raw.live).filter((x): x is InstanceType<typeof THREE.Object3D> => (x as InstanceType<typeof THREE.Object3D>).isObject3D === true))
          const seen = cartoon(raw.group, keep)
          const swap = <M,>(m: M) => (seen.get(m as InstanceType<typeof THREE.Material>) as M | undefined) ?? m
          const liveSwapped = Object.fromEntries(Object.entries(raw.live).map(([k, x]) => [k, (x as InstanceType<typeof THREE.Material>).isMaterial ? swap(x) : x]))
          const built = { group: raw.group, glow: raw.glow.map(swap), live: liveSwapped as typeof raw.live, part: p }
          built.group.userData.inserted = inserted
          placePart(built, p)
          partsRoot.add(built.group)
          next.set(p.id, built)
        }
        for (const [id, old] of builtParts) if (!next.has(id)) dispose(partsRoot, old.group)
        builtParts = next
        // Props shown by shape: knob angle, stick tilt.
        for (const b of builtParts.values()) {
          const knob = b.live.knob as InstanceType<typeof THREE.Object3D> | undefined
          if (knob) knob.rotation.y = -((-135 + 270 * (b.part.props.pos ?? 0.5)) * Math.PI) / 180
          const stick = b.live.stick as InstanceType<typeof THREE.Object3D> | undefined
          if (stick) {
            stick.rotation.x = ((b.part.props.jy ?? 0.5) - 0.5) * 0.9
            stick.rotation.z = -((b.part.props.jx ?? 0.5) - 0.5) * 0.9
          }
          const cap = b.live.cap as InstanceType<typeof THREE.Object3D> | undefined
          if (cap) cap.position.y = b.part.props.pressed ? 4.3 : 4.7
        }
        // Wires are rebuilt only when they or what they plug into change.
        const wireKey = (w: Wire) => {
          const a = terminalPos(w.a)
          const b = terminalPos(w.b)
          return a && b ? `${w.id}|${w.color}|${a.toArray().map((n) => n.toFixed(2))}|${b.toArray().map((n) => n.toFixed(2))}` : null
        }
        const wanted = new Map(d.wires.map((w) => [wireKey(w), w] as const).filter(([k]) => k !== null))
        for (const g of [...wiresRoot.children]) if (!wanted.has(g.userData.key as string)) dispose(wiresRoot, g)
        const have = new Set(wiresRoot.children.map((g) => g.userData.key as string))
        for (const [k, w] of wanted) {
          if (!k || have.has(k)) continue
          const g = labKit.wire(terminalPos(w.a)!, terminalPos(w.b)!, w.color)
          cartoon(g)
          g.userData.wire = w.id
          g.userData.key = k
          wiresRoot.add(g)
        }
        const b = boardOf(d)
        terminals = [
          ...b.headers.map((h) => ({ terminal: h.terminal, pos: terminalPos(h.terminal)! })),
          ...BB_HOLES.map((h) => ({ terminal: h.terminal, pos: terminalPos(h.terminal)! })),
          ...d.parts.flatMap((p) => legPoints(p).filter((l) => !socketAtPoint(l.x, l.y, b.id)).map((l) => ({ terminal: l.terminal, pos: terminalPos(l.terminal)! }))),
        ]
        paintSelection()
        dirty = true
      }

      /** Removes a group and frees what only it used (shared textures and the ink stay). */
      function dispose(parent: InstanceType<typeof THREE.Object3D>, g: InstanceType<typeof THREE.Object3D>) {
        parent.remove(g)
        g.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>
          if (!m.isMesh && !(o as InstanceType<typeof THREE.LineSegments>).isLineSegments) return
          m.geometry.dispose()
        })
      }

      // ── Selection and hover marks ──
      let selected: Selection = live.current.selection
      const tint = (obj: InstanceType<typeof THREE.Object3D>, on: boolean, color = 0x4fb3ff) =>
        obj.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>
          if (!m.isMesh) return
          for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as InstanceType<typeof THREE.MeshStandardMaterial>[]) {
            if (!('emissive' in mat) || mat.userData.glowing) continue
            if (mat.userData.baseEmissive === undefined) mat.userData.baseEmissive = mat.emissive.getHex()
            mat.emissive.setHex(on ? color : mat.userData.baseEmissive)
            mat.emissiveIntensity = on ? 0.35 : mat.emissiveIntensity
          }
        })
      const paintSelection = () => {
        for (const b of builtParts.values()) tint(b.group, selected?.kind === 'part' && selected.id === b.part.id)
        for (const g of wiresRoot.children) tint(g, selected?.kind === 'wire' && selected.id === g.userData.wire, 0x8ab4f8)
      }
      const marker = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 8, 24), new THREE.MeshBasicMaterial({ color: 0x1a73e8 }))
      marker.rotation.x = Math.PI / 2
      marker.visible = false
      scene.add(marker)
      const startMark = marker.clone()
      ;(startMark.material as InstanceType<typeof THREE.MeshBasicMaterial>) = new THREE.MeshBasicMaterial({ color: 0xe8710a })
      startMark.visible = false
      scene.add(startMark)
      const rubber = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x1a73e8, dashSize: 2, gapSize: 1.5 }))
      rubber.visible = false
      scene.add(rubber)

      // ── Camera ──
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.12
      controls.minZoom = 0.6
      controls.maxZoom = 5
      controls.maxPolarAngle = Math.PI * 0.46
      controls.addEventListener('change', () => (dirty = true))
      // The middle of the board, the breadboard and the parking strip below them.
      const aim = new THREE.Vector3(-16, 0, -15)
      controls.target.copy(aim)
      // Isometric: from the front-left, 50° above the bench.
      const iso = new THREE.Vector3(-Math.sin(0.38), 1.2, Math.cos(0.38)).normalize().multiplyScalar(600).add(aim)
      const top = new THREE.Vector3(0, 600, 1).add(aim)
      camera.position.copy(iso)
      let camGoal: InstanceType<typeof THREE.Vector3> | null = null
      let zoomGoal: number | null = null
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
      }
      el.addEventListener('wheel', onWheel, { capture: true })

      // ── Picking ──
      const ray = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      const v = new THREE.Vector3()
      const setRay = (cx: number, cy: number) => {
        const r = renderer.domElement.getBoundingClientRect()
        ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
      }
      /** The terminal nearest to the pointer on screen, within a few pixels. */
      const terminalAt = (cx: number, cy: number) => {
        const r = renderer.domElement.getBoundingClientRect()
        let best: { terminal: string; d: number; x: number; y: number } | null = null
        for (const term of terminals) {
          v.copy(term.pos).project(camera)
          const x = ((v.x + 1) / 2) * r.width
          const y = ((1 - v.y) / 2) * r.height
          const d = Math.hypot(x - (cx - r.left), y - (cy - r.top))
          if (d < 11 && (!best || d < best.d)) best = { terminal: term.terminal, d, x, y }
        }
        return best
      }
      const objectAt = (cx: number, cy: number): { part?: string; wire?: string } | null => {
        setRay(cx, cy)
        const hit = ray.intersectObjects([...partsRoot.children, ...wiresRoot.children], true)[0]
        let o: InstanceType<typeof THREE.Object3D> | null = hit?.object ?? null
        while (o && !o.userData.part && !o.userData.wire) o = o.parent
        if (!o) return null
        return o.userData.part ? { part: o.userData.part as string } : { wire: o.userData.wire as string }
      }
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const floorPoint = (cx: number, cy: number, y = 0) => {
        setRay(cx, cy)
        floor.constant = -y
        const p = new THREE.Vector3()
        return ray.ray.intersectPlane(floor, p) ? p : null
      }

      let drag: { id: string; dx: number; dz: number; sx: number; sy: number; moved: boolean; pressed?: boolean } | null = null
      let wiring: string | null = null
      let down: { x: number; y: number } | null = null

      const finishWire = (from: string, to: string) => {
        const d = live.current.doc
        if (from === to || d.wires.some((w) => (w.a === from && w.b === to) || (w.b === from && w.a === to))) return
        const wire: Wire = { id: `w${Date.now().toString(36)}${d.wires.length}`, a: from, b: to, color: wireColorFor(from, to, d.wires.length) }
        live.current.onChange({ ...d, wires: [...d.wires, wire] })
        live.current.onSelect({ kind: 'wire', id: wire.id })
      }

      const onDown = (e: PointerEvent) => {
        dirty = true
        down = { x: e.clientX, y: e.clientY }
        const term = terminalAt(e.clientX, e.clientY)
        if (term) {
          controls.enabled = false
          if (!wiring) {
            wiring = term.terminal
            setWiringFrom(wiring)
          } else {
            finishWire(wiring, term.terminal)
            wiring = null
            setWiringFrom(null)
          }
          return
        }
        const obj = objectAt(e.clientX, e.clientY)
        if (obj?.part) {
          const p = live.current.doc.parts.find((x) => x.id === obj.part)!
          controls.enabled = false
          // While running, buttons and the joystick's button are pressed rather than moved.
          if (live.current.running && (p.type === 'button' || p.type === 'joystick')) {
            live.current.onChange({ ...live.current.doc, parts: live.current.doc.parts.map((x) => (x.id === p.id ? { ...x, props: { ...x.props, pressed: true } } : x)) })
            drag = { id: p.id, dx: 0, dz: 0, sx: e.clientX, sy: e.clientY, moved: false, pressed: true }
            return
          }
          const fp = floorPoint(e.clientX, e.clientY)
          const [px, pz] = toWorld(p.x, p.y)
          drag = { id: p.id, dx: fp ? fp.x - px : 0, dz: fp ? fp.z - pz : 0, sx: e.clientX, sy: e.clientY, moved: false }
          renderer.domElement.setPointerCapture(e.pointerId)
          return
        }
        if (obj?.wire && !wiring) {
          controls.enabled = false
          live.current.onSelect({ kind: 'wire', id: obj.wire })
        }
      }

      const onMove = (e: PointerEvent) => {
        dirty = true
        if (drag && !drag.pressed) {
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true
          const fp = floorPoint(e.clientX, e.clientY)
          const b = builtParts.get(drag.id)
          if (fp && b && drag.moved) {
            b.group.position.x = fp.x - drag.dx
            b.group.position.z = fp.z - drag.dz
            b.group.position.y = 4
          }
          return
        }
        const term = terminalAt(e.clientX, e.clientY)
        if (term) {
          const pos = terminals.find((x) => x.terminal === term.terminal)!.pos
          marker.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0))
          marker.visible = true
          setHover((h) => (h?.terminal === term.terminal ? h : { terminal: term.terminal, x: term.x, y: term.y }))
          renderer.domElement.style.cursor = 'crosshair'
        } else {
          marker.visible = false
          setHover((h) => (h ? null : h))
          renderer.domElement.style.cursor = objectAt(e.clientX, e.clientY) ? 'grab' : 'default'
        }
        if (wiring) {
          const a = terminals.find((x) => x.terminal === wiring)?.pos
          const b = term ? terminals.find((x) => x.terminal === term.terminal)!.pos : floorPoint(e.clientX, e.clientY, BB_TOP)
          if (a && b) {
            rubber.geometry.setFromPoints([a, b])
            rubber.computeLineDistances()
            rubber.visible = true
          }
        }
      }

      const onUp = (e: PointerEvent) => {
        dirty = true
        controls.enabled = true
        const wasClick = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5
        down = null
        if (drag) {
          const d = live.current.doc
          if (drag.pressed) {
            live.current.onChange({ ...d, parts: d.parts.map((x) => (x.id === drag!.id ? { ...x, props: { ...x.props, pressed: false } } : x)) })
          } else if (drag.moved) {
            const b = builtParts.get(drag.id)
            if (b) {
              const [bx, by] = toBench(b.group.position.x, b.group.position.z)
              const x = Math.max(0, Math.min(BENCH.w, Math.round(bx / P) * P))
              const y = Math.max(0, Math.min(BENCH.h, Math.round(by / P) * P))
              live.current.onChange({ ...d, parts: d.parts.map((p) => (p.id === drag!.id ? { ...p, x, y } : p)) })
            }
          }
          live.current.onSelect({ kind: 'part', id: drag.id })
          drag = null
          return
        }
        // A click on empty space clears the selection and cancels a wire.
        if (wasClick && !terminalAt(e.clientX, e.clientY) && !objectAt(e.clientX, e.clientY)) {
          live.current.onSelect(null)
          wiring = null
          setWiringFrom(null)
        }
      }

      const onKey = (e: KeyboardEvent) => {
        const { selection: sel, doc: d } = live.current
        if (e.key === 'Escape') {
          wiring = null
          setWiringFrom(null)
          live.current.onSelect(null)
          return
        }
        if (!sel) return
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          live.current.onChange(removeSelection(d, sel))
          live.current.onSelect(null)
        } else if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && sel.kind === 'part') {
          live.current.onChange({ ...d, parts: d.parts.map((p) => (p.id === sel.id ? { ...p, rot: ((p.rot + 1) % 4) as Part['rot'] } : p)) })
        }
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerup', onUp)
      renderer.domElement.addEventListener('keydown', onKey)

      const resize = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = `${w}px`
        renderer.domElement.style.height = `${h}px`
        // The frustum fits the bench (about 210 × 140 mm on screen) at zoom 1.
        const aspect = w / Math.max(1, h)
        const halfW = Math.max(104, 70 * aspect)
        camera.left = -halfW
        camera.right = halfW
        camera.top = halfW / aspect
        camera.bottom = -halfW / aspect
        camera.updateProjectionMatrix()
        dirty = true
      }
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      resize()

      // ── Live state from the simulation ──
      let frame: FrameState | null = null
      let isRunning = false
      let lastLcd = new Map<string, string>()
      const applyFrame = () => {
        for (const b of builtParts.values()) {
          const id = b.part.id
          const halo = b.live.halo as InstanceType<typeof THREE.Sprite> | undefined
          for (const g of b.glow) {
            const lit = frame?.burned.includes(id) ? 0 : (frame?.leds[id] ?? 0)
            g.emissiveIntensity = lit * 2.6
            g.userData.glowing = true
            if (halo) {
              halo.material.opacity = Math.min(1, lit * 1.1)
              halo.scale.setScalar(10 + lit * 10)
            }
          }
          const rgbMat = b.live.rgb as InstanceType<typeof THREE.MeshStandardMaterial> | undefined
          if (rgbMat) {
            const [r, g, bl] = frame?.rgb[id] ?? [0, 0, 0]
            rgbMat.emissive.setRGB(r, g, bl)
            rgbMat.userData.glowing = true
            const lit = Math.max(r, g, bl)
            if (halo) {
              halo.material.color.setRGB(r / (lit || 1), g / (lit || 1), bl / (lit || 1))
              halo.material.opacity = Math.min(1, lit * 1.1)
              halo.scale.setScalar(10 + lit * 10)
            }
          }
          const horn = b.live.horn as InstanceType<typeof THREE.Object3D> | undefined
          if (horn) horn.rotation.y = (((frame?.servos[id] ?? 90) - 90) * Math.PI) / 180
          const ring = b.live.ring as InstanceType<typeof THREE.Mesh> | undefined
          if (ring) (ring.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = frame?.tones.some((x) => x.part === id) ? 0.85 : 0
          const lamp = b.live.lamp as InstanceType<typeof THREE.MeshStandardMaterial> | undefined
          if (lamp) {
            lamp.emissiveIntensity = frame?.pir[id] ? 2.5 : 0
            lamp.userData.glowing = true
          }
          const screen = b.live.screen as InstanceType<typeof THREE.CanvasTexture> | undefined
          if (screen) {
            const state = frame ? frame.lcd[id] : null
            const key = JSON.stringify(state ?? null)
            if (lastLcd.get(id) !== key) {
              labKit.paintScreen(screen, state ?? null)
              lastLcd.set(id, key)
            }
          }
        }
        for (const l of boardLeds) {
          const on = l.part === 'led' ? (frame?.builtin ?? 0) : l.part === 'txrx' ? (frame?.tx ? 1 : 0) : isRunning ? 1 : 0
          l.mat.emissive.setHex(l.color)
          l.mat.emissiveIntensity = on * 2.4
        }
      }

      let frameId = 0
      const loop = () => {
        frameId = requestAnimationFrame(loop)
        if (camGoal) {
          camera.position.lerp(camGoal, 0.15)
          if (camera.position.distanceTo(camGoal) < 0.5) camGoal = null
          dirty = true
        }
        if (zoomGoal !== null) {
          camera.zoom += (zoomGoal - camera.zoom) * 0.2
          if (Math.abs(camera.zoom - zoomGoal) < 0.005) {
            camera.zoom = zoomGoal
            zoomGoal = null
          }
          camera.updateProjectionMatrix()
          dirty = true
        }
        if (wiring) {
          const p = terminals.find((x) => x.terminal === wiring)?.pos
          if (p) {
            startMark.position.copy(p).add(new THREE.Vector3(0, 0.3, 0))
            startMark.visible = true
          }
        } else {
          startMark.visible = false
          rubber.visible = false
        }
        controls.update()
        if (!dirty) return
        dirty = false
        renderer.render(scene, camera)
        // The floating chip over the selected part.
        const sel = selected
        if (sel?.kind === 'part') {
          const b = builtParts.get(sel.id)
          if (b) {
            const box = new THREE.Box3().setFromObject(b.group)
            v.set((box.min.x + box.max.x) / 2, box.max.y + 4, (box.min.z + box.max.z) / 2).project(camera)
            const r = el.getBoundingClientRect()
            setChip((c) => {
              const x = ((v.x + 1) / 2) * r.width
              const y = ((1 - v.y) / 2) * r.height
              return c && Math.abs(c.x - x) < 1 && Math.abs(c.y - y) < 1 ? c : { x, y, label: live.current.t.parts[b.part.type] }
            })
          }
        } else setChip((c) => (c ? null : c))
      }
      loop()

      api.current = {
        setDoc: rebuild,
        setFrame: (f, r) => {
          if (f === frame && r === isRunning) return
          frame = f
          isRunning = r
          if (!f) lastLcd = new Map()
          applyFrame()
          dirty = true
        },
        setSelection: (s) => {
          selected = s
          paintSelection()
          dirty = true
        },
        setWiring: (from) => {
          wiring = from
          dirty = true
        },
        view: (topOn) => {
          camGoal = (topOn ? top : iso).clone()
          controls.target.copy(aim)
        },
        zoom: (f) => {
          zoomGoal = Math.max(controls.minZoom, Math.min(controls.maxZoom, (zoomGoal ?? camera.zoom) / f))
        },
      }
      rebuild(live.current.doc)
      if (pushRef) pushRef.current = (f, r) => api.current?.setFrame(f, r)
      setReady('ready')

      cleanup = () => {
        cancelAnimationFrame(frameId)
        ro.disconnect()
        el.removeEventListener('wheel', onWheel, { capture: true })
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointermove', onMove)
        renderer.domElement.removeEventListener('pointerup', onUp)
        renderer.domElement.removeEventListener('keydown', onKey)
        controls.dispose()
        scene.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>
          if (!m.isMesh) return
          m.geometry.dispose()
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            ;(mat as InstanceType<typeof THREE.MeshStandardMaterial>).map?.dispose()
            mat.dispose()
          }
        })
        blobTex.dispose()
        if (pushRef) pushRef.current = null
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

  useEffect(() => api.current?.setDoc(doc), [doc, ready])
  useEffect(() => api.current?.setFrame(frame, running), [frame, running, ready])
  useEffect(() => api.current?.setSelection(selection), [selection, ready])
  useEffect(() => api.current?.setWiring(wiringFrom), [wiringFrom, ready])

  const volts = hover && frame && running ? frame.volts(hover.terminal) : null
  const removeSelected = () => {
    if (!selection) return
    onChange(removeSelection(doc, selection))
    onSelect(null)
  }
  const rotateSelected = () => {
    if (selection?.kind !== 'part') return
    onChange({ ...doc, parts: doc.parts.map((p) => (p.id === selection.id ? { ...p, rot: ((p.rot + 1) % 4) as Part['rot'] } : p)) })
  }

  return (
    <div className={cn('relative overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-border bench-paper', fill ? 'h-[62vh] min-h-[420px] xl:h-full' : tall ? 'h-[calc(100dvh-220px)] min-h-[520px]' : 'h-[min(66vh,620px)] min-h-[420px]')} data-testid="bench-3d" data-wires={doc.wires.length} data-parts={doc.parts.length}>
      <div ref={host} className="absolute inset-0" />
      {ready === 'loading' && <p className="absolute inset-0 m-0 grid place-items-center text-sm font-bold text-[#454b5c]">{t.uno.loading}</p>}
      {ready === 'nogl' && <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-muted-foreground">{t.uno.noWebgl}</p>}
      {wiringFrom && (
        <p className="pointer-events-none absolute top-3 left-1/2 m-0 -translate-x-1/2 rounded-(--radius-pill) bg-[#1b1f2a]/90 px-3 py-1.5 text-xs font-bold text-white">{t.lab.wiring}</p>
      )}
      {hover && (
        <span className="pointer-events-none absolute rounded-(--radius-sm) bg-[#1b1f2a]/92 px-2 py-1 text-xs font-bold whitespace-nowrap text-white" style={{ left: hover.x, top: hover.y - 34, transform: 'translateX(-50%)' }}>
          {terminalLabel(hover.terminal, doc, t, board)}
          {volts !== null && ` · ${t.lab.voltage.replace('{v}', volts.toFixed(2))}`}
        </span>
      )}
      {chip && selection?.kind === 'part' && (
        <div className="absolute flex items-center gap-1 rounded-(--radius-pill) border border-white/60 bg-white/85 p-1 text-xs font-bold text-[#1b1f2a] shadow-md backdrop-blur" style={{ left: chip.x, top: chip.y - 44, transform: 'translateX(-50%)' }}>
          <span className="px-2 whitespace-nowrap">{chip.label}</span>
          {onInspect && (
            <button type="button" onClick={onInspect} className="inline-flex cursor-pointer items-center rounded-(--radius-pill) bg-white p-1.5 hover:bg-[#f1f3f4]" aria-label={t.lab.partTab} title={t.lab.partTab}>
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={rotateSelected} className="inline-flex cursor-pointer items-center gap-1 rounded-(--radius-pill) bg-white px-2 py-1 hover:bg-[#f1f3f4]">
            <RotateCw className="size-3.5" aria-hidden="true" />
            {t.lab.rotate.replace(/\s*\(.*\)/, '')}
          </button>
          <button type="button" onClick={removeSelected} className="inline-flex cursor-pointer items-center gap-1 rounded-(--radius-pill) bg-white px-2 py-1 text-[#c5221f] hover:bg-[#fce8e6]">
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t.lab.remove.replace(/\s*\(.*\)/, '')}
          </button>
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1 rounded-(--radius-pill) border border-white/60 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40">
        <button type="button" className="cursor-pointer rounded-(--radius-pill) px-2.5 py-1 text-xs font-extrabold text-[#1b1f2a] hover:bg-black/5 dark:text-white" onClick={() => (setTopView((x) => !x), api.current?.view(!topView))} aria-pressed={topView}>
          {topView ? t.uno.views.iso : t.uno.views.top}
        </button>
        <button type="button" className="cursor-pointer rounded-(--radius-pill) p-1.5 text-[#1b1f2a] hover:bg-black/5 dark:text-white" onClick={() => api.current?.zoom(0.82)} aria-label="+">
          <ZoomIn className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className="cursor-pointer rounded-(--radius-pill) p-1.5 text-[#1b1f2a] hover:bg-black/5 dark:text-white" onClick={() => api.current?.zoom(1.22)} aria-label="−">
          <ZoomOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
