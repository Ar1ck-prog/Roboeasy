import type * as THREE_NS from 'three'

/**
 * The cartoon look of the lab bench: flat toon shading, ink outlines, and
 * static meshes merged by material so a whole board costs a few draw calls.
 *
 *   toonify(root)        every lit material becomes a MeshToonMaterial (same colour, texture, glow)
 *   flatten(root, keep)  static meshes under root merged per material; `keep` objects stay movable
 *   outline(root)        one LineSegments with the hard edges of every mesh under root
 */

type Three = typeof THREE_NS
type MergeFn = (geometries: THREE_NS.BufferGeometry[], useGroups?: boolean) => THREE_NS.BufferGeometry | null

export const INK = 0x1b1f2a

export function createToon(T: Three, mergeGeometries: MergeFn) {
  // Three tones: shade, mid, light — hard steps, no gradients.
  const grad = new T.DataTexture(new Uint8Array([120, 120, 120, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat)
  grad.minFilter = T.NearestFilter
  grad.magFilter = T.NearestFilter
  grad.generateMipmaps = false
  grad.needsUpdate = true
  const ink = new T.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.85 })

  /** Converts one material; the same original always gives the same toon material, so sharing is kept. */
  function toonMaterial(m: THREE_NS.Material, seen: Map<THREE_NS.Material, THREE_NS.Material>): THREE_NS.Material {
    const done = seen.get(m)
    if (done) return done
    const s = m as THREE_NS.MeshStandardMaterial
    if (!s.isMeshStandardMaterial && !(m as THREE_NS.MeshLambertMaterial).isMeshLambertMaterial && !(m as THREE_NS.MeshPhongMaterial).isMeshPhongMaterial) {
      seen.set(m, m)
      return m
    }
    // Metal reads as a light flat grey in the toon look; plain colours stay as they are.
    const color = s.color.clone()
    if (s.metalness > 0.5) color.lerp(new T.Color(0xffffff), 0.25)
    const toon = new T.MeshToonMaterial({
      color,
      map: s.map,
      gradientMap: grad,
      emissive: s.emissive?.clone() ?? new T.Color(0),
      emissiveMap: s.emissiveMap,
      emissiveIntensity: s.emissiveIntensity ?? 1,
      transparent: s.transparent,
      opacity: s.opacity,
      side: s.side,
      alphaTest: s.alphaTest,
      depthWrite: s.depthWrite,
    })
    toon.userData = { ...s.userData }
    toon.name = s.name
    seen.set(m, toon)
    return toon
  }

  function toonify(root: THREE_NS.Object3D, seen = new Map<THREE_NS.Material, THREE_NS.Material>()) {
    root.traverse((o) => {
      const mesh = o as THREE_NS.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => toonMaterial(m, seen)) : toonMaterial(mesh.material, seen)
    })
    return seen
  }

  /** The same geometry baked into `root`'s space, unindexed, with exactly position/normal/uv. */
  function baked(mesh: THREE_NS.Mesh, toRoot: THREE_NS.Matrix4) {
    let g = mesh.geometry.clone()
    g.applyMatrix4(toRoot)
    if (g.index) g = g.toNonIndexed()
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
    if (!g.attributes.normal) g.computeVertexNormals()
    if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array((g.attributes.position.count * 2) | 0), 2))
    g.morphAttributes = {}
    return g
  }

  const isKept = (o: THREE_NS.Object3D, root: THREE_NS.Object3D, keep: Set<THREE_NS.Object3D>) => {
    for (let p: THREE_NS.Object3D | null = o; p && p !== root; p = p.parent) if (keep.has(p) || p.userData.keep) return true
    return false
  }

  /** Merges static meshes under `root` by material. Meshes with several materials, LEDs of a board and `keep` objects stay. */
  function flatten(root: THREE_NS.Object3D, keep = new Set<THREE_NS.Object3D>()) {
    root.updateMatrixWorld(true)
    const inv = root.matrixWorld.clone().invert()
    const byMat = new Map<THREE_NS.Material, THREE_NS.BufferGeometry[]>()
    const remove: THREE_NS.Mesh[] = []
    root.traverse((o) => {
      const mesh = o as THREE_NS.Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.userData.ledColor !== undefined || isKept(mesh, root, keep)) return
      const toRoot = inv.clone().multiply(mesh.matrixWorld)
      const list = byMat.get(mesh.material) ?? []
      list.push(baked(mesh, toRoot))
      byMat.set(mesh.material, list)
      remove.push(mesh)
    })
    for (const mesh of remove) {
      mesh.parent?.remove(mesh)
      mesh.geometry.dispose()
    }
    for (const [mat, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
      if (!merged) continue
      if (geos.length > 1) for (const g of geos) g.dispose()
      const m = new T.Mesh(merged, mat)
      m.matrixAutoUpdate = false
      root.add(m)
    }
  }

  /**
   * Ink lines along the hard edges (≥ 35°) of every mesh under `root`, merged into one
   * LineSegments per moving piece. Tiny meshes (pin tips) get none — too busy.
   */
  function outline(root: THREE_NS.Object3D, keep = new Set<THREE_NS.Object3D>(), minSize = 0.9) {
    root.updateMatrixWorld(true)
    // Each kept object carries its own lines so they move with it.
    const owners = [root, ...keep].filter((o) => o === root || isDescendant(o, root))
    for (const owner of owners) {
      const inv = owner.matrixWorld.clone().invert()
      const parts: THREE_NS.BufferGeometry[] = []
      owner.traverse((o) => {
        const mesh = o as THREE_NS.Mesh
        if (!mesh.isMesh || mesh.userData.noOutline || mesh.geometry.type === 'TubeGeometry') return
        // Lines of a kept piece belong to that piece, not to the root.
        if (owner === root && isKept(mesh, root, keep)) return
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
        const scale = mesh.matrixWorld.getMaxScaleOnAxis()
        if ((mesh.geometry.boundingSphere?.radius ?? 0) * scale < minSize) return
        const edges = new T.EdgesGeometry(mesh.geometry, 35)
        edges.applyMatrix4(inv.clone().multiply(mesh.matrixWorld))
        parts.push(edges)
      })
      if (!parts.length) continue
      const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false)
      if (!merged) continue
      if (parts.length > 1) for (const g of parts) g.dispose()
      const lines = new T.LineSegments(merged, ink)
      lines.raycast = () => {}
      lines.userData.outline = true
      lines.renderOrder = 1
      owner.add(lines)
    }
  }

  return { toonify, flatten, outline, gradientMap: grad, ink }
}

function isDescendant(o: THREE_NS.Object3D, root: THREE_NS.Object3D) {
  for (let p: THREE_NS.Object3D | null = o.parent; p; p = p.parent) if (p === root) return true
  return false
}
