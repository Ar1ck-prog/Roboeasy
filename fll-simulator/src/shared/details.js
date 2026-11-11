// Detailed LEGO look of the mission models, rebuilt from the official building instructions
// (Field/Insctruction/*.pdf). Visual only: every function returns collide:false shapes in MODEL
// coordinates of the mission (same frame as missions.js), laid over the coarse colliders.

import { ball, cone, cyl, box, tube, rod, torus } from './scene.js';
import {
  L, STUD, PLATE, BRICK, el, brick, plate, tile, round, liftarm, frame, slope, rock, leaf, flower, axle, panel,
  liftarmBetween, fig, canopy, fence,
} from './lego.js';

const V = { collide: false };

/** Fan of leaves around a point (plant pieces). */
function bush(at, color, n = 5, len = 1.1, tilt = 25, seed = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + seed * 37;
    out.push(leaf(len * (0.85 + 0.3 * ((i * 7 + seed) % 3) / 2), at, color, [0, a, tilt + ((i * 13) % 15)]));
  }
  return out;
}

/** Stalk (tube) through points with small leaves along it. */
function stalk(points, r, color) {
  return tube(points, r, { ...V, color });
}

// =============================================================================================
// M11 Window to the Past (bag 17): brown rock walls, green garden roof on clear bricks,
// fossil inside, hinged brown cover with red Technic beam, red side arm with a tan brush.
// Collider envelope (missions.js): base 10x8, walls up to y 9.4, top 9.4..10.4.
// =============================================================================================
export function m11Box() {
  const s = [];
  s.push(el(12, 10, 1, [0, 0, 0], L.rbrown));
  s.push(tile(4, 3, [0.4, PLATE, -0.8], L.dbrown), tile(2, 2, [-1.6, PLATE, 1.2], L.dtan));

  const wallH = 27; // plates: top at 0.32 + 8.64 = 8.96
  const top = PLATE + wallH * PLATE;
  for (const sx of [-1, 1]) {
    s.push(el(1, 8, wallH, [sx * 3.5, PLATE, 0], L.rbrown, { tile: true }));
    // craggy rock panels on the outside
    [[-2.8, 28], [-0.4, 25], [2.0, 27]].forEach(([z, h], i) => s.push(rock(3, 1, h, [sx * 4.3, PLATE, z], L.rbrown, { ry: sx * 90, seed: 11 + i * 5 + sx })));
    // rock fronts of the columns
    s.push(rock(2, 1, 26, [sx * 4.0, PLATE, 3.6], L.rbrown, { seed: 31 + sx }));
    s.push(slope(1, 2, 3, [sx * 4.3, PLATE, 3.2], L.bgreen, { ry: 180 }));
    // clear bricks at the corners hold the garden roof
    for (const z of [-2.8, 2.8]) s.push(el(1, 1, 3, [sx * 3.5, top, z], L.clear, { glass: true }));
    s.push(el(1, 4, 3, [sx * 3.5, top, 0], L.rbrown));
  }
  s.push(el(6, 1, wallH, [0, PLATE, -2.8], L.dbrown, { tile: true }));
  [[-2.4, 26, 3], [0, 29, 7], [2.4, 25, 9]].forEach(([x, h, seed]) => s.push(rock(3, 1, h, [x, PLATE, -3.6], L.rbrown, { ry: 180, seed })));
  s.push(el(4, 1, 3, [0, top, -2.8], L.rbrown));

  // fossil inside: spine, ribs, skull, big tusk
  const T = { ...V, color: L.tan };
  s.push(tube([[-1.8, 1.4, -1.6], [-0.6, 2.2, -1.9], [0.8, 2.3, -1.8], [1.9, 1.6, -1.2]], 0.17, T));
  for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) s.push(tube([[x, 2.15, -1.85], [x + 0.1, 2.5, -1.1], [x + 0.15, 1.7, -0.45], [x + 0.1, 0.8, -0.6]], 0.09, T));
  for (const [x, z] of [[-1.4, -0.6], [1.2, -0.3]]) s.push(tube([[x, 1.6, -1.5], [x - 0.2, 0.9, z], [x - 0.3, 0.4, z + 0.5]], 0.11, T));
  s.push(box(1.2, 0.85, 0.9, [2.3, 1.35, -0.9], { ...T, round: true }), ball(0.16, [2.55, 1.5, -0.42], { ...V, color: L.dbrown }));
  s.push(tube([[-2.3, 0.4, 1.4], [-1.9, 3.0, 0.9], [-1.0, 5.6, -0.2], [0.1, 7.4, -1.3], [0.9, 8.1, -2.0]], 0.38, { ...V, color: '#efe3c2' }));
  s.push(round(1, 3, [1.4, PLATE, 0.9], L.dbrown), round(0.5, 3, [-0.6, PLATE, 1.6], L.dtan));

  // garden roof
  const gy = top + BRICK;
  s.push(el(10, 8, 1, [0, gy, 0], L.bgreen));
  const y0 = gy + PLATE;
  s.push(tile(2, 2, [-2.0, y0, -2.4], L.bgreen), tile(2, 1, [2.8, y0, 2.8], L.green));
  // pink pipe out of a dark pot
  s.push(round(1, 3, [-2.6, y0, -1.8], L.dbrown, { stud: false }));
  s.push(tube([[-2.6, y0 + 0.9, -1.8], [-2.6, y0 + 1.9, -1.8], [-2.2, y0 + 2.6, -1.6], [-1.2, y0 + 2.7, -1.3]], 0.33, { ...V, color: '#e65aa6' }));
  // lavender coral tree
  const lt = [-1.2, y0 + 3.2, -1.8];
  s.push(stalk([[-1.5, y0, -2.2], [-1.4, y0 + 1.6, -2.0], lt], 0.13, L.mlavender));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const tip = [lt[0] + Math.cos(a) * 1.6, lt[1] + 0.3 * Math.sin(i * 2.1), lt[2] + Math.sin(a) * 1.3];
    s.push(stalk([lt, tip], 0.12, L.mlavender), round(0.5, 1, [tip[0], tip[1] - 0.16, tip[2]], L.mlavender));
  }
  // tall flower stalks: yellow cones with pink tops, big orange/purple bloom
  s.push(stalk([[0.7, y0, -0.2], [0.5, y0 + 2.2, -0.4], [0.9, y0 + 4.2, -0.2], [1.0, y0 + 4.9, 0.1]], 0.16, L.lime));
  s.push(cone(0.55, 1.0, [1.0, y0 + 5.2, 0.1], { ...V, color: L.yellow, rot: [180, 0, 0] }));
  s.push(...flower(1.15, [1.0, y0 + 5.65, 0.1], L.orange, L.yellow, { n: 4 }));
  s.push(round(0.7, 1, [1.0, y0 + 5.95, 0.1], L.purple, { stud: false }));
  for (const [x, z, h] of [[1.9, -0.9, 2.6], [-0.2, 0.7, 2.0], [2.3, 0.6, 1.5]]) {
    s.push(stalk([[x - 0.3, y0, z], [x, y0 + h, z]], 0.13, L.lime));
    s.push(cone(0.42, 0.8, [x, y0 + h + 0.3, z], { ...V, color: L.yellow, rot: [180, 0, 0] }), round(0.45, 1, [x, y0 + h + 0.6, z], '#e65aa6'));
  }
  // tree stump, dark dome, mushroom, bricks with leaves, cone tree, dark green fronds, rose
  s.push(round(1, 3, [2.6, y0, -2.2], L.rbrown, { stud: false }), round(0.98, 0.3, [2.6, y0 + BRICK, -2.2], L.tan, { stud: false }));
  s.push(tube([[2.0, y0 + 0.9, -2.8], [1.7, y0 + 0.3, -3.0]], 0.12, { ...V, color: L.rbrown }), tube([[3.2, y0 + 0.8, -1.6], [3.5, y0 + 0.2, -1.4]], 0.12, { ...V, color: L.rbrown }));
  s.push(ball(0.85, [0.8, y0 + 0.2, -2.6], { ...V, color: L.rbrown }));
  s.push(round(0.5, 3, [-3.4, y0, 2.6], L.white), round(0.5, 3, [-3.4, y0 + BRICK, 2.6], L.white), round(1, 0.8, [-3.4, y0 + 2 * BRICK, 2.6], L.lazure, { stud: false }));
  s.push(brick(2, 1, [-1.6, y0, 2.6], L.bgreen), brick(2, 2, [-1.2, y0, 1.4], L.bgreen), brick(1, 1, [-0.6, y0 + BRICK, 1.0], L.bgreen));
  s.push(...bush([-1.8, y0 + BRICK + 0.3, 2.5], L.bgreen, 4, 0.9, 20, 1));
  s.push(cone(0.95, 2.8, [1.7, y0 + 1.4, 2.2], { ...V, color: '#62bf52' }), round(0.62, 0.6, [1.7, y0 + 0.9, 2.2], L.yellow, { stud: false }));
  s.push(...bush([1.4, y0 + 0.5, -0.6], L.dgreen, 6, 1.6, 35, 2));
  s.push(...flower(0.38, [3.3, y0 + 0.5, 0.8], L.red, '#8e1006', { n: 6 }), stalk([[3.3, y0, 0.8], [3.3, y0 + 0.5, 0.8]], 0.08, L.green));
  // brown root running down the left side
  s.push(tube([[-3.2, y0 - 0.2, 1.8], [-4.6, y0 - 0.9, 1.9], [-5.0, y0 - 2.4, 1.6]], 0.2, { ...V, color: L.rbrown }));
  return s;
}

/** Cover (closed: standing at the front, z = 3.9). Opens outwards, studded face ends up on top. */
export function m11Cover() {
  const s = [];
  s.push(panel(8, 11, [0, 4.75, 3.9], L.rbrown, '+z'));
  for (const x of [-1.2, 1.2]) {
    s.push(panel(2, 4, [x, 2.4, 4.22], L.lbgray, '+z'));
    s.push(cyl(0.3, 1.5, [x, 0.65, 4.25], { ...V, color: L.lbgray, axis: 'x' }));
  }
  s.push(liftarm(9, [0, 8.75, 4.45], L.red, 'x', 'z'));
  s.push(liftarm(3, [-2.4, 7.8, 4.45], L.red, 'y', 'z'));
  // shovel
  s.push(box(0.9, 1.1, 0.12, [2.1, 3.0, 4.3], { ...V, color: L.dbgray }), rod([2.1, 3.5, 4.3], [2.4, 5.6, 4.3], 0.1, { ...V, color: L.dbgray }));
  // black sign on a brown stick
  s.push(axle(3.2, [2.6, 9.9, 4.45], L.rbrown, 'y'));
  s.push(box(2.6, 1.7, 0.2, [2.6, 11.2, 4.6], { ...V, color: L.black, rot: [-12, 0, 0] }));
  s.push(box(2.1, 1.2, 0.04, [2.6, 11.2, 4.72], { ...V, color: '#3b4046', rot: [-12, 0, 0] }));
  return s;
}

/** Side arm with the tan brush (pivot at [-5.5, 5.5, 1.5]). */
export function m11Trigger() {
  return [
    cyl(0.45, 1.4, [-5.5, 5.5, 1.5], { ...V, color: L.dbgray }),
    liftarm(6, [-7.0, 5.5, 3.0], L.red, 'x', 'y', { rot: [0, 45, 0] }),
    liftarm(5, [-9.0, 5.6, 4.5], L.red, 'y', 'z'),
    cyl(0.55, 1.6, [-9.0, 8.6, 4.5], { ...V, color: L.tan }),
    cone(0.62, 1.2, [-9.0, 10.0, 4.5], { ...V, color: L.tan }),
    ...[0, 1, 2].map((i) => box(1.3, 0.12, 1.3, [-9.0, 8.1 + i * 0.5, 4.5], { ...V, color: L.dtan, rot: [0, 45, 0] })),
  ];
}

// =============================================================================================
// M15 Biocentric Architecture (bags 22-24): tan brick house with windows and green shutters,
// lime Technic frames on the ends, white floors, red skylight frame, dark grey canopy plate with a
// red lever, roof garden with flowers. Collider envelope: 13 x 11, walls to y 10, roof to 10.8.
// =============================================================================================
const WALL_ROWS = [L.tan, L.tan, L.dtan, L.tan, L.tan, L.tan, L.dtan, L.tan, L.tan, L.tan];

/** Brick wall 1 stud thick along X from x0 to x1 at z, rows of bricks (staggered joints). */
function wallX(x0, x1, z, y0, rows, colors = WALL_ROWS, skip) {
  const out = [];
  const len = Math.round((x1 - x0) / STUD);
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * BRICK;
    let i = 0;
    const sizes = r % 2 ? [2, 4, 3, 4, 2, 4] : [4, 3, 4, 2, 4, 3];
    let k = 0;
    while (i < len) {
      const n = Math.min(sizes[k++ % sizes.length], len - i);
      const cx = x0 + (i + n / 2) * STUD;
      if (!skip?.(cx, y, n)) out.push(el(n, 1, 3, [cx, y, z], colors[r % colors.length], { tile: true }));
      i += n;
    }
  }
  return out;
}
function wallZ(z0, z1, x, y0, rows, colors = WALL_ROWS, skip) {
  const out = [];
  const len = Math.round((z1 - z0) / STUD);
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * BRICK;
    let i = 0;
    const sizes = r % 2 ? [3, 4, 2, 4, 3] : [2, 4, 4, 3, 4];
    let k = 0;
    while (i < len) {
      const n = Math.min(sizes[k++ % sizes.length], len - i);
      const cz = z0 + (i + n / 2) * STUD;
      if (!skip?.(cz, y, n)) out.push(el(1, n, 3, [x, y, cz], colors[r % colors.length], { tile: true }));
      i += n;
    }
  }
  return out;
}

/** Window: white frame, light glass, green shutters; on a wall facing `facing` (+z/-z/+x/-x). */
function windowAt(c, facing) {
  const [x, y, z] = c;
  const n = { '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0] }[facing];
  const along = n[0] ? 'z' : 'x';
  const off = (d) => [x + n[0] * d, y, z + n[2] * d];
  const sz = (a, b, t) => (along === 'x' ? [a, b, t] : [t, b, a]);
  const sh = (side) => { const p = off(0.12); return along === 'x' ? [p[0] + side * 1.05, p[1], p[2]] : [p[0], p[1], p[2] + side * 1.05]; };
  return [
    box(...sz(1.6, 1.9, 0.16), off(0.06), { ...V, color: L.white }),
    box(...sz(1.3, 1.6, 0.06), off(0.15), { ...V, color: '#24323a' }),
    box(...sz(1.3, 1.6, 0.08), off(0.2), { ...V, color: '#9fd8dc', glass: true }),
    box(...sz(0.08, 1.6, 0.14), off(0.2), { ...V, color: L.white }),
    box(...sz(0.4, 1.8, 0.14), sh(-1), { ...V, color: L.bgreen }),
    box(...sz(0.4, 1.8, 0.14), sh(1), { ...V, color: L.bgreen }),
    box(...sz(2.0, 0.22, 0.4), [off(0.15)[0], y - 1.0, off(0.15)[2]], { ...V, color: L.white }),
  ];
}

export function m15Building() {
  const s = [];
  const yb = 0.64;
  s.push(el(16, 14, 1, [0, 0, 0], L.white, { tile: true }), el(16, 14, 1, [0, PLATE, 0], L.white));
  const rows = 10; // 0.64 .. 10.24
  // front wall (z = 5.1): hatch opening x 1..5.5, y < 4.6
  s.push(...wallX(-6.4, 6.4, 5.1, yb, rows, WALL_ROWS, (cx, y, n) => cx + n * 0.4 > 1.0 && cx - n * 0.4 < 5.6 && y < 4.5));
  s.push(...wallX(-6.4, 6.4, -5.1, yb, rows));
  // end walls with big lime Technic frames on the lower floor; the frame openings show the inside
  for (const sx of [-1, 1]) {
    s.push(...wallZ(-4.8, 4.8, sx * 6.1, yb, rows, WALL_ROWS, (cz, y, n) => y < 5.4 && Math.abs(cz) < 3.6 - n * 0.4 + 0.01));
    s.push(frame(11, 7, [sx * 6.9, yb + 2.8, 0], L.lime, 'zy'));
    s.push(el(1, 2, 3, [sx * 6.9, yb + 5.6, 0], L.lbgray), tile(1, 2, [sx * 6.9, yb + 5.6 + BRICK, 0], L.yellow));
    for (const z of [-4.4, 4.4]) s.push(...[0, 1, 2].map((r) => el(1, 1, 3, [sx * 6.9, yb + 6.6 + r * BRICK, z], r === 1 ? L.green : L.bgreen)));
  }
  // second floor and interior details seen through the frames and the skylight
  s.push(el(14, 12, 1, [0, 5.4, 0], L.white));
  s.push(axle(4.4, [5.0, 2.8, -1.2], L.rbrown, 'y'), el(2, 1, 2, [5.0, 4.6, -1.2], L.bgreen));
  s.push(axle(4.4, [-5.0, 2.8, 1.0], L.rbrown, 'y'), el(2, 1, 2, [-5.0, 4.6, 1.0], L.bgreen));
  s.push(cyl(0.9, 0.3, [4.6, 2.6, 2.2], { ...V, color: L.black, axis: 'x' }), cyl(0.4, 0.32, [4.4, 2.6, 2.2], { ...V, color: L.magenta, axis: 'x' }));
  // windows: front (left of the hatch), back, and on the upper floor of the ends
  for (const [x, y] of [[-4.4, 3.0], [-1.6, 3.0], [-4.4, 7.3], [-1.6, 7.3], [1.8, 7.3], [4.6, 7.3]]) s.push(...windowAt([x, y, 5.5], '+z'));
  for (const [x, y] of [[-4.0, 3.0], [-1.2, 3.0], [1.6, 3.0], [4.4, 3.0], [-4.0, 7.3], [-1.2, 7.3], [1.6, 7.3], [4.4, 7.3]]) s.push(...windowAt([x, y, -5.5], '-z'));
  for (const sx of [-1, 1]) for (const z of [-2.2, 2.2]) s.push(...windowAt([sx * 6.5, 8.6, z], sx > 0 ? '+x' : '-x'));
  // green Technic bricks at the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let r = 0; r < 4; r++) s.push(liftarm(2, [sx * 6.25, yb + 0.5 + r * 2.2, sz * 5.55], r % 2 ? L.green : L.bgreen, 'x', 'z'));
  }
  // roof: tan plates, hole for the skylight, raised lime garden, sun flower, red trim
  const ry = yb + rows * BRICK; // 10.24
  s.push(el(16, 7, 1, [0, ry, -2.8], L.tan), el(9, 7, 1, [-2.8, ry, 2.8], L.tan));
  s.push(el(1, 7, 1, [6.0, ry, 2.8], L.tan), el(6, 1, 1, [3.2, ry, -0.2], L.tan));
  s.push(...[0, 1, 2, 3, 4].map((i) => tile(1, 1, [1.6 + i * 0.8, ry, 5.2], L.tan)));
  // roof garden (front left)
  s.push(el(8, 6, 3, [-3.2, ry + PLATE, 3.2], L.lime), el(8, 6, 1, [-3.2, ry + PLATE + BRICK, 3.2], L.lime));
  const gy = ry + 2 * PLATE + BRICK;
  for (const [x, z] of [[-5.0, 2.0], [-2.6, 4.4], [-1.2, 2.4]]) s.push(...flower(0.55, [x, gy, z], L.yellow, L.black, { n: 5 }));
  for (const [x, z, sd] of [[-4.0, 4.6, 1], [-1.8, 3.4, 2], [-5.4, 3.6, 3], [-0.6, 4.6, 4]]) s.push(...bush([x, gy + 0.1, z], L.green, 4, 0.8, 18, sd));
  // sun flower and bird on the back roof
  s.push(round(1.2, 1, [2.6, ry + PLATE, -2.4], L.tan));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 360;
    s.push(leaf(1.3, [2.6, ry + 0.9, -2.4], i % 2 ? L.lnougat : L.nougat, [0, a, -18]));
  }
  s.push(ball(0.42, [2.6, ry + 1.05, -2.4], { ...V, color: L.lnougat }));
  s.push(ball(0.35, [-0.6, ry + 0.7, 0.6], { ...V, color: L.dazure }), cone(0.14, 0.35, [-0.6, ry + 0.75, 1.05], { ...V, color: L.yellow, rot: [90, 0, 0] }));
  // lever bracket in front of the left part of the front wall
  s.push(liftarm(3, [-5.4, 7.0, 6.75], L.lime, 'z', 'x'));
  return s;
}

/** Canopy: dark grey plate hinged at the back (x -6..0, z -5..0) with a red lever and a blue bird. */
export function m15Canopy() {
  const y = 10.24 + PLATE;
  return [
    el(8, 6, 1, [-3.0, y, -2.5], L.dbgray),
    el(8, 1, 1, [-3.0, y - PLATE, -4.6], L.lbgray, { tile: true }),
    cyl(0.32, 6.0, [-3.0, y, -5.05], { ...V, color: L.lbgray, axis: 'x' }),
    liftarm(3, [-0.2, y + 1.2, -2.0], L.lbgray, 'y', 'x'),
    rod([-0.2, y + 2.3, -2.0], [1.6, y + 3.4, -2.0], 0.16, { ...V, color: L.red }),
    ball(0.5, [1.8, y + 3.5, -2.0], { ...V, color: L.red }),
    ball(0.38, [-3.5, y + 0.7, -1.2], { ...V, color: L.dazure }),
    cone(0.16, 0.4, [-3.5, y + 0.75, -0.75], { ...V, color: L.yellow, rot: [90, 0, 0] }),
  ];
}

/** Lever hanging from the bracket (pivot [-4.5, 7, 8]): grey arm, red ball handle. */
export function m15Lever() {
  return [
    cyl(0.4, 1.4, [-4.5, 7.0, 8.0], { ...V, color: L.dbgray, axis: 'x' }),
    liftarm(5, [-4.5, 5.4, 8.0], L.lbgray, 'y', 'x'),
    box(2.4, 1.6, 0.5, [-4.5, 3.6, 8.0], { ...V, color: L.red, round: true }),
    ball(0.75, [-4.5, 3.5, 8.5], { ...V, color: L.red }),
  ];
}

/** Skylight: red frame of 1x6 bricks with a clear pane, slides in over the roof hole. */
export function m15Skylight() {
  const y = 10.8;
  return [
    el(6, 1, 3, [3.0, y, 9.1], L.red),
    el(6, 1, 3, [3.0, y, 4.9], L.red),
    el(1, 4, 3, [5.1, y, 7.0], L.red),
    el(1, 4, 3, [0.9, y, 7.0], L.red),
    box(3.4, 0.12, 3.4, [3.0, y + 0.5, 7.0], { ...V, color: L.clear, glass: true }),
  ];
}

/** Compost hatch: dark brown planks with a grey handle (closed: standing in the front opening). */
export function m15Hatch() {
  const s = [];
  for (let r = 0; r < 4; r++) s.push(el(5, 1, 3, [3.25, 0.4 + r * BRICK, 5.35], r % 2 ? L.rbrown : L.dbrown, { tile: true }));
  s.push(box(1.4, 0.4, 0.4, [3.25, 3.4, 5.75], { ...V, color: L.dbgray, round: true }));
  return s;
}

/** Push button: red axle with a red ball end sticking out of the wall. */
export function m15Button() {
  return [
    axle(1.6, [5.8, 6.0, 6.0], L.red, 'z'),
    ball(0.75, [5.8, 6.0, 6.9], { ...V, color: L.red }),
  ];
}

// =============================================================================================
// M01 Drone Survey (bags 1-2): grey round launch base with lime, satellite dish, minifigure with
// a remote; white quad-rotor drone on black strings; red launch lever; LiDAR map = grey Technic
// frame with green round plates.
// =============================================================================================
export function m01Detail({ droneX, P, LP, mapC, H }) {
  const [mx, , mz] = mapC;
  const string = { ...V, color: '#2b2d30' };
  const rotor = (x, z) => [
    round(1, 1, [x, 1.28, z], L.white, { stud: false }),
    round(1, 0.5, [x, 1.6, z], L.black, { stud: false }),
    cyl(0.2, 0.16, [x, 1.84, z], { ...V, color: L.lbgray }),
  ];
  return {
    base: [
      round(3.6, 2, [0, 0, 0], L.dbgray),
      el(4, 2, 1, [0, 0.64, 0], L.lime),
      slope(2, 2, 3, [0, 0.96, 1.6], L.dbgray),
      slope(2, 2, 3, [0, 0.96, -1.6], L.dbgray, { ry: 180 }),
      liftarm(4, [0, 2.3, 2.4], L.black, 'y', 'x'),
      liftarm(4, [0, 2.3, -2.4], L.black, 'y', 'x'),
      liftarm(6, [0, 2.2, -3.5], L.black, 'y', 'x'),
      rod([1.3, 1.0, -2.6], [1.3, 3.7, -2.6], 0.08, { ...V, color: L.black }),
      cyl(1.0, 0.08, [1.3, 3.9, -2.6], { ...V, axis: 'x', color: L.clear, glass: true }),
      rod([0.5, 3.9, -2.6], [2.4, 3.9, -2.6], 0.13, { ...V, color: L.orange }),
      round(2.6, 1, [5.0, 0, 1.4], L.lbgray),
      ...fig([5.0, PLATE, 1.4], L.green, L.dtan, L.rbrown, { yaw: -90 }),
      el(2, 1, 1, [6.0, 1.9, 0.9], L.black, { tile: true }),
      rod([6.0, 2.2, 0.9], [6.3, 3.4, 0.9], 0.05, { ...V, color: L.lbgray }),
    ],
    tripod: [
      cyl(0.8, 3.6, P, { ...V, axis: 'z', color: L.dbgray }),
      rod([0.4, 3.2, 1.4], [droneX + 1.2, 1.05, 0.7], 0.07, string),
      rod([0.4, 3.2, -1.4], [droneX + 1.2, 1.05, -0.7], 0.07, string),
      cyl(0.2, 1.8, [droneX + 1.3, 1.05, 0], { ...V, axis: 'z', color: L.black }),
      el(2, 2, 3, [droneX, 0, 0], L.white),
      el(4, 2, 1, [droneX, BRICK, 0], L.white, { tile: true }),
      el(2, 4, 1, [droneX, BRICK, 0], L.white, { tile: true }),
      ...rotor(droneX + 1.2, 1.2), ...rotor(droneX - 1.2, 1.2), ...rotor(droneX + 1.2, -1.2), ...rotor(droneX - 1.2, -1.2),
      el(1, 1, 3, [droneX - 1.2, 0, 0], L.dbgray),
      cyl(0.28, 0.2, [droneX - 1.65, 0.48, 0], { ...V, axis: 'x', color: L.black }),
      el(1, 2, 1, [droneX + 0.4, 0.2, 0], L.lazure, { tile: true, glass: true }),
      liftarm(11, [0, 7.6, 0], L.red, 'y', 'z'),
      liftarm(6, [0, 11.8, 0], L.red, 'z', 'x'),
    ],
    paddle: [
      liftarmBetween(LP, [0, 4.6, -11], L.dbgray, { holes: [0, 1, 0] }),
      cyl(0.4, 1.2, LP, { ...V, color: L.lbgray }),
      panel(4, 6, [0, 4.0, -11], L.red, '+x'),
    ],
    map: [
      frame(7, 7, [mx, 0.4, mz], L.lbgray, 'xz'),
      el(5, 5, 1, [mx, 0.4, mz], L.dbgray),
      round(1, 1, [mx - 1.0, 0.8, mz - 0.8], L.bgreen), round(1, 1, [mx + 0.7, 0.8, mz - 1.0], L.green),
      round(1, 1, [mx - 0.7, 0.8, mz + 0.9], L.bgreen), round(1, 1, [mx + 1.1, 0.8, mz + 0.7], L.green),
      round(0.5, 1, [mx - 0.1, 1.12, mz - 0.1], L.red),
      tile(2, 2, [mx + 0.3, 0.72, mz + 0.2], L.rbrown),
    ],
    anchor: [liftarm(7, [H[0], 0.36, H[2]], L.dbgray, 'x', 'y')],
  };
}

// =============================================================================================
// M02 Exploding Seeds (bag 3): grey frame base, lime panels, yellow Technic stalk with a cross
// hub, lime hoses to the seed cups, purple flower; yellow trigger paddle.
// =============================================================================================
export function m02Detail({ stalkTop }) {
  const t = stalkTop;
  return {
    base: [
      frame(9, 6, [0, 0.4, 0], L.lbgray, 'xz'),
      box(1.0, 8, 2.4, [-1.3, 4.8, -0.5], { ...V, color: L.lime, round: true }),
      box(1.0, 8, 2.4, [1.3, 4.8, -0.5], { ...V, color: L.lime, round: true }),
      liftarm(5, [-2.8, 2.6, -1.7], L.lbgray, 'y', 'x'),
      liftarm(5, [2.8, 2.6, -1.7], L.lbgray, 'y', 'x'),
      liftarm(13, [0, 6.1, -0.5], L.lime, 'y', 'z'),
      liftarm(15, [0, t - 5.6, -0.5], L.yellow, 'y', 'z'),
      leaf(1.5, [0.4, 14, -0.5], L.lime, [0, 0, 30]), leaf(1.5, [-0.4, 16.2, -0.5], L.lime, [0, 180, 30]),
      leaf(1.3, [0.4, 11, -0.5], L.lime, [0, 20, 20]), leaf(1.3, [-0.4, 9.2, -0.5], L.lime, [0, 160, 20]),
      ...flower(0.7, [1.85, 7.0, -0.5], L.purple, L.purple, { rot: [0, 0, -90] }),
      cyl(0.4, 0.3, [-0.55, 19, -0.5], { ...V, axis: 'x', color: '#e65aa6' }),
      liftarm(4, [0, 9.5, 1.65], L.lime, 'z', 'x'),
    ],
    pod: [
      box(0.9, 1.6, 0.9, [0, t + 0.8, -0.5], { ...V, color: L.yellow, round: true }),
      liftarm(3, [0, t + 1.6, -0.5], L.yellow, 'x', 'z'),
      liftarm(7, [0.6, t + 1.6, -0.5], L.yellow, 'x', 'z', { rot: [0, 0, 18] }),
      ball(0.45, [3.3, t + 2.6, -0.5], { ...V, color: '#e65aa6' }),
    ],
    trigger: [
      liftarm(5, [0, 7.85, 3.0], L.yellow, 'y', 'x'),
      panel(5, 3, [0, 5.9, 3.0], L.yellow, '+z'),
    ],
  };
}

/** Seed pod: brown spiky bulb (visual spikes around the ball collider at `at`). */
export function seedDetail(at, color) {
  const [x, y, z] = at;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    out.push(cone(0.22, 0.55, [x + Math.cos(a) * 0.9, y + 0.15, z + Math.sin(a) * 0.9], { ...V, color, rot: [Math.sin(a) * 80, 0, -Math.cos(a) * 80] }));
  }
  out.push(cone(0.3, 0.6, [x, y + 1.05, z], { ...V, color }));
  return out;
}

// =============================================================================================
// M03 Flip the Rock (bags 4-5): lime Technic frame base, grey uprights, the rock = dark grey
// frames box with red pins, red handles; plants on top, critters underneath; red flag.
// =============================================================================================
export function m03Detail({ A }) {
  const ay = A[1];
  const rockS = [
    box(8.4, 3.4, 5.0, [0, ay, -1], { ...V, color: L.dbgray }),
    frame(11, 7, [0, ay + 1.8, -1], L.dbgray, 'xz'),
    frame(11, 7, [0, ay - 1.8, -1], L.dbgray, 'xz'),
    liftarm(11, [0, ay, 1.75], L.lbgray, 'x', 'z'),
    liftarm(11, [0, ay, -3.75], L.lbgray, 'x', 'z'),
    liftarm(7, [4.3, ay, -1], L.lbgray, 'z', 'x'),
    liftarm(7, [-4.3, ay, -1], L.lbgray, 'z', 'x'),
    el(4, 3, 1, [-2, ay + 2.2, -1.6], L.green),
    el(3, 2, 1, [2.2, ay + 2.2, -0.2], L.lbgray),
    ...bush([2.4, ay + 2.6, -0.6], L.bgreen, 4, 1.0, 22, 1),
    ...bush([-3.2, ay + 2.5, -2.2], L.bgreen, 4, 0.9, 22, 2),
    round(0.6, 1, [0.5, ay + 2.2, -2.6], L.azure),
    ball(0.45, [-2, 7.2, -0.5], { ...V, color: L.orange }),
    ball(0.4, [1.5, 7.2, -2], { ...V, color: L.magenta }),
    box(1.6, 0.4, 0.4, [2.5, 7.2, 0.8], { ...V, color: L.pink, round: true }),
    liftarm(9, [4.3, 13, -1], L.red, 'y', 'z'),
    liftarm(9, [-4.3, 13, -1], L.red, 'y', 'z'),
  ];
  for (let i = 0; i < 11; i += 2) for (const dz of [-2.4, 2.4]) rockS.push(cyl(0.25, 0.14, [-4 + i * 0.8, ay + 2.22, -1 + dz], { ...V, color: L.red }));
  return {
    base: [
      el(13, 9, 2, [0, 0, -1], L.dbgray, { tile: true }),
      frame(15, 11, [0, 0.4, -1], L.lime, 'xz'),
      frame(15, 11, [0, 1.2, -1], L.lime, 'xz'),
      liftarm(11, [5.6, 5.9, -1.4], L.lbgray, 'y', 'x'), liftarm(11, [5.6, 5.9, -0.6], L.lbgray, 'y', 'x'),
      liftarm(11, [-5.6, 5.9, -1.4], L.lbgray, 'y', 'x'), liftarm(11, [-5.6, 5.9, -0.6], L.lbgray, 'y', 'x'),
      round(0.5, 1, [-4.2, 1.6, 2.6], L.pink),
      cyl(0.25, 2.2, [-4.6, 0.8, 4.4], { ...V, axis: 'z', color: L.red }),
    ],
    rock: rockS,
    flag: [
      liftarm(6, [3, 4.2, 3.0], L.red, 'y', 'z'),
      panel(3, 2, [3, 5.6, 4.1], L.red, '+x'),
    ],
  };
}

// =============================================================================================
// M04 Lucky Leaves (bag 6): layered green / grey plate nest, bright green sockets; big green
// leaf slopes with a brown rope loop.
// =============================================================================================
export function m04Center() {
  return [
    el(5, 5, 2, [0, 0, 0], L.lbgray, { tile: true }),
    el(5, 5, 1, [0, 0.64, 0], L.bgreen, { tile: true }),
    el(5, 5, 1, [0, 0.96, 0], L.lbgray, { tile: true }),
    el(5, 5, 2, [0, 1.28, 0], L.green),
  ];
}
/** One arm of the nest, pointing +z (rotated by the caller). */
export function m04Arm() {
  return [
    el(4, 8, 2, [0, 0, 4.4], L.lbgray, { tile: true }),
    el(4, 8, 1, [0, 0.64, 4.4], L.bgreen, { tile: true }),
    el(4, 8, 2, [0, 0.96, 4.4], L.green),
    el(3, 3, 1, [0, 1.6, 2.6], L.lbgray, { tile: true }),
    el(1, 3, 6, [1.1, 1.6, 6], L.bgreen),
    el(1, 3, 6, [-1.1, 1.6, 6], L.bgreen),
    el(2, 1, 6, [0, 1.6, 7.1], L.bgreen),
    el(2, 1, 6, [0, 1.6, 4.9], L.bgreen),
  ];
}
/** Leaf blades for a lucky leaf standing at the origin pointing +z. */
export function m04Leaf(color) {
  return [
    leaf(6.6, [0, 4.35, -0.4], color, [-20, -90, 0], { width: 0.36 }),
    leaf(3.8, [0.3, 4.1, 0.1], color, [-18, -62, 0], { width: 0.4 }),
    leaf(3.8, [-0.3, 4.1, 0.1], color, [-18, -118, 0], { width: 0.4 }),
    el(2, 2, 1, [0, 3.7, 0], L.bgreen),
  ];
}

// =============================================================================================
// M05 Reaching Roots (bag 7): grey Technic frames, brown root liftarms with a green beam, red
// handle with ball ends, curved horn tip; brown trunk with a leafy crown.
// =============================================================================================
export function m05Detail() {
  const base = [
    el(5, 4, 2, [0, 0, 0.3], L.rbrown),
    slope(2, 1, 3, [-0.9, 0.64, 1.6], L.bgreen),
    slope(2, 1, 3, [0.9, 0.64, 1.6], L.bgreen),
    frame(5, 9, [0, 4.2, -1.0], L.lbgray, 'xy'),
    frame(4, 9, [1.4, 4.2, 0.3], L.lbgray, 'zy'),
    frame(4, 9, [-1.4, 4.2, 0.3], L.lbgray, 'zy'),
    ...canopy([-3.2, 10.8, 0.2], 2.4, [L.green, L.bgreen, L.lime], 3),
    ...canopy([-4.6, 8.6, 1.2], 1.6, [L.bgreen, L.green], 4),
  ];
  for (let i = 0; i < 10; i++) base.push(round(1.1, 3, [-2.9, i * BRICK, 0.2], i % 3 === 1 ? L.dbrown : L.rbrown, { stud: false }));
  return {
    base,
    root: [
      liftarmBetween([-0.38, 9, 0.3], [-0.38, 15, 6.3], L.rbrown, { holes: [1, 0, 0] }),
      liftarmBetween([0.38, 9, 0.3], [0.38, 15, 6.3], L.rbrown, { holes: [1, 0, 0] }),
      liftarmBetween([0.95, 9.5, 0.6], [0.95, 14.6, 5.6], L.bgreen, { holes: [1, 0, 0] }),
      liftarmBetween([0, 9.6, 1.2], [0, 10.6, 4.4], L.rbrown, { holes: [1, 0, 0] }),
      cyl(0.42, 1.6, [0, 10.6, 4.4], { ...V, axis: 'x', color: L.bgreen }),
      axle(3.2, [0, 10.6, 4.4], L.red, 'x'),
      axle(4, [0, 15.2, 6.7], L.red, 'x'),
      cyl(0.4, 1.4, [-1.2, 15.2, 6.7], { ...V, axis: 'x', color: L.red }),
      ball(0.62, [2.0, 15.2, 6.7], { ...V, color: L.red }),
      ball(0.62, [-2.0, 15.2, 6.7], { ...V, color: L.red }),
      tube([[0, 15.3, 6.0], [0, 16.5, 5.5], [0, 17.6, 4.4], [0, 18.3, 3.2]], 0.42, { ...V, color: L.rbrown }),
      cone(0.42, 1.1, [0, 18.6, 2.5], { ...V, color: L.rbrown, rot: [-70, 0, 0] }),
    ],
  };
}

// =============================================================================================
// M06 Leafcutter Frenzy + M07 Humongous Fungus (bags 8-10): tan / white rock strata nest with an
// arched door, tray of leaf fragments, white gear rack with a red ant, tan gear; white Technic
// fungus tower with a red crank.
// =============================================================================================
export function m06Nest() {
  const strata = [L.tan, L.white, L.tan, L.dtan, L.tan];
  return [
    el(28, 9, 1, [2, 0, -0.6], L.white, { tile: true }),
    el(28, 9, 1, [2, PLATE, -0.6], L.tan),
    el(11, 7, 15, [-4, 0.64, -0.8], L.tan, { tile: true }),
    el(11, 7, 1, [-4, 5.44, -0.8], L.white, { tile: true }),
    ...wallX(-8.4, 0.4, 2.6, 0.64, 5, strata, (cx, y, n) => Math.abs(cx + 4) < 1.2 + n * 0.4 && y < 3.5),
    ...wallZ(-3.6, 2.0, -8.9, 0.64, 5, strata),
    slope(11, 1, 2, [-4, 5.44, 2.6], L.white, { curved: true }),
    box(2.4, 2.8, 0.2, [-4, 2.04, 2.3], { ...V, color: '#2b1d12' }),
    tube([[-5.3, 0.7, 3.05], [-5.2, 2.6, 3.05], [-4, 3.5, 3.05], [-2.8, 2.6, 3.05], [-2.7, 0.7, 3.05]], 0.28, { ...V, color: L.white }),
    tile(2, 1, [-7.2, 3.52, 3.0], L.bgreen), tile(2, 1, [-0.8, 2.56, 3.0], L.bgreen), tile(1, 1, [-6.0, 1.6, 3.0], L.green),
    leaf(1.8, [-0.2, 0.9, 3.2], L.bgreen, [0, -30, 15]),
  ];
}
export function m06Tray(TY) {
  return [el(11, 4, 2, [-4, TY - 0.3, -0.6], L.dtan)];
}
export function m06Frag(x, TY, color) {
  return [
    liftarm(7, [x, TY + 2.6, -0.6], L.green, 'y', 'x', { thin: true }),
    leaf(2.8, [x, TY + 3.9, -0.6], color, [0, 90, 90], { width: 0.7 }),
  ];
}
export function m06Ant(RZ0) {
  const z = RZ0 + 6.75;
  const s = [
    el(2, 8, 4, [-4, 0.76, RZ0 + 3.1], L.white, { tile: true }),
    panel(4, 4, [-4, 2.0, RZ0 + 7.6], L.red, '+z'),
    ball(0.85, [-4, 2.3, z], { ...V, color: L.red }),
    ball(0.6, [-4, 2.2, z - 1.3], { ...V, color: L.red }),
    ball(0.5, [-4, 3.1, z - 0.4], { ...V, color: L.red }),
    ball(0.12, [-3.75, 3.3, z], { ...V, color: L.black }),
    ball(0.12, [-4.25, 3.3, z], { ...V, color: L.black }),
    rod([-3.8, 3.4, z - 0.4], [-3.4, 4.2, z + 0.3], 0.05, { ...V, color: L.black }),
    rod([-4.2, 3.4, z - 0.4], [-4.6, 4.2, z + 0.3], 0.05, { ...V, color: L.black }),
  ];
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const p0 = [-4 + sx * 0.5, 2.3, z - 0.8 + k * 0.6];
    const knee = [-4 + sx * 1.3, 2.9, z - 1.0 + k * 0.8];
    const foot = [-4 + sx * 1.8, 1.4, z - 1.2 + k * 1.0];
    s.push(rod(p0, knee, 0.09, { ...V, color: L.dbgray }), rod(knee, foot, 0.08, { ...V, color: L.dbgray }));
  }
  return s;
}
export function m06Gear() {
  return [
    cyl(1.5, 0.6, [0.85, 2.6, 1.2], { ...V, axis: 'x', color: L.tan, gearTeeth: 24 }),
    cyl(0.5, 0.7, [0.85, 2.6, 1.2], { ...V, axis: 'x', color: L.dbgray }),
  ];
}
export function m07Pedestal() {
  return [
    el(5, 4, 2, [8, 0.64, -2.6], L.lbgray),
    liftarm(11, [7.2, 5.3, -2.6], L.white, 'y', 'z'),
    liftarm(11, [8.8, 5.3, -2.6], L.white, 'y', 'z'),
    liftarm(3, [8, 9.4, -2.6], L.lbgray, 'x', 'z'),
    liftarm(3, [8, 4.0, -2.6], L.lbgray, 'x', 'z'),
  ];
}
export function m07Mycelium() {
  return [
    liftarm(17, [6.6, 16.3, -2.6], L.white, 'y', 'z'),
    liftarm(17, [9.4, 16.3, -2.6], L.white, 'y', 'z'),
    liftarm(5, [8, 15, -2.6], L.white, 'x', 'z'),
    liftarm(5, [8, 22.4, -2.6], L.white, 'x', 'z'),
    liftarmBetween([6.6, 18, -2.6], [4.2, 21.5, -2.6], L.white),
    liftarmBetween([9.4, 19, -2.6], [11.8, 22, -2.6], L.white),
    round(1.2, 1, [4.2, 21.6, -2.6], L.white), round(0.8, 2, [11.8, 22.1, -2.6], L.white),
    round(0.5, 3, [6.6, 22.8, -2.6], L.red),
    round(0.5, 1, [9.4, 23.0, -2.6], L.red),
    liftarm(7, [8, 10.6, 0.4], L.red, 'z', 'x'),
    axle(4, [8, 10.6, 3.4], L.red, 'x'),
    ball(0.6, [6.0, 10.6, 3.4], { ...V, color: L.red }),
    ball(0.6, [10.0, 10.6, 3.4], { ...V, color: L.red }),
  ];
}

// =============================================================================================
// M08 Tangled + M09 Research Platform (bags 11-15): brown Technic tree trunk with lime rings and
// red pins, brown branches, lime / green leaf-plate canopy, tan platform with lattice railings
// and minifigures, red paddles, camera trap.
// =============================================================================================
export function m09Tree() {
  const s = [
    el(15, 10, 1, [0, 0, -0.6], L.green),
    el(15, 10, 1, [0, PLATE, -0.6], L.bgreen, { tile: true }),
    cyl(2.2, 26, [0, 13.8, -1.6], { ...V, color: L.dbrown }),
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const x = Math.sin(a) * 2.15;
    const z = -1.6 + Math.cos(a) * 2.15;
    const deg = (a * 180) / Math.PI;
    s.push(liftarm(17, [x, 7.6, z], L.rbrown, 'y', 'z', { rot: [0, deg, 0] }));
    s.push(liftarm(17, [x, 21.1, z], k % 2 ? L.rbrown : L.dbrown, 'y', 'z', { rot: [0, deg, 0] }));
  }
  for (const y of [6.2, 13.9, 19.5]) s.push(cyl(2.45, 0.6, [0, y, -1.6], { ...V, color: L.bgreen }));
  for (const [x, y] of [[-0.4, 3.0], [0.4, 4.6], [-0.4, 9.4], [0.4, 11.0], [-0.4, 16.6], [0.4, 22.0]]) s.push(cyl(0.22, 0.2, [x, y, 0.95], { ...V, axis: 'z', color: L.red }));
  for (const dz of [-0.4, 0.4]) {
    s.push(liftarmBetween([0, 22, -1.6 + dz], [-9, 27, -1.6 + dz], L.rbrown));
    s.push(liftarmBetween([0, 23, -1.6 + dz], [9, 28, -1.6 + dz], L.rbrown));
  }
  s.push(
    ...canopy([0, 30, -1.6], 4.5, [L.green, L.lime, L.bgreen], 1),
    ...canopy([-8, 28.5, -1], 3.6, [L.lime, L.green], 2),
    ...canopy([8.5, 29, -1.8], 3.6, [L.bgreen, L.green, L.lime], 3),
    ...canopy([-3, 33, -2.4], 3, [L.lime, L.green], 4),
    ...canopy([4, 32.5, -0.5], 2.8, [L.green, L.lime], 5),
    ...flower(0.55, [-6, 26.6, 1.4], L.red, L.yellow), ...flower(0.55, [6, 27.1, 1.2], L.red, L.orange),
    tube([[-2.4, 1.2, 0.2], [-3.6, 3.5, 0.5], [-2.9, 6.5, 0.6], [-3.8, 9.5, 0.2], [-3.0, 12.5, 0.4], [-3.4, 15, 0]], 0.45, { ...V, color: '#c9b48a' }),
    ...[2.4, 7.8, 13.2].map((y) => cyl(0.55, 0.9, [-3.3, y, 0.45], { ...V, color: L.bgreen })),
    el(3, 3, 1, [5.2, 9.1, 3.0], L.dbgray, { tile: true }),
    liftarm(3, [3.6, 9.0, 1.4], L.lbgray, 'x', 'z'),
    liftarmBetween([-2.9, 8.0, 0.9], [-2.9, 8.0, 10.6], L.lbgray, { holes: [1, 0, 0] }),
    liftarmBetween([2.6, 8.0, 0.9], [6.2, 8.0, 10.6], L.lbgray, { holes: [1, 0, 0] }),
  );
  return s;
}
export function m09Platform(PX) {
  const y = 9.46;
  return [
    el(14, 11, 3, [PX, 8.5, 5.3], L.tan),
    ...fence(PX - 5.4, PX + 5.4, 9.5, y, L.tan, 'x', 1.0),
    ...fence(1.2, 9.4, PX - 5.3, y, L.tan, 'z', 1.0),
    ...fence(1.2, 9.4, PX + 5.3, y, L.tan, 'z', 1.0),
    ...fig([PX - 2.5, y, 6], L.olive, L.dtan, L.rbrown),
    ...fig([PX + 1.5, y, 4.5], L.red, L.dbgray, L.black, { yaw: 30 }),
    ...fig([PX - 0.5, y, 7.6], L.green, L.rbrown, L.dtan, { yaw: -20 }),
    el(2, 1, 3, [PX + 3.5, y, 7.2], L.rbrown), tile(2, 1, [PX + 3.5, y + BRICK, 7.2], L.dtan),
    ...flower(0.45, [PX + 3.0, y, 3.0], L.lazure, L.lazure, { n: 4 }),
    liftarm(4, [PX + 4.6, 8, 1.4], L.lbgray, 'y', 'z'),
  ];
}
export function m09Lever(LP) {
  return [panel(5, 7, [LP[0], 4.85, LP[2]], L.red, '+z'), axle(4.6, LP, L.dbgray, 'x'), liftarm(3, [LP[0], 7.4, LP[2] + 0.4], L.red, 'y', 'z')];
}
export function m09Camera(CP) {
  const [x, , z] = CP;
  return [
    panel(4, 7, [x, 4.85, z], L.red, '+z'),
    el(2, 2, 4, [x, 2.76, z - 0.9], L.dbgray, { tile: true }),
    cyl(0.42, 0.2, [x, 3.4, z - 1.8], { ...V, axis: 'z', color: L.black }),
    cyl(0.26, 0.22, [x, 3.4, z - 1.86], { ...V, axis: 'z', color: '#4a6f8a', glass: true }),
    axle(3.4, CP, L.lbgray, 'x'),
  ];
}

// =============================================================================================
// M10 Fragile Microhabitats (bag 16): white Technic web frame with a brown roof and a spider;
// lime arm with a yellow pulley shell (snail) on a grey roller base.
// =============================================================================================
export function m10Snail() {
  return {
    base: [
      el(4, 4, 1, [0, 0, 0], L.dbgray),
      liftarm(5, [-1.1, 0.68, 0], L.dbgray, 'z', 'x'),
      liftarm(5, [1.1, 0.68, 0], L.dbgray, 'z', 'x'),
      cyl(0.55, 1.6, [0, 0.9, -0.8], { ...V, axis: 'x', color: L.lbgray }),
      el(2, 2, 2, [0, 1.0, 0.8], L.lbgray),
    ],
    arm: [
      liftarmBetween([0.45, 1.6, 0.8], [0.45, 9.5, -4.0], L.lime, { holes: [1, 0, 0] }),
      liftarmBetween([-0.45, 2.4, 0.5], [-0.45, 6.5, -1.9], L.rbrown, { holes: [1, 0, 0] }),
      cyl(1.5, 0.5, [0.4, 10.7, -4.6], { ...V, axis: 'x', color: L.yellow }),
      cyl(1.5, 0.5, [-0.4, 10.7, -4.6], { ...V, axis: 'x', color: L.yellow }),
      cyl(0.75, 1.4, [0, 10.7, -4.6], { ...V, axis: 'x', color: L.yellow }),
      cyl(0.32, 1.6, [0, 10.7, -4.6], { ...V, axis: 'x', color: L.orange }),
      box(1.1, 1.1, 2.6, [0, 9.4, -3.0], { ...V, color: L.orange, rot: [60, 0, 0], round: true }),
      rod([0.3, 10, -1.9], [0.5, 11.4, -1.4], 0.08, { ...V, color: L.orange }),
      rod([-0.3, 10, -1.9], [-0.5, 11.4, -1.4], 0.08, { ...V, color: L.orange }),
      ball(0.16, [0.5, 11.45, -1.4], { ...V, color: L.tan }),
      ball(0.16, [-0.5, 11.45, -1.4], { ...V, color: L.tan }),
    ],
  };
}
export function m10Spider() {
  const s = [
    liftarm(10, [2.8, 4.65, 0], L.white, 'y', 'z'),
    liftarm(10, [-2.8, 4.65, 0], L.white, 'y', 'z'),
    liftarm(10, [0, 8.4, 0], L.rbrown, 'x', 'z'),
    liftarmBetween([-3.6, 8.3, 0], [0.2, 10.3, 0], L.rbrown),
    liftarmBetween([3.6, 8.3, 0], [-0.2, 10.3, 0], L.rbrown),
    liftarm(6, [0, 3.2, 0], L.white, 'x', 'z'),
    liftarm(6, [0, 5.8, 0], L.white, 'x', 'z'),
    liftarm(8, [0, 4.6, 0], L.white, 'y', 'z'),
    ball(0.5, [0, 4.5, 0.55], { ...V, color: L.dbgray }),
    ball(0.32, [0, 5.15, 0.6], { ...V, color: L.dbgray }),
  ];
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const p0 = [sx * 0.3, 4.75 - k * 0.15, 0.6];
    const knee = [sx * 1.0, 5.2 - k * 0.35, 0.75];
    const foot = [sx * 1.7, 4.8 - k * 0.6, 0.6];
    s.push(rod(p0, knee, 0.07, { ...V, color: L.dbgray }), rod(knee, foot, 0.06, { ...V, color: L.dbgray }));
  }
  return {
    base: [
      liftarm(4, [3, 0.4, 0], L.bgreen, 'z', 'x'),
      liftarm(4, [-3, 0.4, 0], L.bgreen, 'z', 'x'),
      liftarm(9, [0, 0.36, 0], L.lbgray, 'x', 'z'),
    ],
    arm: s,
  };
}

// =============================================================================================
// M12 Forest Elder (bag 18): green round base, tan round-brick trunk forking into two branches
// with leafy canopies, orange butterfly; red ring tie with grey plates; tan cane; grey post.
// =============================================================================================
export function m12Detail({ CP, caneEnd, RC, PP }) {
  const tree = [];
  for (let i = 0; i < 15; i++) tree.push(cyl(1.25, 0.94, [0, 0.8 + i * BRICK + 0.47, -1.5], { ...V, color: i % 2 ? '#d9c08f' : L.tan }));
  tree.push(
    tube([[0, 14.0, -1.5], [-0.8, 16.5, -1.4], [-2.4, 19, -1.2], [-4, 21, -1.0]], 1.0, { ...V, color: L.tan }),
    tube([[-0.6, 17, -1.3], [1.2, 19.5, -1.3], [3, 23, -1.3]], 0.7, { ...V, color: L.tan }),
    liftarm(9, [0, 5, -3.0], L.rbrown, 'y', 'x'),
    ...canopy([-4.6, 22.8, -1], 3.2, [L.green, L.bgreen], 6),
    ...canopy([3.3, 24, -1.3], 2.6, [L.bgreen, L.green], 7),
    ...flower(0.5, [-4.2, 25.6, -1], L.orange, L.orange, { n: 4 }),
    box(2.4, 0.5, 2.8, [0, 12.2, -1.5], { ...V, color: L.sandgreen, round: true }),
    liftarm(4, [2.8, 7.5, -1.5], L.dbgray, 'x', 'z'),
    liftarm(2, [4.1, 8.0, -1.5], L.dbgray, 'y', 'z'),
  );
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    tree.push(torus(0.2, 0.05, [1.3 + 0.9 * t, 7.3 - 3.9 * t, -1.5], { ...V, color: L.lbgray, rot: i % 2 ? [0, 0, 90] : [90, 0, 0] }));
  }
  const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const cane = [
    rod(lerp(CP, caneEnd, 0.06), lerp(CP, caneEnd, 0.94), 0.42, { ...V, color: L.tan }),
    cyl(0.42, 1.2, CP, { ...V, axis: 'x', color: L.red }),
    ball(0.6, caneEnd, { ...V, color: L.red }),
    ...[0.3, 0.55, 0.8].map((t) => torus(0.45, 0.08, lerp(CP, caneEnd, t), { ...V, color: L.dtan, rot: [55, 0, 0] })),
    tube([lerp(CP, caneEnd, 0.1), [0.6, 2.0, 3.0], lerp(CP, caneEnd, 0.35)], 0.15, { ...V, color: L.rbrown }),
  ];
  const tie = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    tie.push(cyl(0.22, 0.16, [RC[0] + 0.47, RC[1] + 2.6 * Math.cos(a), RC[2] + 2.6 * Math.sin(a)], { ...V, axis: 'x', color: L.red }));
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) tie.push(box(0.2, 0.7, 1.4, [RC[0] + 0.5, RC[1] + 2.6 * Math.cos(a), RC[2] + 2.6 * Math.sin(a)], { ...V, color: L.dbgray, rot: [(-a * 180) / Math.PI, 0, 0] }));
  return {
    base: [
      round(4, 1, [0, 0, -0.5], L.green),
      round(3, 1, [0, PLATE, -0.5], L.bgreen),
      el(2, 2, 1, [1.2, 0.8, 2.0], L.dbgray),
      ...bush([-2.0, 0.64, 0.6], L.bgreen, 5, 1.2, 25, 1),
      ...bush([2.0, 0.64, -2.2], L.green, 4, 1.0, 25, 2),
    ],
    tree,
    cane,
    tie,
    post: [
      el(4, 4, 2, [PP[0], 0, PP[2]], L.dbgray),
      liftarm(6, [PP[0] - 0.4, 2.85, PP[2]], L.lbgray, 'y', 'x'),
      liftarm(6, [PP[0] + 0.4, 2.85, PP[2]], L.lbgray, 'y', 'x'),
      el(3, 2, 2, [PP[0], 5.1, PP[2]], L.red),
    ],
  };
}

// =============================================================================================
// Docks M13 (farm, bags 19-20) and M14 (mine, bag 21): dark grey Technic cage, green / brown
// rails; farm trees = brown liftarms with lime round crowns and red flowers; mine floor with
// brown rails and ore.
// =============================================================================================
function dockCage(w, d, h, top) {
  const s = [];
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) s.push(liftarm(10, [x, 3.96, z], L.dbgray, 'y', 'x'));
  s.push(liftarm(17, [0, h, d / 2], top, 'x', 'z'), liftarm(17, [0, h, -d / 2], top, 'x', 'z'));
  s.push(liftarm(11, [w / 2, h, 0], top, 'z', 'x'), liftarm(11, [-w / 2, h, 0], top, 'z', 'x'));
  s.push(el(1, 2, 3, [w / 2, h + 0.36, d / 2], L.lbgray), tile(1, 2, [w / 2, h + 0.36 + BRICK, d / 2], L.yellow));
  s.push(el(1, 2, 3, [-w / 2, h + 0.36, -d / 2], L.lbgray), tile(1, 2, [-w / 2, h + 0.36 + BRICK, -d / 2], L.yellow));
  return s;
}
export function m13Detail() {
  const tree = (x) => [
    liftarm(8, [x, 8, -1.3], L.rbrown, 'z', 'y'),
    cyl(1.6, 0.32, [x, 8, 2.4], { ...V, axis: 'x', color: L.lime }),
    cyl(1.2, 0.5, [x, 8, 2.4], { ...V, axis: 'x', color: L.bgreen }),
    ...flower(0.75, [x + 0.3, 8, 2.4], L.red, L.yellow, { rot: [0, 0, -90] }),
    ...flower(0.75, [x - 0.3, 8, 2.4], L.red, L.yellow, { rot: [0, 0, 90] }),
  ];
  return {
    frame: [
      ...dockCage(13.2, 8.4, 8.0, L.bgreen),
      liftarm(12, [6.6, 0.6, 0], L.dbgray, 'z', 'x'),
      liftarm(12, [-6.6, 0.6, 0], L.dbgray, 'z', 'x'),
      liftarm(17, [0, 0.6, -4.2], L.dbgray, 'x', 'z'),
      el(13, 8, 3, [0, 0.44, -0.6], L.lbgray),
      box(10, 0.32, 3.5, [0, 0.62, 4.0], { ...V, color: L.dbgray, rot: [23.6, 0, 0], lego: { studs: false } }),
      liftarm(17, [0, 4.4, -4.2], L.green, 'x', 'z'),
      liftarm(11, [6.6, 4.4, 0], L.bgreen, 'z', 'x'),
    ],
    trees: [...tree(3), ...tree(-3)],
    lever: [
      liftarm(5, [4.5, 6.2, 4.9], L.lbgray, 'y', 'x'),
      panel(4, 3, [4.5, 4.0, 4.9], L.red, '+z'),
      axle(1.6, [4.5, 8.0, 4.9], L.lbgray, 'x'),
    ],
  };
}
export function m14Detail() {
  const s = [...dockCage(12.8, 8.8, 8.0, L.rbrown)];
  for (const [i, y] of [0.36, 1.08, 1.8].entries()) {
    const c = i % 2 ? L.green : L.bgreen;
    s.push(liftarm(11, [6.4, y, 0], c, 'z', 'x'), liftarm(11, [-6.4, y, 0], c, 'z', 'x'), liftarm(15, [0, y, -4.4], c, 'x', 'z'));
  }
  s.push(
    liftarm(15, [0, 0.36, 4.4], L.dbgray, 'x', 'z'),
    liftarm(15, [0, 8, 0], L.rbrown, 'x', 'y'),
    el(15, 5, 2, [0, 2.68, -2.2], L.rbrown, { tile: true }),
    axle(12, [0, 3.42, -1.4], L.rbrown, 'x'),
    axle(12, [0, 3.42, -3.0], L.rbrown, 'x'),
    ...[-4.8, -2.4, 0, 2.4, 4.8].map((x) => tile(1, 3, [x, 3.32, -2.2], L.dbrown)),
    ...[-4.5, -1.5, 1.5, 4.5].map((x) => liftarm(3, [x, 6.4, -4.4], L.rbrown, 'y', 'z')),
    ...bush([-5.2, 3.4, -3.2], L.bgreen, 5, 1.2, 25, 3),
    round(0.5, 1, [2.0, 3.32, -2.6], L.yellow), round(0.5, 1, [3.0, 3.32, -1.8], L.orange), round(0.5, 1, [-1.2, 3.32, -2.4], L.yellow),
  );
  return s;
}
