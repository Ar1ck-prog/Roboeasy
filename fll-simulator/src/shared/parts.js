// LEGO Education SPIKE Prime style parts library.
// Units: LU (LEGO unit = 8 mm). Local frame: x right, y up, z back. Robot "forward" is -z.
// Connectors: p (LU, segment centre), a (axis 'x'|'y'|'z'), k:
//   'H' round pin hole, 'X' axle hole            (female)
//   'P' friction pin end, 'A' axle segment        (male)
// Matching male+female at the same point and axis connects two parts:
//   P+H and A+X are rigid, A+H is a free hinge (axle spinning in a round hole).
// sub: which rigid sub-body of the part the connector belongs to ('rotor' for motor output, default body).
// legacy: old grid connectors of parts that now use their real LDraw holes; kept only so robots saved
// before keep their connections, never offered for snapping in the builder.

import { Euler, Quaternion, Vector3 } from 'three';
import { COLORS } from './scene.js';
import { LDRAW_CONNS } from './ldrawConns.js';

export const LU_CM = 0.8;

export const PART_COLORS = {
  'Светло-серый': '#a3a8ac', 'Тёмно-серый': '#5b6064', 'Чёрный': '#2a2a2a', 'Белый': '#f2f2f0', 'Голубой (azure)': '#3fb3d6',
  'Синий': '#1b5cb8', 'Пурпурный': '#a5407e', 'Жёлтый': '#f4cd2f', 'Красный': '#c4281c', 'Зелёный': '#287f46',
  'Лаймовый': '#a6c93a', 'Оранжевый': '#f08a1c', 'Бирюзовый': '#11908f', 'Коричневый': '#5c3a21',
};

const b = (size, at, o = {}) => ({ kind: 'box', size, at, ...o });
const c = (r, h, at, axis, o = {}) => ({ kind: 'cyl', r, h, at, axis, ...o });
const s = (r, at, o = {}) => ({ kind: 'ball', r, at, ...o });

function holesLine(n, axis = 'y', dir = 'x', k = 'H', y = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ p: dir === 'x' ? [i, y, 0] : [0, y, i], a: axis, k });
  return out;
}

// ---------- structural ----------
function beam(n) {
  return {
    id: `beam${n}`, cat: 'beams', name: `Балка ${n}`, desc: `Толстая балка (liftarm) на ${n} отверстий`,
    color: n === 3 ? '#2a2a2a' : n === 5 ? '#3fb3d6' : n === 7 ? '#2a2a2a' : n === 9 ? '#a5407e' : n === 11 ? '#2a2a2a' : n === 13 ? '#3fb3d6' : '#f2f2f0',
    mass: 0.0011 * n, realHoles: true,
    shapes: [b([n, 0.94, 0.94], [(n - 1) / 2, 0, 0], { round: true, beam: { n, axis: 'x', holes: 'y' } })],
    conns: holesLine(n),
  };
}

function lbeam(n, m) {
  const conns = holesLine(n);
  for (let j = 1; j < m; j++) conns.push({ p: [0, 0, j], a: 'y', k: 'H' });
  return {
    id: `lbeam${m}x${n}`, cat: 'beams', name: `Угловая балка ${m}×${n}`, desc: `L-образная балка ${m}×${n}`,
    color: '#2a2a2a', mass: 0.0011 * (n + m - 1), realHoles: true,
    shapes: [
      b([n, 0.94, 0.94], [(n - 1) / 2, 0, 0], { beam: { n, axis: 'x', holes: 'y' } }),
      b([0.94, 0.94, m - 1], [0, 0, m / 2], { visible: false }),
      b([0.94, 0.94, m], [0, 0, (m - 1) / 2], { kind: 'deco', collide: false, beam: { n: m, axis: 'z', holes: 'y' } }),
    ],
    conns,
  };
}

function frame(w, l, color = '#f2f2f0') {
  const conns = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < l; z++) if (x === 0 || x === w - 1 || z === 0 || z === l - 1) conns.push({ p: [x, 0, z], a: 'y', k: 'H' });
  return {
    id: `frame${w}x${l}`, cat: 'beams', name: `Рама ${w}×${l}`, desc: `Открытая рама ${w}×${l}`,
    color, mass: 0.0009 * conns.length, realHoles: true,
    shapes: [
      b([w, 0.94, 0.94], [(w - 1) / 2, 0, 0], { visible: false }), b([w, 0.94, 0.94], [(w - 1) / 2, 0, l - 1], { visible: false }),
      b([0.94, 0.94, l - 2], [0, 0, (l - 1) / 2], { visible: false }), b([0.94, 0.94, l - 2], [w - 1, 0, (l - 1) / 2], { visible: false }),
      b([w, 0.94, l], [(w - 1) / 2, 0, (l - 1) / 2], { kind: 'deco', collide: false, frame: { w, h: l, plane: 'xz' } }),
    ],
    conns,
  };
}

function axle(n) {
  const conns = [];
  for (let i = 0; i < n; i++) conns.push({ p: [i, 0, 0], a: 'x', k: 'A' });
  const color = n % 2 === 0 ? '#2a2a2a' : n === 3 || n === 5 ? '#a3a8ac' : '#c4281c';
  return {
    id: `axle${n}`, cat: 'axles', name: `Ось ${n}`, desc: `Ось длиной ${n}`, color, mass: 0.0006 * n,
    shapes: [b([n - 0.1, 0.46, 0.17], [(n - 1) / 2, 0, 0], { collide: n >= 4, axle: { axis: 'x' } }), b([n - 0.1, 0.17, 0.46], [(n - 1) / 2, 0, 0], { collide: false, visible: false })],
    conns,
  };
}

function gear(teeth, r, color = '#a3a8ac') {
  return {
    id: `gear${teeth}`, cat: 'gears', name: `Шестерня ${teeth}z`, desc: `Зубчатое колесо на ${teeth} зубьев`, color, mass: 0.0002 * teeth,
    gear: { teeth, r },
    shapes: [c(r + 0.12, 0.7, [0, 0, 0], 'x', { gearTeeth: teeth })],
    conns: [{ p: [0, 0, 0], a: 'x', k: 'X' }],
  };
}

function wheel(id, name, rLU, width, tireColor = '#1e1e1e', hubColor = '#f2f2f0') {
  return {
    id, cat: 'wheels', name, desc: `Колесо Ø${Math.round(rLU * 2 * 8)} мм`, color: hubColor, mass: rLU > 4 ? 0.042 : 0.022,
    wheel: { r: rLU },
    shapes: [
      c(rLU, width, [0.5, 0, 0], 'x', { color: tireColor, tag: 'tire', tire: true }),
      c(rLU * 0.66, width + 0.06, [0.5, 0, 0], 'x', { collide: false, hub: true }),
    ],
    conns: [{ p: [0, 0, 0], a: 'x', k: 'X' }, { p: [1, 0, 0], a: 'x', k: 'X' }],
  };
}

// ---------- electronics ----------
function hubPart() {
  const conns = [];
  for (let z = -4; z <= 4; z++) for (const y of [-1, 1]) { conns.push({ p: [-3, y, z], a: 'x', k: 'H' }); conns.push({ p: [3, y, z], a: 'x', k: 'H' }); }
  for (let x = -2; x <= 2; x++) for (const y of [-1, 1]) { conns.push({ p: [x, y, -5], a: 'z', k: 'H' }); conns.push({ p: [x, y, 5], a: 'z', k: 'H' }); }
  for (const x of [-2, 2]) for (let z = -4; z <= 4; z++) conns.push({ p: [x, -1.5, z], a: 'y', k: 'H' });
  return {
    id: 'hub', cat: 'electronics', name: 'Хаб SPIKE Prime', desc: 'Большой хаб: 6 портов A–F, гироскоп/акселерометр, матрица 5×5',
    color: '#f2f2f0', mass: 0.205, electronic: 'hub',
    shapes: [
      b([7, 4, 11], [0, 0, 0], { round: true }),
      b([6.4, 0.6, 10.4], [0, 1.75, 0], { color: '#f4cd2f', collide: false }),
      b([4.2, 0.12, 4.2], [0, 2.06, -1.2], { color: '#1e1e1e', collide: false, matrix: true }),
      c(0.55, 0.16, [0, 2.06, 2.6], 'y', { color: '#3fb3d6', collide: false }),
      c(0.35, 0.16, [-1.5, 2.06, 2.6], 'y', { color: '#5b6064', collide: false }),
      c(0.35, 0.16, [1.5, 2.06, 2.6], 'y', { color: '#5b6064', collide: false }),
    ],
    conns,
  };
}

function motorPart(id, name, len, discR, specs) {
  const half = (len - 1) / 2;
  const conns = [
    { p: [2, 0, 0], a: 'x', k: 'X', sub: 'rotor' },
    { p: [2, 1, 0], a: 'x', k: 'H', sub: 'rotor' }, { p: [2, -1, 0], a: 'x', k: 'H', sub: 'rotor' },
    { p: [2, 0, 1], a: 'x', k: 'H', sub: 'rotor' }, { p: [2, 0, -1], a: 'x', k: 'H', sub: 'rotor' },
  ];
  for (let z = -half; z <= half; z += 2) for (const y of [-1, 1]) conns.push({ p: [-1, y, z], a: 'x', k: 'H' });
  for (const x of [-1, 0, 1]) for (const y of [-1, 1]) { conns.push({ p: [x, y, -half], a: 'z', k: 'H' }); conns.push({ p: [x, y, half], a: 'z', k: 'H' }); }
  for (const x of [-1, 1]) for (const z of [-half, half]) { conns.push({ p: [x, 1.5, z], a: 'y', k: 'H' }); conns.push({ p: [x, -1.5, z], a: 'y', k: 'H' }); }
  return {
    id, cat: 'electronics', name, desc: `${name}: ${specs.rpm} об/мин, ${specs.torque} Н·см`, color: '#f2f2f0', mass: specs.mass,
    electronic: 'motor', motor: specs,
    shapes: [
      b([3, 4, len], [0, 0, 0], { round: true }),
      b([0.1, 3.2, len - 1], [-1.52, 0, 0], { color: '#5b6064', collide: false }),
      c(discR, 1, [2, 0, 0], 'x', { color: '#11908f', sub: 'rotor' }),
      c(discR * 0.35, 1.02, [2, 0, 0], 'x', { color: '#2a2a2a', sub: 'rotor', collide: false }),
    ],
    conns,
  };
}

function colorSensor() {
  const conns = [];
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) conns.push({ p: [x, 0.5, z], a: 'z', k: 'H' });
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) conns.push({ p: [x, 0.5, z], a: 'x', k: 'H' });
  return {
    id: 'colorSensor', cat: 'electronics', name: 'Датчик цвета', desc: 'Цвет, отражённый и окружающий свет. Смотрит вниз (-Y).',
    color: '#f2f2f0', mass: 0.017, electronic: 'color', sensor: { origin: [0, -1.5, 0], dir: [0, -1, 0] },
    shapes: [b([2, 3, 2], [0, 0, 0], { round: true }), c(0.55, 0.08, [0, -1.52, 0], 'y', { color: '#1e1e1e', collide: false }), c(0.25, 0.1, [0, -1.54, 0], 'y', { color: '#ffffff', collide: false, lamp: true })],
    conns,
  };
}

function distanceSensor() {
  const conns = [];
  for (const x of [-2.5, 2.5]) for (const y of [-1, 0, 1]) for (const z of [-0.5, 0.5]) conns.push({ p: [x, y, z], a: 'z', k: 'H' });
  return {
    id: 'distanceSensor', cat: 'electronics', name: 'Датчик расстояния', desc: 'Ультразвуковой дальномер 4–200 см. Смотрит вперёд (-Z).',
    color: '#f2f2f0', mass: 0.025, electronic: 'distance', sensor: { origin: [0, 0, -1], dir: [0, 0, -1] },
    shapes: [b([6, 3, 2], [0, 0, 0], { round: true }), c(1.05, 0.2, [-1.4, 0, -1.02], 'z', { color: '#1e1e1e', collide: false }), c(1.05, 0.2, [1.4, 0, -1.02], 'z', { color: '#1e1e1e', collide: false })],
    conns,
  };
}

function forceSensor() {
  const conns = [];
  for (const x of [-0.5, 0.5]) for (const z of [0, 1]) conns.push({ p: [x, 0, z], a: 'x', k: 'H' });
  return {
    id: 'forceSensor', cat: 'electronics', name: 'Датчик силы (касания)', desc: 'Кнопка 0–10 Н. Кнопка спереди (-Z).',
    color: '#f2f2f0', mass: 0.015, electronic: 'force', sensor: { origin: [0, 0, -1.9], dir: [0, 0, -1] },
    shapes: [b([2, 2, 3], [0, 0, 0.5], { round: true }), c(0.65, 0.7, [0, 0, -1.35], 'z', { color: '#1e1e1e', sub: 'button', tag: 'button' })],
    conns,
  };
}

// ---------- pins & connectors ----------
const pinShapes = (k0, k1, col0, col1) => [
  c(0.29, 0.92, [0, 0, 0], 'x', { color: col0, collide: false }),
  c(k1 === 'A' ? 0.22 : 0.29, 0.92, [1, 0, 0], 'x', { color: col1, collide: false }),
  c(0.36, 0.14, [0.5, 0, 0], 'x', { color: col0, collide: false }),
];

const PARTS_LIST = [
  hubPart(),
  motorPart('motorL', 'Большой мотор', 7, 1.75, { rpm: 175, torque: 25, maxSpeed: 1050, stall: 2500, mass: 0.08 }),
  motorPart('motorM', 'Средний мотор', 5, 1.4, { rpm: 185, torque: 18, maxSpeed: 1110, stall: 1800, mass: 0.055 }),
  colorSensor(),
  distanceSensor(),
  forceSensor(),
  beam(3), beam(5), beam(7), beam(9), beam(11), beam(13), beam(15),
  lbeam(5, 3), lbeam(4, 2),
  frame(5, 7, '#f2f2f0'), frame(7, 11, '#3fb3d6'), frame(11, 15, '#2a2a2a'),
  axle(2), axle(3), axle(4), axle(5), axle(6), axle(7), axle(8), axle(10), axle(12),
  {
    id: 'pin', cat: 'pins', name: 'Штифт с трением', desc: 'Чёрный штифт 2L: соединяет два отверстия', color: '#2a2a2a', mass: 0.0005,
    shapes: pinShapes('P', 'P', '#2a2a2a', '#2a2a2a'), conns: [{ p: [0, 0, 0], a: 'x', k: 'P' }, { p: [1, 0, 0], a: 'x', k: 'P' }],
  },
  {
    id: 'pin3', cat: 'pins', name: 'Штифт 3L', desc: 'Синий штифт 3L: соединяет три слоя', color: '#1b5cb8', mass: 0.0007,
    shapes: [c(0.29, 2.9, [1, 0, 0], 'x', { collide: false }), c(0.36, 0.14, [0.5, 0, 0], 'x', { collide: false })],
    conns: [{ p: [0, 0, 0], a: 'x', k: 'P' }, { p: [1, 0, 0], a: 'x', k: 'P' }, { p: [2, 0, 0], a: 'x', k: 'P' }],
  },
  {
    id: 'pinAxle', cat: 'pins', name: 'Штифт-ось', desc: 'Синий: с одной стороны штифт, с другой ось', color: '#1b5cb8', mass: 0.0005,
    shapes: pinShapes('P', 'A', '#1b5cb8', '#1b5cb8'), conns: [{ p: [0, 0, 0], a: 'x', k: 'P' }, { p: [1, 0, 0], a: 'x', k: 'A' }],
  },
  {
    id: 'axleConn', cat: 'pins', name: 'Соединитель осей', desc: 'Соединяет две оси в линию', color: '#2a2a2a', mass: 0.0008,
    shapes: [c(0.42, 1.9, [0.5, 0, 0], 'x', { collide: false })], conns: [{ p: [0, 0, 0], a: 'x', k: 'X' }, { p: [1, 0, 0], a: 'x', k: 'X' }],
  },
  {
    id: 'perpConn', cat: 'pins', name: 'Перпендикулярный соединитель', desc: 'Два отверстия под 90°: поворачивает конструкцию', color: '#a3a8ac', mass: 0.001,
    shapes: [b([0.94, 0.94, 1.9], [0, 0, 0.5])], conns: [{ p: [0, 0, 0], a: 'y', k: 'H' }, { p: [0, 0, 1], a: 'x', k: 'H' }],
  },
  {
    id: 'bush', cat: 'pins', name: 'Втулка', desc: 'Фиксирует ось (½ модуля)', color: '#f4cd2f', mass: 0.0003,
    shapes: [c(0.4, 0.45, [0, 0, 0], 'x', { collide: false })], conns: [{ p: [0, 0, 0], a: 'x', k: 'X' }],
  },
  wheel('wheel56', 'Колесо 56 мм', 3.5, 1.75),
  wheel('wheel88', 'Колесо 88 мм', 5.5, 2.0),
  // 32020c01: hub 43.2 x 18 with black tyre 62.4 x 20 (Cooper 2.0 and many FLL drive bases)
  wheel('wheel62', 'Колесо 62,4 мм (чёрная шина)', 3.9, 2.5),
  {
    id: 'caster', cat: 'wheels', name: 'Шаровая опора', desc: 'Скользящая опора с шаром (почти без трения)', color: '#5b6064', mass: 0.016, realHoles: true,
    shapes: [b([5, 1, 1], [0, 0, 0], { beam: { n: 5, axis: 'x', holes: 'y' } }), s(0.75, [0, -0.25, 0], { color: '#d9dde0', tag: 'caster', caster: true })],
    conns: [-2, -1, 1, 2].map((x) => ({ p: [x, 0, 0], a: 'y', k: 'H' })),
  },
  gear(12, 0.75), gear(20, 1.25), gear(36, 2.25, '#5b6064'), gear(24, 1.5, '#5b6064'), gear(8, 0.5),
  {
    id: 'hook', cat: 'beams', name: 'Балка-крюк', desc: 'Балка 3 с крюком вниз (-Y): цеплять петли миссий', color: '#c4281c', mass: 0.004,
    shapes: [b([4, 0.94, 0.94], [1.5, 0, 0]), b([0.8, 2.6, 0.8], [3.6, -1.3, 0]), b([1.4, 0.7, 0.8], [3.2, -2.45, 0])],
    conns: holesLine(3, 'z'),
  },
  {
    id: 'pusher', cat: 'beams', name: 'Толкатель 5×3', desc: 'Балка 5 с широкой пластиной-бампером вниз (-Y)', color: '#f4cd2f', mass: 0.006,
    shapes: [b([5, 0.94, 0.94], [2, 0, 0]), b([5, 2.4, 0.5], [2, -1.6, 0])],
    conns: holesLine(5, 'z'),
  },
];

// Real part meshes (LDraw, src/render/ldraw.js): model per sub-body plus the rotation (deg, XYZ)
// and offset (LU) that put the LDraw part on this definition's colliders and connectors.
// Motors are aligned on the output axis (the real bodies are longer than the collider boxes).
const LDRAW = {
  hub: { parts: [{ model: 'hub' }], off: [0, -2, 0] },
  motorL: { parts: [{ model: 'motorL' }, { model: 'motorLRotor', sub: 'rotor' }], rot: [0, 0, -90] },
  motorM: { parts: [{ model: 'motorM' }, { model: 'motorMRotor', sub: 'rotor' }], rot: [0, 0, -90] },
  colorSensor: { parts: [{ model: 'colorSensor' }], rot: [90, 0, 0], off: [0, 0.95, 0] },
  distanceSensor: { parts: [{ model: 'distanceSensor' }], rot: [0, 180, 0], off: [0, 0, 2.45] },
  forceSensor: { parts: [{ model: 'forceSensor' }], rot: [0, 180, 0], off: [0, 0, 1.8] },
  wheel56: { parts: [{ model: 'wheel56' }], rot: [0, 90, 0], off: [0.5, 0, 0] },
  wheel88: { parts: [{ model: 'wheel88' }], rot: [0, 90, 0], off: [0.5, 0, 0] },
  frame7x11: { parts: [{ model: 'frame7x11' }], off: [3, 0, 5] },
  frame11x15: { parts: [{ model: 'frame11x15' }], off: [5, 0, 7] },
};
/** Connectors from the real Technic holes of the LDraw part (scripts/pack-ldraw.mjs), in this part's frame. */
function realHoles(def) {
  const r = (def.ldraw.rot || [0, 0, 0]).map((d) => (d * Math.PI) / 180);
  const q = new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], 'XYZ'));
  const off = new Vector3(...(def.ldraw.off || [0, 0, 0]));
  const unit = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
  const out = [];
  for (const lp of def.ldraw.parts) {
    for (const [x, y, z, a, k] of LDRAW_CONNS[lp.model] || []) {
      const v = new Vector3(x, y, z).applyQuaternion(q).add(off);
      const d = unit[a].clone().applyQuaternion(q);
      const ad = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)];
      const c = { p: [v.x, v.y, v.z].map((n) => Math.round(n * 2) / 2), a: 'xyz'[ad.indexOf(Math.max(...ad))], k };
      if (lp.sub) c.sub = lp.sub;
      out.push(c);
    }
  }
  return out;
}

for (const p of PARTS_LIST) {
  if (!LDRAW[p.id]) continue;
  p.ldraw = LDRAW[p.id];
  // electronics: snap only to the real holes (the old grid was a guess and pins ended up on flat plastic)
  if (p.cat === 'electronics') p.conns = [...realHoles(p), ...p.conns.map((c) => ({ ...c, legacy: true }))];
}

export const PARTS = Object.fromEntries(PARTS_LIST.map((p) => [p.id, p]));

export const CATEGORIES = [
  { id: 'electronics', name: 'Электроника' },
  { id: 'beams', name: 'Балки и рамы' },
  { id: 'axles', name: 'Оси' },
  { id: 'pins', name: 'Штифты и соединители' },
  { id: 'wheels', name: 'Колёса и опоры' },
  { id: 'gears', name: 'Шестерни' },
];

export const MALE = { P: true, A: true };
export const FEMALE = { H: true, X: true };

/** Connection type between a male and female connector kind. */
export function linkKind(male, female) {
  if (male === 'P' && female === 'H') return 'rigid';
  if (male === 'A' && female === 'X') return 'rigid';
  if (male === 'A' && female === 'H') return 'hinge';
  return null; // pin in an axle hole does not fit
}

export const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'];
