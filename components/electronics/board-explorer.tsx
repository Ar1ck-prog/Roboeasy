'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Layers, RotateCw, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Board3DId } from '@/components/electronics/three/boards'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

/**
 * A board in 3D, built procedurally in the browser (components/electronics/three):
 * environment reflections and soft shadows, part picking with hover and focus,
 * "take apart", labels, pinout, specifications and a find-the-part quiz.
 */

type View = 'iso' | 'top' | 'front'
type Tab = 'parts' | 'pinout' | 'specs' | 'quiz'
type Info = { title: string; parts: Record<string, [string, string]>; pinout: [string, string][]; specs: [string, string][] }

interface Api {
  select: (id: string | null) => void
  view: (v: View) => void
  spin: (on: boolean) => void
  explode: (on: boolean) => void
}

export function BoardExplorer({ board, t }: { board: Board3DId; t: ElectronicsText }) {
  const u = t.uno
  const info: Info = board === 'uno' ? t.uno : t.esp32
  const partIds = Object.keys(info.parts)
  const host = useRef<HTMLDivElement>(null)
  const labelEls = useRef<Record<string, HTMLSpanElement | null>>({})
  const api = useRef<Api | null>(null)
  const onPickRef = useRef<(id: string) => void>(() => {})
  const hoverRef = useRef<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'nogl'>('loading')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [labels, setLabels] = useState(false)
  const [spin, setSpin] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [tab, setTab] = useState<Tab>('parts')
  const [quiz, setQuiz] = useState<{ order: string[]; i: number; right: number; missed: boolean; feedback: string | null } | null>(null)

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
      const [THREE, { OrbitControls }, { RoundedBoxGeometry }, { RoomEnvironment }, { createKit }, { BUILDERS }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('@/components/electronics/three/kit'),
        import('@/components/electronics/three/boards'),
      ])
      const el = host.current
      if (disposed || !el) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      } catch {
        setState('nogl')
        return
      }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      const envScene = new RoomEnvironment()
      scene.environment = pmrem.fromScene(envScene, 0.04).texture
      scene.environmentIntensity = 0.85
      const camera = new THREE.PerspectiveCamera(34, 1, 1, 1000)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4252, 0.55))
      const key = new THREE.DirectionalLight(0xffffff, 2.1)
      key.position.set(-30, 70, 40)
      key.castShadow = true
      key.shadow.mapSize.set(2048, 2048)
      key.shadow.camera.left = -60
      key.shadow.camera.right = 60
      key.shadow.camera.top = 60
      key.shadow.camera.bottom = -60
      key.shadow.bias = -0.0004
      key.shadow.radius = 4
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xbfd8ff, 0.7)
      rim.position.set(50, 30, -60)
      scene.add(rim)

      const kit = createKit(THREE, RoundedBoxGeometry)
      const built = BUILDERS[board](THREE, kit)
      scene.add(built.root)
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.22 }))
      ground.rotation.x = -Math.PI / 2
      // Low enough for parts that drop when the board is taken apart.
      ground.position.y = built.floor - 10
      ground.receiveShadow = true
      scene.add(ground)

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

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = !reduce
      controls.dampingFactor = 0.08
      controls.minDistance = 20
      controls.maxDistance = 260
      controls.maxPolarAngle = Math.PI * 0.49
      controls.autoRotateSpeed = 1.1
      // A plain wheel scrolls the page; Ctrl/⌘ + wheel (and a pinch) zooms.
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
      }
      el.addEventListener('wheel', onWheel, { capture: true })

      // The camera keeps the whole board in frame: distance from its bounding sphere and the field of view.
      const sphere = new THREE.Box3().setFromObject(built.root).getBoundingSphere(new THREE.Sphere())
      let spread = 1
      const fitDistance = () => {
        const v = THREE.MathUtils.degToRad(camera.fov)
        const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect)
        return (sphere.radius / Math.sin(Math.min(v, h) / 2)) * 0.8 * spread
      }
      let camGoal: InstanceType<typeof THREE.Vector3> | null = null
      const targetGoal = new THREE.Vector3()
      const setView = (v: View) => {
        camGoal = new THREE.Vector3(...built.views[v]).setLength(fitDistance())
        targetGoal.set(0, explodeGoal * 7, 0)
        if (reduce) {
          camera.position.copy(camGoal)
          controls.target.copy(targetGoal)
          camGoal = null
        }
      }
      /** Moves the camera along its current direction to the fitting distance. */
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
        if (id) {
          const a = built.anchors.get(id)
          if (a) targetGoal.set(a.x * 0.3, explodeGoal * 7, a.z * 0.3)
        } else targetGoal.set(0, explodeGoal * 7, 0)
      }

      let explodeGoal = 0
      let explodeNow = 0

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
        if (hoverId) {
          hoverId = null
          hoverRef.current = null
          setHovered(null)
          paint()
        }
      }
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerup', onUp)
      renderer.domElement.addEventListener('pointerleave', onLeave)

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
      camera.position.set(...built.views.iso).setLength(fitDistance())
      // Draw only while the view is on screen.
      let visible = true
      const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
      io.observe(el)

      const v = new THREE.Vector3()
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
          const a = built.anchors.get(id)
          if (!span || !a) continue
          v.copy(a)
          v.y += explodeNow * (built.lift.get(id) ?? 10)
          v.project(camera)
          span.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h - 6}px)`
          span.style.opacity = v.z < 1 ? '' : '0'
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
    setLabels(false)
    setExploded(false)
    setQuiz({ order, i: 0, right: 0, missed: false, feedback: null })
    setTab('quiz')
  }

  const tabs: Tab[] = ['parts', 'pinout', 'specs', 'quiz']
  const quizOver = quiz && quiz.i >= quiz.order.length

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <Card className="gap-3 overflow-hidden p-0 sm:p-0">
        <div className="relative aspect-square overflow-hidden bg-[radial-gradient(120%_90%_at_50%_15%,#ffffff,#eef1f6_45%,#d9dee8)] sm:aspect-[4/3] dark:bg-[radial-gradient(120%_90%_at_50%_15%,#3a4150,#232833_50%,#151820)]">
          <div ref={host} className="absolute inset-0" data-testid="board-3d" />
          {state === 'loading' && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="m-0 animate-pulse rounded-(--radius-pill) bg-card/80 px-4 py-2 text-sm font-bold text-muted-foreground">{u.loading}</p>
            </div>
          )}
          {state === 'nogl' && <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-muted-foreground">{u.noWebgl}</p>}
          {state === 'ready' &&
            partIds.map((id) => {
              const show = labels || selected === id || hovered === id
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
          {state === 'ready' && (
            <div className="absolute top-3 right-3 left-3 flex flex-wrap justify-between gap-2">
              <div className="flex gap-1 rounded-(--radius-pill) bg-white/80 p-1 shadow-sm backdrop-blur dark:bg-black/40">
                {(['iso', 'top', 'front'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => api.current?.view(view)}
                    className="cursor-pointer rounded-(--radius-pill) px-2.5 py-1 text-xs font-extrabold text-[#1b1f2a] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                  >
                    {u.views[view]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          <Button size="sm" variant={exploded ? 'primary' : 'secondary'} onClick={() => setExploded((x) => !x)} aria-pressed={exploded} disabled={state !== 'ready'} data-testid="explode">
            <Layers aria-hidden="true" />
            {exploded ? u.assemble : u.explode}
          </Button>
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
          <div role="tabpanel" className="grid gap-3">
            {selected ? (
              <div className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-(--ok-bg) p-3" aria-live="polite">
                <h2 className="m-0 text-lg">{info.parts[selected][0]}</h2>
                <p className="m-0 mt-1 text-muted-foreground">{info.parts[selected][1]}</p>
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
          <dl role="tabpanel" className="m-0 grid gap-3">
            {info.pinout.map(([pins, text]) => (
              <div key={pins} className="grid gap-0.5 border-l-4 border-primary pl-3">
                <dt className="font-mono font-extrabold">{pins}</dt>
                <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === 'specs' && (
          <table role="tabpanel" className="w-full border-collapse text-sm">
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
