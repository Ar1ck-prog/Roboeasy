// Headless 1:1 motion check: drives the default robot on the real field physics and compares the
// distance / heading with what a real SPIKE Prime robot does for the same motor rotations.
// Run: node scripts/drive-check.mjs
import { Quaternion, Vector3 } from 'three';
import { PhysicsWorld, initRapier, DT } from '../src/sim/physics.js';
import { RobotRuntime } from '../src/sim/robotRuntime.js';
import { buildField } from '../src/shared/missions.js';
import { compileRobot, templateDriveBase } from '../src/shared/robot.js';
import { SceneDesc, box, GROUP } from '../src/shared/scene.js';

await initRapier();

const WHEEL_D = 56; // mm, SPIKE Prime 56 mm wheel
const yawOf = (q) => {
  const f = new Vector3(0, 0, -1).applyQuaternion(new Quaternion(...q));
  return (Math.atan2(-f.x, -f.z) * 180) / Math.PI;
};

function setup(opts = {}) {
  const phys = new PhysicsWorld();
  if (opts.iters) phys.world.numSolverIterations = opts.iters;
  if (opts.pgs) phys.world.integrationParameters.numInternalPgsIterations = opts.pgs;
  if (opts.ale) phys.world.integrationParameters.normalizedAllowedLinearError = opts.ale;
  if (opts.nf) phys.world.integrationParameters.contact_natural_frequency = opts.nf;
  if (opts.flat) {
    // open table without mission models (long straight runs), same mat friction as the real field
    const sc = new SceneDesc();
    sc.model('field', [0, 0], 0).body('table', { type: 'fixed', shapes: [box(2000, 2, 2000, [0, -1, 0], { tag: 'mat', friction: 0.95 })], group: GROUP.FIELD });
    phys.build(sc);
  } else phys.build(buildField({ katydid: 0 }).scene);
  const design = templateDriveBase();
  if (opts.big) for (const p of design.parts) if (p.type === 'wheel56') p.type = 'wheel88';
  const compiled = compileRobot(design);
  const pose = opts.pose || { x: -78, z: 42.15 };
  for (const b of compiled.bodies) phys.addBody(b, { pos: [pose.x, 0, pose.z], rot: [0, 0, 0, 1] });
  for (const j of compiled.joints) phys.addJoint(j);
  const rt = new RobotRuntime(phys, compiled, null);
  const step = () => { rt.update(DT); phys.stepWorld(); };
  for (let i = 0; i < 60; i++) step();
  return { phys, rt, step };
}

/** Both wheels `deg` degrees at `speed` deg/s; returns distance (mm), heading change and encoder angles. */
export function straight({ deg = 1440, speed = 400, ...opts } = {}) {
  const { phys, rt, step } = setup(opts);
  const L = rt.motors.A;
  const R = rt.motors.B;
  const p0 = phys.pose(rt.rootId);
  const a0 = [L.angle(), R.angle()];
  const ids = [L.runAngle(speed, -deg), R.runAngle(speed, deg)];
  let n = 0;
  const t0 = performance.now();
  const touched = new Set();
  const look = () => {
    if (!opts.contacts) return;
    for (const id of rt.bodyIds) {
      for (const col of phys.bodies.get(id).colliders) {
        phys.world.contactPairsWith(col, (other) => {
          const info = phys.colInfo.get(other.handle);
          if (!info || info.group === GROUP.ROBOT || info.tag === 'mat') return;
          const c = col.contactCollider(other, 0.05);
          if (c && c.distance < 0.05) touched.add(`${info.body} @${(phys.time).toFixed(2)}s`);
        });
      }
    }
  };
  while (!(L.isDone(ids[0]) && R.isDone(ids[1])) && n < 200 * 120) { step(); look(); n++; }
  for (let i = 0; i < 100; i++) step();
  const ms = (performance.now() - t0) / (n + 100);
  const p1 = phys.pose(rt.rootId);
  const mm = Math.hypot(p1.p[0] - p0.p[0], p1.p[2] - p0.p[2]) * 10;
  const expect = (deg / 360) * Math.PI * (opts.big ? 88 : WHEEL_D);
  return {
    mm: +mm.toFixed(1), expect: +expect.toFixed(1), errPct: +((mm / expect - 1) * 100).toFixed(2),
    yaw: +(yawOf(p1.q) - yawOf(p0.q)).toFixed(2),
    enc: [+(L.angle() - a0[0]).toFixed(1), +(R.angle() - a0[1]).toFixed(1)],
    msPerStep: +ms.toFixed(3),
    ...(opts.contacts ? { touched: [...touched] } : {}),
  };
}

/** Spin in place: wheels in opposite directions by `deg`; returns robot rotation vs the ideal for the measured track. */
export function spin({ deg = 720, speed = 300, ...opts } = {}) {
  const { phys, rt, step } = setup({ flat: 1, ...opts, pose: { x: 0, z: 20 } });
  const L = rt.motors.A;
  const R = rt.motors.B;
  const q0 = phys.pose(rt.rootId).q;
  const tires = [];
  for (const [h, info] of phys.colInfo) if (info.tag === 'tire') tires.push(phys.world.getCollider(h).translation());
  const track = Math.hypot(tires[0].x - tires[1].x, tires[0].z - tires[1].z) * 10;
  const ids = [L.runAngle(speed, deg), R.runAngle(speed, deg)];
  let n = 0;
  let d = 0;
  let prev = yawOf(q0);
  const track1 = () => { const y = yawOf(phys.pose(rt.rootId).q); d += ((y - prev + 540) % 360) - 180; prev = y; };
  while (!(L.isDone(ids[0]) && R.isDone(ids[1])) && n < 200 * 60) { step(); track1(); n++; }
  for (let i = 0; i < 100; i++) { step(); track1(); }
  const expect = (deg * (opts.big ? 88 : WHEEL_D)) / track;
  return { trackMm: +track.toFixed(1), yaw: +d.toFixed(2), expect: +expect.toFixed(2), errPct: +((Math.abs(d) / expect - 1) * 100).toFixed(2) };
}

/** Height of each tyre's centre above the mat at rest (mm) -> how deep the 28 mm tyre sinks in. */
export function sink(opts = {}) {
  const { phys } = setup({ flat: 1, ...opts });
  const out = [];
  for (const [h, info] of phys.colInfo) {
    if (info.tag !== 'tire') continue;
    const c = phys.world.getCollider(h);
    const t = c.translation();
    out.push(+((2.8 - t.y) * 10).toFixed(3));
  }
  return { sinkMm: out };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('drive-check.mjs')) {
  const cases = JSON.parse(process.argv[2] || '[{}]');
  for (const c of cases) console.log(JSON.stringify({ ...c, ...(c.sink ? sink(c) : c.spin ? spin(c) : straight(c)) }));
}
