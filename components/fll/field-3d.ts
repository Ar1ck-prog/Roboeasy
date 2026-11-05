/**
 * The 3D FLL field: a table with walls, the mat (the team's own picture or
 * our schematic), a stylised model for every mission, a loose piece per
 * mission that the robot can push, and the robot. Rapier runs the physics:
 * the robot is a kinematic body that follows the pose the simulator gives
 * it, so programs and manual driving push the pieces around.
 *
 * Units: 1 = 1 cm. Field mm (x right, y away from the team) map to
 * X = x/10 − W/2, Z = H/2 − y/10; a heading of θ° (counterclockwise) is a
 * rotation of θ about +Y. Loaded only on the simulator page (dynamic import).
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import RAPIER from '@dimforge/rapier3d-compat'

import type { Mission, Season } from '@/lib/fll/season'
import { zonePolygon } from '@/lib/fll/geometry'
import { ROBOT_SHAPE } from '@/lib/sim/robot'

export type CameraKind = 'orbit' | 'top' | 'base' | 'follow'

export interface Pose2 {
  x: number
  y: number
  heading: number
}

interface Options {
  season: Season
  matUrl: string | null
  robotColor: string
  /** Called while the robot is dragged with the mouse (field mm). */
  onDragRobot: (p: { x: number; y: number }) => void
  /** Called when a mission model is clicked. */
  onPickMission: (id: string) => void
}

const INK = 0x1b1f2a
const PALETTE = [0xffc531, 0x4a86f7, 0x2bb673, 0xe8442e, 0xb26ef0, 0xff9f1c, 0x7fe0c4, 0xf06fb4]
const WALL_H = 7.6
const WALL_T = 3.8

let rapierReady: Promise<void> | null = null
const initRapier = () => (rapierReady ??= RAPIER.init())

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback
}

/** A rounded number badge as a sprite (Rubik, our yellow). */
function badge(text: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#ffc531'
  g.strokeStyle = '#1b1f2a'
  g.lineWidth = 10
  g.beginPath()
  g.arc(64, 64, 52, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.fillStyle = '#1b1f2a'
  g.font = `800 58px ${cssVar('--font-display', 'sans-serif')}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  s.scale.set(7, 7, 1)
  s.renderOrder = 10
  return s
}

/** The schematic mat when the team has not uploaded a picture: warm paper, grid, launch areas. */
function schematicMat(season: Season): THREE.CanvasTexture {
  const { widthMm: W, heightMm: H } = season.field
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#fbf1da'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(27,31,42,0.10)'
  g.lineWidth = 2
  for (let x = 0; x <= W; x += 100) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += 100) {
    g.beginPath()
    g.moveTo(0, H - y)
    g.lineTo(W, H - y)
    g.stroke()
  }
  for (const a of season.launchAreas) {
    const poly = zonePolygon(a)
    g.beginPath()
    poly.forEach((p, i) => (i ? g.lineTo(p.x, H - p.y) : g.moveTo(p.x, H - p.y)))
    g.closePath()
    g.fillStyle = 'rgba(74,134,247,0.16)'
    g.fill()
    g.setLineDash([22, 14])
    g.strokeStyle = '#4a86f7'
    g.lineWidth = 6
    g.stroke()
    g.setLineDash([])
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** The robot buddy as a driving base: body, wheels, the hub screen with eyes, an arrow. */
function robotMesh(color: string): THREE.Group {
  const g = new THREE.Group()
  const L = ROBOT_SHAPE.length / 10
  const Wd = ROBOT_SHAPE.width / 10
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, 6, Wd), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }))
  body.position.y = 5
  body.castShadow = true
  g.add(body)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: INK }))
  edges.position.copy(body.position)
  g.add(edges)
  const wheelGeo = new THREE.CylinderGeometry(2.8, 2.8, 1.6, 28)
  wheelGeo.rotateX(Math.PI / 2)
  const tyre = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.9 })
  const hub = new THREE.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.4 })
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, tyre)
    w.position.set(0, 2.8, side * (Wd / 2 + 0.9))
    w.castShadow = true
    g.add(w)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.7, 16).rotateX(Math.PI / 2), hub)
    cap.position.copy(w.position)
    g.add(cap)
  }
  // Hub with a face screen (our buddy's eyes).
  const face = document.createElement('canvas')
  face.width = 128
  face.height = 96
  const f = face.getContext('2d')!
  f.fillStyle = '#1b1f2a'
  f.fillRect(0, 0, 128, 96)
  f.fillStyle = '#9ef0ff'
  for (const x of [40, 88]) {
    f.beginPath()
    f.arc(x, 42, 13, 0, Math.PI * 2)
    f.fill()
  }
  f.strokeStyle = '#9ef0ff'
  f.lineWidth = 6
  f.beginPath()
  f.arc(64, 58, 18, 0.2 * Math.PI, 0.8 * Math.PI)
  f.stroke()
  const faceTex = new THREE.CanvasTexture(face)
  faceTex.colorSpace = THREE.SRGBColorSpace
  const top = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 8.5), [
    new THREE.MeshStandardMaterial({ map: faceTex }),
    new THREE.MeshStandardMaterial({ color }),
    new THREE.MeshStandardMaterial({ color }),
    new THREE.MeshStandardMaterial({ color }),
    new THREE.MeshStandardMaterial({ color }),
    new THREE.MeshStandardMaterial({ color }),
  ])
  top.position.set(1, 10.5, 0)
  top.castShadow = true
  g.add(top)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 3).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: INK }))
  nose.position.set(L / 2 + 1.5, 5, 0)
  g.add(nose)
  return g
}

interface Piece {
  body: RAPIER.RigidBody
  mesh: THREE.Mesh
  home: THREE.Vector3
}

export class Field3D {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private world!: RAPIER.World
  private robot!: THREE.Group
  private robotBody!: RAPIER.RigidBody
  private matMaterial!: THREE.MeshStandardMaterial
  private trail: THREE.Line
  private pieces: Piece[] = []
  private missionMeshes: THREE.Object3D[] = []
  private pose: Pose2 = { x: 200, y: 160, heading: 90 }
  private cameraKind: CameraKind = 'orbit'
  private raf = 0
  private last = 0
  private acc = 0
  private disposed = false
  private dragging = false
  private resize: ResizeObserver
  private W: number
  private H: number

  static async create(host: HTMLElement, opts: Options): Promise<Field3D> {
    await initRapier()
    return new Field3D(host, opts)
  }

  private constructor(
    private host: HTMLElement,
    private opts: Options,
  ) {
    this.W = opts.season.field.widthMm / 10
    this.H = opts.season.field.heightMm / 10
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    host.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 2000)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05
    this.controls.minDistance = 25
    this.controls.maxDistance = 420

    this.scene.add(new THREE.HemisphereLight(0xfff7e8, 0x8a7a5a, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(-60, 160, 90)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera
    sc.left = -140
    sc.right = 140
    sc.top = 90
    sc.bottom = -90
    this.scene.add(sun)

    this.world = new RAPIER.World({ x: 0, y: -981, z: 0 })
    this.world.timestep = 1 / 60
    this.buildTable()
    this.buildMissions()
    this.robot = robotMesh(opts.robotColor)
    this.scene.add(this.robot)
    this.robotBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(ROBOT_SHAPE.length / 20, 4.5, ROBOT_SHAPE.width / 20 + 1.6).setTranslation(0, 4.5, 0), this.robotBody)

    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffc531, linewidth: 2 }))
    this.trail.position.y = 0.25
    this.scene.add(this.trail)

    this.setCamera('orbit')
    this.setRobot(this.pose, true)
    this.bindPointer()
    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ── Building the scene ──────────────────────────────────────────────
  private toWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x / 10 - this.W / 2, 0, this.H / 2 - y / 10)
  }

  private buildTable() {
    const { W, H } = this
    // Table board under the mat.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(W + 2 * WALL_T + 4, 3, H + 2 * WALL_T + 4),
      new THREE.MeshStandardMaterial({ color: 0xe8d6b0, roughness: 0.85 }),
    )
    board.position.y = -1.55
    board.receiveShadow = true
    this.scene.add(board)
    // Mat.
    this.matMaterial = new THREE.MeshStandardMaterial({ map: schematicMat(this.opts.season), roughness: 0.92 })
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.matMaterial)
    mat.rotation.x = -Math.PI / 2
    mat.receiveShadow = true
    this.scene.add(mat)
    if (this.opts.matUrl) this.setMat(this.opts.matUrl)
    // Ground collider.
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(W / 2 + 20, 1, H / 2 + 20)
        .setTranslation(0, -1, 0)
        .setFriction(0.8),
    )
    // Walls: cream with an ink top edge, like our cards.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.7 })
    const capMat = new THREE.MeshStandardMaterial({ color: INK })
    const wall = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat)
      m.position.set(x, WALL_H / 2, z)
      m.castShadow = m.receiveShadow = true
      this.scene.add(m)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.8, d + 0.2), capMat)
      cap.position.set(x, WALL_H + 0.4, z)
      this.scene.add(cap)
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, WALL_H / 2, d / 2).setTranslation(x, WALL_H / 2, z))
    }
    wall(W + 2 * WALL_T, WALL_T, 0, -H / 2 - WALL_T / 2)
    wall(W + 2 * WALL_T, WALL_T, 0, H / 2 + WALL_T / 2)
    wall(WALL_T, H, -W / 2 - WALL_T / 2, 0)
    wall(WALL_T, H, W / 2 + WALL_T / 2, 0)
  }

  private buildMissions() {
    this.opts.season.missions.forEach((m, i) => this.buildMission(m, PALETTE[i % PALETTE.length]))
  }

  private buildMission(m: Mission, color: number) {
    const at = this.toWorld(m.x, m.y)
    const rot = (m.rotationDeg * Math.PI) / 180
    const w = (m.outline.kind === 'rect' ? m.outline.width : 120) / 10
    const d = (m.outline.kind === 'rect' ? m.outline.height : 120) / 10
    const h = 4 + ((m.number * 7) % 9)
    const group = new THREE.Group()
    group.position.copy(at)
    group.rotation.y = rot
    group.userData.missionId = m.id
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    const cream = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.6 })
    const ink = new THREE.LineBasicMaterial({ color: INK })
    const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, outline = true, pick = true) => {
      const mesh = new THREE.Mesh(geo, material)
      mesh.position.set(x, y, z)
      mesh.castShadow = mesh.receiveShadow = true
      if (pick) {
        mesh.userData.missionId = m.id
        this.missionMeshes.push(mesh)
      }
      group.add(mesh)
      if (outline) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), ink)
        e.position.copy(mesh.position)
        e.rotation.copy(mesh.rotation)
        group.add(e)
      }
      return mesh
    }
    // A low platform in the mission colour, then a shape that hints at the action.
    const plat = 2.4
    add(new THREE.BoxGeometry(w, plat, d), mat, 0, plat / 2, 0)
    const top = plat
    switch (m.action) {
      case 'push': {
        add(new THREE.BoxGeometry(w * 0.75, 3, Math.min(3, d * 0.3)), cream, 0, top + 1.5, -d * 0.2)
        add(new THREE.BoxGeometry(1.6, 4.5, 1.6), mat, 0, top + 2.25, d * 0.15)
        break
      }
      case 'pull': {
        const arch = add(new THREE.TorusGeometry(Math.min(w, d) * 0.38, 0.9, 10, 28, Math.PI), cream, 0, top, 0)
        arch.rotation.y = Math.PI / 2
        add(new THREE.SphereGeometry(1.4, 14, 10), mat, 0, top + Math.min(w, d) * 0.38, 0, false)
        break
      }
      case 'lift': {
        add(new THREE.CylinderGeometry(1.1, 1.1, h, 14), cream, -w * 0.15, top + h / 2, 0)
        const arm = add(new THREE.BoxGeometry(w * 0.7, 1.2, 1.8), mat, w * 0.1, top + h * 0.8, 0)
        arm.rotation.z = 0.25
        break
      }
      case 'flip': {
        const rock = add(
          new THREE.DodecahedronGeometry(Math.min(w, d) * 0.3),
          new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.95, flatShading: true }),
          0,
          top + Math.min(w, d) * 0.28,
          0,
        )
        rock.rotation.set(0.4, 0.6, 0.2)
        add(new THREE.BoxGeometry(0.6, 6, 0.6), cream, w * 0.35, top + 3, 0, false)
        add(new THREE.BoxGeometry(2.6, 1.6, 0.3), mat, w * 0.35 + 1.4, top + 5.2, 0, false)
        break
      }
      case 'collect': {
        const r = Math.min(w, d) * 0.36
        add(new THREE.CylinderGeometry(r, r * 0.75, 3.2, 24, 1, true), cream, 0, top + 1.6, 0)
        add(new THREE.CircleGeometry(r * 0.75, 24).rotateX(-Math.PI / 2), mat, 0, top + 0.05, 0, false)
        break
      }
      case 'deliver': {
        for (const [x, z, ww, dd] of [
          [0, -d / 2 + 0.5, w, 1],
          [0, d / 2 - 0.5, w, 1],
          [-w / 2 + 0.5, 0, 1, d],
          [w / 2 - 0.5, 0, 1, d],
        ])
          add(new THREE.BoxGeometry(ww, 2.4, dd), cream, x, top + 1.2, z)
        add(new THREE.ConeGeometry(1.6, 3, 5), mat, 0, top + 1.5, 0, false)
        break
      }
    }
    const label = badge(String(m.number))
    label.position.y = h + 6
    group.add(label)
    this.scene.add(group)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot)
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setTranslation(at.x, h / 2, at.z)
        .setRotation(q),
    )

    // A loose piece on the robot's side of the model (pushable).
    const zoneLocal = new THREE.Vector3(m.actionZone.dx / 10, 0, -m.actionZone.dy / 10).applyQuaternion(q)
    const dir = zoneLocal.lengthSq() > 0 ? zoneLocal.clone().normalize() : new THREE.Vector3(0, 0, 1)
    const reach = Math.max(w, d) / 2 + 3.5
    const home = new THREE.Vector3(at.x + dir.x * reach, 2.6, at.z + dir.z * reach)
    const sphere = m.action === 'collect' || m.action === 'deliver'
    const geo = sphere ? new THREE.SphereGeometry(2.4, 20, 14) : new THREE.BoxGeometry(4.4, 4.4, 4.4)
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }))
    mesh.castShadow = true
    this.scene.add(mesh)
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(home.x, home.y, home.z).setLinearDamping(0.6).setAngularDamping(0.8))
    this.world.createCollider(
      (sphere ? RAPIER.ColliderDesc.ball(2.4) : RAPIER.ColliderDesc.cuboid(2.2, 2.2, 2.2)).setDensity(0.4).setFriction(0.7).setRestitution(0.1),
      body,
    )
    this.pieces.push({ body, mesh, home })
  }

  // ── Public API ──────────────────────────────────────────────────────
  setMat(url: string | null) {
    if (!url) {
      this.matMaterial.map = schematicMat(this.opts.season)
      this.matMaterial.needsUpdate = true
      return
    }
    new THREE.TextureLoader().load(url, (tex) => {
      if (this.disposed) return
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      this.matMaterial.map = tex
      this.matMaterial.needsUpdate = true
    })
  }

  setRobotColor(color: string) {
    this.robot.traverse((o) => {
      const mesh = o as THREE.Mesh
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined
      if (mesh.isMesh && mat && !Array.isArray(mat) && mat.color && mat.color.getHex() !== INK && mat.color.getHex() !== 0xc9d1dc) mat.color.set(color)
    })
  }

  /** The robot's pose (field mm, degrees). `teleport`: jump without shoving pieces. */
  setRobot(p: Pose2, teleport = false) {
    const jump = Math.hypot(p.x - this.pose.x, p.y - this.pose.y) > 150
    this.pose = p
    const at = this.toWorld(p.x, p.y)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (p.heading * Math.PI) / 180)
    this.robot.position.copy(at)
    this.robot.quaternion.copy(q)
    if (teleport || jump) {
      this.robotBody.setTranslation({ x: at.x, y: 0, z: at.z }, true)
      this.robotBody.setRotation(q, true)
    }
    this.robotBody.setNextKinematicTranslation({ x: at.x, y: 0, z: at.z })
    this.robotBody.setNextKinematicRotation(q)
  }

  /** The route of a run (field mm); `upTo` samples are drawn. */
  setTrail(points: { x: number; y: number }[] | null) {
    const geo = new THREE.BufferGeometry()
    if (points?.length) {
      const step = Math.max(1, Math.floor(points.length / 3000))
      const arr: number[] = []
      for (let i = 0; i < points.length; i += step) {
        const v = this.toWorld(points[i].x, points[i].y)
        arr.push(v.x, 0, v.z)
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      geo.userData.step = step
    }
    this.trail.geometry.dispose()
    this.trail.geometry = geo
    geo.setDrawRange(0, 0)
  }

  setTrailProgress(sample: number) {
    const step = (this.trail.geometry.userData.step as number) || 1
    this.trail.geometry.setDrawRange(0, Math.floor(sample / step) + 1)
  }

  resetPieces() {
    for (const p of this.pieces) {
      p.body.setTranslation(p.home, true)
      p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  setCamera(kind: CameraKind) {
    this.cameraKind = kind
    this.controls.enabled = kind !== 'follow'
    const t = new THREE.Vector3(0, 0, 0)
    if (kind === 'orbit') {
      // Far enough to fit the whole table across the view, looking down at ~50°.
      const half = this.W / 2 + WALL_T + 6
      const vfov = (this.camera.fov * Math.PI) / 180
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(0.6, this.camera.aspect))
      const dist = (half / Math.tan(hfov / 2)) * 1.08
      const tilt = (50 * Math.PI) / 180
      this.camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist)
      t.set(0, 0, -4)
    } else if (kind === 'top') {
      this.camera.position.set(0, 245, 0.01)
    } else if (kind === 'base') {
      const a = this.opts.season.launchAreas[0]
      const b = a ? this.toWorld(a.start.x, a.start.y) : new THREE.Vector3(-this.W / 2 + 20, 0, this.H / 2 - 15)
      this.camera.position.set(b.x - 20, 42, b.z + 55)
      t.set(b.x + 60, 0, b.z - 50)
    }
    if (kind !== 'follow') {
      this.controls.target.copy(t)
      this.controls.update()
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resize.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.world.free()
  }

  // ── Loop and input ──────────────────────────────────────────────────
  private fit() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = `${w}px`
    this.renderer.domElement.style.height = `${h}px`
    const first = this.camera.aspect === 1
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (first && this.cameraKind === 'orbit') this.setCamera('orbit')
  }

  private frame = (now: number) => {
    if (this.disposed) return
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.acc += dt
    let steps = 0
    while (this.acc >= 1 / 60 && steps < 4) {
      this.world.step()
      this.acc -= 1 / 60
      steps++
    }
    for (const p of this.pieces) {
      const t = p.body.translation()
      // A piece pushed off the table comes back home.
      if (t.y < -30) {
        p.body.setTranslation(p.home, true)
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
      const r = p.body.rotation()
      p.mesh.position.set(t.x, t.y, t.z)
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
    if (this.cameraKind === 'follow') {
      const at = this.robot.position
      const dir = new THREE.Vector3(Math.cos((this.pose.heading * Math.PI) / 180), 0, -Math.sin((this.pose.heading * Math.PI) / 180))
      const want = at
        .clone()
        .addScaledVector(dir, -48)
        .add(new THREE.Vector3(0, 30, 0))
      this.camera.position.lerp(want, 1 - Math.pow(0.001, dt))
      this.camera.lookAt(at.clone().addScaledVector(dir, 30))
    } else this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.frame)
  }

  private bindPointer() {
    const el = this.renderer.domElement
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    const groundPoint = (e: PointerEvent) => {
      ray.setFromCamera(ndc(e), this.camera)
      const hit = new THREE.Vector3()
      return ray.ray.intersectPlane(plane, hit) ? hit : null
    }
    el.addEventListener('pointerdown', (e) => {
      ray.setFromCamera(ndc(e), this.camera)
      if (ray.intersectObject(this.robot, true).length) {
        this.dragging = true
        this.controls.enabled = false
        el.setPointerCapture(e.pointerId)
        return
      }
      const hit = ray.intersectObjects(this.missionMeshes, false)[0]
      if (hit?.object.userData.missionId) this.opts.onPickMission(hit.object.userData.missionId as string)
    })
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      const p = groundPoint(e)
      if (p) this.opts.onDragRobot({ x: (p.x + this.W / 2) * 10, y: (this.H / 2 - p.z) * 10 })
    })
    const end = () => {
      if (!this.dragging) return
      this.dragging = false
      this.controls.enabled = this.cameraKind !== 'follow'
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }
}
