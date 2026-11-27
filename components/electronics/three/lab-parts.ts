/**
 * 3D models of the lab bench: the breadboard, every part and the jumper
 * wires, in millimetres. The bench's 2D coordinates (px, one pin pitch is
 * 10 px = 2.54 mm) map straight onto the 3D floor, so the 3D view and the
 * simulator share one layout: a leg in hole e14 is in hole e14 in both.
 */

import type * as THREE_NS from 'three'

import { BB, BB_HOLES, BENCH, type LedColor, P, type Part } from '@/lib/electronics/board'

type Three = typeof THREE_NS
type G = THREE_NS.Group

export const MM = 2.54 / P
/** Bench px → world mm (x, z), centred on the bench. */
export const toWorld = (x: number, y: number): [number, number] => [(x - BENCH.w / 2) * MM, (y - BENCH.h / 2) * MM]
export const toBench = (x: number, z: number): [number, number] => [x / MM + BENCH.w / 2, z / MM + BENCH.h / 2]
/** Height of the breadboard's top. */
export const BB_TOP = 8.5

const LED_HEX: Record<LedColor, number> = { red: 0xff3b2f, yellow: 0xffd43b, green: 0x37d67a, blue: 0x3d8bff, white: 0xf5f5f5 }
const BAND = [0x000000, 0x8b4513, 0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa, 0x9e9e9e, 0xffffff]

export function createLabKit(T: Three) {
  const std = (color: number, rough = 0.5, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  const mesh = (geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material | THREE_NS.Material[], x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }
  const box = (w: number, h: number, d: number, mat: THREE_NS.Material, x = 0, y = 0, z = 0) => mesh(new T.BoxGeometry(w, h, d), mat, x, y + h / 2, z)
  const cyl = (r: number, h: number, mat: THREE_NS.Material, x = 0, y = 0, z = 0, seg = 24) => mesh(new T.CylinderGeometry(r, r, h, seg), mat, x, y + h / 2, z)
  const metal = () => std(0xcfd3d8, 0.25, 1)
  const gold = () => std(0xe6bd52, 0.25, 1)
  const pcb = (color: number) => new T.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.25 })
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, px = 20) => {
    const c = document.createElement('canvas')
    c.width = Math.round(w * px)
    c.height = Math.round(h * px)
    draw(c.getContext('2d')!, c.width, c.height)
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    t.anisotropy = 8
    return t
  }
  /** A leg going from the body down to the hole (or to the mat). */
  const leg = (g: G, x: number, z: number, top: number, bottom = -1.5) => g.add(box(0.5, top - bottom, 0.5, metal(), x, bottom, z))
  /** Male header pins lying flat along +z at the edge of a module (where the wires go). */
  const flatPins = (g: G, n: number) => {
    g.add(box(n * 2.54, 2.5, 2.5, std(0x1a1a1c, 0.6), ((n - 1) * 2.54) / 2, 0.6, -1.4))
    for (let i = 0; i < n; i++) {
      const pin = box(0.64, 0.64, 8, gold(), i * 2.54, 1.55, 0.6)
      g.add(pin)
    }
  }

  /** A soft additive glow around a lit LED; its opacity and colour follow the brightness. */
  let haloTex: THREE_NS.CanvasTexture | null = null
  const halo = (color: number, x: number, y: number) => {
    haloTex ??= canvasTex(4, 4, (c, W, H) => {
      const grad = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = grad
      c.fillRect(0, 0, W, H)
    }, 32)
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }))
    sprite.position.set(x, y, 0)
    sprite.scale.set(16, 16, 1)
    sprite.renderOrder = 10
    return sprite
  }

  // ── Breadboard ──
  function breadboard(): G {
    const g = new T.Group()
    const w = BB.w * MM
    const d = BB.h * MM
    const top = canvasTex(w, d, (c, W, H) => {
      const s = W / BB.w
      c.fillStyle = '#f7f4ec'
      c.fillRect(0, 0, W, H)
      c.fillStyle = '#e4ddcc'
      // The channel between rows e and f
      c.fillRect(4 * s, 98 * s, (BB.w - 8) * s, 14 * s)
      for (const [y, color] of [
        [10 - 6, '#1a73e8'],
        [20 + 6, '#d93025'],
        [190 - 6, '#d93025'],
        [200 + 6, '#1a73e8'],
      ] as const) {
        c.strokeStyle = color
        c.lineWidth = 1.4 * s
        c.beginPath()
        c.moveTo(6 * s, y * s)
        c.lineTo((BB.w - 6) * s, y * s)
        c.stroke()
      }
      c.fillStyle = '#3a3a3a'
      for (const h of BB_HOLES) {
        const x = (h.x - BB.x) * s
        const y = (h.y - BB.y) * s
        c.fillRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s)
      }
      c.fillStyle = '#80868b'
      c.font = `600 ${5.5 * s}px system-ui, sans-serif`
      c.textAlign = 'center'
      for (let col = 1; col <= BB.cols; col++)
        if (col === 1 || col % 5 === 0) {
          c.fillText(String(col), (10 + (col - 1) * P) * s, 44 * s)
          c.fillText(String(col), (10 + (col - 1) * P) * s, 172 * s)
        }
      c.textAlign = 'left'
      ;['a', 'b', 'c', 'd', 'e'].forEach((r, i) => c.fillText(r, 2 * s, (52 + i * 10) * s))
      ;['f', 'g', 'h', 'i', 'j'].forEach((r, i) => c.fillText(r, 2 * s, (122 + i * 10) * s))
    }, 10)
    const side = std(0xefeadf, 0.7)
    const body = mesh(new T.BoxGeometry(w, BB_TOP, d), [side, side, new T.MeshStandardMaterial({ map: top, roughness: 0.75 }), side, side, side])
    body.position.y = BB_TOP / 2
    g.add(body)
    const [cx, cz] = toWorld(BB.x + BB.w / 2, BB.y + BB.h / 2)
    g.position.set(cx, 0, cz)
    return g
  }

  // ── Parts ──

  /** A part's model with its first leg at the origin, legs along +x (+z for the button's second row). */
  function part(p: Part, inserted: boolean): { group: G; glow: THREE_NS.MeshStandardMaterial[]; live: Record<string, THREE_NS.Object3D | THREE_NS.Material | THREE_NS.CanvasTexture> } {
    const g = new T.Group()
    const glow: THREE_NS.MeshStandardMaterial[] = []
    const live: Record<string, THREE_NS.Object3D | THREE_NS.Material | THREE_NS.CanvasTexture> = {}
    const props = p.props
    switch (p.type) {
      case 'led': {
        const color = LED_HEX[props.color ?? 'red']
        const lens = new T.MeshPhysicalMaterial({ color, roughness: 0.18, transmission: 0.2, thickness: 2, emissive: color, emissiveIntensity: 0 })
        glow.push(lens)
        leg(g, 0, 0, 3)
        leg(g, 2.54, 0, 3)
        g.add(cyl(2.9, 1, lens, 1.27, 3))
        g.add(cyl(2.5, 5.2, lens, 1.27, 4))
        const dome = mesh(new T.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens, 1.27, 9.2, 0)
        g.add(dome)
        live.halo = halo(color, 1.27, 8)
        g.add(live.halo)
        break
      }
      case 'rgb': {
        const lens = new T.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.4, transmission: 0.1, emissive: 0x000000, emissiveIntensity: 1.6 })
        live.rgb = lens
        for (let i = 0; i < 4; i++) leg(g, i * 2.54, 0, 3)
        g.add(cyl(2.9, 1, lens, 3.81, 3))
        g.add(cyl(2.5, 5.2, lens, 3.81, 4))
        g.add(mesh(new T.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens, 3.81, 9.2, 0))
        live.halo = halo(0xffffff, 3.81, 8)
        g.add(live.halo)
        break
      }
      case 'resistor': {
        const len = 10.16
        leg(g, 0, 0, 3)
        leg(g, len, 0, 3)
        const wire = mesh(new T.CylinderGeometry(0.25, 0.25, len, 8), metal(), len / 2, 3, 0)
        wire.rotation.z = Math.PI / 2
        g.add(wire)
        const body = mesh(new T.CapsuleGeometry(1.15, 4.2, 6, 16), std(0xe2c799, 0.5), len / 2, 3, 0)
        body.rotation.z = Math.PI / 2
        g.add(body)
        const ohms = props.ohms ?? 220
        const exp = Math.max(0, Math.floor(Math.log10(Math.max(ohms, 10))) - 1)
        const digits = Math.round(ohms / 10 ** exp)
        ;[BAND[Math.floor(digits / 10) % 10], BAND[digits % 10], BAND[exp] ?? 0, 0xc9a227].forEach((color, i) => {
          const band = mesh(new T.CylinderGeometry(1.22, 1.22, 0.45, 16), std(color, 0.5), len / 2 - 1.8 + i * 1.1 + (i === 3 ? 0.5 : 0), 3, 0)
          band.rotation.z = Math.PI / 2
          g.add(band)
        })
        break
      }
      case 'button': {
        for (const [x, z] of [
          [0, 0],
          [5.08, 0],
          [0, 7.62],
          [5.08, 7.62],
        ])
          leg(g, x, z, 0.5)
        g.add(box(6.2, 3.4, 6.2, std(0x202124, 0.5), 2.54, 0.2, 3.81))
        g.add(box(5.9, 0.3, 5.9, metal(), 2.54, 3.6, 3.81))
        const cap = cyl(1.8, 1.6, std(0xc62828, 0.4), 2.54, 3.9, 3.81)
        live.cap = cap
        g.add(cap)
        break
      }
      case 'pot': {
        for (let i = 0; i < 3; i++) leg(g, i * 2.54, 0, 1)
        g.add(box(9.5, 6, 6.5, std(0x1f5fae, 0.5), 2.54, 1, -0.6))
        const knob = new T.Group()
        knob.position.set(2.54, 7, -0.6)
        knob.add(cyl(3.6, 5, std(0xf1f3f4, 0.4)))
        knob.add(box(0.7, 0.4, 3.4, std(0x202124), 0, 5, 1.3))
        knob.rotation.y = -((-135 + 270 * (props.pos ?? 0.5)) * Math.PI) / 180
        live.knob = knob
        g.add(knob)
        break
      }
      case 'ldr': {
        leg(g, 0, 0, 3.5)
        leg(g, 5.08, 0, 3.5)
        const face = canvasTex(5.2, 5.2, (c, W, H) => {
          c.fillStyle = '#d9a066'
          c.beginPath()
          c.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2)
          c.fill()
          c.strokeStyle = '#8b2f1c'
          c.lineWidth = W * 0.07
          c.beginPath()
          for (let i = 0; i < 5; i++) {
            const y = H * (0.25 + i * 0.12)
            c.moveTo(W * 0.2, y)
            c.lineTo(W * 0.8, y)
          }
          c.stroke()
        })
        const head = mesh(new T.CylinderGeometry(2.6, 2.6, 1.8, 24), [std(0xc68a4f, 0.4), new T.MeshStandardMaterial({ map: face, roughness: 0.4 }), std(0xc68a4f)], 2.54, 4.4, 0)
        g.add(head)
        break
      }
      case 'buzzer': {
        leg(g, 0, 0, 1)
        leg(g, 7.62, 0, 1)
        g.add(cyl(6, 7.5, std(0x1d1d1f, 0.6), 3.81, 1, 0, 32))
        g.add(cyl(1.2, 0.2, std(0x444444), 3.81, 8.5, 0))
        const ring = mesh(new T.TorusGeometry(8, 0.35, 8, 40), new T.MeshBasicMaterial({ color: 0xffc531, transparent: true, opacity: 0 }), 3.81, 8.6, 0)
        ring.rotation.x = Math.PI / 2
        live.ring = ring
        g.add(ring)
        break
      }
      default:
        module(g, p, inserted, live)
    }
    g.userData.part = p.id
    return { group: g, glow, live }
  }

  /** Modules on their own little board: they lie flat beside the breadboard, pins towards the viewer; pushed into holes they stand up. */
  function module(g: G, p: Part, inserted: boolean, live: Record<string, THREE_NS.Object3D | THREE_NS.Material | THREE_NS.CanvasTexture>) {
    const pivot = new T.Group()
    g.add(pivot)
    if (inserted && p.type !== 'servo') {
      pivot.rotation.x = Math.PI / 2
      pivot.position.y = 2
    }
    const props = p.props
    const n = { servo: 3, ultrasonic: 4, pir: 3, dht: 3, lcd: 4, joystick: 5 }[p.type as 'servo'] ?? 3
    if (p.type === 'servo') {
      // A female 3-pin connector at the legs, a cable to the SG90 body standing behind.
      g.add(box(7.6, 2.6, 5, std(0x1d1d1f, 0.6), 2.54, 0, 0))
      const cable = new T.CatmullRomCurve3([new T.Vector3(2.54, 1.3, 2.5), new T.Vector3(2.54, 1.2, 9), new T.Vector3(-2, 1, 14), new T.Vector3(-3, 1, 18)])
      for (const [i, color] of [0x6d3a1f, 0xd93025, 0xe8710a].entries()) g.add(mesh(new T.TubeGeometry(cable, 24, 0.45, 6, false), std(color, 0.5), (i - 1) * 0.9, 0, 0))
      g.add(box(22.8, 22.5, 12.2, std(0x1f5fae, 0.45), -2, 0, 24))
      g.add(box(32, 2.5, 12.2, std(0x1f5fae, 0.45), -2, 16, 24))
      g.add(cyl(2.5, 4, std(0xf2f2f2, 0.4), 3.5, 22.5, 24))
      const horn = new T.Group()
      horn.position.set(3.5, 26.6, 24)
      horn.add(box(14, 1.5, 4.5, std(0xf7f7f7, 0.4), 4.5, 0, 0))
      horn.add(cyl(3, 1.6, std(0xf7f7f7, 0.4)))
      live.horn = horn
      g.add(horn)
      return
    }
    flatPins(pivot, n)
    const plate = (w: number, d: number, color: number, x: number) => pivot.add(box(w, 1.6, d, pcb(color), x, 0.8, -d / 2 - 2.6))
    switch (p.type) {
      case 'ultrasonic': {
        plate(45, 20, 0x1f5fae, 3.81)
        for (const x of [3.81 - 13, 3.81 + 13]) {
          pivot.add(cyl(8, 12, std(0xc9ccd1, 0.3, 0.8), x, 2.4, -12.6, 32))
          pivot.add(cyl(6.2, 0.4, std(0x2b2f33, 0.8), x, 14.2, -12.6, 32))
        }
        pivot.add(box(4, 2, 3, std(0x9aa0a6, 0.3, 0.9), 3.81, 2.4, -12.6))
        break
      }
      case 'pir': {
        plate(32, 24, 0x1e7a3c, 2.54)
        const dome = mesh(new T.SphereGeometry(11.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xf4f4f2, roughness: 0.55, transmission: 0.05 }), 2.54, 2.4, -14.6)
        pivot.add(dome)
        const lamp = new T.MeshStandardMaterial({ color: 0x5f1a16, emissive: 0xff3b30, emissiveIntensity: 0 })
        live.lamp = lamp
        pivot.add(box(1.6, 0.6, 1, lamp, -11, 2.4, -24))
        break
      }
      case 'dht': {
        plate(18, 14, 0x1d1d1f, 2.54)
        const grid = canvasTex(12, 15.5, (c, W, H) => {
          c.fillStyle = '#3b82f6'
          c.fillRect(0, 0, W, H)
          c.fillStyle = '#1e4fa8'
          for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) c.fillRect(W * (0.12 + k * 0.2), H * (0.08 + r * 0.15), W * 0.12, H * 0.09)
        })
        const sensor = mesh(new T.BoxGeometry(12, 5.5, 15.5), [std(0x3b82f6), std(0x3b82f6), new T.MeshStandardMaterial({ map: grid, roughness: 0.5 }), std(0x3b82f6), std(0x3b82f6), std(0x3b82f6)], 2.54, 2.4 + 2.75, -11)
        pivot.add(sensor)
        break
      }
      case 'lcd': {
        plate(53, 22, 0x1e7a3c, 18.5)
        pivot.add(box(46, 2.2, 15.5, std(0x1d1d1f, 0.5), 18.5, 2.4, -13.6))
        const screen = canvasTex(42, 12, (c, W, H) => {
          c.fillStyle = '#22313a'
          c.fillRect(0, 0, W, H)
        }, 24)
        live.screen = screen
        const face = mesh(new T.PlaneGeometry(42, 12), new T.MeshStandardMaterial({ map: screen, roughness: 0.35, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: 0.15 }), 18.5, 4.65, -13.6)
        face.rotation.x = -Math.PI / 2
        live.face = face
        pivot.add(face)
        break
      }
      case 'joystick': {
        plate(26, 34, 0x202124, 5.08)
        pivot.add(box(16, 5, 16, std(0x3c4043, 0.5), 5.08, 2.4, -20))
        const stick = new T.Group()
        stick.position.set(5.08, 7.4, -20)
        stick.add(cyl(1.4, 7, std(0x9aa0a6, 0.3, 0.8)))
        const knob = mesh(new T.SphereGeometry(6, 24, 16), std(0x1d1d1f, 0.6), 0, 9, 0)
        knob.scale.y = 0.7
        stick.add(knob)
        stick.rotation.x = ((props.jy ?? 0.5) - 0.5) * 0.9
        stick.rotation.z = -((props.jx ?? 0.5) - 0.5) * 0.9
        live.stick = stick
        pivot.add(stick)
        break
      }
      default:
        plate(20, 14, 0x1e7a3c, 2.54)
    }
  }

  /** Draws a display's two lines on its canvas. */
  function paintScreen(tex: THREE_NS.Texture, state: { lines: [string, string]; backlight: boolean } | null) {
    const c = tex.image as HTMLCanvasElement
    const g = c.getContext('2d')!
    const W = c.width
    const H = c.height
    g.fillStyle = state ? (state.backlight ? '#6fc8ff' : '#2a4f66') : '#22313a'
    g.fillRect(0, 0, W, H)
    if (state) {
      g.fillStyle = state.backlight ? '#06233f' : '#9fc5dc'
      g.font = `700 ${H * 0.36}px ui-monospace, Consolas, monospace`
      g.textBaseline = 'middle'
      state.lines.forEach((line, row) => {
        for (let i = 0; i < 16; i++) g.fillText(line[i] ?? ' ', W * 0.035 + i * W * 0.058, H * (0.3 + row * 0.42))
      })
    }
    tex.needsUpdate = true
  }

  /** A jumper wire between two points: a soft arc with black housings and metal pins at both ends. */
  function wire(a: THREE_NS.Vector3, b: THREE_NS.Vector3, color: string): G {
    const g = new T.Group()
    const mat = std(new T.Color(color).getHex(), 0.5)
    const lift = 8 + Math.min(30, a.distanceTo(b) * 0.25)
    const ends = [a, b].map((p) => p.clone().add(new T.Vector3(0, 8, 0)))
    const mid = a.clone().lerp(b, 0.5)
    mid.y = Math.max(a.y, b.y) + lift
    const curve = new T.CatmullRomCurve3([ends[0], ends[0].clone().lerp(mid, 0.45).setY(mid.y * 0.9), mid, ends[1].clone().lerp(mid, 0.45).setY(mid.y * 0.9), ends[1]])
    g.add(mesh(new T.TubeGeometry(curve, 48, 0.75, 8, false), mat))
    for (const [i, p] of [a, b].entries()) {
      g.add(box(2.5, 7, 2.5, std(0x1d1d1f, 0.6), p.x, p.y + 1.2, p.z))
      g.add(box(0.6, 1.4, 0.6, metal(), p.x, p.y - 0.2, p.z))
      void i
    }
    return g
  }

  return { breadboard, part, wire, paintScreen }
}

export type LabKit = ReturnType<typeof createLabKit>
