/**
 * A procedural kit of electronic parts for three.js, in millimetres.
 * Every builder returns a Group that stands on y = 0 and is centred on x/z,
 * so a board places parts by their footprint centre. Nothing is loaded from
 * files: shapes, materials and the small printed labels are made here.
 */

import type * as THREE_NS from 'three'

type Three = typeof THREE_NS
type RoundedBoxCtor = new (w: number, h: number, d: number, segments?: number, radius?: number) => THREE_NS.BufferGeometry

export const PITCH = 2.54

export function createKit(T: Three, RoundedBox: RoundedBoxCtor) {
  const cache = new Map<string, THREE_NS.Material>()
  const material = <M extends THREE_NS.Material>(key: string, make: () => M): M => {
    let m = cache.get(key)
    if (!m) {
      m = make()
      cache.set(key, m)
    }
    return m as M
  }

  const M = {
    plastic: (color: number, rough = 0.55) => material(`plastic${color}${rough}`, () => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })),
    metal: (color = 0xd8dde2, rough = 0.28) => material(`metal${color}${rough}`, () => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 1 })),
    gold: () => material('gold', () => new T.MeshStandardMaterial({ color: 0xe6bd52, roughness: 0.22, metalness: 1 })),
    solder: () => material('solder', () => new T.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.18, metalness: 1 })),
    ceramic: (color: number) => material(`ceramic${color}`, () => new T.MeshStandardMaterial({ color, roughness: 0.6 })),
    /** Solder mask: glossy lacquer over the board. */
    mask: (color: number) => material(`mask${color}`, () => new T.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.22 })),
    glow: (color: number) => new T.MeshStandardMaterial({ color: 0xf4f4f4, emissive: color, emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.92 }),
  }

  const mesh = (geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material | THREE_NS.Material[], x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }
  const box = (w: number, h: number, d: number, mat: THREE_NS.Material, x = 0, y = 0, z = 0) => mesh(new T.BoxGeometry(w, h, d), mat, x, y + h / 2, z)
  const rbox = (w: number, h: number, d: number, r: number, mat: THREE_NS.Material, x = 0, y = 0, z = 0) =>
    mesh(new RoundedBox(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat, x, y + h / 2, z)
  const cylinder = (r: number, h: number, mat: THREE_NS.Material, x = 0, y = 0, z = 0, segments = 32) => mesh(new T.CylinderGeometry(r, r, h, segments), mat, x, y + h / 2, z)

  /** A canvas texture for small printed labels on chips and shields. */
  const label = (w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, scale = 40) => {
    const c = document.createElement('canvas')
    c.width = Math.round(w * scale)
    c.height = Math.round(h * scale)
    draw(c.getContext('2d')!, c.width, c.height)
    const tex = new T.CanvasTexture(c)
    tex.colorSpace = T.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }
  /** A thin plane lying on top of something, for printed marks. */
  const decal = (w: number, d: number, tex: THREE_NS.Texture, y: number, rough = 0.6) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: rough }))
    m.rotation.x = -Math.PI / 2
    m.position.y = y
    return m
  }
  const group = (...children: THREE_NS.Object3D[]) => {
    const g = new T.Group()
    for (const c of children) g.add(c)
    return g
  }

  return {
    M,
    mesh,
    box,
    rbox,
    cylinder,
    label,
    group,

    /**
     * A circuit board: the outline is a rounded rectangle with optional notches,
     * extruded with a small bevel; the top carries the drawn texture.
     */
    pcb(L: number, W: number, thick: number, color: number, art: HTMLCanvasElement, holes: [number, number, number][] = [], corner = 1.6) {
      const s = new T.Shape()
      const x0 = -L / 2
      const y0 = -W / 2
      const r = corner
      s.moveTo(x0 + r, y0)
      s.lineTo(x0 + L - r, y0)
      s.quadraticCurveTo(x0 + L, y0, x0 + L, y0 + r)
      s.lineTo(x0 + L, y0 + W - r)
      s.quadraticCurveTo(x0 + L, y0 + W, x0 + L - r, y0 + W)
      s.lineTo(x0 + r, y0 + W)
      s.quadraticCurveTo(x0, y0 + W, x0, y0 + W - r)
      s.lineTo(x0, y0 + r)
      s.quadraticCurveTo(x0, y0, x0 + r, y0)
      // Holes are given in board millimetres from the left and from the top edge.
      for (const [hx, hz, hr] of holes) {
        const h = new T.Path()
        h.absarc(hx - L / 2, W / 2 - hz, hr, 0, Math.PI * 2, true)
        s.holes.push(h)
      }
      const geo = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 24 })
      geo.rotateX(-Math.PI / 2)
      const tex = new T.CanvasTexture(art)
      tex.colorSpace = T.SRGBColorSpace
      tex.anisotropy = 8
      tex.repeat.set(1 / L, 1 / W)
      tex.offset.set(0.5, 0.5)
      const top = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.22 })
      const side = M.mask(color)
      const m = mesh(geo, [top, side])
      m.position.y = 0
      return m
    },

    /** Female header: a black strip with square sockets and gold contacts deep inside. */
    femaleHeader(n: number, height = 8.5) {
      const g = group(rbox(n * PITCH - 0.08, height, 2.5, 0.25, M.plastic(0x1a1a1c, 0.6)))
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * PITCH
        g.add(box(1.05, 0.06, 1.05, M.plastic(0x050505, 0.9), x, height - 0.04, 0))
        g.add(box(0.5, 0.05, 0.5, M.gold(), x, height - 0.7, 0))
      }
      return g
    },

    /** Male pin header: plastic spacer and gold square pins (`down` makes them point under the board). */
    maleHeader(cols: number, rows = 1, pinLength = 6, down = false, spacer = 2.5) {
      const g = group()
      const w = cols * PITCH
      const d = rows * PITCH
      const sy = down ? -spacer - 1.6 : 0
      g.add(rbox(w - 0.08, spacer, d - 0.08, 0.2, M.plastic(0x1a1a1c, 0.6), 0, sy, 0))
      for (let i = 0; i < cols; i++)
        for (let k = 0; k < rows; k++) {
          const x = (i - (cols - 1) / 2) * PITCH
          const z = (k - (rows - 1) / 2) * PITCH
          // Pointing down, the pins pass through the board (1.72 mm) and are soldered on top.
          const pin = down ? box(0.64, pinLength + spacer + 1.6 + 2.3, 0.64, M.gold(), x, -pinLength - 1.6 - spacer, z) : box(0.64, pinLength + 2, 0.64, M.gold(), x, -1, z)
          g.add(pin)
          if (down) g.add(mesh(new T.ConeGeometry(0.85, 0.55, 16), M.solder(), x, 1.72 + 0.27, z))
        }
      return g
    },

    /** Through-hole DIP chip in a socket: notch, pin-1 dot and the printed name. */
    dip(pins: number, name: string, socket = true) {
      const per = pins / 2
      const len = per * PITCH + 0.6
      const g = group()
      let base = 0
      if (socket) {
        g.add(rbox(len + 1.2, 2.2, 10.2, 0.2, M.plastic(0x2a2b2e, 0.7)))
        base = 2.2
      }
      const body = rbox(len, 3.4, 6.6, 0.35, M.plastic(0x18181a, 0.5), 0, base + 0.5, 0)
      g.add(body)
      const top = base + 3.9 + 0.01
      g.add(
        decal(
          len,
          6.6,
          label(len, 6.6, (c, W, H) => {
            c.clearRect(0, 0, W, H)
            c.fillStyle = 'rgba(0,0,0,0)'
            c.beginPath()
            c.arc(0, H / 2, H * 0.12, -Math.PI / 2, Math.PI / 2)
            c.fillStyle = '#0a0a0a'
            c.fill()
            c.beginPath()
            c.arc(W * 0.06, H * 0.78, H * 0.06, 0, Math.PI * 2)
            c.fillStyle = '#2b2b2e'
            c.fill()
            c.fillStyle = '#cfd2d6'
            c.font = `700 ${H * 0.22}px system-ui, sans-serif`
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText(name, W / 2, H * 0.42)
            c.font = `500 ${H * 0.13}px system-ui, sans-serif`
            c.fillText('20AU · 2316', W / 2, H * 0.68)
          }),
          top,
        ),
      )
      for (let i = 0; i < per; i++)
        for (const side of [-1, 1]) {
          const x = (i - (per - 1) / 2) * PITCH
          g.add(box(0.5, 0.25, 1.1, M.solder(), x, base + 1.9, side * 3.75))
          g.add(box(0.5, 2.6, 0.25, M.solder(), x, base - 0.6, side * 4.25))
        }
      return g
    },

    /** Square flat chip with legs on four sides (TQFP) or with pads underneath (QFN). */
    flatChip(size: number, pinsPerSide: number, name: string, legs = true) {
      const g = group(rbox(size, 0.9, size, 0.12, M.plastic(0x161618, 0.45)))
      g.add(
        decal(
          size,
          size,
          label(size, size, (c, W, H) => {
            c.clearRect(0, 0, W, H)
            c.fillStyle = '#c7cace'
            c.font = `700 ${H * 0.16}px system-ui, sans-serif`
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText(name, W / 2, H / 2)
            c.beginPath()
            c.arc(W * 0.16, H * 0.16, W * 0.05, 0, Math.PI * 2)
            c.fillStyle = '#2d2d30'
            c.fill()
          }),
          0.91,
        ),
      )
      const step = (size * 0.8) / pinsPerSide
      for (let i = 0; i < pinsPerSide; i++) {
        const o = (i - (pinsPerSide - 1) / 2) * step
        for (const [x, z, rot] of [
          [o, size / 2, 0],
          [o, -size / 2, 0],
          [size / 2, o, 1],
          [-size / 2, o, 1],
        ] as const) {
          const leg = legs ? box(rot ? 0.9 : 0.22, 0.18, rot ? 0.22 : 0.9, M.solder(), x * (legs ? 1.08 : 1), 0, z * (legs ? 1.08 : 1)) : box(rot ? 0.3 : 0.2, 0.1, rot ? 0.2 : 0.3, M.solder(), x, 0, z)
          g.add(leg)
        }
      }
      return g
    },

    /** SOIC/SOT chips: a small body with gull-wing legs on two sides. */
    smallChip(w: number, d: number, pinsPerSide: number, legsBothSides = true) {
      const g = group(rbox(w, 1.3, d, 0.12, M.plastic(0x161618, 0.45)))
      const step = w / (pinsPerSide + 0.5)
      for (let i = 0; i < pinsPerSide; i++) {
        const x = (i - (pinsPerSide - 1) / 2) * step
        g.add(box(0.4, 0.2, 0.9, M.solder(), x, 0.05, d / 2 + 0.35))
        if (legsBothSides) g.add(box(0.4, 0.2, 0.9, M.solder(), x, 0.05, -d / 2 - 0.35))
      }
      return g
    },

    /** Voltage regulator (SOT-223): body, three legs and the wide tab. */
    sot223() {
      const g = group(rbox(6.5, 1.6, 3.5, 0.12, M.plastic(0x161618, 0.45), 0, 0, -0.6))
      g.add(box(3.1, 0.25, 1.8, M.solder(), 0, 0, 2.1))
      for (const x of [-2.3, 0, 2.3]) g.add(box(0.7, 0.25, 1.4, M.solder(), x, 0, -3))
      return g
    },

    /** 0805 resistor (black, white code) or capacitor (tan) with metal ends. */
    smd(kind: 'r' | 'c' | 'led', color = 0) {
      const body =
        kind === 'r' ? M.plastic(0x1b1b1b, 0.5) : kind === 'c' ? M.ceramic(0xc8a978) : (M.glow(color) as THREE_NS.Material)
      const core = box(1.3, 0.55, 1.25, body)
      // LEDs are found by this mark after materials are cloned per part.
      if (kind === 'led') core.userData.ledColor = color
      const g = group(core)
      for (const x of [-0.85, 0.85]) g.add(box(0.4, 0.58, 1.27, M.solder(), x, 0, 0))
      return g
    },

    /** Aluminium electrolytic capacitor (SMD can on a black base). */
    electrolytic(r: number, h: number) {
      const g = group(box(r * 2 + 0.4, 0.6, r * 2 + 0.4, M.plastic(0x1d1d1f)))
      g.add(cylinder(r, h, M.metal(0xdfe3e7, 0.35), 0, 0.6, 0, 40))
      const top = decal(
        r * 2,
        r * 2,
        label(r * 2, r * 2, (c, W, H) => {
          c.clearRect(0, 0, W, H)
          c.beginPath()
          c.arc(W / 2, H / 2, W / 2, Math.PI * 0.6, Math.PI * 1.4)
          c.closePath()
          c.fillStyle = '#1a2440'
          c.fill()
          c.strokeStyle = 'rgba(0,0,0,0.25)'
          c.lineWidth = W * 0.02
          c.beginPath()
          c.moveTo(W * 0.3, H * 0.5)
          c.lineTo(W * 0.7, H * 0.5)
          c.moveTo(W * 0.5, H * 0.3)
          c.lineTo(W * 0.5, H * 0.7)
          c.stroke()
        }),
        h + 0.61,
        0.35,
      )
      g.add(top)
      return g
    },

    /** HC-49 crystal: a stadium-shaped metal can. */
    crystal(len = 10.5, wid = 4.4, h = 3.6) {
      const s = new T.Shape()
      const r = wid / 2
      s.moveTo(-len / 2 + r, -r)
      s.lineTo(len / 2 - r, -r)
      s.absarc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false)
      s.lineTo(-len / 2 + r, r)
      s.absarc(-len / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false)
      const geo = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 4, curveSegments: 24 })
      geo.rotateX(-Math.PI / 2)
      const g = group(mesh(geo, M.metal(0xe3e6ea, 0.2)))
      g.add(box(len + 0.6, 0.35, wid + 0.6, M.plastic(0x222)))
      return g
    },

    /** USB-B socket: a metal shell with chamfered top, a dark mouth and the white tongue. */
    usbB() {
      const s = new T.Shape()
      s.moveTo(-6, 0)
      s.lineTo(6, 0)
      s.lineTo(6, 8.6)
      s.lineTo(4.4, 10.8)
      s.lineTo(-4.4, 10.8)
      s.lineTo(-6, 8.6)
      s.closePath()
      const geo = new T.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 })
      geo.translate(0, 0, -8)
      geo.rotateY(Math.PI / 2)
      const g = group(mesh(geo, M.metal(0xd2d6db, 0.3)))
      g.add(box(0.2, 7.6, 9.4, M.plastic(0x101010, 0.9), -8.15, 1.4, 0))
      g.add(box(0.4, 3.2, 5, M.plastic(0xf2f2f2, 0.5), -8.05, 3.6, 0))
      return g
    },

    microUsb() {
      const g = group(rbox(5.6, 2.6, 7.6, 0.6, M.metal(0xd2d6db, 0.3)))
      g.add(box(0.2, 1.6, 6, M.plastic(0x101010, 0.9), -2.85, 0.5, 0))
      return g
    },

    /** DC barrel jack: black body with a round mouth and the centre pin. */
    barrelJack() {
      const g = group(rbox(14, 11, 9, 0.6, M.plastic(0x18181a, 0.55)))
      const mouth = mesh(new T.CylinderGeometry(3.2, 3.2, 0.6, 32), M.plastic(0x050505, 0.9), -7.1, 6.2, 0)
      mouth.rotation.z = Math.PI / 2
      g.add(mouth)
      const pin = mesh(new T.CylinderGeometry(0.95, 0.95, 2, 16), M.metal(), -6.5, 6.2, 0)
      pin.rotation.z = Math.PI / 2
      g.add(pin)
      return g
    },

    /** Tactile button: a metal frame on a plastic base with a round cap. */
    tactile(size = 6, cap = 0xc62828, capR = 1.75) {
      const g = group(rbox(size, 1.8, size, 0.3, M.plastic(0x202124, 0.5)))
      g.add(box(size * 0.95, 0.25, size * 0.95, M.metal(0xc9cdd2, 0.35), 0, 1.8, 0))
      g.add(cylinder(capR, 1.3, M.plastic(cap, 0.4), 0, 2.05, 0, 28))
      return g
    },

    /** The ESP32-WROOM-32 module: its own little board, the metal shield and the PCB antenna. */
    wroom(antennaArt: HTMLCanvasElement) {
      const len = 25.5
      const wid = 18
      const tex = new T.CanvasTexture(antennaArt)
      tex.colorSpace = T.SRGBColorSpace
      tex.anisotropy = 8
      const board = mesh(new RoundedBox(len, 0.8, wid, 2, 0.3), [M.mask(0x15171c), M.mask(0x15171c), new T.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.9 }), M.mask(0x15171c), M.mask(0x15171c), M.mask(0x15171c)], 0, 0.4, 0)
      const g = group(board)
      const shieldLen = 17.6
      const shieldX = -len / 2 + 0.6 + shieldLen / 2
      g.add(rbox(shieldLen, 2.4, 15.4, 0.35, M.metal(0xcfd4da, 0.32), shieldX, 0.8, 0))
      g.add(
        decal(
          shieldLen - 1,
          14.4,
          label(shieldLen - 1, 14.4, (c, W, H) => {
            c.clearRect(0, 0, W, H)
            c.fillStyle = 'rgba(40,44,52,0.85)'
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.font = `800 ${H * 0.12}px system-ui, sans-serif`
            c.fillText('ESP32-WROOM-32', W / 2, H * 0.38)
            c.font = `600 ${H * 0.075}px system-ui, sans-serif`
            c.fillText('Wi-Fi · Bluetooth · 240 MHz', W / 2, H * 0.56)
            c.fillText('4 MB FLASH', W / 2, H * 0.68)
            c.strokeStyle = 'rgba(40,44,52,0.6)'
            c.lineWidth = H * 0.012
            c.strokeRect(W * 0.06, H * 0.12, W * 0.88, H * 0.76)
          }),
          3.21,
          0.35,
        ),
      )
      g.children[g.children.length - 1].position.x = shieldX
      // Castellated pads along the module's edges
      for (let i = 0; i < 12; i++) {
        const x = -len / 2 + 2 + i * 1.27
        for (const z of [-wid / 2, wid / 2]) g.add(box(0.7, 0.82, 0.5, M.gold(), x, 0, z))
      }
      return g
    },
  }
}

export type Kit = ReturnType<typeof createKit>
