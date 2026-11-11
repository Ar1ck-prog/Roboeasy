// BIOGLOW mission models: geometry, mechanisms and scoring observations.
// Each mission builder adds bodies/joints to the scene description and returns a runtime object:
//   { id, behavior(ctx)?, observe(ctx) -> partial scoresheet answers }
// `ctx` is provided by the physics worker (see src/sim/worker.js -> MissionContext).
// Model-local frame: x right, y up, z towards the model "front" (where the robot usually comes from).

import {
  COLORS as C, GROUP, SceneDesc, box, cyl, ball, capsule, cone, foliage, tube, torus, rod, bar, minifig,
  rotateShapes, translateShapes,
} from './scene.js';
import { Quaternion, Vector3 } from 'three';
import {
  MAT_D, TABLE_W, WALL_T, WALL_H, HALF_D, HALF_W, STRIP_W, px, DOCKS, SURVEY_AREA, LEAF_HABITAT, rectTouchesPolygon,
} from './field.js';
import { hidden } from './lego.js';
import * as DT from './details.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Stiffness values for scripted mechanism motors (Rapier acceleration-based motor model).
// Note: Rapier scales these by the effective mass about the body's centre of mass, which is small
// for long levers, so "holding" motors need large values.
const LATCH = { stiffness: 1e5, damping: 600, maxForce: 1e9 };
const HOLD = LATCH;
const SPRING = { stiffness: 300, damping: 20, maxForce: 2e5 };

// ---------------------------------------------------------------------------------------------
// Table, walls, mat
// ---------------------------------------------------------------------------------------------
function buildTable(scene) {
  const m = scene.model('field', [0, 0], 0);
  const W = TABLE_W;
  const shapes = [
    // table top under mat and storage strips (collider = "mat")
    box(W, 2, MAT_D, [0, -1, 0], { color: '#2b2d31', visible: false, tag: 'mat', friction: 0.95 }),
    // storage strips (dark table surface, visual)
    box(STRIP_W, 0.05, MAT_D, [-HALF_W - STRIP_W / 2, -0.02, 0], { color: '#3a3d42', collide: false }),
    box(STRIP_W, 0.05, MAT_D, [HALF_W + STRIP_W / 2, -0.02, 0], { color: '#3a3d42', collide: false }),
    // walls
    box(W + 2 * WALL_T, WALL_H, WALL_T, [0, WALL_H / 2, HALF_D + WALL_T / 2], { color: '#16171a', tag: 'wall' }),
    box(W + 2 * WALL_T, WALL_H, WALL_T, [0, WALL_H / 2, -HALF_D - WALL_T / 2], { color: '#16171a', tag: 'wall' }),
    box(WALL_T, WALL_H, MAT_D, [-W / 2 - WALL_T / 2, WALL_H / 2, 0], { color: '#16171a', tag: 'wall' }),
    box(WALL_T, WALL_H, MAT_D, [W / 2 + WALL_T / 2, WALL_H / 2, 0], { color: '#16171a', tag: 'wall' }),
    // table body (visual)
    box(W + 2 * WALL_T, 8, MAT_D + 2 * WALL_T, [0, -6, 0], { color: '#1b1c1f', collide: false }),
  ];
  m.body('table', { type: 'fixed', shapes, group: GROUP.FIELD });
  return { id: 'field' };
}

// ---------------------------------------------------------------------------------------------
// M01 Drone Survey
// ---------------------------------------------------------------------------------------------
function m01(scene) {
  // pivot close to the south wall so a robot fits between the lying tripod and the LiDAR map
  const m = scene.model('m01', px(1148, 1119), 0);
  const base = m.body('base', {
    type: 'fixed',
    shapes: [
      box(6, 1, 6, [0, 0.5, 0], { color: C.lgray }),
      box(1.2, 3.4, 0.8, [0, 2.3, 2.4], { color: C.dgray }),
      box(1.2, 3.4, 0.8, [0, 2.3, -2.4], { color: C.dgray }),
      cyl(2.2, 0.5, [5.0, 0.25, 1.4], { color: C.lgray }),
      ...minifig([5.0, 0.5, 1.4], C.green, C.dtan),
      box(1.2, 0.5, 0.8, [6.0, 2.2, 0.9], { color: C.black, collide: false }),
      rod([6.0, 2.4, 0.9], [6.3, 3.6, 0.9], 0.08, { color: C.lgray, collide: false }),
      // post holding the launch paddle
      box(0.8, 4.2, 0.8, [0, 2.1, -3.5], { color: C.dgray }),
    ],
  });
  const P = [0, 3.2, 0];
  const droneX = -32.5;
  const tripod = m.body('tripod', {
    at: P,
    shapes: [
      cyl(0.8, 3.6, P, { axis: 'z', color: C.dgray }),
      rod([0.4, 3.2, 1.4], [droneX + 1.2, 1.05, 0.7], 0.32, { color: C.black, density: 0.0003 }),
      rod([0.4, 3.2, -1.4], [droneX + 1.2, 1.05, -0.7], 0.32, { color: C.black, density: 0.0003 }),
      rod([0.3, 3.5, 0], [droneX + 1.2, 1.25, 0], 0.32, { color: C.black, density: 0.0003 }),
      // drone
      box(3.2, 1.0, 3.2, [droneX, 0.5, 0], { color: C.cyan, density: 0.0012 }),
      box(4.6, 0.3, 0.5, [droneX, 1.05, 0], { color: C.dgray, collide: false, rot: [0, 45, 0] }),
      box(4.6, 0.3, 0.5, [droneX, 1.05, 0], { color: C.dgray, collide: false, rot: [0, -45, 0] }),
      cyl(1.05, 0.22, [droneX + 1.75, 1.3, 1.75], { color: C.black, collide: false }),
      cyl(1.05, 0.22, [droneX - 1.75, 1.3, 1.75], { color: C.black, collide: false }),
      cyl(1.05, 0.22, [droneX + 1.75, 1.3, -1.75], { color: C.black, collide: false }),
      cyl(1.05, 0.22, [droneX - 1.75, 1.3, -1.75], { color: C.black, collide: false }),
      // launch lever (red) with a wide handle
      box(0.8, 9, 0.8, [0, P[1] + 4.5, 0], { color: C.red }),
      box(0.8, 0.8, 4.6, [0, P[1] + 8.6, 0], { color: C.red }),
    ],
  });
  const jT = m.revolute('tripodHinge', base, tripod, P, [0, 0, 1], { limits: [-1.78, 0.04], friction: 0.02 });

  // launch paddle north of the base: pushing it east releases the (spring powered) launch
  const LP = [0, 4.6, -3.5];
  const paddle = m.body('paddle', {
    at: LP,
    shapes: [
      cyl(0.5, 1.4, LP, { color: C.dgray }),
      bar(LP, [0, 4.6, -11], 0.8, 0.8, { color: C.dgray }),
      box(1.2, 5, 3, [0, 4.0, -11], { color: C.red }),
    ],
  });
  const jP = m.revolute('paddleHinge', base, paddle, LP, [0, 1, 0], { limits: [-1.2, 0.02], spring: { target: 0, ...SPRING } });

  // LiDAR map: hinged tile that flips (south) into the survey area when the drone launches (string pull).
  const S = SURVEY_AREA.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const o = m.origin;
  const sl = [S[0] - o.x, S[1] - o.z]; // local (rot = 0)
  const hz = sl[1] - 3.3;
  const H = [sl[0], 0.6, hz];
  const anchor = m.body('mapAnchor', { type: 'fixed', at: H, shapes: [box(6.4, 0.08, 0.6, [H[0], 0.04, hz], { color: C.dgray, collide: false })] });
  const mapC = [sl[0], 0.6, hz - 3.3];
  const map = m.body('map', {
    at: H,
    shapes: [
      box(6, 1.2, 6, mapC, { color: C.red, density: 0.0006 }),
      box(4.2, 0.12, 4.2, [mapC[0], 1.24, mapC[2]], { color: C.lgray, collide: false }),
      box(1.2, 0.3, 1.2, [mapC[0] - 1, 1.42, mapC[2] - 0.8], { color: C.bgreen, collide: false }),
      box(0.8, 0.3, 1.6, [mapC[0] + 1.2, 1.42, mapC[2] + 0.6], { color: C.green, collide: false }),
      box(0.6, 0.3, 0.6, [mapC[0] + 0.2, 1.42, mapC[2] + 1.4], { color: C.yellow, collide: false }),
    ],
  });
  const jM = m.revolute('mapHinge', anchor, map, H, [1, 0, 0], { limits: [-0.02, PI + 0.02], friction: 0.01 });
  const D1 = DT.m01Detail({ droneX, P, LP, mapC, H });
  m.decorate(base, D1.base);
  m.decorate(tripod, D1.tripod);
  m.decorate(paddle, D1.paddle);
  m.decorate(map, D1.map);
  m.decorate(anchor, D1.anchor);

  return {
    id: 'm01',
    behavior(ctx) {
      const st = ctx.state;
      // the spring lifts the tripod in ~1.5 s; the LiDAR string only pulls near the top,
      // which leaves the robot time to back away from the map's landing spot
      if (!st.launch && ctx.time > 0.5 && ctx.angle(jP.id) < -0.3) st.launch = true;
      if (st.launch && !st.up) {
        ctx.motorVel(jT.id, -1.1, 1e4, 1e9);
        if (ctx.angle(jT.id) < -1.62) { st.up = true; ctx.motorOff(jT.id); }
      }
      const th = ctx.angle(jT.id);
      if (!st.pulled && th < -1.3) { st.pulled = true; }
      if (st.pulled && !st.flipped) {
        const a = ctx.angle(jM.id);
        if (a < 2.1) ctx.motorVel(jM.id, 5, 1e4, 1e9);
        else { ctx.motorOff(jM.id); st.flipped = true; }
      }
    },
    observe(ctx) {
      const equip = ctx.touching([tripod.id, map.id], 'EQUIP');
      const drone = !ctx.touching(tripod.id, 'MAT');
      const a = ctx.angle(jM.id);
      const mk = ctx.toWorld(map.id, [mapC[0] - H[0], mapC[1] - H[1] + 0.6, mapC[2] - H[2]]);
      const markerIn = rectTouchesPolygon([mk[0] - 2.1, mk[2] - 2.1, mk[0] + 2.1, mk[2] + 2.1], SURVEY_AREA);
      return {
        m01_drone: !equip && drone,
        m01_bonus: !equip && drone && a > PI - 0.2 && markerIn,
        _warn: equip ? 'M01: модель касается оборудования' : null,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M02 Exploding Seeds
// ---------------------------------------------------------------------------------------------
export const SEED_COLORS = [C.brown, C.rbrown, '#7a4a2a'];

function seedShapes(at, color) {
  const [x, y, z] = at;
  return [
    ball(0.95, [x, y, z], { color, density: 0.0012, friction: 0.7 }),
    torus(0.75, 0.22, [x, y - 1.25, z], { color: '#e2b98a', collide: false, rot: [90, 0, 0] }),
    cyl(0.18, 0.5, [x, y - 0.75, z], { color: '#e2b98a', collide: false }),
    ...DT.seedDetail(at, color),
  ];
}

function m02(scene) {
  const m = scene.model('m02', px(640, 600), 0);
  const stalkTop = 22.8;
  const base = m.body('base', {
    type: 'fixed',
    shapes: [
      box(7, 0.8, 0.8, [0, 0.4, 2.1], { color: C.lgray }),
      box(7, 0.8, 0.8, [0, 0.4, -2.1], { color: C.lgray }),
      box(0.8, 0.8, 3.4, [3.1, 0.4, 0], { color: C.lgray }),
      box(0.8, 0.8, 3.4, [-3.1, 0.4, 0], { color: C.lgray }),
      box(1.6, stalkTop - 0.8, 1.6, [0, (stalkTop + 0.8) / 2, -0.5], { color: C.lime }),
      box(1.0, 6, 1.0, [1.2, 15, -0.5], { color: C.lime, rot: [0, 0, -25], collide: false }),
      box(2.2, 0.3, 1.2, [-1.6, 17, -0.5], { color: C.green, rot: [0, 0, 30], collide: false }),
      box(2.2, 0.3, 1.2, [1.8, 12, -0.5], { color: C.green, rot: [0, 0, -30], collide: false }),
      ball(0.5, [1.4, 18.5, 0.3], { color: C.purple, collide: false }),
      box(0.6, 0.6, 2.7, [0, 9.5, 1.65], { color: C.lime }),
    ],
  });
  const P = [0, stalkTop, -0.5];
  const cups = [[-8, 12.5, -0.5], [8, 10.5, -0.5], [-4, 6.5, -5.5]];
  const podShapes = [
    cyl(0.85, 1.2, [0, stalkTop + 0.6, -0.5], { color: C.yellow }),
    box(6, 0.8, 0.8, [0.6, stalkTop + 1.6, -0.5], { color: C.yellow, rot: [0, 0, 18], collide: false }),
    ball(0.45, [3.3, stalkTop + 2.6, -0.5], { color: C.pink, collide: false }),
  ];
  for (const [cx, cy, cz] of cups) {
    const r = Math.hypot(cx, cz + 0.5);
    const ux = cx / r;
    const uz = (cz + 0.5) / r;
    podShapes.push(tube([
      [0, stalkTop + 1.2, -0.5],
      [ux * r * 0.45, stalkTop + 3.4, -0.5 + uz * r * 0.45],
      [ux * r * 0.95, stalkTop - 2 - (stalkTop - cy) * 0.35, -0.5 + uz * r * 0.95],
      [cx, cy + 0.8, cz],
    ], 0.28, { color: C.lime }));
    podShapes.push(box(2.6, 0.3, 2.6, [cx, cy - 0.15, cz], { color: C.dgray, friction: 0.4 }));
    for (const [dx, dz, sx, sz] of [[1.2, 0, 0.25, 2.6], [-1.2, 0, 0.25, 2.6], [0, 1.2, 2.6, 0.25], [0, -1.2, 2.6, 0.25]]) {
      podShapes.push(box(sx, 0.45, sz, [cx + dx, cy + 0.22, cz + dz], { color: C.dgray, friction: 0.4 }));
    }
  }
  const pod = m.body('pod', { at: P, shapes: podShapes, damping: [0.05, 0.3] });
  const jPod = m.revolute('podHinge', base, pod, P, [0, 1, 0], { friction: 0.15 });

  // trigger hangs from a bracket 2.7 cm in front of the stalk (gravity keeps it at 0); pushing it north fires the pod
  const T = [0, 9.5, 3.0];
  const trigger = m.body('trigger', {
    at: T,
    shapes: [rod(T, [0, 6.2, 3.0], 0.4, { color: C.yellow }), box(4.2, 2.6, 0.6, [0, 5.9, 3.0], { color: C.yellow })],
  });
  const jTr = m.revolute('triggerHinge', base, trigger, T, [1, 0, 0], { limits: [-0.02, 0.6], spring: { target: 0, ...SPRING } });

  const D2 = DT.m02Detail({ stalkTop });
  m.decorate(base, D2.base);
  m.decorate(pod, D2.pod, { keep: (s) => s.kind === 'tube' || s.color === C.dgray });
  m.decorate(trigger, D2.trigger);
  const seeds = cups.map(([cx, cy, cz], i) => m.body(`seed${i + 1}`, { loose: true, ccd: true, shapes: seedShapes([cx, cy + 0.98, cz], SEED_COLORS[i]), at: [cx, cy + 0.98, cz] }));
  const modelBodies = [base.id, pod.id, trigger.id];

  return {
    id: 'm02',
    seeds: seeds.map((s) => s.id),
    behavior(ctx) {
      const st = ctx.state;
      // the pod "explodes" after a short fuse (0.7 s) once the trigger is pushed
      if (!st.fired && ctx.time > 0.5 && ctx.angle(jTr.id) > 0.35) { st.fired = true; st.t0 = ctx.time + 0.7; seeds.forEach((s) => ctx.wake(s.id)); }
      if (st.fired && !st.done && ctx.time >= st.t0) {
        if (ctx.time - st.t0 < 0.32) ctx.motorVel(jPod.id, 19, 400, 8e6);
        else { ctx.motorVel(jPod.id, 0, 0.6, 2e4); st.done = true; }
      }
    },
    observe(ctx) {
      let n = 0;
      for (const s of seeds) if (ctx.removed(s.id) || !ctx.touching(s.id, modelBodies)) n++;
      return { m02_seeds: n };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M03 Flip the Rock (west edge of the mat, front faces east)
// ---------------------------------------------------------------------------------------------
function m03(scene) {
  const m = scene.model('m03', px(90, 490), 90);
  const base = m.body('base', {
    type: 'fixed',
    shapes: [
      box(12, 1.6, 9, [0, 0.8, -1], { color: C.lime }),
      box(1, 8.6, 1.6, [5.6, 5.9, -1], { color: C.dgray }),
      box(1, 8.6, 1.6, [-5.6, 5.9, -1], { color: C.dgray }),
      box(12, 0.8, 0.8, [0, 1.9, 3.1], { color: C.lgray, collide: false }),
      box(0.8, 0.8, 8, [5.6, 1.9, -1], { color: C.lgray, collide: false }),
      cyl(0.5, 0.5, [-4.2, 1.85, 2.6], { color: C.pink, collide: false }),
    ],
  });
  const A = [0, 9.5, -1];
  const rock = m.body('rock', {
    at: A,
    shapes: [
      box(9.4, 4.4, 6, A, { color: C.dgray, density: 0.0005 }),
      box(4.2, 0.6, 3, [-2, 12, -1.6], { color: C.green, collide: false }),
      box(3, 0.8, 2.4, [2.2, 12.1, -0.2], { color: C.lgray, collide: false }),
      cone(0.7, 1.6, [2.4, 13, -0.6], { color: C.bgreen }),
      cone(0.5, 1.2, [-3.2, 12.8, -2.2], { color: C.bgreen }),
      cyl(0.5, 0.3, [0.5, 12.15, -2.6], { color: C.azure, collide: false }),
      // creatures underneath
      ball(0.45, [-2, 7.2, -0.5], { color: C.orange, collide: false }),
      ball(0.4, [1.5, 7.2, -2], { color: C.magenta, collide: false }),
      capsule(0.25, 1.6, [2.5, 7.2, 0.8], { color: C.pink, axis: 'x', collide: false }),
      // handles
      box(0.8, 7, 0.8, [4.3, 13, -1], { color: C.red }),
      box(0.8, 7, 0.8, [-4.3, 13, -1], { color: C.red }),
    ],
  });
  const jR = m.revolute('rockAxle', base, rock, A, [1, 0, 0], { friction: 0.6 });
  const F = [3, 2.0, 3.0];
  const flag = m.body('flag', {
    at: F,
    shapes: [box(0.6, 4.4, 0.6, [3, 4.2, 3.0], { color: C.red }), box(0.3, 1.6, 2.2, [3, 5.6, 4.1], { color: C.red })],
  });
  const jF = m.revolute('flagHinge', base, flag, F, [1, 0, 0], { limits: [-0.02, 1.58] });
  const D3 = DT.m03Detail({ A });
  m.decorate(base, D3.base);
  m.decorate(rock, D3.rock);
  m.decorate(flag, D3.flag);
  return {
    id: 'm03',
    behavior(ctx) {
      const st = ctx.state;
      const r = ctx.angle(jR.id);
      if (!st.released && Math.abs(r) > 2.3) { st.released = true; st.t0 = ctx.time; ctx.wake(flag.id); }
      if (!st.released) ctx.motorPos(jF.id, 0, LATCH.stiffness, LATCH.damping, LATCH.maxForce);
      else if (ctx.time - st.t0 < 0.3) ctx.motorVel(jF.id, 3, 50, 2e4);
      else ctx.motorOff(jF.id);
    },
    observe(ctx) {
      const flagDown = ctx.angle(jF.id) > 1.0;
      const r = ctx.angle(jR.id);
      const wrapped = Math.atan2(Math.sin(r), Math.cos(r));
      return { m03_flag: flagDown, m03_bonus: flagDown && Math.abs(wrapped) < 0.3 };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M04 Lucky Leaves (north-west corner)
// ---------------------------------------------------------------------------------------------
function leafShapes(isKatydid) {
  // canonical leaf standing in a socket at the origin, pointing +z
  // peg (heavy, in the socket) + light visual blade -> centre of mass above the peg, so it stands
  const blade = isKatydid ? '#3f8f3a' : C.bgreen;
  const s = [
    cyl(0.5, 2.5, [0, 2.85, 0], { color: C.green, density: 0.004 }),
    box(1.6, 0.6, 1.6, [0, 4.1, 0], { color: blade, density: 0.001 }),
    box(2.4, 0.35, 6.2, [0, 4.4, 2.7], { color: blade, rot: [-20, 0, 0], collide: false, visible: false }),
    box(1.2, 0.36, 3.4, [1.3, 4.0, 1.5], { color: blade, rot: [-20, -30, 0], collide: false, visible: false }),
    box(1.2, 0.36, 3.4, [-1.3, 4.0, 1.5], { color: blade, rot: [-20, 30, 0], collide: false, visible: false }),
    cyl(0.18, 0.9, [0, 4.8, 0], { color: '#a8703f' }),
    torus(1.7, 0.2, [0, 6.9, 0], { color: '#a8703f', rot: [90, 0, 0], density: 0.0005 }),
    ...DT.m04Leaf(blade),
  ];
  if (isKatydid) {
    s.push(rod([0.3, 4.6, 5.6], [0.9, 7.2, 8.2], 0.06, { color: C.dgreen, collide: false }));
    s.push(rod([-0.3, 4.6, 5.6], [-0.9, 7.2, 8.2], 0.06, { color: C.dgreen, collide: false }));
    s.push(ball(0.25, [0.35, 4.75, 5.4], { color: C.black, collide: false }));
    s.push(ball(0.25, [-0.35, 4.75, 5.4], { color: C.black, collide: false }));
  }
  return s;
}

function m04(scene, cfg) {
  const m = scene.model('m04', px(118, 128), 45);
  const dirs = [0, 120, 240]; // yaw of the three arms (0 = front)
  const nestShapes = [box(4, 2, 4, [0, 1, 0], { color: C.dgray }), box(3.6, 0.3, 3.6, [0, 2.15, 0], { color: C.green, collide: false })];
  for (const yaw of dirs) {
    const arm = [
      box(3, 1.6, 6.2, [0, 0.8, 4.4], { color: C.green }),
      box(3.2, 0.4, 6.4, [0, 0.2, 4.4], { color: C.lgray, collide: false }),
      box(0.35, 1.8, 1.9, [0.88, 2.5, 6], { color: C.dgreen }),
      box(0.35, 1.8, 1.9, [-0.88, 2.5, 6], { color: C.dgreen }),
      box(1.4, 1.8, 0.35, [0, 2.5, 6.88], { color: C.dgreen }),
      box(1.4, 1.8, 0.35, [0, 2.5, 5.12], { color: C.dgreen }),
      box(2.4, 0.3, 2.2, [0, 1.75, 2.6], { color: C.lgray, collide: false }),
    ];
    nestShapes.push(...rotateShapes(arm, [0, yaw, 0]));
  }
  const nest = m.body('nest', { type: 'fixed', shapes: nestShapes });
  m.decorate(nest, [...DT.m04Center(), ...dirs.flatMap((yaw) => rotateShapes(DT.m04Arm(), [0, yaw, 0]))]);
  const k = cfg.katydid ?? 0;
  const items = dirs.map((yaw, i) => {
    const sock = rotateShapes([box(0, 0, 0, [0, 0, 6])], [0, yaw, 0])[0].at;
    const shapes = rotateShapes(translateShapes(leafShapes(i === k), [0, 0, 6]), [0, yaw, 0]);
    return m.body(i === k ? 'katydid' : `leaf${i < k ? i + 1 : i}`, { loose: true, at: [sock[0], 1.6, sock[2]], shapes, damping: [0.1, 0.2] });
  });
  const katydid = items[k];
  const leaves = items.filter((_, i) => i !== k);
  const katStart = { at: katydid.pos };
  const all = [nest.id, ...items.map((b) => b.id)];

  const katydidInHabitat = (ctx) => {
    if (ctx.removed(katydid.id)) return false;
    if (ctx.touching(katydid.id, nest.id)) return true;
    const bb = ctx.aabb(katydid.id);
    return rectTouchesPolygon([bb[0], bb[2], bb[3], bb[5]], LEAF_HABITAT) || rectTouchesPolygon([bb[0], bb[2], bb[3], bb[5]], NEST_POLY);
  };
  const NEST_POLY = [m.wxz([-6, 0, -5]), m.wxz([6, 0, -5]), m.wxz([6, 0, 8]), m.wxz([-6, 0, 8])];

  return {
    id: 'm04',
    behavior(ctx) {
      if (ctx.step % 10 === 0 && !ctx.state.left && !katydidInHabitat(ctx)) ctx.state.left = true;
    },
    observe(ctx) {
      const equip = ctx.touching(all, 'EQUIP');
      let off = 0;
      for (const l of leaves) if (ctx.removed(l.id) || !ctx.touching(l.id, nest.id)) off++;
      const inHab = katydidInHabitat(ctx);
      const p = ctx.pose(katydid.id).p;
      const moved = Math.hypot(p[0] - katStart.at[0], p[1] - katStart.at[1], p[2] - katStart.at[2]);
      const up = ctx.axisWorld(katydid.id, [0, 1, 0])[1];
      const original = moved < 0.8 && up > 0.9 && ctx.touching(katydid.id, nest.id);
      return {
        m04_leaves: equip ? 0 : off,
        m04_katydid: !equip && inHab,
        m04_bonus: !equip && inHab && original && !ctx.state.left,
        _warn: equip ? 'M04: модель касается оборудования' : null,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M05 Reaching Roots (north wall)
// ---------------------------------------------------------------------------------------------
function m05(scene) {
  const m = scene.model('m05', px(410, 22), 0);
  const base = m.body('base', {
    type: 'fixed',
    shapes: [
      box(4, 0.6, 3.2, [0, 0.3, 0.3], { color: C.lgray }),
      box(3.6, 7.6, 0.8, [0, 4.2, -1.0], { color: C.lgray }),
      box(0.8, 7.6, 3, [1.4, 4.2, 0.3], { color: C.lgray }),
      box(0.8, 7.6, 3, [-1.4, 4.2, 0.3], { color: C.lgray }),
      box(1.8, 9.5, 1.8, [-2.9, 4.75, 0.2], { color: C.brown }),
      foliage(2.4, [-3.2, 10.5, 0.2], { color: C.bgreen }),
      foliage(1.8, [-4.6, 8.6, 1.2], { color: C.green }),
    ],
  });
  const P = [0, 9.0, 0.3];
  const tip = [0, 15, 6.3];
  const arm = m.body('root', {
    at: P,
    gravity: 0,
    shapes: [
      bar(P, tip, 1.2, 1.2, { color: C.brown }),
      bar([0.9, 9.5, 0.6], [0.9, 14.6, 5.6], 0.5, 0.9, { color: C.green, collide: false }),
      cyl(0.5, 4, [0, 15.2, 6.7], { axis: 'x', color: C.red }),
      ball(0.62, [2.0, 15.2, 6.7], { color: C.red, collide: false }),
      ball(0.62, [-2.0, 15.2, 6.7], { color: C.red, collide: false }),
      cyl(0.55, 3.2, [0, 10.6, 4.4], { axis: 'x', color: C.red }),
      bar([0, 9.6, 1.2], [0, 10.6, 4.4], 0.8, 0.8, { color: C.rbrown }),
      cone(0.8, 3.4, [0, 16.8, 4.6], { color: C.brown, rot: [-35, 0, 0] }),
    ],
  });
  const jA = m.revolute('rootHinge', base, arm, P, [1, 0, 0], { limits: [-2.35, 0.05], friction: 0.4 });
  const D5 = DT.m05Detail();
  m.decorate(base, D5.base);
  m.decorate(arm, D5.root);
  return {
    id: 'm05',
    behavior(ctx) {
      // ratchet: the root stays where it was pushed (cannot retract)
      const st = ctx.state;
      const a = ctx.angle(jA.id);
      if (st.min === undefined) st.min = 0;
      if (a < st.min) st.min = a;
      if (a > st.min + 0.04) ctx.motorPos(jA.id, st.min, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
      else ctx.motorOff(jA.id);
    },
    observe(ctx) {
      const a = ctx.angle(jA.id);
      const equip = ctx.touching(arm.id, 'EQUIP');
      const level = a <= -2.0 ? 2 : a <= -0.8 ? 1 : 0;
      return { m05_root: equip ? 0 : level, _m05full: !equip && level === 2, _warn: equip ? 'M05: корень касается оборудования' : null };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M06 Leafcutter Frenzy + M07 Humongous Fungus (north wall, shared base)
// ---------------------------------------------------------------------------------------------
const FRAG_COLORS = [C.bgreen, C.orange, C.yellow, C.white];

function m06m07(scene) {
  const m = scene.model('m06', px(1585, 45), 0);
  const nest = m.body('nest', {
    type: 'fixed',
    shapes: [
      box(22, 0.8, 7, [2, 0.4, -0.6], { color: C.cream }),
      box(9, 5, 6, [-4, 3.3, -0.6], { color: C.tan }),
      box(2.4, 2.6, 0.2, [-4, 2.1, 2.42], { color: '#3b2a1a', collide: false }),
      box(9.4, 0.4, 0.6, [-4, 5.6, 2.3], { color: C.green, collide: false }),
      box(0.6, 3, 6.2, [-8.6, 3, -0.6], { color: C.dtan, collide: false }),
    ],
  });
  // shaking tray with 4 slots on top of the nest
  const TY = 6.1;
  const trayShapes = [box(8.4, 0.6, 3.2, [-4, TY, -0.6], { color: C.dtan })];
  const slots = [-7, -5, -3, -1];
  for (const x of slots) {
    trayShapes.push(box(1.6, 1.0, 0.3, [x, TY + 0.8, -0.6 + 0.9], { color: C.tan }));
    trayShapes.push(box(1.6, 1.0, 0.3, [x, TY + 0.8, -0.6 - 0.9], { color: C.tan }));
    trayShapes.push(box(0.25, 1.0, 1.5, [x + 0.62, TY + 0.8, -0.6], { color: C.tan }));
    trayShapes.push(box(0.25, 1.0, 1.5, [x - 0.62, TY + 0.8, -0.6], { color: C.tan }));
  }
  const tray = m.body('tray', { at: [-4, TY, -0.6], shapes: trayShapes });
  const jTray = m.prismatic('trayLift', nest, tray, [-4, TY, -0.6], [0, 1, 0], { limits: [0, 1.0] });
  const frags = slots.map((x, i) => m.body(`frag${i + 1}`, {
    loose: true,
    at: [x, TY + 0.3 + 2.5, -0.6],
    shapes: [
      box(0.4, 5, 1.3, [x, TY + 0.3 + 2.5, -0.6], { color: FRAG_COLORS[i], density: 0.0007, friction: 0.6 }),
      ball(1, [x, TY + 4.6, -0.6], { color: FRAG_COLORS[i], collide: false }),
    ],
  }));
  // rack with the ant
  const RZ0 = 2.4;
  const rackShapes = [
    box(1.6, 1.2, 6.2, [-4, 1.4, RZ0 + 3.1], { color: C.white }),
    box(3, 3, 0.5, [-4, 2.0, RZ0 + 7.6], { color: C.black }),
    ball(0.85, [-4, 2.3, RZ0 + 6.75], { color: C.red }),
    ball(0.7, [-4, 2.2, RZ0 + 5.4], { color: C.black, collide: false }),
    ball(0.6, [-4.5, 3.0, RZ0 + 6.3], { color: C.black, collide: false }),
    box(3.2, 0.15, 0.2, [-4, 1.8, RZ0 + 6.1], { color: C.black, collide: false }),
  ];
  for (let i = 0; i < 7; i++) rackShapes.push(box(1.4, 0.25, 0.35, [-4, 2.1, RZ0 + 0.4 + i * 0.8], { color: C.white, collide: false }));
  const rack = m.body('rack', { at: [-4, 1.4, RZ0], shapes: rackShapes });
  const jRack = m.prismatic('rackSlide', nest, rack, [-4, 1.4, RZ0], [0, 0, 1], { limits: [-6.2, 0.02], friction: 1.2 });
  const gear = m.body('gear', {
    at: [0.85, 2.6, 1.2],
    shapes: [cyl(1.5, 0.6, [0.85, 2.6, 1.2], { axis: 'x', color: C.dgray }), box(0.62, 0.5, 3.4, [0.85, 2.6, 1.2], { color: C.lgray, collide: false }), box(0.62, 3.4, 0.5, [0.85, 2.6, 1.2], { color: C.lgray, collide: false })],
  });
  const jGear = m.revolute('gearAxle', nest, gear, [0.85, 2.6, 1.2], [1, 0, 0], {});

  // M07 mycelium
  const ped = m.body('pedestal', { type: 'fixed', shapes: [box(2.4, 9, 2, [8, 5.3, -2.6], { color: C.white }), box(4, 0.6, 3, [8, 1.1, -2.6], { color: C.lgray })] });
  const MP = [8, 9.8, -2.6];
  const myc = m.body('mycelium', {
    at: MP,
    shapes: [
      box(0.8, 13, 0.8, [6.6, 16.3, -2.6], { color: C.white }),
      box(0.8, 13, 0.8, [9.4, 16.3, -2.6], { color: C.white }),
      box(3.6, 0.8, 0.8, [8, 15, -2.6], { color: C.white }),
      box(3.6, 0.8, 0.8, [8, 22.4, -2.6], { color: C.white }),
      bar([6.6, 18, -2.6], [4.2, 21.5, -2.6], 0.6, 0.6, { color: C.white, collide: false }),
      bar([9.4, 19, -2.6], [11.8, 22, -2.6], 0.6, 0.6, { color: C.white, collide: false }),
      box(0.8, 0.8, 0.8, [6.6, 22.8, -2.6], { color: C.red, collide: false }),
      box(0.8, 0.8, 6, [8, 10.6, 0.4], { color: C.red }),
      cyl(0.6, 4, [8, 10.6, 3.4], { axis: 'x', color: C.red }),
    ],
  });
  const jMyc = m.revolute('myceliumHinge', ped, myc, MP, [1, 0, 0], { limits: [-1.6, 0.03], friction: 0.05 });
  m.decorate(nest, DT.m06Nest());
  m.decorate(tray, DT.m06Tray(TY), { keep: (s, i) => i > 0 });
  frags.forEach((f, i) => m.decorate(f, DT.m06Frag(slots[i], TY, FRAG_COLORS[i])));
  m.decorate(rack, DT.m06Ant(RZ0), { keep: (s, i) => i >= 6 });
  m.decorate(gear, DT.m06Gear(), { keep: (s, i) => i > 0 });
  m.decorate(ped, DT.m07Pedestal());
  m.decorate(myc, DT.m07Mycelium());

  const NEST_X = [-8.6, 0.6];
  const NEST_Z = [-3.7, 2.5];
  return [
    {
      id: 'm06',
      behavior(ctx) {
        const r = ctx.slide(jRack.id);
        ctx.motorPos(jTray.id, 0.55 * Math.abs(Math.sin((r * PI) / 1.5)), HOLD.stiffness, HOLD.damping, HOLD.maxForce);
        ctx.motorPos(jGear.id, -r / 1.2, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
      },
      observe(ctx) {
        const ant = ctx.slide(jRack.id) <= -6.0;
        let n = 0;
        for (const f of frags) {
          if (ctx.removed(f.id)) continue;
          const l = ctx.toModel('m06', ctx.pose(f.id).p);
          if (l[0] > NEST_X[0] && l[0] < NEST_X[1] && l[2] > NEST_Z[0] && l[2] < NEST_Z[1] && l[1] > 5.0) n++;
        }
        return { m06_ant: ant, m06_frags: n };
      },
    },
    {
      id: 'm07',
      observe(ctx, answers) {
        const equip = ctx.touching(myc.id, 'EQUIP');
        const ext = !equip && ctx.angle(jMyc.id) <= -1.4;
        const opp = ctx.cfg.opponent || {};
        const conn = ext ? (opp.rootFull ? 1 : 0) + (opp.mycelium && answers._m05full ? 1 : 0) : 0;
        return { m07_myc: ext, m07_conn: conn, _warn: equip ? 'M07: мицелий касается оборудования' : null };
      },
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// M08 Tangled + M09 Research Platform (big tree at the north wall)
// ---------------------------------------------------------------------------------------------
function m08m09(scene) {
  const m = scene.model('m09', px(600, 50), 0);
  const treeShapes = [
    box(12, 0.8, 8, [0, 0.4, -0.6], { color: C.green }),
    box(5, 26, 5, [0, 13.8, -1.6], { color: C.brown }),
    box(1.6, 3, 1.6, [-3, 1.9, 0.2], { color: C.rbrown, collide: false }),
    box(1.6, 2.4, 1.6, [3, 1.6, -0.2], { color: C.rbrown, collide: false }),
    bar([0, 22, -1.6], [-9, 27, -1.6], 1.4, 1.4, { color: C.brown, collide: false }),
    bar([0, 23, -1.6], [9, 28, -1.6], 1.4, 1.4, { color: C.brown, collide: false }),
    foliage(4.5, [0, 30, -1.6], { color: C.bgreen }),
    foliage(3.6, [-8, 28.5, -1], { color: C.green }),
    foliage(3.6, [8.5, 29, -1.8], { color: C.lime }),
    foliage(3, [-3, 33, -2.4], { color: C.lime }),
    foliage(2.8, [4, 32.5, -0.5], { color: C.green }),
    ball(0.5, [-6, 26.5, 1.4], { color: C.red, collide: false }),
    ball(0.5, [6, 27, 1.2], { color: C.orange, collide: false }),
    // seed shelf on a bracket (east side) with a low lip so the seed cannot roll off by itself
    box(2.4, 0.4, 2.6, [5.2, 9.3, 3.0], { color: C.dgray }),
    box(0.3, 0.5, 2.6, [6.25, 9.75, 3.0], { color: C.dgray }),
    box(2.4, 0.8, 0.8, [3.6, 9.0, 1.4], { color: C.dgray }),
    // brackets that carry the platform lever and the camera trap (above the robot, below the platform)
    bar([-2.9, 8.0, 0.9], [-2.9, 8.0, 10.6], 0.6, 0.6, { color: C.lgray }),
    bar([2.6, 8.0, 0.9], [6.2, 8.0, 10.6], 0.6, 0.6, { color: C.lgray }),
  ];
  const tree = m.body('tree', { type: 'fixed', shapes: treeShapes });

  // research platform (west part of the south face), slides up
  const PX = -5.2;
  const platShapes = [
    box(11, 1, 8.6, [PX, 9, 5.3], { color: C.tan }),
    box(11, 1, 0.4, [PX, 10, 9.4], { color: C.dtan }),
    box(0.4, 1, 8.6, [PX - 5.3, 10, 5.3], { color: C.dtan }),
    box(0.4, 1, 8.6, [PX + 5.3, 10, 5.3], { color: C.dtan, collide: false }),
    ...minifig([PX - 2.5, 9.5, 6], C.olive, C.dtan),
    ...minifig([PX + 1.5, 9.5, 4.5], C.red, C.dgray),
    ...minifig([PX - 0.5, 9.5, 7.6], C.green, C.brown),
    box(2, 1.2, 1.2, [PX + 3.5, 10.1, 7.2], { color: C.brown, collide: false }),
    box(0.8, 3, 0.8, [PX + 4.6, 8, 1.4], { color: C.lgray, collide: false }),
  ];
  const plat = m.body('platform', { at: [PX, 9, 5.3], shapes: platShapes });
  const jPlat = m.prismatic('platformLift', tree, plat, [PX, 9, 5.3], [0, 1, 0], { limits: [0, 7] });

  // platform lever: a paddle hanging in front of the platform; pushing it north lifts the platform
  const LP = [-5.6, 8.0, 10.6];
  const lever = m.body('lever', {
    at: LP,
    shapes: [
      box(4, 5.7, 0.6, [-5.6, 4.85, 10.6], { color: C.red }),
      cyl(0.25, 4.6, LP, { axis: 'x', color: C.dgray, collide: false }),
    ],
  });
  const jLever = m.revolute('leverHinge', tree, lever, LP, [1, 0, 0], { limits: [-0.02, 1.25], spring: { target: 0, stiffness: 40, damping: 6, maxForce: 3e4 } });

  // camera trap: hangs folded under its bracket; pushed north it swings up and latches (deployed)
  const CP = [8.0, 8.0, 10.6];
  const cam = m.body('cameraTrap', {
    at: CP,
    shapes: [
      box(3, 5.7, 0.6, [8.0, 4.85, 10.6], { color: C.red }),
      box(1.4, 1.4, 1.2, [8.0, 3.4, 9.7], { color: C.dgray }),
      cyl(0.35, 0.3, [8.0, 3.4, 9.0], { axis: 'z', color: C.black, collide: false }),
      cyl(0.25, 3.4, CP, { axis: 'x', color: C.lgray, collide: false }),
    ],
  });
  const jCam = m.revolute('cameraHinge', tree, cam, CP, [1, 0, 0], { limits: [-0.02, 1.25], friction: 0.05 });

  const seed = m.body('seed', {
    loose: true,
    at: [5.2, 10.0, 3.0],
    shapes: [
      box(0.8, 0.8, 2.6, [5.2, 9.9, 3.0], { color: C.red, density: 0.0012, visible: false, friction: 0.8 }),
      capsule(0.42, 2.0, [5.2, 9.92, 3.0], { axis: 'z', color: C.red, collide: false }),
      cone(0.25, 0.9, [5.2, 10.7, 3.4], { color: C.brown, collide: false }),
      cone(0.25, 0.9, [5.2, 10.7, 2.4], { color: C.brown, collide: false }),
    ],
  });

  // vine hanging on the south face (M08). It unhooks when pulled out ~30°.
  const VP = [1.6, 18, 1.5];
  const vinePts = [[1.6, 18, 1.5], [2.4, 16, 1.6], [0.8, 14, 1.7], [2.4, 12, 1.7], [0.8, 10, 1.8], [1.8, 8.2, 1.9]];
  const vineShapes = [tube(vinePts, 0.38, { color: C.bgreen })];
  for (let i = 0; i < vinePts.length - 1; i++) vineShapes.push(rod(vinePts[i], vinePts[i + 1], 0.38, { color: C.bgreen, visible: false }));
  vineShapes.push(rod([1.8, 8.2, 1.9], [1.8, 5.6, 2.3], 0.3, { color: C.dtan }));
  vineShapes.push(rod([1.8, 5.4, 2.3], [1.8, 5.2, 2.95], 0.22, { color: C.dtan }));
  vineShapes.push(torus(1.9, 0.25, [1.8, 5.2, 4.85], { color: C.dtan }));
  const vine = m.body('vine', { at: VP, shapes: vineShapes });
  const jVine = m.revolute('vineHook', tree, vine, VP, [1, 0, 0], { limits: [-1.2, 0.05], friction: 0.05 });

  m.decorate(tree, DT.m09Tree(), { keep: (s) => s.color === C.rbrown || (s.size && s.size[0] === 0.3) });
  m.decorate(plat, DT.m09Platform(PX));
  m.decorate(lever, DT.m09Lever(LP));
  m.decorate(cam, DT.m09Camera(CP));
  const treeBodies = [tree.id, plat.id, lever.id, cam.id];
  return [
    {
      id: 'm08',
      behavior(ctx) {
        const st = ctx.state;
        if (!st.unhooked && ctx.angle(jVine.id) < -0.4) { st.unhooked = true; ctx.removeJoint(jVine.id); ctx.wake(vine.id); }
      },
      observe(ctx) {
        return { m08_vine: ctx.touching(vine.id, 'MAT') };
      },
    },
    {
      id: 'm09',
      behavior(ctx) {
        const st = ctx.state;
        const la = ctx.angle(jLever.id);
        st.plat = Math.max(st.plat || 0, 7 * clamp((la - 0.03) / 0.82, 0, 1));
        ctx.motorPos(jPlat.id, st.plat, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
        const ca = ctx.angle(jCam.id);
        st.cam = Math.max(st.cam || 0, ca);
        if (st.cam > 0.9) ctx.motorPos(jCam.id, Math.max(0.9, st.cam), HOLD.stiffness, HOLD.damping, HOLD.maxForce);
      },
      observe(ctx) {
        const platUp = ctx.slide(jPlat.id) >= 6.0 && !ctx.touching(plat.id, 'EQUIP');
        const camOk = ctx.angle(jCam.id) >= 0.9 && !ctx.touching(cam.id, 'EQUIP');
        const seedOk = (ctx.removed(seed.id) || !ctx.touching(seed.id, treeBodies)) && !ctx.touching(seed.id, 'EQUIP');
        return { m09_platform: platUp, m09_camera: camOk, m09_seed: seedOk };
      },
      seeds: [seed.id],
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// M10 Fragile Microhabitats
// ---------------------------------------------------------------------------------------------
function fragile(m, baseShapes, P, armShapes) {
  const base = m.body('base', { type: 'fixed', shapes: baseShapes });
  const arm = m.body('habitat', { at: P, shapes: armShapes });
  const j = m.revolute('hinge', base, arm, P, [1, 0, 0], { limits: [-1.65, 1.65], friction: 0.02 });
  return { base, arm, j };
}

function m10(scene) {
  // snail habitat (north)
  const ms = scene.model('m10s', px(790, 92), 0);
  const snail = fragile(ms, [box(3, 1.2, 3.5, [0, 0.6, 0], { color: C.dgray }), box(1.2, 0.8, 1.2, [0, 1.6, 0.8], { color: C.lgray })], [0, 1.6, 0.8], [
    bar([0, 1.6, 0.8], [0, 9.5, -4.0], 1.0, 1.0, { color: C.lime }),
    bar([0.6, 2.4, 0.5], [0.6, 6.5, -1.9], 0.6, 0.8, { color: C.brown, collide: false }),
    ball(1.5, [0, 10.7, -4.6], { color: C.yellow }),
    capsule(0.55, 2.4, [0, 9.4, -3.0], { color: C.orange, rot: [60, 0, 0], collide: false }),
    rod([0.3, 10, -1.9], [0.5, 11.4, -1.4], 0.08, { color: C.orange, collide: false }),
    rod([-0.3, 10, -1.9], [-0.5, 11.4, -1.4], 0.08, { color: C.orange, collide: false }),
  ]);
  // spider habitat (near the farm)
  const mp = scene.model('m10p', px(1122, 442), 0);
  const spider = fragile(mp, [box(1.2, 0.8, 3, [3, 0.4, 0], { color: C.lime }), box(1.2, 0.8, 3, [-3, 0.4, 0], { color: C.lime }), box(7, 0.6, 0.8, [0, 0.3, 0], { color: C.lgray })], [0, 0.9, 0], [
    box(0.8, 7.5, 0.8, [2.8, 4.65, 0], { color: C.white }),
    box(0.8, 7.5, 0.8, [-2.8, 4.65, 0], { color: C.white }),
    box(7.4, 0.8, 0.8, [0, 8.4, 0], { color: C.brown }),
    bar([-3.4, 8.4, 0], [0, 10.2, 0], 0.7, 0.7, { color: C.brown, collide: false }),
    bar([3.4, 8.4, 0], [0, 10.2, 0], 0.7, 0.7, { color: C.brown, collide: false }),
    box(4.8, 0.45, 0.45, [0, 3.2, 0], { color: C.white, collide: false }),
    box(4.8, 0.45, 0.45, [0, 5.8, 0], { color: C.white, collide: false }),
    box(0.45, 6.6, 0.45, [0, 4.6, 0], { color: C.white, collide: false }),
    ball(0.75, [0, 4.6, 0.45], { color: C.black, collide: false }),
    rod([-1.6, 5.4, 0.5], [1.6, 3.8, 0.5], 0.08, { color: C.black, collide: false }),
    rod([1.6, 5.4, 0.5], [-1.6, 3.8, 0.5], 0.08, { color: C.black, collide: false }),
    rod([-1.8, 4.6, 0.5], [1.8, 4.6, 0.5], 0.08, { color: C.black, collide: false }),
  ]);
  const ds = DT.m10Snail();
  ms.decorate(snail.base, ds.base);
  ms.decorate(snail.arm, ds.arm);
  const dp = DT.m10Spider();
  mp.decorate(spider.base, dp.base);
  mp.decorate(spider.arm, dp.arm);
  const habitats = [{ h: spider, key: 'm10_spider', st: 'spider' }, { h: snail, key: 'm10_snail', st: 'snail' }];
  return {
    id: 'm10',
    behavior(ctx) {
      for (const { h, st } of habitats) {
        const s = (ctx.state[st] ||= { fallen: false });
        const a = ctx.angle(h.j.id);
        if (!s.fallen && Math.abs(a) > 0.22) s.fallen = true;
        if (s.fallen) ctx.motorOff(h.j.id);
        else ctx.motorPos(h.j.id, 0, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
      }
    },
    observe(ctx) {
      const out = {};
      for (const { h, key, st } of habitats) {
        const s = ctx.state[st] || {};
        out[key] = !s.fallen && Math.abs(ctx.angle(h.j.id)) < 0.15 && !ctx.touching(h.arm.id, 'EQUIP');
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M11 Window to the Past
// ---------------------------------------------------------------------------------------------
function m11(scene) {
  const m = scene.model('m11', px(1440, 562), 0);
  const box_ = m.body('box', {
    type: 'fixed',
    shapes: [...hidden([
      box(10, 0.5, 8, [0, 0.25, 0], { color: C.dgray }),
      box(9, 9, 1, [0, 5, -3.4], { color: C.rbrown }),
      box(1.6, 9, 7, [3.9, 5, 0], { color: C.brown }),
      box(1.6, 9, 7, [-3.9, 5, 0], { color: C.brown }),
      box(10, 1, 8, [0, 9.9, 0], { color: C.green }),
      rod([-1.5, 1, -2.8], [0.5, 7, -2.8], 0.3, { color: C.tan, collide: false }),
      rod([1.5, 1, -2.8], [-0.2, 6.5, -2.8], 0.25, { color: C.dtan, collide: false }),
      ball(0.8, [0.2, 3.5, -2.6], { color: C.cream, collide: false }),
      rod([0, 10.4, 0], [0, 15, 0.4], 0.2, { color: C.green, collide: false }),
      cone(1.0, 1.2, [0, 15.4, 0.4], { color: C.orange, rot: [180, 0, 0] }),
      rod([-2.5, 10.4, 1], [-2.6, 13, 1.2], 0.15, { color: C.green, collide: false }),
      foliage(0.9, [-2.6, 13.3, 1.2], { color: C.lavender }),
      rod([2.5, 10.4, -1], [2.8, 12.4, -1], 0.15, { color: C.green, collide: false }),
      foliage(0.8, [2.8, 12.7, -1], { color: C.magenta }),
    ]), ...DT.m11Box()],
  });
  const HP = [0, 0.35, 3.9];
  const cover = m.body('cover', { at: HP, shapes: [...hidden([box(6, 8.6, 0.6, [0, 4.65, 3.9], { color: C.red }), box(1.6, 0.6, 0.6, [0, 7.5, 4.4], { color: C.dred, collide: false })]), ...DT.m11Cover()] });
  const jC = m.revolute('coverHinge', box_, cover, HP, [1, 0, 0], { limits: [-0.02, 1.62], friction: 0.02 });
  const TP = [-5.5, 5.5, 1.5];
  const trig = m.body('trigger', {
    at: TP,
    shapes: [...hidden([bar(TP, [-8.5, 5.5, 4.5], 0.8, 0.8, { color: C.brown }), box(2.4, 5, 1, [-9.0, 5.0, 4.5], { color: C.red }), ball(1, [-9.0, 7.9, 4.5], { color: C.tan, collide: false }), cyl(0.45, 1.2, TP, { color: C.dgray })]), ...DT.m11Trigger()],
  });
  const jT = m.revolute('triggerHinge', box_, trig, TP, [0, 1, 0], { limits: [-0.9, 0.02], spring: { target: 0, stiffness: 60, damping: 8, maxForce: 3e4 } });
  return {
    id: 'm11',
    behavior(ctx) {
      const st = ctx.state;
      if (!st.released && ctx.angle(jT.id) < -0.35) { st.released = true; st.t0 = ctx.time; ctx.wake(cover.id); }
      if (!st.released) ctx.motorPos(jC.id, 0, LATCH.stiffness, LATCH.damping, LATCH.maxForce);
      else if (ctx.time - st.t0 < 0.3) ctx.motorVel(jC.id, 2.5, 50, 3e4);
      else ctx.motorOff(jC.id);
    },
    observe(ctx) {
      return { m11_cover: ctx.angle(jC.id) > 1.35 && ctx.touching(cover.id, 'MAT') };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// M12 Forest Elder (east edge, front faces west)
// ---------------------------------------------------------------------------------------------
function m12(scene) {
  const m = scene.model('m12', px(2025, 395), -90);
  const base = m.body('base', { type: 'fixed', shapes: [box(8, 0.8, 7, [0, 0.4, -0.5], { color: C.green }), box(1.6, 0.4, 1.6, [1.2, 1.0, 2.0], { color: C.dgray })] });
  const tree = m.body('tree', {
    type: 'fixed',
    shapes: [
      box(2.6, 14, 2.6, [0, 7.8, -1.5], { color: C.cream }),
      bar([0, 14.4, -1.5], [-4, 21, -1.0], 2.2, 2.2, { color: C.cream }),
      bar([-1.5, 17.5, -1.3], [3, 23, -1.3], 1.4, 1.4, { color: C.cream, collide: false }),
      foliage(3.2, [-4.6, 22.6, -1], { color: C.bgreen }),
      foliage(2.6, [3.3, 23.8, -1.3], { color: C.green }),
      cyl(0.5, 0.3, [-4.2, 25.6, -1], { color: C.orange, collide: false }),
      box(1.4, 1.4, 1.4, [0, 2.2, -0.4], { color: C.dgray, collide: false }),
      // hook peg for the support tie (sticks out south)
      box(3, 0.6, 0.6, [2.8, 7.5, -1.5], { color: C.dgray }),
      box(0.6, 1.0, 0.6, [4.1, 8.0, -1.5], { color: C.dgray }),
      rod([1.3, 7.3, -1.5], [2.2, 3.4, -1.5], 0.15, { color: C.lgray, collide: false }),
    ],
  });
  const CP = [0, 0.9, 2.0];
  const a35 = (35 * PI) / 180;
  const cane = m.body('cane', {
    at: CP,
    shapes: [bar(CP, [0, 0.9 + 16 * Math.sin(a35), 2 + 16 * Math.cos(a35)], 0.8, 0.8, { color: C.rbrown }), ball(0.6, [0, 0.9 + 16 * Math.sin(a35), 2 + 16 * Math.cos(a35)], { color: C.red, collide: false })],
  });
  const jCane = m.revolute('caneHinge', base, cane, CP, [1, 0, 0], { limits: [-1.35, 0.04], friction: 0.05 });
  const RC = [3.2, 5.2, -1.5];
  const tie = m.body('tie', {
    loose: true,
    at: RC,
    shapes: [torus(2.6, 0.45, RC, { color: C.red, rot: [0, 0, 90], density: 0.0012 }), ...[0, 1, 2, 3].map((i) => box(0.4, 0.7, 0.25, [3.2, 2.3 - i * 0.6, -1.5], { color: C.lgray, collide: false }))],
  });
  const PP = [13, 0, 4.0];
  const post = m.body('post', {
    type: 'fixed',
    shapes: [box(3, 0.6, 3, [PP[0], 0.3, PP[2]], { color: C.dgray }), box(1.6, 4.5, 1.6, [PP[0], 2.85, PP[2]], { color: C.lgray }), box(2.4, 0.6, 1.6, [PP[0], 5.4, PP[2]], { color: C.red })],
  });
  m.rope('chain', tree, tie, [0, 3.0, -1.5], [3.2, 2.6, -1.5], 17);
  const D12 = DT.m12Detail({ CP, caneEnd: [0, 0.9 + 16 * Math.sin(a35), 2 + 16 * Math.cos(a35)], RC, PP });
  m.decorate(base, D12.base);
  m.decorate(tree, D12.tree);
  m.decorate(cane, D12.cane);
  m.decorate(tie, D12.tie, { hide: false });
  m.decorate(post, D12.post);
  const postTop = 5.7;
  return {
    id: 'm12',
    behavior() {},
    observe(ctx) {
      const caneUp = ctx.angle(jCane.id) <= -0.95 && ctx.touching(cane.id, tree.id) && !ctx.touching(cane.id, 'EQUIP');
      let tieOk = false;
      if (!ctx.removed(tie.id) && !ctx.touching(tie.id, 'EQUIP')) {
        const c = ctx.pose(tie.id).p;
        const n = ctx.axisWorld(tie.id, [1, 0, 0]); // torus axis (rotated about z by 90°)
        const pw = m.w(PP);
        if (Math.abs(n[1]) > 0.25) {
          const y = c[1] - (n[0] * (pw.x - c[0]) + n[2] * (pw.z - c[2])) / n[1];
          const d = Math.hypot(pw.x - c[0], y - c[1], pw.z - c[2]);
          tieOk = y >= -0.5 && y <= postTop + 0.3 && d < 2.6 - 0.45 - 0.5;
        }
      }
      return { m12_cane: caneUp, m12_tie: tieOk };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Interchangeable models (M13, M14, M15) on docks
// ---------------------------------------------------------------------------------------------
function frameCorners(m, w, d, h, color, top = C.black) {
  const s = [];
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) s.push(box(0.8, h, 0.8, [x, h / 2, z], { color }));
  s.push(box(w + 0.8, 0.8, 0.8, [0, h, d / 2], { color: top }), box(w + 0.8, 0.8, 0.8, [0, h, -d / 2], { color: top }));
  s.push(box(0.8, 0.8, d, [w / 2, h, 0], { color: top }), box(0.8, 0.8, d, [-w / 2, h, 0], { color: top }));
  s.push(box(1, 0.4, 1, [w / 2, h + 0.6, d / 2], { color: C.yellow, collide: false }), box(1, 0.4, 1, [-w / 2, h + 0.6, -d / 2], { color: C.yellow, collide: false }));
  return s;
}

function m13(scene, dock) {
  const D = DOCKS[dock];
  const m = scene.model('m13', D.pos, D.rot);
  const frame = m.body('frame', {
    type: 'fixed',
    shapes: [
      ...frameCorners(m, 13.2, 8.4, 8.0, C.black, C.green),
      box(0.8, 1.2, 9.2, [6.6, 0.6, 0], { color: C.black }),
      box(0.8, 1.2, 9.2, [-6.6, 0.6, 0], { color: C.black }),
      box(13.2, 1.2, 0.8, [0, 0.6, -4.2], { color: C.black }),
      box(10, 0.8, 6, [0, 1.0, -0.6], { color: C.lgray, tag: 'platform' }),
      box(10, 0.3, 3.5, [0, 0.62, 4.0], { color: C.dgray, rot: [23.6, 0, 0] }),
      box(13, 0.6, 0.6, [0, 4.4, -4.2], { color: C.green, collide: false }),
      box(0.6, 0.6, 8, [6.6, 4.4, 0], { color: C.bgreen, collide: false }),
    ],
  });
  const TP = [0, 8.0, -4.2];
  const trees = m.body('trees', {
    at: TP,
    shapes: [3, -3].flatMap((x) => [
      bar([x, 8, -4.2], [x, 8, 1.6], 0.7, 0.7, { color: C.brown }),
      ball(1.6, [x, 8, 2.4], { color: C.green }),
      foliage(1.0, [x + 0.8, 8.6, 2.0], { color: C.bgreen }),
      ball(0.4, [x - 0.6, 9.2, 2.6], { color: C.red, collide: false }),
    ]),
  });
  const jTrees = m.revolute('treesHinge', frame, trees, TP, [1, 0, 0], { limits: [-1.62, 0.03], friction: 0.05 });
  // push lever hanging straight down from the front top rail
  const LP = [4.5, 8.0, 4.9];
  const lever = m.body('lever', { at: LP, shapes: [bar(LP, [4.5, 4.4, 4.9], 0.8, 0.8, { color: C.dgray }), box(3, 2.5, 0.6, [4.5, 4.0, 4.9], { color: C.red })] });
  const jL = m.revolute('leverHinge', frame, lever, LP, [1, 0, 0], { limits: [-0.02, 0.9], spring: { target: 0, ...SPRING } });
  const D13 = DT.m13Detail();
  m.decorate(frame, D13.frame);
  m.decorate(trees, D13.trees);
  m.decorate(lever, D13.lever);
  return {
    id: 'm13',
    dock,
    behavior(ctx) {
      const st = ctx.state;
      if (ctx.time > 0.5) st.t = Math.max(st.t || 0, clamp((ctx.angle(jL.id) - 0.12) / 0.55, 0, 1));
      if (st.t > 0.02) ctx.motorPos(jTrees.id, -1.62 * st.t, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
    },
    observe(ctx) {
      const raised = ctx.angle(jTrees.id) <= -1.3;
      const ks = 'equip.keystone';
      let on = false;
      if (ctx.has(ks) && !ctx.removed(ks)) {
        const l = ctx.toModel('m13', ctx.pose(ks).p);
        on = ctx.touching(ks, frame.id) && Math.abs(l[0]) < 5.2 && l[2] > -3.8 && l[2] < 2.6 && l[1] > 1.2;
      }
      return { m13: raised && on, _m13: { raised, on } };
    },
  };
}

function m14(scene, dock, seedIds) {
  const D = DOCKS[dock];
  const m = scene.model('m14', D.pos, D.rot);
  const shapes = [
    ...frameCorners(m, 12.8, 8.8, 8.0, C.black, C.rbrown),
    box(0.8, 2, 8, [6.4, 1, 0], { color: C.green }),
    box(0.8, 2, 8, [-6.4, 1, 0], { color: C.green }),
    box(12, 2, 0.8, [0, 1, -4.4], { color: C.bgreen }),
    box(12, 0.9, 0.8, [0, 0.45, 4.4], { color: C.dgray }),
    box(12, 0.6, 0.6, [0, 8, 0], { color: C.rbrown }),
    box(12, 0.5, 4, [0, 3.0, -2.2], { color: C.brown }),
    ...[-4.5, -1.5, 1.5, 4.5].map((x) => box(0.5, 2.5, 0.5, [x, 6.4, -4.4], { color: C.rbrown, collide: false })),
    foliage(0.9, [-5.2, 3.9, -3.2], { color: C.bgreen }),
  ];
  const station = m.body('station', { type: 'fixed', shapes });
  m.decorate(station, DT.m14Detail());
  return {
    id: 'm14',
    dock,
    observe(ctx) {
      let inN = 0;
      let matN = 0;
      for (const id of seedIds) {
        if (ctx.removed(id)) continue;
        const l = ctx.toModel('m14', ctx.pose(id).p);
        const inside = Math.abs(l[0]) < 6.0 && Math.abs(l[2]) < 4.0 && l[1] > -0.5 && l[1] < 8.4;
        if (inside) {
          inN++;
          if (ctx.touching(id, 'MAT')) matN++;
        }
      }
      return { m14_in: inN, m14_mat: matN };
    },
    station: station.id,
  };
}

function m15(scene, dock) {
  const D = DOCKS[dock];
  const m = scene.model('m15', D.pos, D.rot);
  const bld = m.body('building', {
    type: 'fixed',
    shapes: [...hidden([
      box(13, 0.6, 11, [0, 0.3, 0], { color: C.dgray }),
      box(13, 9.4, 0.8, [0, 5.3, -5.1], { color: C.lime }),
      box(0.8, 9.4, 11, [-6.1, 5.3, 0], { color: C.green }),
      box(0.8, 9.4, 11, [6.1, 5.3, 0], { color: C.tan }),
      box(7.5, 9.4, 0.8, [-2.75, 5.3, 5.1], { color: C.lime }),
      box(5.5, 5.4, 0.8, [3.75, 7.3, 5.1], { color: C.ygreen }),
      box(1, 4, 0.8, [6.0, 2.6, 5.1], { color: C.ygreen }),
      box(13, 0.8, 11, [0, 10.4, 0], { color: C.tan }),
      box(2.4, 2.4, 0.2, [-3.5, 6.5, 5.55], { color: C.azure, collide: false }),
      box(2.4, 2.4, 0.2, [-0.5, 6.5, 5.55], { color: C.azure, collide: false }),
      box(0.2, 2.4, 2.4, [6.55, 6.5, 0], { color: C.azure, collide: false }),
      foliage(1.0, [-5, 11.6, 3.5], { color: C.bgreen }),
      foliage(0.8, [-1.5, 11.5, 4.2], { color: C.green }),
      box(3, 0.5, 3, [-1, 11.05, 3.0], { color: C.bgreen, collide: false }),
      box(0.6, 0.8, 2.5, [-5.4, 7.0, 6.75], { color: C.dgray }),
    ]), ...DT.m15Building()],
  });
  const CP = [-3, 11.05, -5.0];
  const canopy = m.body('canopy', {
    at: CP,
    shapes: [...hidden([box(6, 0.5, 5, [-3, 11.05, -2.5], { color: C.black }), box(1.2, 1.0, 1.2, [-3.5, 11.8, -1.2], { color: C.mblue, collide: false }), cone(0.4, 0.6, [-3.5, 12.4, -0.6], { color: C.orange, rot: [90, 0, 0] })]), ...DT.m15Canopy()],
  });
  const jCan = m.revolute('canopyHinge', bld, canopy, CP, [1, 0, 0], { limits: [-1.4, 0.02], friction: 0.05 });
  // canopy lever hangs from a bracket 2.5 cm in front of the wall so a robot can swing it
  const LP = [-4.5, 7.0, 8.0];
  const lever = m.body('lever', { at: LP, shapes: [...hidden([bar(LP, [-4.5, 3.6, 8.0], 0.8, 0.8, { color: C.dgray }), box(2.6, 2.6, 0.6, [-4.5, 3.4, 8.0], { color: C.red }), cyl(0.45, 1.4, LP, { axis: 'x', color: C.dgray })]), ...DT.m15Lever()] });
  const jLev = m.revolute('leverHinge', bld, lever, LP, [1, 0, 0], { limits: [-0.02, 0.9], spring: { target: 0, ...SPRING } });
  const SKY = [3, 11.2, 7.0];
  const sky = m.body('skylight', {
    at: SKY,
    shapes: [...hidden([
      box(5, 0.8, 0.8, [3, 11.2, 9.1], { color: C.red }),
      box(5, 0.8, 0.8, [3, 11.2, 4.9], { color: C.red }),
      box(0.8, 0.8, 5, [5.1, 11.2, 7.0], { color: C.red }),
      box(0.8, 0.8, 5, [0.9, 11.2, 7.0], { color: C.red }),
      box(3.4, 0.15, 3.4, [3, 11.2, 7.0], { color: '#bfe8f2', collide: false }),
    ]), ...DT.m15Skylight()],
  });
  const jSky = m.prismatic('skylightSlide', bld, sky, SKY, [0, 0, 1], { limits: [-5.0, 0.02], friction: 0.8 });
  const HP = [3.25, 0.25, 5.35];
  const hatch = m.body('hatch', { at: HP, shapes: [...hidden([box(4.3, 3.8, 0.5, [3.25, 2.15, 5.35], { color: '#4a2e1c' }), box(1.2, 0.5, 0.4, [3.25, 3.4, 5.7], { color: C.dgray, collide: false })]), ...DT.m15Hatch()] });
  const jHatch = m.revolute('hatchHinge', bld, hatch, HP, [1, 0, 0], { limits: [-0.02, 1.62], friction: 0.02 });
  const BP = [5.8, 6.0, 5.9];
  const btn = m.body('button', { at: BP, shapes: [...hidden([box(1.4, 1.6, 1.6, [5.8, 6.0, 6.3], { color: C.red })]), ...DT.m15Button()] });
  const jBtn = m.prismatic('buttonSlide', bld, btn, BP, [0, 0, 1], { limits: [-1.2, 0.02], spring: { target: 0, stiffness: 80, damping: 8, maxForce: 2e4 } });
  const dockIndex = { mine: 0, city: 1, farm: 2 }[dock];
  return {
    id: 'm15',
    dock,
    behavior(ctx) {
      const st = ctx.state;
      if (ctx.time > 0.5) st.c = Math.max(st.c || 0, clamp((ctx.angle(jLev.id) - 0.12) / 0.55, 0, 1));
      if (st.c > 0.02) ctx.motorPos(jCan.id, -1.2 * st.c, HOLD.stiffness, HOLD.damping, HOLD.maxForce);
      if (!st.released && ctx.slide(jBtn.id) < -0.7) { st.released = true; st.t0 = ctx.time; ctx.wake(hatch.id); }
      if (!st.released) ctx.motorPos(jHatch.id, 0, LATCH.stiffness, LATCH.damping, LATCH.maxForce);
      else if (ctx.time - st.t0 < 0.3) ctx.motorVel(jHatch.id, 2.5, 50, 3e4);
      else ctx.motorOff(jHatch.id);
    },
    observe(ctx) {
      return {
        m15_canopy: ctx.angle(jCan.id) <= -0.6 && !ctx.touching(canopy.id, 'EQUIP'),
        m15_skylight: ctx.slide(jSky.id) <= -4.8 && !ctx.touching(sky.id, 'EQUIP'),
        m15_hatch: ctx.angle(jHatch.id) >= 1.35 && ctx.touching(hatch.id, 'MAT') && !ctx.touching(hatch.id, 'EQUIP'),
        m15_dock: dockIndex,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Keystone species (team equipment, starts in the left launch area)
// ---------------------------------------------------------------------------------------------
export function addKeystone(scene, at = [-93, 51], rotDeg = 30) {
  const m = scene.model('equip', at, rotDeg);
  m.body('keystone', {
    group: GROUP.EQUIP,
    loose: true,
    at: [0, 1.2, 0],
    shapes: [
      box(4, 1.6, 3, [0, 0.8, 0], { color: C.pink, density: 0.0012 }),
      box(2.4, 1.6, 2.2, [0, 2.4, 0.2], { color: C.azure, density: 0.0012 }),
      ball(0.9, [0, 3.6, 1.0], { color: C.bgreen, collide: false }),
      ball(0.25, [0.4, 3.9, 1.8], { color: C.black, collide: false }),
      ball(0.25, [-0.4, 3.9, 1.8], { color: C.black, collide: false }),
      capsule(0.3, 2.2, [0, 1.4, -2.4], { color: C.magenta, rot: [60, 0, 0], collide: false }),
      box(4.6, 0.3, 1.2, [0, 1.8, 0], { color: C.green, collide: false, rot: [0, 20, 0] }),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function buildField(cfg = {}) {
  const scene = new SceneDesc();
  const missions = [];
  buildTable(scene);
  missions.push(m01(scene));
  const s2 = m02(scene);
  missions.push(s2);
  missions.push(m03(scene));
  missions.push(m04(scene, cfg));
  missions.push(m05(scene));
  missions.push(...m06m07(scene));
  const tree = m08m09(scene);
  missions.push(...tree);
  missions.push(m10(scene));
  missions.push(m11(scene));
  missions.push(m12(scene));
  const docks = { ...{ farm: 'm13', mine: 'm14', city: 'm15' }, ...(cfg.docks || {}) };
  const seedIds = [...s2.seeds, ...tree[1].seeds];
  for (const [dock, model] of Object.entries(docks)) {
    if (model === 'm13') missions.push(m13(scene, dock));
    if (model === 'm14') missions.push(m14(scene, dock, seedIds));
    if (model === 'm15') missions.push(m15(scene, dock));
  }
  // the team's keystone animal (needed only to score M13) is left off the field unless asked for
  if (cfg.keystone) addKeystone(scene, cfg.keystoneAt, cfg.keystoneRot);
  return { scene, missions, frames: modelFrames(scene) };
}

function modelFrames(scene) {
  // Each body stores world pos of its model-local origin `local`; recover the model origin.
  const out = {};
  for (const b of scene.bodies) {
    if (out[b.model]) continue;
    const v = new Vector3(...b.local).applyQuaternion(new Quaternion(...b.rot));
    out[b.model] = { origin: [b.pos[0] - v.x, b.pos[1] - v.y, b.pos[2] - v.z], rot: b.rot };
  }
  return out;
}

export const MISSION_ORDER = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15'];
