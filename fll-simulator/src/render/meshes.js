// Three.js mesh factory for scene shapes. Shapes of one body are merged per colour for speed.
// LEGO detail shapes (see src/shared/lego.js) get bevelled edges, studs, real Technic holes etc.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getLDraw } from './ldraw.js';

const STUD = 0.8;
const matCache = new Map();
/**
 * ABS-plastic look: slightly glossy base with a thin clear coat (picks up the environment map).
 * opts: { roughness, flat, opacity, emissive, glass, matte }
 */
export function material(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const glass = !!opts.glass;
    const matte = !!opts.matte;
    matCache.set(key, new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: opts.roughness ?? (glass ? 0.05 : matte ? 0.85 : 0.34),
      metalness: 0.0,
      clearcoat: glass ? 1 : matte ? 0 : 0.35,
      clearcoatRoughness: 0.22,
      specularIntensity: glass ? 1 : 0.6,
      flatShading: !!opts.flat,
      side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
      transparent: glass || !!opts.opacity,
      opacity: glass ? 0.42 : opts.opacity ?? 1,
      depthWrite: !glass,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0),
      emissiveIntensity: opts.emissive ? 0.6 : 0,
    }));
  }
  return matCache.get(key);
}

function hash(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function merge(list) {
  return mergeGeometries(list.map((g) => normalizeGeom(g)));
}

function gearGeometry(r, h, teeth) {
  const parts = [new THREE.CylinderGeometry(r * 0.86, r * 0.86, h, Math.max(12, teeth))];
  const tw = (2 * Math.PI * r) / teeth / 2.2;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const g = new THREE.BoxGeometry(tw, h, r * 0.24);
    g.translate(0, 0, r * 0.88);
    g.rotateY(a);
    parts.push(g);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

// ---- LEGO details ----------------------------------------------------------------------------
let studProto = null;
/** One stud (Ø4.8 mm, 1.7 mm high, small chamfer on top), base at y = 0. */
function stud() {
  if (!studProto) {
    const r = 0.24;
    const pts = [[0, 0], [r, 0], [r, 0.15], [r - 0.025, 0.172], [0, 0.172]].map(([x, y]) => new THREE.Vector2(x, y));
    studProto = new THREE.LatheGeometry(pts, 14);
  }
  return studProto.clone();
}

function studGrid(sx, sz, y, only) {
  const nx = Math.max(1, Math.round(sx / STUD));
  const nz = Math.max(1, Math.round(sz / STUD));
  const out = [];
  const add = (i, j) => {
    const g = stud();
    g.translate(-sx / 2 + STUD * (i + 0.5) * (sx / (nx * STUD)), y, -sz / 2 + STUD * (j + 0.5) * (sz / (nz * STUD)));
    out.push(g);
  };
  if (only) for (const [i, j] of only) add(i, j);
  else for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(i, j);
  return out;
}

function legoBox(s) {
  const [sx, sy, sz] = s.size;
  const r = Math.min(0.035, Math.min(sx, sy, sz) * 0.2);
  const parts = [new RoundedBoxGeometry(sx, sy, sz, 1, r)];
  if (s.lego.studs) parts.push(...studGrid(sx, sz, sy / 2 - 0.005, s.lego.only));
  return merge(parts);
}

/** Stadium-shaped Technic liftarm with through holes; length along X, holes along Z, thickness along Y. */
function beamGeometry(s) {
  const { n, axis, holes, thin } = s.beam;
  const w = 0.72;
  const L = (n - 1) * STUD + w;
  const depth = thin ? 0.4 : 0.72;
  const R = w / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-L / 2 + R, -R);
  sh.lineTo(L / 2 - R, -R);
  sh.absarc(L / 2 - R, 0, R, -Math.PI / 2, Math.PI / 2, false);
  sh.lineTo(-L / 2 + R, R);
  sh.absarc(-L / 2 + R, 0, R, Math.PI / 2, Math.PI * 1.5, false);
  for (let i = 0; i < n; i++) {
    const h = new THREE.Path();
    h.absarc(-L / 2 + R + i * STUD, 0, 0.245, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  // base: length X, thickness Y, holes Z -> requested axes
  const unit = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const ex = unit[axis];
  const ez = unit[holes === axis ? (axis === 'y' ? 'z' : 'y') : holes];
  const ey = new THREE.Vector3().crossVectors(ez, ex);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(ex, ey, ez));
  return g;
}

/** Technic open frame: ring one stud wide with holes through the face. */
function frameGeometry(s) {
  const { w, h, plane } = s.frame;
  const W = w * STUD;
  const H = h * STUD;
  const rr = (sh, x0, y0, x1, y1, r, path) => {
    const p = path || new THREE.Shape();
    p.moveTo(x0 + r, y0);
    p.lineTo(x1 - r, y0);
    p.quadraticCurveTo(x1, y0, x1, y0 + r);
    p.lineTo(x1, y1 - r);
    p.quadraticCurveTo(x1, y1, x1 - r, y1);
    p.lineTo(x0 + r, y1);
    p.quadraticCurveTo(x0, y1, x0, y1 - r);
    p.lineTo(x0, y0 + r);
    p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  };
  const sh = rr(null, -W / 2, -H / 2, W / 2, H / 2, 0.4);
  const inner = new THREE.Path();
  rr(null, -W / 2 + STUD, -H / 2 + STUD, W / 2 - STUD, H / 2 - STUD, 0.12, inner);
  sh.holes.push(inner);
  const hole = (x, y) => { const p = new THREE.Path(); p.absarc(x, y, 0.245, 0, Math.PI * 2, true); sh.holes.push(p); };
  for (let i = 0; i < w; i++) { hole(-W / 2 + STUD * (i + 0.5), -H / 2 + 0.4); hole(-W / 2 + STUD * (i + 0.5), H / 2 - 0.4); }
  for (let j = 1; j < h - 1; j++) { hole(-W / 2 + 0.4, -H / 2 + STUD * (j + 0.5)); hole(W / 2 - 0.4, -H / 2 + STUD * (j + 0.5)); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.76, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -0.38);
  if (plane === 'zy') g.rotateY(Math.PI / 2);
  else if (plane === 'xz') g.rotateX(-Math.PI / 2);
  return g;
}

/** Slope: profile in the YZ plane extruded along X; high side at -z, `top` studs of flat top at the back. */
function wedgeGeometry(s) {
  const [sx, sy, sz] = s.size;
  const { top, curved } = s.wedge;
  const t = Math.min(sz, top * STUD);
  const lip = Math.min(0.12, sy * 0.3);
  const sh = new THREE.Shape();
  sh.moveTo(-sz / 2, -sy / 2);
  sh.lineTo(sz / 2, -sy / 2);
  sh.lineTo(sz / 2, -sy / 2 + lip);
  if (curved) sh.quadraticCurveTo(-sz / 2 + t, -sy / 2 + lip, -sz / 2 + t, sy / 2);
  else sh.lineTo(-sz / 2 + t, sy / 2);
  sh.lineTo(-sz / 2, sy / 2);
  sh.lineTo(-sz / 2, -sy / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: sx, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -sx / 2);
  g.rotateY(-Math.PI / 2);
  const parts = [g];
  if (t > 0.5) {
    for (const st of studGrid(sx, t, sy / 2 - 0.005)) { st.translate(0, 0, -sz / 2 + t / 2); parts.push(st); }
  }
  return merge(parts);
}

/** Faceted rock panel: box whose +z face is pushed in by layered noise (flat shaded). */
function rockGeometry(s) {
  const [sx, sy, sz] = s.size;
  const seg = (v) => Math.max(2, Math.round(v / 0.55));
  let g = new THREE.BoxGeometry(sx, sy, sz, seg(sx), seg(sy), 1);
  const pos = g.attributes.position;
  const seed = s.rock.seed;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const onFront = v.z > sz / 2 - 1e-4;
    const edge = Math.abs(Math.abs(v.x) - sx / 2) < 1e-4 || Math.abs(Math.abs(v.y) - sy / 2) < 1e-4;
    if (onFront) {
      const big = hash(Math.round(v.x / 1.1) + seed, Math.round(v.y / 1.3), seed);
      const fine = hash(v.x * 3.1 + seed, v.y * 2.7, seed * 0.3);
      const d = (edge ? 0.25 : 1) * (0.55 * big + 0.3 * fine) * Math.min(0.9, sz * 0.7);
      v.z -= d;
      if (!edge) { v.x += (hash(v.y, seed, v.x) - 0.5) * 0.18; v.y += (hash(seed, v.x, v.y) - 0.5) * 0.18; }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** Leaf: pointed oval in the XZ plane, stem at x = 0, slightly cupped. */
function leafGeometry(s) {
  const len = s.size[0];
  const w = s.size[2];
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(len * 0.25, w * 0.62, len * 0.7, w * 0.55, len, 0);
  sh.bezierCurveTo(len * 0.7, -w * 0.55, len * 0.25, -w * 0.62, 0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -0.05);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + (y / (w / 2)) ** 2 * 0.12 + Math.sin((x / len) * Math.PI) * 0.12);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Flower plate: n rounded petals, flat in XZ. */
function petalGeometry(s) {
  const r = s.size[0] / 2;
  const n = s.petals.n;
  const sh = new THREE.Shape();
  const N = n * 14;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rad = r * (0.5 + 0.5 * Math.abs(Math.cos((a * n) / 2)) ** 0.7);
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: s.size[1], bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -s.size[1] / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

function axleGeometry(s) {
  const len = Math.max(...s.size);
  const a = s.axle.axis;
  const g1 = new THREE.BoxGeometry(0.46, 0.17, len);
  const g2 = new THREE.BoxGeometry(0.17, 0.46, len);
  const g = merge([g1, g2]);
  if (a === 'x') g.rotateY(Math.PI / 2);
  else if (a === 'y') g.rotateX(Math.PI / 2);
  return g;
}

/** Geometry for one shape, already transformed into body-local coordinates. */
export function shapeGeometry(s) {
  let g;
  switch (s.kind) {
    case 'deco': // visual-only box-shaped detail (robot parts): same geometries as 'box'
    case 'box':
      if (s.lego) g = legoBox(s);
      else if (s.beam) g = beamGeometry(s);
      else if (s.frame) g = frameGeometry(s);
      else if (s.wedge) g = wedgeGeometry(s);
      else if (s.rock) g = rockGeometry(s);
      else if (s.leaf) g = leafGeometry(s);
      else if (s.petals) g = petalGeometry(s);
      else if (s.axle) g = axleGeometry(s);
      else g = s.round && Math.min(...s.size) > 0.25 ? new RoundedBoxGeometry(s.size[0], s.size[1], s.size[2], 2, Math.min(0.09, Math.min(...s.size) * 0.18)) : new RoundedBoxGeometry(s.size[0], s.size[1], s.size[2], 1, Math.min(0.03, Math.min(...s.size) * 0.15));
      break;
    case 'cyl':
      if (s.gearTeeth) g = gearGeometry(s.r, s.h, s.gearTeeth);
      else {
        g = new THREE.CylinderGeometry(s.r, s.r, s.h, s.r > 1.5 ? 40 : s.r > 0.5 ? 28 : 18);
        if (s.lego?.stud) {
          const st = stud();
          st.translate(0, s.h / 2 - 0.005, 0);
          g = merge([g, st]);
        }
      }
      break;
    case 'ball':
      g = new THREE.SphereGeometry(s.r, 24, 16);
      break;
    case 'capsule':
      g = new THREE.CapsuleGeometry(s.r, s.len, 6, 14);
      break;
    case 'cone':
      g = new THREE.ConeGeometry(s.r, s.h, 24);
      break;
    case 'torus':
      g = new THREE.TorusGeometry(s.R, s.r, 10, 32);
      g.rotateX(Math.PI / 2);
      break;
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(s.points.map((p) => new THREE.Vector3(...p)));
      g = new THREE.TubeGeometry(curve, Math.max(16, s.points.length * 8), s.r, 10, false);
      return g; // tube points are already body-local
    }
    case 'foliage': {
      const parts = [];
      const [x, y, z] = s.at;
      for (let i = 0; i < 6; i++) {
        const rr = s.r * (0.45 + 0.3 * hash(x + i, y, z));
        const p = new THREE.IcosahedronGeometry(rr, 0);
        p.translate((hash(i, x, z) - 0.5) * s.r * 1.1, (hash(x, i, y) - 0.4) * s.r * 0.7, (hash(z, y, i) - 0.5) * s.r * 1.1);
        parts.push(p);
      }
      g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
      break;
    }
    case 'hole':
      g = new THREE.CylinderGeometry(s.r, s.r, s.h, 12);
      break;
    default:
      g = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  }
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...s.at), new THREE.Quaternion(...(s.q || [0, 0, 0, 1])), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

function normalizeGeom(g) {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((ng.attributes.position.count) * 2), 2));
  return ng;
}

/**
 * Build a group of meshes for a list of shapes (body-local). Shapes sharing a colour are merged.
 * options: { tint, opacity, castShadow }
 */
export function buildShapesGroup(shapes, options = {}) {
  const group = new THREE.Group();
  const buckets = new Map();
  const bucket = (color, flat, lamp, glass, double) => {
    const key = color + (flat ? '|f' : '') + (lamp ? '|l' : '') + (glass ? '|g' : '') + (double ? '|d' : '');
    if (!buckets.has(key)) buckets.set(key, { color, flat, lamp, glass, double, geoms: [] });
    return buckets.get(key).geoms;
  };
  for (const s of shapes) {
    if (s.visible === false) continue;
    if (s.kind === 'ldraw') {
      const model = getLDraw(s.model);
      if (!model) continue;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...s.at), new THREE.Quaternion(...(s.q || [0, 0, 0, 1])), new THREE.Vector3(1, 1, 1));
      for (const p of model.pieces) bucket(p.main ? s.color || p.color : p.color, false, false, p.glass, true).push(normalizeGeom(p.geom.clone().applyMatrix4(m)));
      continue;
    }
    // primitive stand-in for an LDraw part: drawn only while the real mesh is not available
    if (s.alt && getLDraw(s.alt)) continue;
    const flat = s.kind === 'foliage' || !!s.rock;
    bucket(s.color || '#888888', flat, s.lamp, !!(s.lego?.glass || s.glass), false).push(normalizeGeom(shapeGeometry(s)));
  }
  for (const b of buckets.values()) {
    const geom = b.geoms.length === 1 ? b.geoms[0] : mergeGeometries(b.geoms);
    geom.computeBoundingSphere();
    const mat = options.tint
      ? material(b.color, { emissive: options.tint, opacity: options.opacity, flat: b.flat, double: b.double })
      : material(b.color, { flat: b.flat, glass: b.glass, double: b.double, opacity: options.opacity, emissive: b.lamp ? '#ffffff' : null, roughness: b.flat ? 0.6 : undefined });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = options.castShadow !== false && !b.glass;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function disposeGroup(obj) {
  obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
