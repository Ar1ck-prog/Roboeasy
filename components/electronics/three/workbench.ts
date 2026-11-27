/**
 * The workbench under the board: a cutting mat with a millimetre grid and
 * rulers, and a few things that lie around on a maker's desk — a solder
 * spool, multimeter probes, an LED, jumper wires and a resistor. All
 * procedural, in millimetres, around the origin where the board sits.
 */

import type * as THREE_NS from 'three'

type Three = typeof THREE_NS

export interface BenchColors {
  mat: string
  grid: string
  gridStrong: string
  ink: string
}

export const BENCH_COLORS: Record<'light' | 'dark', BenchColors & { sky: number }> = {
  light: { mat: '#7f91a6', grid: 'rgba(255,255,255,0.16)', gridStrong: 'rgba(255,255,255,0.34)', ink: 'rgba(255,255,255,0.75)', sky: 0xdde4ec },
  dark: { mat: '#3a4658', grid: 'rgba(255,255,255,0.08)', gridStrong: 'rgba(255,255,255,0.18)', ink: 'rgba(255,255,255,0.5)', sky: 0x1a1f2b },
}

/** The mat's texture: grid every 10 mm, bold lines every 50 mm, ruler ticks along two edges. */
function matTexture(T: Three, size: number, c: BenchColors) {
  const px = 6
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * px
  const g = canvas.getContext('2d')!
  g.fillStyle = c.mat
  g.fillRect(0, 0, canvas.width, canvas.height)
  for (let mm = 0; mm <= size; mm += 10) {
    g.strokeStyle = mm % 50 === 0 ? c.gridStrong : c.grid
    g.lineWidth = mm % 50 === 0 ? 2.2 : 1.2
    g.beginPath()
    g.moveTo(mm * px, 0)
    g.lineTo(mm * px, canvas.height)
    g.moveTo(0, mm * px)
    g.lineTo(canvas.width, mm * px)
    g.stroke()
  }
  // Rulers with millimetre ticks and centimetre numbers
  g.strokeStyle = c.ink
  g.fillStyle = c.ink
  g.font = `600 ${px * 3}px system-ui, sans-serif`
  for (let mm = 0; mm <= size; mm += 1) {
    const len = mm % 10 === 0 ? 7 : mm % 5 === 0 ? 4.5 : 2.5
    g.lineWidth = mm % 10 === 0 ? 1.6 : 1
    g.beginPath()
    g.moveTo(mm * px, 0)
    g.lineTo(mm * px, len * px)
    g.moveTo(0, mm * px)
    g.lineTo(len * px, mm * px)
    g.stroke()
    if (mm % 10 === 0 && mm > 0 && mm < size) {
      g.fillText(String(mm / 10), mm * px + 4, 11 * px)
      g.fillText(String(mm / 10), 9 * px, mm * px - 4)
    }
  }
  // A printed angle guide in one corner
  g.lineWidth = 1.5
  for (const r of [40, 60]) {
    g.beginPath()
    g.arc(canvas.width - 20 * px, canvas.height - 20 * px, r * px, Math.PI, Math.PI * 1.5)
    g.stroke()
  }
  for (let a = 0; a <= 90; a += 15) {
    const rad = Math.PI + (a * Math.PI) / 180
    g.beginPath()
    g.moveTo(canvas.width - 20 * px + Math.cos(rad) * 40 * px, canvas.height - 20 * px + Math.sin(rad) * 40 * px)
    g.lineTo(canvas.width - 20 * px + Math.cos(rad) * 66 * px, canvas.height - 20 * px + Math.sin(rad) * 66 * px)
    g.stroke()
  }
  const tex = new T.CanvasTexture(canvas)
  tex.colorSpace = T.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function buildWorkbench(T: Three, theme: 'light' | 'dark', floorY: number, boardSize: { L: number; W: number }) {
  const c = BENCH_COLORS[theme]
  const root = new T.Group()
  const size = 420
  const mat = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ map: matTexture(T, size, c), roughness: 0.92, metalness: 0 }))
  mat.rotation.x = -Math.PI / 2
  mat.position.y = floorY
  mat.receiveShadow = true
  root.add(mat)

  const std = (color: number, rough = 0.5, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  const add = (mesh: THREE_NS.Mesh) => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
    return mesh
  }
  const y0 = floorY
  const reachX = boardSize.L / 2 + 22
  const reachZ = boardSize.W / 2 + 22

  // Solder spool lying flat at the back left: a white reel with grey wire wound on it.
  const spool = new T.Group()
  const flange = new T.CylinderGeometry(26, 26, 2, 48)
  const top = new T.Mesh(flange, std(0xf4f4f2, 0.6))
  top.position.y = 14
  const bottom = new T.Mesh(flange, std(0xf4f4f2, 0.6))
  bottom.position.y = 1
  const wound = new T.Mesh(new T.CylinderGeometry(21, 21, 11, 48), std(0x9ea3a9, 0.35, 0.9))
  wound.position.y = 7.5
  const hole = new T.Mesh(new T.CylinderGeometry(7, 7, 16, 32), std(0x2a2d33, 0.8))
  hole.position.y = 7.5
  for (const m of [top, bottom, wound, hole]) {
    m.castShadow = true
    m.receiveShadow = true
    spool.add(m)
  }
  spool.position.set(-reachX - 50, y0, -reachZ - 44)
  root.add(spool)

  // Multimeter probes at the back right: handle, guard, metal tip and a cable running off the mat.
  const probe = (color: number, x: number, z: number, angle: number) => {
    const g = new T.Group()
    const handle = new T.Mesh(new T.CylinderGeometry(2.6, 3, 40, 24), std(color, 0.45))
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, 3.8, 0)
    const guard = new T.Mesh(new T.CylinderGeometry(4.2, 4.2, 2, 24), std(color, 0.45))
    guard.rotation.z = Math.PI / 2
    guard.position.set(-22, 3.8, 0)
    const tip = new T.Mesh(new T.ConeGeometry(1.2, 16, 16), std(0xd8dde2, 0.25, 1))
    tip.rotation.z = Math.PI / 2
    tip.position.set(-31, 3.8, 0)
    const curve = new T.CatmullRomCurve3([new T.Vector3(23, 3.8, 0), new T.Vector3(40, 2.5, 6), new T.Vector3(70, 2, 22), new T.Vector3(130, 2, 30)])
    const cable = new T.Mesh(new T.TubeGeometry(curve, 48, 1.8, 10, false), std(color, 0.55))
    for (const m of [handle, guard, tip, cable]) {
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
    g.position.set(x, y0, z)
    g.rotation.y = angle
    root.add(g)
  }
  probe(0xd8453b, reachX + 60, -reachZ - 46, 0.5)
  probe(0x2a2d33, reachX + 76, -reachZ - 30, 0.35)

  // A red LED at the front left, lying on its side with two long legs.
  const led = new T.Group()
  const lens = new T.Mesh(new T.CylinderGeometry(2.5, 2.5, 5.6, 24), new T.MeshPhysicalMaterial({ color: 0xff3b2f, roughness: 0.15, transmission: 0.25, thickness: 2 }))
  const dome = new T.Mesh(new T.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens.material)
  dome.position.y = 2.8
  const rim = new T.Mesh(new T.CylinderGeometry(2.9, 2.9, 1, 24), lens.material)
  rim.position.y = -2.8
  const legA = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 26, 8), std(0xcfd3d8, 0.25, 1))
  legA.position.set(-1.2, -16, 0)
  const legK = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 22, 8), std(0xcfd3d8, 0.25, 1))
  legK.position.set(1.2, -14, 0)
  for (const m of [lens, dome, rim, legA, legK]) {
    m.castShadow = true
    led.add(m)
  }
  led.rotation.z = Math.PI / 2
  led.rotation.y = 0.6
  led.position.set(-reachX - 14, y0 + 2.9, reachZ + 18)
  root.add(led)

  // Jumper wires at the front right: soft PVC curves with metal pins at both ends.
  const jumper = (color: number, points: [number, number, number][]) => {
    const curve = new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y0 + y, z)))
    add(new T.Mesh(new T.TubeGeometry(curve, 64, 1, 10, false), std(color, 0.5)))
    for (const end of [curve.getPoint(0), curve.getPoint(1)]) {
      const housing = add(new T.Mesh(new T.BoxGeometry(2.6, 2.6, 2.6), std(0x1d1d1f, 0.6)))
      housing.position.copy(end)
    }
  }
  jumper(0xf2a900, [
    [reachX + 2, 1, reachZ + 6],
    [reachX + 24, 1.1, reachZ + 2],
    [reachX + 40, 1.1, reachZ + 22],
    [reachX + 18, 1, reachZ + 36],
  ])
  jumper(0x1f6feb, [
    [reachX - 18, 1, reachZ + 26],
    [reachX + 6, 1.1, reachZ + 18],
    [reachX + 34, 1.1, reachZ + 34],
  ])

  // A loose resistor next to them.
  const res = new T.Group()
  const body = new T.Mesh(new T.CapsuleGeometry(1.2, 4, 6, 16), std(0xe2c799, 0.5))
  body.rotation.z = Math.PI / 2
  const wire = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 22, 8), std(0xcfd3d8, 0.25, 1))
  wire.rotation.z = Math.PI / 2
  for (const [i, color] of [0xe53935, 0xe53935, 0x8b4513, 0xc9a227].entries()) {
    const band = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, 0.5, 16), std(color, 0.5))
    band.rotation.z = Math.PI / 2
    band.position.x = -1.6 + i * 1.1
    res.add(band)
  }
  for (const m of [body, wire]) {
    m.castShadow = true
    res.add(m)
  }
  res.position.set(-reachX + 4, y0 + 1.2, reachZ + 30)
  res.rotation.y = -0.4
  root.add(res)

  return { root, sky: c.sky }
}
