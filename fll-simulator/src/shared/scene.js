// A small declarative "scene description" used by both the physics worker and the renderer.
// Mission models and the robot are described as rigid bodies made of primitive shapes,
// connected by joints. Everything is plain data (JSON-friendly) so it can be posted
// from the worker to the main thread, which builds Three.js meshes from the same data.

import { Euler, Quaternion, Vector3 } from 'three';

// Collision groups (membership bits).
export const GROUP = { FIELD: 1, MODEL: 2, LOOSE: 4, ROBOT: 8, EQUIP: 16 };

export const COLORS = {
  black: '#1e1e1e', dgray: '#5b6064', lgray: '#a3a8ac', white: '#f2f2f0', red: '#c4281c', dred: '#7b1a12',
  brown: '#5c3a21', rbrown: '#6e2f18', tan: '#dcc595', dtan: '#a18c6a', green: '#287f46', dgreen: '#1d5c34',
  bgreen: '#4ba84b', lime: '#a6c93a', ygreen: '#d2e48c', olive: '#8d8b52', yellow: '#f4cd2f', orange: '#f08a1c',
  blue: '#1b5cb8', azure: '#3fb3d6', mblue: '#5f97d9', teal: '#11908f', magenta: '#a5407e', pink: '#f59ab5',
  lavender: '#c9b3e6', sand: '#9fb7a4', cyan: '#61d6e8', gold: '#d6a73a', purple: '#7a4fb0', cream: '#efe1bf',
};

const DEG = Math.PI / 180;

function quatFromEulerDeg(r) {
  if (!r) return [0, 0, 0, 1];
  const q = new Quaternion().setFromEuler(new Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

const AXIS_ROT = { x: [0, 0, -90], y: null, z: [90, 0, 0] };

function shape(kind, props, at, o = {}) {
  const s = { kind, ...props, at: at || [0, 0, 0], ...o };
  // cylinders/capsules/cones are Y-aligned; allow axis shortcut
  if (o.axis && !o.rot) s.rot = AXIS_ROT[o.axis];
  s.q = o.q || quatFromEulerDeg(s.rot);
  delete s.rot;
  if (s.collide === undefined) s.collide = !['cone', 'tube', 'foliage', 'torusv', 'disc'].includes(kind);
  if (s.visible === undefined) s.visible = true;
  return s;
}

export const box = (sx, sy, sz, at, o) => shape('box', { size: [sx, sy, sz] }, at, o);
export const cyl = (r, h, at, o) => shape('cyl', { r, h }, at, o);
export const ball = (r, at, o) => shape('ball', { r }, at, o);
export const capsule = (r, len, at, o) => shape('capsule', { r, len }, at, o);
export const cone = (r, h, at, o) => shape('cone', { r, h }, at, o);
export const foliage = (r, at, o) => shape('foliage', { r }, at, o);
/** Visual tube through points (model coordinates are relative to `at`). */
export const tube = (points, r, o) => shape('tube', { points, r }, [0, 0, 0], o);
/** Torus in the XZ plane (around Y) unless rotated. Collider: ring of capsules. */
export const torus = (R, r, at, o) => shape('torus', { R, r }, at, o);

/** Rotate a shape list by euler degrees around a pivot (helper for building rotated sub-assemblies). */
export function rotateShapes(shapes, eulerDeg, pivot = [0, 0, 0]) {
  const q = new Quaternion().setFromEuler(new Euler(eulerDeg[0] * DEG, eulerDeg[1] * DEG, eulerDeg[2] * DEG));
  const p = new Vector3(...pivot);
  return shapes.map((s) => {
    const v = new Vector3(...s.at).sub(p).applyQuaternion(q).add(p);
    const sq = q.clone().multiply(new Quaternion(...s.q));
    const out = { ...s, at: [v.x, v.y, v.z], q: [sq.x, sq.y, sq.z, sq.w] };
    if (s.points) out.points = s.points.map((pt) => { const w = new Vector3(...pt).sub(p).applyQuaternion(q).add(p); return [w.x, w.y, w.z]; });
    return out;
  });
}

export function translateShapes(shapes, d) {
  return shapes.map((s) => ({ ...s, at: [s.at[0] + d[0], s.at[1] + d[1], s.at[2] + d[2]], points: s.points && s.points.map((p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]) }));
}

export class SceneDesc {
  constructor() {
    this.bodies = [];
    this.joints = [];
    this.couplings = [];
    this.index = new Map();
  }
  addBody(b) {
    if (this.index.has(b.id)) throw new Error('duplicate body ' + b.id);
    b.index = this.bodies.length;
    this.bodies.push(b);
    this.index.set(b.id, b);
    return b;
  }
  addJoint(j) {
    this.joints.push(j);
    return j;
  }
  model(id, pos, rotDeg = 0, y = 0) {
    return new ModelBuilder(this, id, pos, rotDeg, y);
  }
  toJSON() {
    return { bodies: this.bodies, joints: this.joints };
  }
}

export class ModelBuilder {
  constructor(scene, id, pos, rotDeg, y) {
    this.scene = scene;
    this.id = id;
    this.rotDeg = rotDeg;
    this.q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotDeg * DEG);
    this.origin = new Vector3(pos[0], y, pos[1]);
  }
  /** model-local point -> world */
  w(p) {
    return new Vector3(...p).applyQuaternion(this.q).add(this.origin);
  }
  /** model-local direction -> world */
  dir(v) {
    return new Vector3(...v).applyQuaternion(this.q);
  }
  wxz(p) {
    const v = this.w(p);
    return [v.x, v.z];
  }
  /**
   * Add a rigid body. Shapes are given in MODEL coordinates; `at` is the body origin (pivot) in model coordinates.
   * opts: { type: 'fixed'|'dynamic'|'kinematic', at, shapes, group, ccd, damping:[lin,ang], sleep, tag, loose }
   */
  body(name, opts) {
    const at = opts.at || [0, 0, 0];
    const shapes = (opts.shapes || []).map((s) => ({
      ...s,
      at: [s.at[0] - at[0], s.at[1] - at[1], s.at[2] - at[2]],
      points: s.points && s.points.map((p) => [p[0] - at[0], p[1] - at[1], p[2] - at[2]]),
    }));
    const p = this.w(at);
    const b = {
      id: `${this.id}.${name}`,
      model: this.id,
      name,
      type: opts.type || 'dynamic',
      pos: [p.x, p.y, p.z],
      rot: [this.q.x, this.q.y, this.q.z, this.q.w],
      local: at,
      shapes,
      group: opts.group || (opts.loose ? GROUP.LOOSE : GROUP.MODEL),
      ccd: !!opts.ccd,
      damping: opts.damping || [0.05, 0.05],
      sleep: opts.sleep !== false,
      loose: !!opts.loose,
      tag: opts.tag || null,
      gravity: opts.gravity ?? 1,
    };
    return this.scene.addBody(b);
  }
  /**
   * Add visual-only shapes (MODEL coordinates) to an existing body. By default its original shapes
   * become invisible (they still collide); `keep(shape, index)` keeps some of them visible.
   */
  decorate(b, shapes, { hide = true, keep } = {}) {
    if (hide) b.shapes.forEach((s, i) => { if (!keep?.(s, i)) s.visible = false; });
    const at = b.local;
    for (const s of shapes) {
      b.shapes.push({
        ...s,
        at: [s.at[0] - at[0], s.at[1] - at[1], s.at[2] - at[2]],
        points: s.points && s.points.map((p) => [p[0] - at[0], p[1] - at[1], p[2] - at[2]]),
      });
    }
    return b;
  }
  fixedBody(name, shapes, at) {
    return this.body(name, { type: 'fixed', shapes, at });
  }
  _joint(kind, name, A, B, anchor, axis, opts = {}) {
    const ax = new Vector3(...(axis || [1, 0, 0])).normalize();
    return this.scene.addJoint({
      id: `${this.id}.${name}`,
      model: this.id,
      kind,
      a: A.id,
      b: B.id,
      anchorA: [anchor[0] - A.local[0], anchor[1] - A.local[1], anchor[2] - A.local[2]],
      anchorB: [anchor[0] - B.local[0], anchor[1] - B.local[1], anchor[2] - B.local[2]],
      axis: [ax.x, ax.y, ax.z],
      limits: opts.limits || null,
      friction: opts.friction ?? 0,
      spring: opts.spring || null,
      maxForce: opts.maxForce ?? null,
      contacts: !!opts.contacts,
    });
  }
  /** Hinge. anchor/axis in model coordinates. Angle 0 = as built. */
  revolute(name, A, B, anchor, axis, opts) {
    return this._joint('revolute', name, A, B, anchor, axis, opts);
  }
  /** Slider. Position 0 = as built. */
  prismatic(name, A, B, anchor, axis, opts) {
    return this._joint('prismatic', name, A, B, anchor, axis, opts);
  }
  weld(name, A, B, anchor = [0, 0, 0]) {
    return this._joint('fixed', name, A, B, anchor, [1, 0, 0], {});
  }
  rope(name, A, B, anchorA, anchorB, length) {
    return this.scene.addJoint({
      id: `${this.id}.${name}`,
      model: this.id,
      kind: 'rope',
      a: A.id,
      b: B.id,
      anchorA: [anchorA[0] - A.local[0], anchorA[1] - A.local[1], anchorA[2] - A.local[2]],
      anchorB: [anchorB[0] - B.local[0], anchorB[1] - B.local[1], anchorB[2] - B.local[2]],
      length,
      contacts: true,
    });
  }
}

/** Cylinder between two points. */
export function rod(p1, p2, r, o = {}) {
  const a = new Vector3(...p1);
  const b = new Vector3(...p2);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  return cyl(r, len, [mid.x, mid.y, mid.z], { ...o, q: [q.x, q.y, q.z, q.w] });
}

/** Box between two points (w across X-ish, h across Z-ish). */
export function bar(p1, p2, w, h, o = {}) {
  const a = new Vector3(...p1);
  const b = new Vector3(...p2);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  return box(w, len, h ?? w, [mid.x, mid.y, mid.z], { ...o, q: [q.x, q.y, q.z, q.w] });
}

/** Simple minifigure (visual only). */
export function minifig(at, torso = COLORS.green, legs = COLORS.dtan, head = '#f6d33c') {
  const [x, y, z] = at;
  return [
    box(0.85, 1.25, 0.55, [x, y + 0.62, z], { color: legs, collide: false }),
    box(0.95, 1.1, 0.55, [x, y + 1.8, z], { color: torso, collide: false }),
    cyl(0.33, 0.62, [x, y + 2.66, z], { color: head, collide: false }),
    cyl(0.4, 0.18, [x, y + 3.02, z], { color: COLORS.brown, collide: false }),
  ];
}

/** Studs on top of a box (visual LEGO detail). Returns cylinder shapes. */
export function studsOn(sx, sz, topAt, color, pitch = 0.8, o = {}) {
  const out = [];
  const nx = Math.max(1, Math.floor(sx / pitch + 1e-6));
  const nz = Math.max(1, Math.floor(sz / pitch + 1e-6));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      out.push(cyl(0.24, 0.17, [topAt[0] - sx / 2 + pitch * (i + 0.5), topAt[1] + 0.085, topAt[2] - sz / 2 + pitch * (j + 0.5)], { color, collide: false, ...o }));
    }
  }
  return out;
}

/** A LEGO-ish brick box with studs on top. */
export function brick(sx, sy, sz, at, color, o = {}) {
  const shapes = [box(sx, sy, sz, at, { color, ...o })];
  if (o.studs !== false && sx * sz < 200) shapes.push(...studsOn(sx, sz, [at[0], at[1] + sy / 2, at[2]], color));
  return shapes;
}

/** Technic-style beam (visual holes as dark discs) along an axis. */
export function beam(len, at, axis = 'x', color = COLORS.lgray, o = {}) {
  const t = 0.72;
  const size = axis === 'x' ? [len, t, t] : axis === 'y' ? [t, len, t] : [t, t, len];
  return [box(...size, at, { color, ...o })];
}
