// Robot design analysis (which parts are connected and how) and compilation into physics bodies.
// A design is { name, parts: [{ uid, type, pos:[x,y,z] (LU), q:[x,y,z,w], color?, port? }] }.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { PARTS, LU_CM, linkKind, MALE, FEMALE, PORTS } from './parts.js';
import { GROUP } from './scene.js';

const AXV = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
const DEG = Math.PI / 180;

export function qFromBasis(xAxis, yAxis) {
  const x = new Vector3(...xAxis).normalize();
  const y = new Vector3(...yAxis).normalize();
  const z = new Vector3().crossVectors(x, y);
  const m = new Matrix4().makeBasis(x, y, z);
  const q = new Quaternion().setFromRotationMatrix(m);
  return [q.x, q.y, q.z, q.w];
}

export function qAxisAngle(axis, deg) {
  const q = new Quaternion().setFromAxisAngle(AXV[axis] || new Vector3(...axis).normalize(), deg * DEG);
  return [q.x, q.y, q.z, q.w];
}

export function snapQuat(q) {
  // snap a rotation to the nearest of the 24 axis-aligned orientations
  const Q = new Quaternion(...q);
  const xs = AXV.x.clone().applyQuaternion(Q);
  const ys = AXV.y.clone().applyQuaternion(Q);
  const snap = (v) => {
    const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
    const i = a.indexOf(Math.max(...a));
    const out = [0, 0, 0];
    out[i] = Math.sign([v.x, v.y, v.z][i]);
    return out;
  };
  return qFromBasis(snap(xs), snap(ys));
}

const r2 = (v) => Math.round(v * 2) / 2;
const fam = (a) => {
  const ax = Math.abs(a[0]), ay = Math.abs(a[1]), az = Math.abs(a[2]);
  return ax >= ay && ax >= az ? 'x' : ay >= az ? 'y' : 'z';
};
const keyOf = (p, f) => `${f}:${r2(p[0])},${r2(p[1])},${r2(p[2])}`;

export function partConnectorsWorld(inst) {
  const def = PARTS[inst.type];
  const q = new Quaternion(...inst.q);
  const p = new Vector3(...inst.pos);
  return def.conns.map((c, ci) => {
    const wp = new Vector3(...c.p).applyQuaternion(q).add(p);
    const wa = AXV[c.a].clone().applyQuaternion(q);
    return { ci, k: c.k, sub: c.sub || 'body', p: [wp.x, wp.y, wp.z], a: [wa.x, wa.y, wa.z], legacy: !!c.legacy };
  });
}

class UF {
  constructor() { this.p = new Map(); }
  find(a) {
    if (!this.p.has(a)) this.p.set(a, a);
    let r = a;
    while (this.p.get(r) !== r) r = this.p.get(r);
    let x = a;
    while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

/** Analyse connectivity of a design. */
export function analyzeDesign(design) {
  const parts = design.parts || [];
  const uf = new UF();
  const nodeKey = (i, sub) => `${i}:${sub}`;
  const slots = new Map();
  const warnings = [];
  const partConns = [];
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (!def) return;
    uf.find(nodeKey(i, 'body'));
    if (def.electronic === 'motor') uf.find(nodeKey(i, 'rotor'));
    const conns = partConnectorsWorld(inst);
    partConns.push(conns);
    for (const c of conns) {
      const k = keyOf(c.p, fam(c.a));
      if (!slots.has(k)) slots.set(k, []);
      slots.get(k).push({ part: i, ...c });
    }
  });
  const links = []; // for rendering connection markers
  const hinges = [];
  const occupied = new Set();
  for (const list of slots.values()) {
    if (list.length < 2) continue;
    const males = list.filter((c) => MALE[c.k]);
    const females = list.filter((c) => FEMALE[c.k]);
    for (let i = 0; i < males.length; i++) for (let j = i + 1; j < males.length; j++) {
      if (males[i].part !== males[j].part) warnings.push({ type: 'overlap', parts: [males[i].part, males[j].part], text: 'Два штифта/оси в одном месте' });
    }
    for (const m of males) for (const f of females) {
      if (m.part === f.part) continue;
      const kind = linkKind(m.k, f.k);
      if (!kind) continue;
      occupied.add(`${f.part}:${f.ci}`);
      occupied.add(`${m.part}:${m.ci}`);
      links.push({ a: m.part, b: f.part, kind, p: m.p, axis: m.a });
      if (kind === 'rigid') uf.union(nodeKey(m.part, m.sub), nodeKey(f.part, f.sub));
      else hinges.push({ a: nodeKey(m.part, m.sub), b: nodeKey(f.part, f.sub), p: m.p, axis: m.a });
    }
  }

  // groups
  const groupIndex = new Map();
  const groups = [];
  const nodeGroup = (nk) => {
    const r = uf.find(nk);
    if (!groupIndex.has(r)) { groupIndex.set(r, groups.length); groups.push({ nodes: [], parts: new Set() }); }
    return groupIndex.get(r);
  };
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (!def) return;
    const subs = def.electronic === 'motor' ? ['body', 'rotor'] : ['body'];
    for (const s of subs) { const g = nodeGroup(nodeKey(i, s)); groups[g].nodes.push({ part: i, sub: s }); groups[g].parts.add(i); }
  });

  // joints between groups
  const joints = [];
  const motors = [];
  const motorParts = [];
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (def?.electronic !== 'motor') return;
    motorParts.push(i);
    const ga = nodeGroup(nodeKey(i, 'body'));
    const gb = nodeGroup(nodeKey(i, 'rotor'));
    const q = new Quaternion(...inst.q);
    const axis = AXV.x.clone().applyQuaternion(q);
    const p = new Vector3(2, 0, 0).applyQuaternion(q).add(new Vector3(...inst.pos));
    if (ga === gb) warnings.push({ type: 'locked', parts: [i], text: `${def.name}: вал жёстко связан с корпусом — мотор заблокирован` });
    const m = { part: i, ga, gb, axis: [axis.x, axis.y, axis.z], p: [p.x, p.y, p.z], kind: inst.type };
    motors.push(m);
    if (ga !== gb) joints.push({ kind: 'motor', ga, gb, axis: m.axis, p: m.p, motor: motors.length - 1 });
  });
  const seenHinge = new Set();
  for (const h of hinges) {
    const ga = nodeGroup(h.a), gb = nodeGroup(h.b);
    if (ga === gb) continue;
    const key = ga < gb ? `${ga}-${gb}` : `${gb}-${ga}`;
    if (seenHinge.has(key)) continue;
    if (joints.some((j) => (j.ga === ga && j.gb === gb) || (j.ga === gb && j.gb === ga))) continue;
    seenHinge.add(key);
    joints.push({ kind: 'hinge', ga: gb, gb: ga, axis: h.axis, p: h.p });
  }

  // root & reachability
  const hubs = parts.map((p, i) => [p, i]).filter(([p]) => p.type === 'hub');
  if (hubs.length === 0) warnings.push({ type: 'nohub', parts: [], text: 'Нет хаба — роботу нужен хаб SPIKE Prime' });
  if (hubs.length > 1) warnings.push({ type: 'hubs', parts: hubs.slice(1).map((h) => h[1]), text: 'Разрешён только один хаб' });
  const root = hubs.length ? nodeGroup(nodeKey(hubs[0][1], 'body')) : -1;
  const reach = new Set();
  if (root >= 0) {
    reach.add(root);
    let changed = true;
    while (changed) {
      changed = false;
      for (const j of joints) {
        if (reach.has(j.ga) && !reach.has(j.gb)) { reach.add(j.gb); changed = true; }
        if (reach.has(j.gb) && !reach.has(j.ga)) { reach.add(j.ga); changed = true; }
      }
    }
  }
  const floating = [];
  groups.forEach((g, gi) => { if (!reach.has(gi)) for (const p of g.parts) floating.push(p); });
  const floatSet = new Set(floating);
  if (floating.length) warnings.push({ type: 'floating', parts: [...floatSet], text: `${floatSet.size} дет. не соединены с хабом (выделены красным)` });
  if (motorParts.length > 4) warnings.push({ type: 'motors', parts: motorParts.slice(4), text: 'По правилам максимум 4 мотора' });

  // gears
  const gears = [];
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (!def?.gear) return;
    const q = new Quaternion(...inst.q);
    const ax = AXV.x.clone().applyQuaternion(q);
    gears.push({ part: i, g: nodeGroup(nodeKey(i, 'body')), r: def.gear.r, teeth: def.gear.teeth, c: new Vector3(...inst.pos), ax });
  });
  const meshes = [];
  for (let i = 0; i < gears.length; i++) for (let j = i + 1; j < gears.length; j++) {
    const A = gears[i], B = gears[j];
    if (A.g === B.g) continue;
    if (Math.abs(Math.abs(A.ax.dot(B.ax)) - 1) > 1e-3) continue;
    const d = B.c.clone().sub(A.c);
    const axial = d.dot(A.ax);
    if (Math.abs(axial) > 0.3) continue;
    const radial = d.clone().sub(A.ax.clone().multiplyScalar(axial)).length();
    if (Math.abs(radial - (A.r + B.r)) < 0.18) meshes.push({ a: i, b: j, ga: A.g, gb: B.g, ratio: -(A.teeth / B.teeth) * Math.sign(A.ax.dot(B.ax)) });
  }

  // ports
  const ports = assignPorts(parts);
  for (const [port, list] of Object.entries(ports.byPort)) if (list.length > 1) warnings.push({ type: 'port', parts: list, text: `Порт ${port} занят несколькими устройствами` });

  return { groups, joints, motors, root, reach, floating: floatSet, warnings, links, gears, meshes, ports, occupied };
}

/** Assign hub ports: explicit inst.port wins, otherwise first free (motors first). */
export function assignPorts(parts) {
  const used = new Set(parts.filter((p) => p.port && PARTS[p.type]?.electronic && PARTS[p.type].electronic !== 'hub').map((p) => p.port));
  const res = {};
  const byPort = {};
  const order = parts.map((p, i) => [p, i]).filter(([p]) => PARTS[p.type]?.electronic && PARTS[p.type].electronic !== 'hub');
  order.sort((a, b) => (PARTS[a[0].type].electronic === 'motor' ? 0 : 1) - (PARTS[b[0].type].electronic === 'motor' ? 0 : 1));
  for (const [p, i] of order) {
    let port = p.port;
    if (!port) { port = PORTS.find((x) => !used.has(x)) || null; if (port) used.add(port); }
    res[i] = port;
    if (port) (byPort[port] ||= []).push(i);
  }
  return { byPart: res, byPort };
}

// ---------------------------------------------------------------------------------------------
// Compile into scene bodies (cm). All robot bodies share the robot frame at creation time.
// ---------------------------------------------------------------------------------------------

/** Part shapes in LU (part-local), optionally with dark hole markers for pin/axle holes. */
export function partShapes(def, withHoles = true) {
  // LDraw parts: the primitives stay (colliders), and are drawn only as a stand-in (`alt`)
  // while the real LDraw mesh of their sub-body is not loaded.
  const ld = def.ldraw;
  const altFor = (sub) => ld && (ld.parts.find((p) => (p.sub || 'body') === (sub || 'body')) || ld.parts[0]).model;
  const shapes = ld ? def.shapes.map((s) => ({ ...s, alt: altFor(s.sub) })) : [...def.shapes];
  if (withHoles && !def.realHoles) {
    for (const c of def.conns) {
      if ((c.k === 'H' || c.k === 'X') && !c.legacy) shapes.push({ kind: 'hole', r: c.k === 'X' ? 0.19 : 0.245, h: 1.04, at: c.p, axis: c.a, color: c.k === 'X' ? '#3a2f22' : '#121212', collide: false, sub: c.sub, alt: altFor(c.sub) });
    }
  }
  if (ld) {
    const r = ld.rot || [0, 0, 0];
    const q = new Quaternion().setFromEuler(new Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'XYZ'));
    for (const p of ld.parts) shapes.push({ kind: 'ldraw', model: p.model, at: ld.off || [0, 0, 0], lq: [q.x, q.y, q.z, q.w], collide: false, sub: p.sub });
  }
  return shapes;
}

/** Quaternion that turns a Y-aligned primitive to the given axis. */
export function axisQuat(axis) {
  const sq = new Quaternion();
  if (axis === 'x') sq.setFromAxisAngle(AXV.z, -Math.PI / 2);
  if (axis === 'z') sq.setFromAxisAngle(AXV.x, Math.PI / 2);
  return sq;
}

export function shapeToCm(s, inst, def) {
  const q = new Quaternion(...inst.q);
  const at = new Vector3(...s.at).applyQuaternion(q).add(new Vector3(...inst.pos)).multiplyScalar(LU_CM);
  const sq = (s.kind === 'cyl' || s.kind === 'hole') ? axisQuat(s.axis) : s.lq ? new Quaternion(...s.lq) : new Quaternion();
  const fq = q.clone().multiply(sq);
  const out = {
    kind: s.kind,
    at: [at.x, at.y, at.z],
    q: [fq.x, fq.y, fq.z, fq.w],
    color: s.color || inst.color || def.color,
    collide: s.collide !== false,
    visible: true,
    tag: s.tag || null,
    friction: s.tire ? 1.0 : s.caster ? 0.02 : 0.45,
    round: s.round,
    gearTeeth: s.gearTeeth,
    matrix: s.matrix,
    part: inst.uid,
  };
  if (s.kind === 'box' || s.kind === 'deco') out.size = s.size.map((v) => v * LU_CM);
  if (s.kind === 'cyl' || s.kind === 'hole') { out.r = s.r * LU_CM; out.h = s.h * LU_CM; }
  if (s.kind === 'ball') out.r = s.r * LU_CM;
  if (s.kind === 'hole') out.collide = false;
  // visual detail (src/render/meshes.js): real LDraw mesh, its stand-ins, Technic beam/frame/axle geometry
  if (s.kind === 'ldraw') { out.model = s.model; out.collide = false; }
  for (const k of ['alt', 'beam', 'frame', 'axle']) if (s[k]) out[k] = s[k];
  if (s.visible === false) out.visible = false;
  return out;
}

function shapeVolume(s) {
  if (s.kind === 'box') return s.size[0] * s.size[1] * s.size[2];
  if (s.kind === 'cyl') return Math.PI * s.r * s.r * s.h;
  if (s.kind === 'ball') return (4 / 3) * Math.PI * s.r ** 3;
  return 1;
}

function lowestPoint(s) {
  const q = new Quaternion(...s.q);
  const c = new Vector3(...s.at);
  if (s.kind === 'ball') return c.y - s.r;
  if (s.kind === 'cyl') {
    const ax = AXV.y.clone().applyQuaternion(q);
    const radial = Math.sqrt(Math.max(0, 1 - ax.y * ax.y));
    return c.y - Math.abs(ax.y) * s.h / 2 - radial * s.r;
  }
  let m = Infinity;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = new Vector3(sx * s.size[0] / 2, sy * s.size[1] / 2, sz * s.size[2] / 2).applyQuaternion(q).add(c);
    m = Math.min(m, v.y);
  }
  return m;
}

/**
 * Compile a design. Returns { bodies, joints, motors, sensors, couplings, analysis, lift, footprint }.
 * pose: { x, z, yaw } in world cm / degrees. Body positions are placeholders (pose applied by the worker).
 */
export function compileRobot(design, pose = { x: 0, z: 0, yaw: 0 }) {
  const an = analyzeDesign(design);
  const parts = design.parts;
  if (an.root < 0) return { error: 'Нет хаба', analysis: an };
  const groupShapes = new Map();
  for (const gi of an.reach) groupShapes.set(gi, []);
  // shapes per group
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (!def || an.floating.has(i)) return;
    const nodes = def.electronic === 'motor' ? ['body', 'rotor'] : ['body'];
    for (const sub of nodes) {
      const g = an.groups.findIndex((G) => G.nodes.some((n) => n.part === i && n.sub === sub));
      if (!groupShapes.has(g)) continue;
      const shapes = partShapes(def).filter((s) => (s.sub === 'rotor' ? 'rotor' : 'body') === sub).map((s) => shapeToCm(s, inst, def));
      const colliding = shapes.filter((s) => s.collide);
      const vol = colliding.reduce((a, s) => a + shapeVolume(s), 0) || 1;
      const partMass = def.electronic === 'motor' ? (sub === 'rotor' ? def.mass * 0.15 : def.mass * 0.85) : def.mass;
      for (const s of colliding) s.mass = partMass * shapeVolume(s) / vol;
      groupShapes.get(g).push(...shapes);
    }
  });
  let lift = Infinity;
  for (const shapes of groupShapes.values()) for (const s of shapes) if (s.collide) lift = Math.min(lift, lowestPoint(s));
  lift = -lift + 0.02;
  const bodies = [];
  const gid = (g) => `robot.g${g}`;
  // root first
  const order = [an.root, ...[...an.reach].filter((g) => g !== an.root)];
  for (const g of order) {
    const shapes = groupShapes.get(g).map((s) => ({ ...s, at: [s.at[0], s.at[1] + lift, s.at[2]] }));
    if (!shapes.some((s) => s.collide)) shapes.push({ kind: 'ball', r: 0.2, at: shapes[0]?.at || [0, lift, 0], q: [0, 0, 0, 1], collide: true, visible: false, mass: 0.001 });
    bodies.push({ id: gid(g), model: 'robot', name: `g${g}`, type: 'dynamic', pos: [0, 0, 0], rot: [0, 0, 0, 1], local: [0, 0, 0], shapes, group: GROUP.ROBOT, ccd: false, damping: [0.0, 0.02], sleep: false, root: g === an.root });
  }
  const toCm = (p) => [p[0] * LU_CM, p[1] * LU_CM + lift, p[2] * LU_CM];
  const joints = [];
  const motors = [];
  for (const j of an.joints) {
    if (!an.reach.has(j.ga) || !an.reach.has(j.gb)) continue;
    const id = `robot.j${joints.length}`;
    const anchor = toCm(j.p);
    joints.push({ id, model: 'robot', kind: 'revolute', a: gid(j.ga), b: gid(j.gb), anchorA: anchor, anchorB: anchor, axis: j.axis, limits: null, friction: j.kind === 'hinge' ? 0.002 : 0, contacts: false });
    if (j.kind === 'motor') {
      const m = an.motors[j.motor];
      const inst = parts[m.part];
      const def = PARTS[inst.type];
      motors.push({ port: an.ports.byPart[m.part], joint: id, part: inst.uid, type: inst.type, specs: def.motor, stator: gid(j.ga), rotor: gid(j.gb) });
    }
  }
  // gear couplings: driven hinge follows driver group angle
  const couplings = [];
  for (const mesh of an.meshes) {
    const jA = an.joints.findIndex((j) => j.gb === mesh.ga || j.ga === mesh.ga);
    const jB = an.joints.findIndex((j) => (j.gb === mesh.gb || j.ga === mesh.gb) && j.kind === 'hinge');
    if (jA < 0 || jB < 0) continue;
    couplings.push({ driverGroup: gid(mesh.ga), drivenGroup: gid(mesh.gb), ratio: mesh.ratio });
  }
  const sensors = [];
  parts.forEach((inst, i) => {
    const def = PARTS[inst.type];
    if (!def?.sensor || an.floating.has(i)) return;
    const g = an.groups.findIndex((G) => G.nodes.some((n) => n.part === i));
    const q = new Quaternion(...inst.q);
    const o = new Vector3(...def.sensor.origin).applyQuaternion(q).add(new Vector3(...inst.pos));
    const d = new Vector3(...def.sensor.dir).applyQuaternion(q);
    sensors.push({ port: an.ports.byPart[i], type: def.electronic, body: gid(g), origin: toCm([o.x, o.y, o.z]), dir: [d.x, d.y, d.z], part: inst.uid });
  });
  // footprint (robot local, cm) for launch-area checks
  const pts = [];
  let height = 0;
  for (const b of bodies) for (const s of b.shapes) {
    if (!s.collide && s.kind !== 'box') continue;
    const r = s.kind === 'box' ? Math.hypot(...s.size) / 2 : s.r + (s.h || 0) / 2;
    pts.push([s.at[0] - r * 0.7, s.at[2] - r * 0.7], [s.at[0] + r * 0.7, s.at[2] + r * 0.7], [s.at[0] - r * 0.7, s.at[2] + r * 0.7], [s.at[0] + r * 0.7, s.at[2] - r * 0.7]);
    height = Math.max(height, s.at[1] + r * 0.7);
  }
  const hubInst = parts.find((p) => p.type === 'hub');
  return { bodies, joints, motors, sensors, couplings, analysis: an, lift, footprint: pts, height, hub: hubInst?.uid, pose };
}

// ---------------------------------------------------------------------------------------------
// Default template: differential drive base with front arm and two colour sensors.
// ---------------------------------------------------------------------------------------------
let _uid = 1;
const P = (type, pos, q = [0, 0, 0, 1], extra = {}) => ({ uid: `p${_uid++}`, type, pos, q, ...extra });

export function templateDriveBase() {
  _uid = 1;
  const Y180 = qAxisAngle('y', 180);
  const PIN_Z = qAxisAngle('y', 90); // pin axis -> -z
  const PIN_DOWN = qAxisAngle('z', -90); // pin axis -> -y
  const BEAM_Z = qAxisAngle('x', 90); // beam holes axis -> z
  const ARM = qFromBasis([0, 0, -1], [1, 0, 0]); // length -> -z, holes -> x
  const HOOK = qFromBasis([0, 0, -1], [0, 1, 0]); // length -> -z, holes(z) -> x, prong down
  const parts = [
    P('hub', [0, 0, 0]),
    // drive motors (wheels ahead of the centre of mass, caster at the back)
    P('motorM', [5, 0, -5], [0, 0, 0, 1], { port: 'B' }),
    P('pin', [3, 1, -3]), P('pin', [3, -1, -3]),
    P('motorM', [-5, 0, -5], Y180, { port: 'A' }),
    P('pin', [-3, 1, -3], Y180), P('pin', [-3, -1, -3], Y180),
    P('axle3', [7, 0, -5]), P('wheel56', [8, 0, -5]),
    P('axle3', [-7, 0, -5], Y180), P('wheel56', [-8, 0, -5], Y180),
    // caster under the back of the hub
    P('caster', [0, -2.5, 4]),
    P('pin', [2, -1.5, 4], PIN_DOWN), P('pin', [-2, -1.5, 4], PIN_DOWN),
    // lower front beam with two colour sensors
    P('beam7', [-3, -1, -6], BEAM_Z, { color: '#3fb3d6' }),
    P('pin', [-1, -1, -5], PIN_Z), P('pin', [1, -1, -5], PIN_Z),
    P('colorSensor', [-2.5, -1.5, -7.5], [0, 0, 0, 1], { port: 'E' }),
    P('colorSensor', [2.5, -1.5, -7.5], [0, 0, 0, 1], { port: 'F' }),
    P('pin', [-3, -1, -6], PIN_Z), P('pin', [3, -1, -6], PIN_Z),
    // upper front beam with the arm motor
    P('beam7', [-3, 1, -6], BEAM_Z, { color: '#2a2a2a' }),
    P('pin', [-2, 1, -5], PIN_Z), P('pin', [2, 1, -5], PIN_Z),
    P('motorM', [0, 2, -9], [0, 0, 0, 1], { port: 'C' }),
    P('pin', [-1, 1, -6], PIN_Z), P('pin', [1, 1, -6], PIN_Z),
    // arm on the motor output + hook
    P('beam9', [3, 2, -8], ARM, { color: '#a5407e' }),
    P('pin', [2, 2, -8]), P('pin', [2, 2, -10]),
    P('hook', [4, 2, -14], HOOK),
    P('pin', [3, 2, -14]), P('pin', [3, 2, -16]),
  ];
  return { name: 'Робот-база FLL', parts, version: 1 };
}

/**
 * Friction pins for every pair of free real pin holes of different parts that are coaxial and one
 * LU apart (the same rule as the builder's auto-pins).
 */
export function pinsForHoles(parts) {
  const holes = [];
  parts.forEach((inst, i) => {
    if (!PARTS[inst.type] || PARTS[inst.type].cat === 'pins') return;
    for (const c of partConnectorsWorld(inst)) if (c.k === 'H' && !c.legacy) holes.push({ i, P: new Vector3(...c.p), A: new Vector3(...c.a) });
  });
  const pins = [];
  const used = new Set();
  for (let a = 0; a < holes.length; a++) {
    for (let b = 0; b < holes.length && !used.has(a); b++) {
      const A = holes[a];
      const B = holes[b];
      if (b === a || used.has(b) || A.i === B.i || Math.abs(Math.abs(A.A.dot(B.A)) - 1) > 1e-3) continue;
      const d = B.P.clone().sub(A.P);
      if (Math.abs(d.length() - 1) > 0.05 || Math.abs(Math.abs(d.clone().normalize().dot(A.A)) - 1) > 1e-3) continue;
      const q = new Quaternion().setFromUnitVectors(AXV.x, d.normalize());
      pins.push(P('pin', [A.P.x, A.P.y, A.P.z], [q.x, q.y, q.z, q.w]));
      used.add(a);
      used.add(b);
    }
  }
  return pins;
}

/**
 * Drive base assembled only on the real holes of the SPIKE Prime parts: drive motors hang on the
 * three-hole columns of the hub's sides, colour sensors on the front face, arm motor on a top corner
 * hole, caster on the bottom holes. Pins are generated in every coaxial hole pair.
 */
export function templateRealHoles() {
  _uid = 1;
  const RX180 = qAxisAngle('x', 180); // output stays +x, body extends backwards (+z)
  const RY180 = qAxisAngle('y', 180); // output -x, body extends backwards
  const RY90 = qAxisAngle('y', 90);
  const ARM = qFromBasis([0, 0, -1], [1, 0, 0]); // length -> -z, holes -> x
  const HOOK = qFromBasis([0, 0, -1], [0, 1, 0]); // length -> -z, holes(z) -> x, prong down
  const parts = [
    P('hub', [0, 0, 0]),
    P('motorM', [5, -0.5, -4], RX180, { port: 'B' }),
    P('motorM', [-5, -0.5, -4], RY180, { port: 'A' }),
    P('axle3', [7, -0.5, -4]), P('wheel56', [8, -0.5, -4]),
    P('axle3', [-7, -0.5, -4], RY180), P('wheel56', [-8, -0.5, -4], RY180),
    P('caster', [0, -2.5, 5]),
    P('colorSensor', [-3, -1.5, -7], RY90, { port: 'E' }),
    P('colorSensor', [3, -1.5, -7], RY90, { port: 'F' }),
    P('motorM', [2, 3.5, -4], RX180, { port: 'C' }),
    P('beam9', [5, 3.5, -3], ARM, { color: '#a5407e' }),
    P('hook', [6, 3.5, -9], HOOK),
  ];
  parts.push(...pinsForHoles(parts));
  return { name: 'Робот SPIKE (настоящие отверстия)', parts, version: 1 };
}

const Z90 = qAxisAngle('z', 90); // axle / gear axis -> +y (output pointing up)
const ATT = [0.7071, 0.7071, 0, 0]; // medium/large motor standing in front of the hub, output up

/**
 * "Cooper 2.0" of team Platinum Pizzeria (BIOGLOW 530-point run; BrickLink Studio model 852730):
 * two large motors drive 62.4 mm wheels (B left, F right), two medium attachment motors stand at the
 * front with 12-tooth gears on top (D left, C right), colour sensor between them. Same ports and
 * wheel size as the team's published code. Simplified: the frames, panels and the 31 mm rollers
 * are left out, a ball caster carries the back.
 */
export function templateCooper() {
  _uid = 1;
  const RX180 = qAxisAngle('x', 180);
  const RY180 = qAxisAngle('y', 180);
  const parts = [
    P('hub', [0, 0, 0]),
    P('motorL', [5, 0.5, -2], RX180, { port: 'F' }),
    P('motorL', [-5, 0.5, -2], RY180, { port: 'B' }),
    P('axle3', [7, 0.5, -2]), P('wheel62', [8, 0.5, -2]),
    P('axle3', [-7, 0.5, -2], RY180), P('wheel62', [-8, 0.5, -2], RY180),
    P('motorM', [3, -0.5, -11], ATT, { port: 'C' }),
    P('motorM', [-3, -0.5, -11], ATT, { port: 'D' }),
    P('axle3', [3, 1.5, -11], Z90), P('gear12', [3, 2.5, -11], Z90),
    P('axle3', [-3, 1.5, -11], Z90), P('gear12', [-3, 2.5, -11], Z90),
    P('colorSensor', [0, -0.5, -11], [0, 0, 0, 1], { port: 'A' }),
    P('caster', [0, -2.5, 5]),
  ];
  parts.push(...pinsForHoles(parts));
  return { name: 'Cooper 2.0 (Platinum Pizzeria)', parts, version: 1 };
}

/**
 * Compact base-set robot (two medium drive motors with 56 mm wheels at the back: A left, B right;
 * large attachment motor standing at the front with a 20-tooth gear on top: C; ball caster at the
 * front). Built from the photo; the decorative bumper beams are left out.
 */
export function templateFrontGear() {
  _uid = 1;
  const RY180 = qAxisAngle('y', 180);
  const parts = [
    P('hub', [0, 0, 0]),
    P('motorM', [5, -0.5, 4], [0, 0, 0, 1], { port: 'B' }),
    P('motorM', [-5, -0.5, 4], RY180, { port: 'A' }),
    P('axle3', [7, -0.5, 4]), P('wheel56', [8, -0.5, 4]),
    P('axle3', [-7, -0.5, 4], RY180), P('wheel56', [-8, -0.5, 4], RY180),
    P('motorL', [0, -0.5, -9], ATT, { port: 'C' }),
    P('axle3', [0, 1.5, -9], Z90), P('gear20', [0, 2.5, -9], Z90, { color: '#e4cd9e' }),
    P('caster', [0, -2.5, -5]),
  ];
  parts.push(...pinsForHoles(parts));
  return { name: 'Робот с насадкой спереди (базовый набор)', parts, version: 1 };
}

export const TEMPLATES = [
  { id: 'drivebase', name: 'Робот-база FLL (2 колеса, рука, 2 датчика цвета)', make: templateDriveBase },
  { id: 'spikeReal', name: 'Робот SPIKE на настоящих отверстиях (штифты в отверстиях)', make: templateRealHoles },
  { id: 'cooper', name: 'Cooper 2.0 — Platinum Pizzeria (колёса 62,4 мм, 2 насадки: B/F езда, D/C насадки)', make: templateCooper },
  { id: 'frontGear', name: 'Робот с насадкой спереди (колёса 56 мм, A/B езда, C насадка)', make: templateFrontGear },
  { id: 'empty', name: 'Пустой (только хаб)', make: () => ({ name: 'Новый робот', parts: [{ uid: 'p1', type: 'hub', pos: [0, 0, 0], q: [0, 0, 0, 1] }], version: 1 }) },
];

export function designStats(design, an) {
  let mass = 0;
  let motors = 0;
  let sensors = 0;
  for (const p of design.parts) {
    const d = PARTS[p.type];
    if (!d) continue;
    mass += d.mass;
    if (d.electronic === 'motor') motors++;
    if (d.sensor) sensors++;
  }
  return { mass, motors, sensors, parts: design.parts.length };
}
