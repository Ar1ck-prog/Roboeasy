// LEGO element kit for detailed (visual-only) mission models.
// Units: cm. 1 stud = 0.8, 1 plate = 0.32, 1 brick = 0.96. Positions are model coordinates of the
// element's BOTTOM centre (so stacking is `y + n * PLATE`). All shapes are collide: false — the coarse
// colliders of each mission stay as they are, these only change what the model looks like.
//
// The renderer (src/render/meshes.js) turns `lego` boxes into bevelled elements with studs,
// Technic beams/frames into extruded parts with real holes, and the other kinds below into
// slopes, rock panels, plant leaves and flowers.

import { Quaternion, Vector3 } from 'three';
import { COLORS as C, box, cyl, ball, rod } from './scene.js';

export const STUD = 0.8;
export const PLATE = 0.32;
export const BRICK = 0.96;

const V = { collide: false };

/** Official LEGO colours (sRGB) used by the detailed models. */
export const L = {
  black: '#1b1d1f', white: '#f4f4f4', red: '#c91a09', yellow: '#f2cd37', orange: '#fe8a18', tan: '#e4cd9e',
  dtan: '#958a73', rbrown: '#582a12', dbrown: '#352100', lbgray: '#a0a5a9', dbgray: '#6c6e68', green: '#237841',
  bgreen: '#4b9f4a', dgreen: '#184632', lime: '#bbe90b', ylgreen: '#c7d23c', sandgreen: '#a0bcac', olive: '#9b9a5a',
  azure: '#36aebf', lazure: '#9fc3e9', blue: '#0055bf', dazure: '#078bc9', magenta: '#923978', pink: '#e4adc8',
  dpink: '#c870a0', lavender: '#e1d5ed', mlavender: '#ac78ba', purple: '#81007b', clear: '#e8f2f6', lgreenglass: '#c6efe0',
  nougat: '#d09168', lnougat: '#f6d7b3', mnougat: '#aa7d55', coral: '#ff698f', bone: '#e4cd9e',
};

/**
 * Plate standing up as a wall panel: w studs wide (horizontal), h studs tall, studs facing `facing`
 * ('+z' | '-z' | '+x' | '-x'). centre = centre of the plate.
 */
export function panel(w, h, centre, color, facing = '+z', o = {}) {
  const [x, y, z] = centre;
  const at = [x, y - ((o.plates || 1) * PLATE) / 2, z];
  const rot = { '+z': [90, 0, 0], '-z': [-90, 0, 0], '+x': [0, 0, -90], '-x': [0, 0, 90] }[facing];
  const vertAlongX = facing === '+x' || facing === '-x';
  return el(vertAlongX ? h : w, vertAlongX ? w : h, o.plates || 1, at, color, { ...o, rot });
}

/**
 * Brick / plate / tile: w x d studs, h plates high. at = bottom centre.
 * o.tile -> no studs; o.studs = [[i, j], ...] only these studs (jumper-style);
 * o.rot = [x, y, z] degrees (applied around the element centre).
 */
export function el(w, d, h, at, color, o = {}) {
  const sy = h * PLATE;
  return box(w * STUD, sy, d * STUD, [at[0], at[1] + sy / 2, at[2]], {
    ...V, color, rot: o.rot, q: o.q,
    lego: { studs: !o.tile, only: o.studs || null, glass: !!o.glass },
  });
}
export const brick = (w, d, at, color, o) => el(w, d, 3 * (o?.bricks || 1), at, color, o);
export const plate = (w, d, at, color, o) => el(w, d, 1, at, color, o);
export const tile = (w, d, at, color, o) => el(w, d, 1, at, color, { ...o, tile: true });

/** Round brick/plate (r in studs): at = bottom centre. */
export function round(rStuds, hPlates, at, color, o = {}) {
  const h = hPlates * PLATE;
  return cyl(rStuds * STUD, h, [at[0], at[1] + h / 2, at[2]], { ...V, color, rot: o.rot, lego: { stud: o.stud !== false, glass: !!o.glass } });
}

/**
 * Technic liftarm (thick beam) n holes long, centred at `at` (centre of the beam, not the bottom).
 * axis: direction of the length ('x' | 'z' | 'y'); holes: direction the holes go through ('y' | 'x' | 'z').
 */
export function liftarm(n, at, color, axis = 'x', holes = 'z', o = {}) {
  const len = n * STUD;
  const size = { x: [len, 0.72, 0.72], y: [0.72, len, 0.72], z: [0.72, 0.72, len] }[axis];
  return box(...size, at, { ...V, color, rot: o.rot, q: o.q, beam: { n, axis, holes, thin: !!o.thin, axles: o.axles || null } });
}

/**
 * Technic open frame (e.g. 5x7, 11x15) w x h holes, ring 1 stud wide, 0.8 thick. Centre at `at`.
 * plane: 'xy' (stands up facing +z), 'zy' (stands up facing +x) or 'xz' (lying flat).
 */
export function frame(w, h, at, color, plane = 'xy', o = {}) {
  const size = plane === 'xy' ? [w * STUD, h * STUD, 0.8] : plane === 'zy' ? [0.8, h * STUD, w * STUD] : [w * STUD, 0.8, h * STUD];
  return box(...size, at, { ...V, color, rot: o.rot, frame: { w, h, plane } });
}

/** Slope brick: w x d studs, h plates, high side towards -z (rotate with o.ry). at = bottom centre. */
export function slope(w, d, h, at, color, o = {}) {
  const sy = h * PLATE;
  return box(w * STUD, sy, d * STUD, [at[0], at[1] + sy / 2, at[2]], { ...V, color, rot: [0, o.ry || 0, 0], wedge: { top: o.top ?? 1, curved: !!o.curved, inv: !!o.inv } });
}

/** Rock panel: jagged faceted block (w x d studs, h plates) with the craggy face towards +z (rotate with ry). */
export function rock(w, d, h, at, color, o = {}) {
  const sy = h * PLATE;
  return box(w * STUD, sy, d * STUD, [at[0], at[1] + sy / 2, at[2]], { ...V, color, rot: [0, o.ry || 0, 0], rock: { seed: o.seed ?? (at[0] * 7.1 + at[2] * 3.3 + at[1]) } });
}

/** Plant leaf: flat leaf `len` cm long at `at` (its stem end), tilted by rot. */
export function leaf(len, at, color, rot = [0, 0, 0], o = {}) {
  return box(len, 0.12, len * (o.width ?? 0.45), at, { ...V, color, rot, leaf: { lobes: o.lobes || 1 } });
}

/** Flower plate (petals radius r cm) lying flat, centre at `at` (bottom). */
export function flower(r, at, color, centre = C.yellow, o = {}) {
  return [
    box(r * 2, 0.24, r * 2, [at[0], at[1] + 0.12, at[2]], { ...V, color, rot: o.rot, petals: { n: o.n || 5 } }),
    cyl(r * 0.32, 0.2, [at[0], at[1] + 0.32, at[2]], { ...V, color: centre, rot: o.rot }),
  ];
}

/** Technic pin / axle stub (visual), along axis, centred. */
export function pin(len, at, color = C.black, axis = 'z') {
  return cyl(0.24, len, at, { ...V, color, axis });
}
export function axle(len, at, color = C.dgray, axis = 'z') {
  return box(...(axis === 'x' ? [len, 0.18, 0.18] : axis === 'y' ? [0.18, len, 0.18] : [0.18, 0.18, len]), at, { ...V, color, axle: { axis } });
}

/**
 * Liftarm spanning p1 -> p2 (hole count from the distance). o.holes = preferred hole direction
 * (e.g. [1, 0, 0]); o.thin for a thin liftarm.
 */
export function liftarmBetween(p1, p2, color, o = {}) {
  const a = new Vector3(...p1);
  const b = new Vector3(...p2);
  const d = b.clone().sub(a);
  const n = Math.max(2, Math.round((d.length() - 0.72) / STUD) + 1);
  const dn = d.clone().normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dn);
  if (o.holes) {
    const t = new Vector3(...o.holes);
    t.sub(dn.clone().multiplyScalar(t.dot(dn)));
    if (t.lengthSq() > 1e-6) {
      t.normalize();
      const h = new Vector3(0, 0, 1).applyQuaternion(q);
      const ang = Math.atan2(dn.dot(h.clone().cross(t)), h.dot(t));
      q.premultiply(new Quaternion().setFromAxisAngle(dn, ang));
    }
  }
  const mid = a.add(b).multiplyScalar(0.5);
  return liftarm(n, [mid.x, mid.y, mid.z], color, 'x', 'z', { q: [q.x, q.y, q.z, q.w], thin: o.thin });
}

/** LEGO minifigure standing at `at` (feet), facing +z (yaw in degrees). ~3.3 cm tall. */
export function fig(at, torso, legs, hair = L.rbrown, o = {}) {
  const yaw = ((o.yaw || 0) * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const P = (x, y, z) => [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c];
  const R = (r = [0, 0, 0]) => [r[0], r[1] + (o.yaw || 0), r[2]];
  const skin = o.skin || L.yellow;
  return [
    box(0.38, 1.15, 0.52, P(-0.2, 0.6, 0), { ...V, color: legs, rot: R(), round: true }),
    box(0.38, 1.15, 0.52, P(0.2, 0.6, 0), { ...V, color: legs, rot: R(), round: true }),
    box(0.82, 0.26, 0.52, P(0, 1.3, 0), { ...V, color: legs, rot: R() }),
    box(0.84, 1.05, 0.5, P(0, 1.95, 0), { ...V, color: torso, rot: R(), round: true }),
    box(0.24, 0.85, 0.3, P(-0.55, 1.85, 0.05), { ...V, color: torso, rot: R([12, 0, -8]), round: true }),
    box(0.24, 0.85, 0.3, P(0.55, 1.85, 0.05), { ...V, color: torso, rot: R([12, 0, 8]), round: true }),
    cyl(0.12, 0.2, P(-0.6, 1.4, 0.15), { ...V, color: skin }),
    cyl(0.12, 0.2, P(0.6, 1.4, 0.15), { ...V, color: skin }),
    cyl(0.14, 0.12, P(0, 2.53, 0), { ...V, color: skin }),
    cyl(0.32, 0.6, P(0, 2.9, 0), { ...V, color: skin }),
    ball(0.045, P(-0.11, 2.97, 0.3), { ...V, color: L.black }),
    ball(0.045, P(0.11, 2.97, 0.3), { ...V, color: L.black }),
    o.helmet
      ? ball(0.4, P(0, 3.15, 0), { ...V, color: hair })
      : box(0.72, 0.28, 0.7, P(0, 3.27, -0.03), { ...V, color: hair, rot: R(), round: true }),
  ];
}

/** Leafy canopy: tilted "plant leaves" plates and small round plates scattered around `c` (radius r). */
export function canopy(c, r, colors = [L.green, L.bgreen, L.lime], seed = 1) {
  const out = [];
  const rnd = (i, k) => { const v = Math.sin((i + 1) * 12.9898 + (k + 1) * 78.233 + seed * 37.719) * 43758.5453; return v - Math.floor(v); };
  const n = Math.max(4, Math.round(3 + r * 3.2));
  for (let i = 0; i < n; i++) {
    const a = rnd(i, 1) * Math.PI * 2;
    const d = Math.sqrt(rnd(i, 2)) * r * 0.85;
    const y = (rnd(i, 3) - 0.4) * r * 0.9;
    const at = [c[0] + Math.cos(a) * d, c[1] + y, c[2] + Math.sin(a) * d];
    const col = colors[i % colors.length];
    const sz = 2.2 + rnd(i, 7) * 0.9;
    out.push(box(sz, 0.2, sz, at, { ...V, color: col, rot: [(rnd(i, 4) - 0.5) * 50, rnd(i, 5) * 360, (rnd(i, 6) - 0.5) * 50], petals: { n: 5 } }));
    if (i % 2 === 0) out.push(cyl(0.32, 0.32, [at[0], at[1] + 0.2, at[2]], { ...V, color: col, lego: { stud: true } }));
  }
  return out;
}

/** Lattice fence (tan "X" railing) from x0 to x1 (axis 'x') or z0 to z1 (axis 'z') at height y. */
export function fence(a0, a1, other, y, color, axis = 'x', h = 1.2) {
  const out = [];
  const len = a1 - a0;
  const P = (u, yy) => (axis === 'x' ? [u, yy, other] : [other, yy, u]);
  const mid = (a0 + a1) / 2;
  out.push(box(...(axis === 'x' ? [len, 0.2, 0.4] : [0.4, 0.2, len]), P(mid, y + h), { ...V, color, round: true }));
  const n = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) {
    const u = a0 + (len * i) / n;
    out.push(box(0.3, h, 0.3, P(u, y + h / 2), { ...V, color }));
    if (i < n) {
      const u1 = a0 + (len * (i + 1)) / n;
      out.push(rod(P(u, y + 0.1), P(u1, y + h - 0.1), 0.07, { ...V, color }), rod(P(u, y + h - 0.1), P(u1, y + 0.1), 0.07, { ...V, color }));
    }
  }
  return out;
}

/** A row of `n` elements along x starting at x0 (each `w` studs). */
export function rowX(n, w, x0, y, z, make) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...[].concat(make(x0 + (i + 0.5) * w * STUD, y, z, i)));
  return out;
}

/** Translate a list of shapes (helper for building sub-assemblies around their own origin). */
export function moveTo(shapes, d) {
  return shapes.map((s) => ({ ...s, at: [s.at[0] + d[0], s.at[1] + d[1], s.at[2] + d[2]] }));
}

/** Hide the coarse collider shapes of a body (they still collide), leaving the LEGO detail visible. */
export function hidden(shapes) {
  return shapes.map((s) => ({ ...s, visible: false }));
}
