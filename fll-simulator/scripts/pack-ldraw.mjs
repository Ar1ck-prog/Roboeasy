// Converts the LDraw parts used by the robot builder into one compact binary mesh file.
//
//   node scripts/pack-ldraw.mjs
//
// Source: spike_prime_ldraw/ (LDraw.org parts library subset, CC BY 2.0 / 4.0).
// Each model is packed into a self-contained MPD text (all sub-files and primitives embedded),
// parsed with three's LDrawLoader (smooth normals, BFC), converted to centimetres in a y-up frame,
// split per colour and quantised (int16 positions in 0.01 mm, int8 normals).
// Output: public/ldraw/parts.json (index), public/ldraw/parts.bin, licence files.
// Parsing at build time keeps page load fast (parsing in the browser took ~25 s).

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SRC = path.resolve('spike_prime_ldraw');
const OUT = path.resolve('public/ldraw');

// name -> [[file, LDraw colour code, offset LDU?], ...]  (code 16 = main colour, recoloured in the builder)
// Motors are split into body and drive hub so the hub can turn with the motor's rotor body.
const MODELS = {
  hub: [['45601p01.dat', 15], ['45610.dat', 14]],
  motorL: [['u9367c01.dat', 15]],
  motorLRotor: [['u9363.dat', 322, [0, -50, 0]]],
  motorM: [['u9364c01.dat', 15]],
  motorMRotor: [['u9363p01.dat', 322, [0, -50, 0]]],
  colorSensor: [['37308.dat', 15]],
  distanceSensor: [['37316.dat', 15]],
  forceSensor: [['37312.dat', 15]],
  wheel56: [['39367p01.dat', 15]],
  wheel88: [['49295p01.dat', 15]],
  frame7x11: [['39794.dat', 16]],
  frame11x15: [['39790.dat', 16]],
};
// Not converted (yet): 39370c01 ball castor (2 cm taller than the simulator's caster collider, its ball
// would sink into the floor) and 39369 / 65817 / 39793 / 39789 (would need hole connectors defined).

/** Name a reference the way LDrawLoader normalises it (s/ -> parts/s/, 48/ -> p/48/). */
function loaderName(ref) {
  const r = ref.trim().replace(/\\/g, '/').toLowerCase();
  if (r.startsWith('s/')) return 'parts/' + r;
  if (r.startsWith('48/')) return 'p/' + r;
  return r;
}

function findFile(ref) {
  const r = ref.trim().replace(/\\/g, '/').toLowerCase();
  const cands = r.startsWith('s/') ? [path.join(SRC, 'parts', r)]
    : r.startsWith('48/') || r.startsWith('8/') ? [path.join(SRC, 'p', r)]
      : [path.join(SRC, 'parts', r), path.join(SRC, 'p', r)];
  return cands.find((f) => fs.existsSync(f)) || null;
}

function collect(ref, seen, missing) {
  const key = loaderName(ref);
  if (seen.has(key)) return;
  const file = findFile(ref);
  if (!file) { missing.add(key); return; }
  const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  seen.set(key, text);
  for (const line of text.split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === '1' && t.length >= 15) collect(t.slice(14).join(' '), seen, missing);
  }
}

function packMpd(name, list) {
  const seen = new Map();
  const missing = new Set();
  for (const [f] of list) collect(f, seen, missing);
  if (missing.size) console.warn(`${name}: missing ${[...missing].join(', ')}`);
  const out = [`0 FILE ${name}.ldr`, `0 ${name}`];
  for (const [f, code, o = [0, 0, 0]] of list) out.push(`1 ${code} ${o.join(' ')} 1 0 0 0 1 0 0 0 1 ${f.toLowerCase()}`);
  out.push('0 NOFILE');
  for (const [key, text] of seen) out.push(`0 FILE ${key}`, text.trimEnd(), '0 NOFILE');
  return out.join('\n') + '\n';
}

// LDrawLoader fetches LDConfig.ldr through FileLoader -> fetch(); serve it from disk.
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, o) { Object.assign(this, o, { type }); } };
globalThis.fetch = async (req) => {
  const url = typeof req === 'string' ? req : req.url;
  const file = path.join(SRC, decodeURIComponent(new URL(url).pathname).replace(/^\/+/, ''));
  return new Response(fs.readFileSync(file, 'utf8'), { status: 200 });
};

// LDU (0.4 mm) -> cm, LDraw -Y up -> +Y up (180° about X keeps the winding)
const CONVERT = new THREE.Matrix4().makeScale(0.04, -0.04, -0.04);

function convert(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isLineSegments) return;
    const geom = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = geom.groups.length ? geom.groups : [{ start: 0, count: geom.attributes.position.count, materialIndex: 0 }];
    const m = new THREE.Matrix4().multiplyMatrices(CONVERT, o.matrixWorld);
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      const main = mat.userData?.code === '16';
      const color = '#' + mat.color.getHexString();
      const glass = !!mat.transparent && mat.opacity < 0.95;
      const key = (main ? 'main' : color) + (glass ? '|g' : '');
      if (!buckets.has(key)) buckets.set(key, { color, main, glass, geoms: [] });
      const g = new THREE.BufferGeometry();
      for (const a of ['position', 'normal']) g.setAttribute(a, new THREE.Float32BufferAttribute(geom.attributes[a].array.slice(gr.start * 3, (gr.start + gr.count) * 3), 3));
      g.applyMatrix4(m);
      buckets.get(key).geoms.push(g);
    }
  });
  return [...buckets.values()].map((b) => ({ color: b.color, main: b.main, glass: b.glass, geom: mergeGeometries(b.geoms) }));
}

const loader = new LDrawLoader();
loader.smoothNormals = true;
loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
await loader.preloadMaterials('http://local/LDConfig.ldr');

const POS_SCALE = 1000; // cm -> int16 units of 0.01 mm
const chunks = [];
let offset = 0;
const index = { posScale: POS_SCALE, models: {} };
for (const [name, list] of Object.entries(MODELS)) {
  const group = await new Promise((res, rej) => loader.parse(packMpd(name, list), res, rej));
  const pieces = convert(group);
  const box = new THREE.Box3();
  const entry = { pieces: [] };
  let tris = 0;
  for (const p of pieces) {
    const pos = p.geom.attributes.position.array;
    const nrm = p.geom.attributes.normal.array;
    const n = pos.length;
    const qp = new Int16Array(n);
    const qn = new Int8Array(n + ((4 - (n % 4)) % 4)); // pad so the next int16 block stays aligned
    for (let i = 0; i < n; i++) { qp[i] = Math.round(pos[i] * POS_SCALE); qn[i] = Math.round(nrm[i] * 127); }
    p.geom.computeBoundingBox();
    box.union(p.geom.boundingBox);
    entry.pieces.push({ color: p.color, main: p.main, glass: p.glass, count: n / 3, pos: offset, nrm: offset + qp.byteLength });
    chunks.push(Buffer.from(qp.buffer), Buffer.from(qn.buffer));
    offset += qp.byteLength + qn.byteLength;
    tris += n / 9;
  }
  entry.box = [...box.min.toArray(), ...box.max.toArray()].map((v) => Math.round(v * 1000) / 1000);
  index.models[name] = entry;
  console.log(`${name.padEnd(14)} ${String(Math.round(tris)).padStart(7)} tris  ${entry.pieces.length} colours`);
}
// ---- real hole connectors --------------------------------------------------------------------
// Every Technic hole in an LDraw part is drawn with hole primitives (peghole, connhol3, beamhole,
// axl3hole, ...). Follow the part tree with the accumulated transforms; each primitive gives a
// segment along its local Y axis (its Y extent). Segments on one line are merged into a hole and the
// hole is cut into 1 LU slots = connectors, in the same LU frame as the meshes (y up).
// npeghol* (cut-outs between neighbouring holes) are only drawn where holes meet, they do not add holes
const HOLE_RE = /^(peghole\d*|connhol\w*|beamhole|axl\dhol\w*|axl\dho\d+|axlehol\w*)\.dat$/;
const SKIP_RE = /^npeghol\w*\.dat$/;
const parsed = new Map();
function parseFile(ref) {
  const key = loaderName(ref);
  if (parsed.has(key)) return parsed.get(key);
  const file = findFile(ref);
  const out = { subs: [], pts: [] };
  if (file) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim().split(/\s+/);
      const n = t.slice(2).map(Number);
      if (t[0] === '1' && t.length >= 15) {
        const m = new THREE.Matrix4().set(n[3], n[4], n[5], n[0], n[6], n[7], n[8], n[1], n[9], n[10], n[11], n[2], 0, 0, 0, 1);
        out.subs.push({ m, ref: t.slice(14).join(' ') });
      } else if (['2', '3', '4', '5'].includes(t[0])) {
        const k = t[0] === '2' || t[0] === '5' ? 2 : Number(t[0]);
        for (let i = 0; i < k; i++) out.pts.push(new THREE.Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]));
      }
    }
  }
  parsed.set(key, out);
  return out;
}
const boxes = new Map();
function bboxOf(ref) {
  const key = loaderName(ref);
  if (boxes.has(key)) return boxes.get(key);
  const f = parseFile(ref);
  const box = new THREE.Box3().setFromPoints(f.pts);
  for (const s of f.subs) { const b = bboxOf(s.ref); if (!b.isEmpty()) box.union(b.clone().applyMatrix4(s.m)); }
  boxes.set(key, box);
  return box;
}
function holePrims(ref, M, out) {
  for (const s of parseFile(ref).subs) {
    const m = M.clone().multiply(s.m);
    const base = s.ref.trim().replace(/\\/g, '/').toLowerCase().split('/').pop();
    if (HOLE_RE.test(base)) out.push({ m, axle: base.startsWith('axl') });
    else if (!SKIP_RE.test(base)) holePrims(s.ref, m, out);
    if (HOLE_RE.test(base)) out.at(-1).ref = s.ref;
  }
}
const toLU = (v) => new THREE.Vector3(v.x / 20, -v.y / 20, -v.z / 20);
function connectorsOf(list) {
  const prims = [];
  for (const [f, , o = [0, 0, 0]] of list) holePrims(f, new THREE.Matrix4().makeTranslation(...o), prims);
  const lines = new Map();
  for (const p of prims) {
    const b = bboxOf(p.ref);
    const y0 = b.isEmpty() ? 0 : b.min.y;
    const y1 = b.isEmpty() ? 0 : b.max.y;
    const a = toLU(new THREE.Vector3(0, y0, 0).applyMatrix4(p.m));
    const c = toLU(new THREE.Vector3(0, y1, 0).applyMatrix4(p.m));
    const dir = toLU(new THREE.Vector3(0, -1, 0).transformDirection(p.m)).normalize();
    const ax = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
    const i = ax.indexOf(Math.max(...ax));
    if (ax[i] < 0.98) continue; // slanted holes are not used
    const fam = 'xyz'[i];
    const o = [0, 1, 2].filter((k) => k !== i);
    const key = `${fam}:${o.map((k) => Math.round(a.getComponent(k) * 20) / 20).join(',')}`;
    if (!lines.has(key)) lines.set(key, { fam, i, other: o.map((k) => [k, a.getComponent(k)]), segs: [], axle: false });
    const L = lines.get(key);
    L.segs.push([Math.min(a.getComponent(i), c.getComponent(i)), Math.max(a.getComponent(i), c.getComponent(i))]);
    L.axle ||= p.axle;
  }
  const conns = [];
  for (const L of lines.values()) {
    L.segs.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const s of L.segs) {
      const last = merged.at(-1);
      if (last && s[0] <= last[1] + 0.25) last[1] = Math.max(last[1], s[1]);
      else merged.push([...s]);
    }
    for (const [s0, s1] of merged) {
      const len = s1 - s0;
      const n = Math.max(1, Math.round(len));
      for (let k = 0; k < n; k++) {
        const p = [0, 0, 0];
        p[L.i] = s0 + (len * (k + 0.5)) / n;
        for (const [kk, v] of L.other) p[kk] = v;
        // Technic holes sit on the half-stud grid: snap (the primitives end a little off the surface)
        conns.push([...p.map((v) => Math.round(v * 2) / 2), L.fam, L.axle ? 'X' : 'H']);
      }
    }
  }
  const seen = new Map();
  for (const c of conns) {
    const k = c.slice(0, 4).join(',');
    if (!seen.has(k) || c[4] === 'X') seen.set(k, c);
  }
  return [...seen.values()];
}
const CONNS = {};
for (const [name, list] of Object.entries(MODELS)) CONNS[name] = connectorsOf(list);
fs.writeFileSync(path.resolve('src/shared/ldrawConns.js'),
  '// Generated by scripts/pack-ldraw.mjs — real Technic holes of the LDraw parts.\n'
  + '// [x, y, z, axis, kind] in LU, mesh frame (y up); kind H = pin hole, X = axle hole.\n'
  + `export const LDRAW_CONNS = ${JSON.stringify(CONNS)};\n`);
for (const [name, c] of Object.entries(CONNS)) console.log(`${name.padEnd(14)} ${c.length} holes`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'parts.bin'), Buffer.concat(chunks));
fs.writeFileSync(path.join(OUT, 'parts.json'), JSON.stringify(index));
for (const f of ['CAlicense.txt', 'CAlicense4.txt', 'CAreadme.txt']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
console.log(`parts.bin ${(offset / 1024 / 1024).toFixed(2)} MB`);
