// Simulation worker: owns the physics world, the robot runtime, mission logic, match rules and the Python program.

import { Quaternion, Vector3 } from 'three';
import { PhysicsWorld, initRapier, DT } from './physics.js';
import { RobotRuntime, DriveBase } from './robotRuntime.js';
import { buildField } from '../shared/missions.js';
import { compileRobot } from '../shared/robot.js';
import { GROUP } from '../shared/scene.js';
import { emptyAnswers, scoreBreakdown } from '../shared/scoring.js';
import {
  MATCH_TIME, HEIGHT_LIMIT, LAUNCH_R, pointsInHome, pointsInLaunchArea, inHome, HALF_W, HALF_D,
} from '../shared/field.js';
import PY_SIMAPI from './python/_simapi.py?raw';
import PY_RUNLOOP from './python/runloop.py?raw';
import PY_HUB from './python/hub.py?raw';
import PY_COLOR from './python/color.py?raw';
import PY_COLOR_SENSOR from './python/color_sensor.py?raw';
import PY_DISTANCE from './python/distance_sensor.py?raw';
import PY_FORCE from './python/force_sensor.py?raw';
import PY_MOTOR from './python/motor.py?raw';
import PY_MOTOR_PAIR from './python/motor_pair.py?raw';
import PY_PB_INIT from './python/pybricks/__init__.py?raw';
import PY_PB_PARAMS from './python/pybricks/parameters.py?raw';
import PY_PB_TOOLS from './python/pybricks/tools.py?raw';
import PY_PB_HUBS from './python/pybricks/hubs.py?raw';
import PY_PB_DEVICES from './python/pybricks/pupdevices.py?raw';
import PY_PB_ROBOTICS from './python/pybricks/robotics.py?raw';

const PY_FILES = {
  '_simapi.py': PY_SIMAPI, 'runloop.py': PY_RUNLOOP, 'hub.py': PY_HUB, 'color.py': PY_COLOR,
  'color_sensor.py': PY_COLOR_SENSOR, 'distance_sensor.py': PY_DISTANCE, 'force_sensor.py': PY_FORCE,
  'motor.py': PY_MOTOR, 'motor_pair.py': PY_MOTOR_PAIR,
  'pybricks/__init__.py': PY_PB_INIT, 'pybricks/parameters.py': PY_PB_PARAMS, 'pybricks/tools.py': PY_PB_TOOLS,
  'pybricks/hubs.py': PY_PB_HUBS, 'pybricks/pupdevices.py': PY_PB_DEVICES, 'pybricks/robotics.py': PY_PB_ROBOTICS,
};
const PY_MODULES = ['_simapi', 'runloop', 'hub', 'color', 'color_sensor', 'distance_sensor', 'force_sensor', 'motor', 'motor_pair', 'pybricks', 'pybricks.parameters', 'pybricks.tools', 'pybricks.hubs', 'pybricks.pupdevices', 'pybricks.robotics'];

// ---- shared control block (SharedArrayBuffer) ----
// ctrl[0] stop request, ctrl[1] pause, ctrl[2] speed*100 (0 = as fast as possible), ctrl[3] sleep slot
let ctrl = null;
let interruptBuf = null;
const hasSAB = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;

const post = (msg, transfer) => self.postMessage(msg, transfer || []);
const log = (text, kind = 'out') => post({ type: 'console', text, kind });

let phys = null;
let field = null;
let missionStates = {};
let robot = null; // { compiled, rt, pose }
let design = null;
let cfg = { docks: { farm: 'm13', mine: 'm14', city: 'm15' }, opponent: { rootFull: false, mycelium: false } };
let matImage = null;
let pyBase = '';
let pyodide = null;
let pyLoading = null;
let programRunning = false;
let manual = { keys: {}, ports: { left: 'A', right: 'B', arm: 'C', arm2: 'D' } };
let manualDrive = null;
let launchInfo = null;
let costAcc = 0;

const match = {
  phase: 'free', // free | ready | running | ended
  t0: 0,
  tokens: 6,
  insp: false,
  inspText: '',
  side: 'left',
  ended: false,
  endT: 0,
  final: null,
  launches: 0,
};

// ---------------------------------------------------------------------------------------------
// building
// ---------------------------------------------------------------------------------------------
function yawQuat(deg) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (deg * Math.PI) / 180);
  return [q.x, q.y, q.z, q.w];
}

function defaultPose(side = 'left') {
  return side === 'left' ? { x: -HALF_W + 23, z: HALF_D - 15, yaw: 0 } : { x: HALF_W - 23, z: HALF_D - 15, yaw: 0 };
}

function buildAll(opts = {}) {
  if (phys) phys.free();
  phys = new PhysicsWorld();
  const fcfg = { ...cfg, katydid: opts.katydid ?? Math.floor(Math.random() * 3) };
  cfg.katydid = fcfg.katydid;
  field = buildField(fcfg);
  phys.build(field.scene);
  missionStates = {};
  for (const m of field.missions) missionStates[m.id] = {};
  robot = null;
  manualDrive = null;
  if (design) addRobot(opts.pose || defaultPose(match.side));
  // let things settle for a moment
  for (let i = 0; i < 40; i++) simStep(true);
  phys.time = 0;
  sendScene();
}

function addRobot(pose) {
  const compiled = compileRobot(design);
  if (compiled.error) {
    log('Робот не собран: ' + compiled.error, 'err');
    return;
  }
  const rot = yawQuat(pose.yaw);
  for (const b of compiled.bodies) phys.addBody(b, { pos: [pose.x, 0, pose.z], rot });
  for (const j of compiled.joints) phys.addJoint(j);
  robot = { compiled, rt: new RobotRuntime(phys, compiled, matImage), pose, fits: robotFits(compiled) };
}

/** Put on / take off an attachment: rebuild only the robot at its current pose, the field stays as it is. */
function swapRobot(newDesign, label) {
  const fail = (text) => { log(text, 'err'); post({ type: 'swap', ok: false }); };
  if (programRunning) return fail('Насадку нельзя менять, пока работает программа');
  if (robot && match.phase !== 'free' && !robotInHome()) return fail('Насадку можно менять только когда робот на базе (Правило 15) — нажмите Прервать или На старт');
  let pose = defaultPose(match.side);
  if (robot) {
    const p = robotRootPose().p;
    pose = { x: p[0], z: p[2], yaw: currentYaw() };
    for (const id of robot.rt.bodyIds) phys.deleteBody(id);
  }
  const old = design;
  design = newDesign;
  robot = null;
  manualDrive = null;
  addRobot(pose);
  if (!robot) {
    design = old;
    addRobot(pose);
    return fail('Насадка не держится на роботе: ' + (label || ''));
  }
  sendScene();
  post({ type: 'swap', ok: true });
}

/** Does the robot fit (by size) into a launch quarter circle and under the height limit? */
function robotFits(c) {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const [x, z] of c.footprint) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  return Math.hypot(maxX - minX, maxZ - minZ) <= LAUNCH_R && c.height <= HEIGHT_LIMIT;
}

function sendScene() {
  const bodies = phys.order.map((id) => {
    const b = phys.bodies.get(id).desc;
    return { id: b.id, model: b.model, name: b.name, type: b.type, shapes: b.shapes, loose: b.loose, group: b.group };
  });
  post({
    type: 'scene',
    bodies,
    robot: robot ? { bodies: robot.compiled.bodies.map((b) => b.id), motors: robot.compiled.motors.map((m) => ({ port: m.port, type: m.type })), sensors: robot.compiled.sensors.map((s) => ({ port: s.port, type: s.type })), warnings: robot.compiled.analysis.warnings.map((w) => w.text) } : null,
    cfg: { docks: cfg.docks, katydid: cfg.katydid },
  });
  postFrame(true);
  postScore();
}

// ---------------------------------------------------------------------------------------------
// mission context
// ---------------------------------------------------------------------------------------------
function predFor(set) {
  if (set === 'MAT') return (info) => info.tag === 'mat';
  if (set === 'ROBOT') return (info) => info.group === GROUP.ROBOT;
  if (set === 'EQUIP') return (info) => info.group === GROUP.ROBOT || info.group === GROUP.EQUIP;
  const ids = new Set(Array.isArray(set) ? set : [set]);
  return (info) => ids.has(info.body);
}

const ctx = {
  get time() { return phys.time; },
  get step() { return phys.step; },
  get cfg() { return cfg; },
  state: null,
  angle: (id) => phys.jointValue(id),
  slide: (id) => phys.jointValue(id),
  motorPos(id, target, k, d, maxF) {
    const e = phys.joints.get(id);
    if (!e || e.removed) return;
    e.j.configureMotorPosition(target, k, d);
    e.j.setMotorMaxForce(maxF ?? 1e9);
  },
  motorVel(id, v, factor, maxF) {
    const e = phys.joints.get(id);
    if (!e || e.removed) return;
    e.j.configureMotorVelocity(v, factor);
    e.j.setMotorMaxForce(maxF ?? 1e9);
  },
  motorOff(id) {
    const e = phys.joints.get(id);
    if (!e || e.removed) return;
    e.j.configureMotorVelocity(0, e.desc.friction || 0);
    e.j.setMotorMaxForce(1e9);
  },
  removeJoint: (id) => phys.removeJoint(id),
  wake: (id) => phys.bodies.get(id)?.rb.wakeUp(),
  touching(a, b) {
    const pred = predFor(b);
    for (const id of Array.isArray(a) ? a : [a]) if (phys.bodyTouches(id, pred)) return true;
    return false;
  },
  pose: (id) => phys.pose(id),
  toWorld: (id, l) => phys.toWorld(id, l),
  axisWorld: (id, v) => phys.axisWorld(id, v),
  aabb: (id) => phys.aabb(id),
  removed: (id) => phys.removed.has(id),
  has: (id) => phys.bodies.has(id),
  toModel(model, p) {
    const f = field.frames[model];
    const q = new Quaternion(...f.rot).invert();
    const v = new Vector3(p[0] - f.origin[0], p[1] - f.origin[1], p[2] - f.origin[2]).applyQuaternion(q);
    return [v.x, v.y, v.z];
  },
};

function missionBehaviors() {
  for (const m of field.missions) {
    if (!m.behavior) continue;
    ctx.state = missionStates[m.id];
    m.behavior(ctx);
  }
}

function observe() {
  const a = emptyAnswers();
  const warns = [];
  for (const m of field.missions) {
    ctx.state = missionStates[m.id];
    const r = m.observe(ctx, a);
    if (r._warn) warns.push(r._warn);
    Object.assign(a, r);
  }
  // practice mode: the robot's size decides (it may be anywhere); match mode: checked at match start
  a.insp = match.phase === 'free' ? !!robot?.fits : match.insp;
  a.tokens = match.tokens;
  for (const k of Object.keys(a)) if (k.startsWith('_')) delete a[k];
  return { answers: a, warns };
}

function postScore() {
  if (!phys) return;
  const res = match.final || observe();
  const br = scoreBreakdown(res.answers);
  const total = Object.values(br).reduce((x, y) => x + y, 0);
  post({ type: 'score', answers: res.answers, breakdown: br, total, warns: res.warns, final: !!match.final });
}

// ---------------------------------------------------------------------------------------------
// robot geometry helpers
// ---------------------------------------------------------------------------------------------
function robotPoints() {
  const pts = [];
  let top = 0;
  for (const id of robot.rt.bodyIds) {
    const bb = phys.aabb(id);
    pts.push([bb[0], bb[2]], [bb[3], bb[2]], [bb[0], bb[5]], [bb[3], bb[5]]);
    top = Math.max(top, bb[4]);
  }
  return { pts, top };
}

function inspectionCheck() {
  if (!robot) return { ok: false, text: 'Нет робота' };
  const { pts, top } = robotPoints();
  const side = pointsInLaunchArea(pts, 0.3);
  const kb = phys.bodies.has('equip.keystone') && !phys.removed.has('equip.keystone') ? phys.aabb('equip.keystone') : null;
  const kpts = kb ? [[kb[0], kb[2]], [kb[3], kb[2]], [kb[0], kb[5]], [kb[3], kb[5]]] : [];
  const allIn = side && pointsInLaunchArea([...pts, ...kpts], 0.3) === side;
  const ok = !!allIn && top <= HEIGHT_LIMIT;
  const text = ok ? `Робот и оборудование в ${side === 'left' ? 'левой' : 'правой'} зоне запуска, высота ${top.toFixed(1)} см` : !side ? 'Робот не помещается в одну зону запуска' : top > HEIGHT_LIMIT ? `Высота ${top.toFixed(1)} см > 30,5 см` : 'Ключевой вид (оборудование) не в той же зоне запуска';
  return { ok, text, side, height: top };
}

function robotRootPose() {
  return phys.pose(robot.rt.rootId);
}

function currentYaw() {
  const q = new Quaternion(...robotRootPose().q);
  const f = new Vector3(0, 0, -1).applyQuaternion(q);
  return (Math.atan2(-f.x, -f.z) * 180) / Math.PI;
}

/** Move the whole robot (all groups) keeping joint configuration. */
function placeRobot(x, z, yaw, y = null) {
  if (!robot) return;
  const root = robotRootPose();
  const Qr = new Quaternion(...root.q);
  const Pr = new Vector3(...root.p);
  const Qn = new Quaternion(...yawQuat(yaw));
  const Pn = new Vector3(x, y ?? 0.02, z);
  const inv = Qr.clone().invert();
  for (const id of robot.rt.bodyIds) {
    const p = phys.pose(id);
    const relP = new Vector3(...p.p).sub(Pr).applyQuaternion(inv);
    const relQ = inv.clone().multiply(new Quaternion(...p.q));
    const np = relP.applyQuaternion(Qn).add(Pn);
    const nq = Qn.clone().multiply(relQ);
    phys.setBodyPose(id, [np.x, np.y, np.z], [nq.x, nq.y, nq.z, nq.w]);
  }
  robot.pose = { x, z, yaw };
}

function robotInHome() {
  const { pts } = robotPoints();
  return pointsInHome(pts, 0.3);
}

function robotInLaunch() {
  const { pts } = robotPoints();
  return pointsInLaunchArea(pts, 0.3);
}

function looseTouchingRobot() {
  const out = [];
  for (const [id, e] of phys.bodies) {
    if (!e.desc.loose || phys.removed.has(id)) continue;
    if (phys.bodyTouches(id, (info) => info.group === GROUP.ROBOT, 0.2)) out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// stepping
// ---------------------------------------------------------------------------------------------
function manualControl() {
  if (!robot || programRunning) return;
  const k = manual.keys;
  const rt = robot.rt;
  const P = manual.ports;
  const any = Object.values(k).some(Boolean);
  if (!any && !manual.active) return;
  manual.active = any;
  const L = rt.motors[P.left];
  const R = rt.motors[P.right];
  const v = k.slow ? 260 : 620;
  const w = k.slow ? 160 : 360;
  const f = (k.f ? 1 : 0) - (k.b ? 1 : 0);
  const t = (k.r ? 1 : 0) - (k.l ? 1 : 0);
  if (L && R) {
    if (f || t) { L.run(-(f * v + t * w), 3000); R.run(f * v - t * w, 3000); }
    else if (L.mode === 'speed' || R.mode === 'speed') { L.hold(); R.hold(); }
  }
  for (const [port, up, down] of [[P.arm, k.au, k.ad], [P.arm2, k.bu, k.bd]]) {
    const m = rt.motors[port];
    if (!m) continue;
    if (up || down) m.run((down ? 1 : 0) * 300 - (up ? 1 : 0) * 300, 3000);
    else if (m.mode === 'speed') m.hold();
  }
}

function simStep(silent = false) {
  if (robot) robot.rt.update(DT);
  missionBehaviors();
  phys.stepWorld();
  if (!silent) matchTick();
}

function matchTick() {
  if (match.phase === 'running' && !match.ended && phys.time - match.t0 >= MATCH_TIME) {
    match.ended = true;
    match.endT = phys.time;
    if (robot) robot.rt.stopAll();
    log('Матч окончен! Подсчёт очков…', 'info');
  }
  if (match.ended && !match.final && phys.time - match.endT > 0.6) {
    match.final = observe();
    match.phase = 'ended';
    postScore();
    post({ type: 'match', ...matchStatus() });
  }
}

function matchStatus() {
  return {
    phase: match.phase,
    time: match.phase === 'running' || match.phase === 'ended' ? Math.max(0, MATCH_TIME - Math.min(MATCH_TIME, phys.time - match.t0)) : MATCH_TIME,
    tokens: match.tokens,
    insp: match.insp,
    inspText: match.inspText,
    launches: match.launches,
    side: match.side,
  };
}

let lastFrameWall = 0;
let lastScoreWall = 0;
let snapBuf = null;
function postFrame(force = false) {
  const now = performance.now();
  if (!force && now - lastFrameWall < 15) return;
  lastFrameWall = now;
  const arr = phys.snapshot();
  const status = robot ? robot.rt.status() : null;
  post({ type: 'frame', t: phys.time, poses: arr, robot: status, match: matchStatus(), running: programRunning }, [arr.buffer]);
  if (now - lastScoreWall > 220) { lastScoreWall = now; postScore(); }
}

// real-time pacing
let syncWall = 0;
let syncSim = 0;
let lastSpeed = 100;
function speedFactor() {
  return ctrl ? Atomics.load(ctrl, 2) : 100;
}
function resync() {
  syncWall = performance.now();
  syncSim = phys ? phys.time : 0;
}
function sleepMs(ms) {
  if (ms <= 0) return;
  if (ctrl) Atomics.wait(ctrl, 3, 0, ms);
  else { const end = performance.now() + ms; while (performance.now() < end) { /* busy wait */ } }
}
function pace() {
  const sp = speedFactor();
  if (sp !== lastSpeed) { lastSpeed = sp; resync(); }
  if (sp > 0) {
    const target = syncWall + ((phys.time - syncSim) * 1000 * 100) / sp;
    const ahead = target - performance.now();
    if (ahead > 1.5) sleepMs(ahead);
    else if (ahead < -250) resync(); // fell behind, do not try to catch up forever
  }
  postFrame();
}

// idle loop (no program running)
let idleTimer = null;
function idleLoop() {
  idleTimer = null;
  if (!phys || programRunning) return;
  const paused = ctrl && Atomics.load(ctrl, 1);
  if (!paused) {
    const sp = speedFactor();
    if (sp !== lastSpeed) { lastSpeed = sp; resync(); }
    const target = sp > 0 ? syncSim + ((performance.now() - syncWall) / 1000) * (sp / 100) : phys.time + DT * 12;
    let n = 0;
    while (phys.time < target && n < 24) {
      manualControl();
      simStep();
      n++;
    }
    if (phys.time < target - 0.25) resync();
  } else resync();
  postFrame();
  idleTimer = setTimeout(idleLoop, 6);
}
function startIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  resync();
  idleTimer = setTimeout(idleLoop, 0);
}

// ---------------------------------------------------------------------------------------------
// Python bridge
// ---------------------------------------------------------------------------------------------
function stopRequested() {
  return ctrl && Atomics.load(ctrl, 0);
}

function pyStep() {
  if (stopRequested()) return 1;
  if (match.ended) return 2;
  while (ctrl && Atomics.load(ctrl, 1)) {
    sleepMs(25);
    postFrame();
    resync();
    if (stopRequested()) return 1;
  }
  simStep();
  pace();
  if (stopRequested()) return 1;
  return match.ended ? 2 : 0;
}

const drives = [];
let pairSeq = 1;
const pairs = new Map();
const motorOf = (p) => robot.rt.motor(p);

const simApi = {
  step: () => pyStep(),
  cost() {
    costAcc += 0.0004;
    if (costAcc >= DT) { costAcc -= DT; return pyStep(); }
    return stopRequested() ? 1 : match.ended ? 2 : 0;
  },
  time_ms: () => (match.phase === 'running' ? (phys.time - match.t0) * 1000 : (phys.time - (launchInfo?.t0 || 0)) * 1000),
  motor_exists: (p) => !!(robot && robot.rt.motors[p]),
  sensor_type: (p) => (robot && robot.rt.sensors[p] ? robot.rt.sensors[p].type : robot && robot.rt.motors[p] ? 'motor' : ''),
  motor_angle: (p) => motorOf(p).raw(),
  motor_rel: (p) => motorOf(p).angle(),
  motor_speed: (p) => motorOf(p).speed(),
  motor_reset: (p, a) => motorOf(p).resetAngle(a || 0),
  motor_run: (p, s, acc) => motorOf(p).run(s, acc || undefined),
  motor_dc: (p, d) => motorOf(p).dc(d * 100),
  motor_run_angle: (p, s, a, then, acc, dec) => motorOf(p).runAngle(s, a, then || 'hold', acc || undefined, dec || undefined),
  motor_run_target: (p, s, t, then, acc, dec) => motorOf(p).runTarget(s, t, then || 'hold', acc || undefined, dec || undefined),
  motor_run_time: (p, s, ms, then, acc) => motorOf(p).runTime(s, ms, then || 'hold', acc || undefined),
  motor_stop(p, mode) {
    const m = motorOf(p);
    if (mode === 'hold') m.hold();
    else if (mode === 'brake') m.brake();
    else m.coast();
  },
  motor_hold_at(p, a) { const m = motorOf(p); m.mode = 'hold'; m.holdAt = a + m.offset; },
  motor_done(p, id) { const m = motorOf(p); return id === -1 ? !m.cmd || m.cmd.done : m.isDone(id); },
  motor_stalled: (p) => motorOf(p).stalled(),
  pair_run(l, r, vl, vr, acc) { motorOf(l).run(vl, acc || undefined); motorOf(r).run(vr, acc || undefined); },
  pair_stop(l, r, mode) { simApi.motor_stop(l, mode); simApi.motor_stop(r, mode); },
  pair_move(l, r, dl, dr, vmax, acc, dec, then) {
    const big = Math.max(Math.abs(dl), Math.abs(dr), 1e-6);
    const kl = Math.abs(dl) / big;
    const kr = Math.abs(dr) / big;
    const A = acc || 1000;
    const D = dec || A;
    const ML = motorOf(l);
    const MR = motorOf(r);
    const il = ML.runTarget(Math.max(1, vmax * kl), ML.angle() + dl, then || 'brake', Math.max(1, A * kl), Math.max(1, D * kl));
    const ir = MR.runTarget(Math.max(1, vmax * kr), MR.angle() + dr, then || 'brake', Math.max(1, A * kr), Math.max(1, D * kr));
    const id = pairSeq++;
    pairs.set(id, () => ML.isDone(il) && MR.isDone(ir));
    return id;
  },
  pair_done: (id) => (pairs.get(id) ? pairs.get(id)() : true),
  drive_new(pl, dl, pr, dr, D, T) {
    const d = new DriveBase(robot.rt, motorOf(pl), motorOf(pr), dl, dr, D, T);
    robot.rt.drives.push(d);
    drives.push(d);
    return drives.length - 1;
  },
  drive_cmd(id, kind, a, b, then) {
    const d = drives[id];
    if (kind === 'straight') return d.straight(a, then);
    if (kind === 'turn') return d.turn(a, then);
    return d.curve(a, b, then);
  },
  drive_done(id, cid) { const d = drives[id]; return cid === -1 ? !d.move || d.move.done : d.isDone(cid); },
  drive_drive: (id, s, r) => drives[id].drive(s, r),
  drive_stop(id, mode) { if (mode === 'brake') drives[id].brake(); else drives[id].stop(); },
  drive_state(id) {
    const d = drives[id];
    const sp = ((d.L.speed() * d.dirL + d.R.speed() * d.dirR) / 2) * Math.PI * d.D / 360;
    const tr = ((d.L.speed() * d.dirL - d.R.speed() * d.dirR) * Math.PI * d.D / 360 / d.T) * 180 / Math.PI;
    return [d.distance(), sp, d.angle(), tr];
  },
  drive_reset: (id, dist, a) => drives[id].reset(dist || 0, a || 0),
  drive_settings(id, ss, sa, tr, ta) {
    const d = drives[id];
    d.settings({ straightSpeed: ss ?? undefined, straightAccel: sa ?? undefined, turnRate: tr ?? undefined, turnAccel: ta ?? undefined });
    return [d.cfg.straightSpeed, d.cfg.straightAccel, d.cfg.turnRate, d.cfg.turnAccel];
  },
  drive_gyro(id, on) { const d = drives[id]; const h = d.angle(); d.gyro = !!on; d.reset(d.distance(), h); },
  drive_stalled: (id) => drives[id].stalled(),
  color(p) {
    const r = robot.rt.readColor(p);
    return [r.color, r.reflection, r.ambient, r.h, r.s, r.v, r.rgb[0], r.rgb[1], r.rgb[2]];
  },
  distance: (p) => robot.rt.readDistance(p),
  force: (p) => robot.rt.readForce(p),
  imu() { const i = robot.rt.imu; return [i.heading(), i.yaw - i.zero, i.pitch || 0, i.roll || 0]; },
  imu_reset(a) { const i = robot.rt.imu; i.zero = i.yaw + (a || 0); },
  // ground-truth pose for debugging programs: [x, z, heading] in cm / degrees (not available on a real robot)
  debug_pose() { const p = phys.pose(robot.rt.rootId).p; return [Math.round(p[0] * 10) / 10, Math.round(p[2] * 10) / 10, Math.round(-currentYaw() * 10) / 10]; },
  display(t) { robot.rt.display = String(t); post({ type: 'hub', display: String(t) }); },
  beep(f, ms) { post({ type: 'hub', beep: [f, ms] }); },
  light() {},
};

async function ensurePython() {
  if (pyodide) return pyodide;
  if (!pyLoading) {
    pyLoading = (async () => {
      post({ type: 'py', state: 'loading' });
      const mod = await import(/* @vite-ignore */ pyBase + 'pyodide.mjs');
      const py = await mod.loadPyodide({
        indexURL: pyBase,
        stdout: (s) => log(s),
        stderr: (s) => log(s, 'err'),
      });
      py.FS.mkdirTree('/sim/pybricks');
      for (const [name, src] of Object.entries(PY_FILES)) py.FS.writeFile('/sim/' + name, src);
      py.runPython("import sys\nsys.path.insert(0, '/sim')");
      py.registerJsModule('_sim', simApi);
      if (interruptBuf) py.setInterruptBuffer(interruptBuf);
      pyodide = py;
      post({ type: 'py', state: 'ready' });
      return py;
    })();
  }
  return pyLoading;
}

async function runProgram(code, name) {
  if (!robot) { log('Нет робота — соберите его в конструкторе', 'err'); return; }
  if (programRunning) return;
  if (match.phase === 'ended') { log('Матч окончен. Нажмите «Новый матч» или «Сброс поля».', 'err'); return; }
  if (match.phase === 'ready' || match.phase === 'running') {
    const side = robotInLaunch();
    if (!side) { log('Запуск запрещён: робот должен полностью находиться в зоне запуска (Правило 14).', 'err'); return; }
  }
  let py;
  try {
    py = await ensurePython();
  } catch (e) {
    log('Не удалось загрузить Python: ' + e.message, 'err');
    post({ type: 'program', state: 'error' });
    return;
  }
  if (match.phase === 'ready') {
    match.phase = 'running';
    match.t0 = phys.time;
    log('Матч начался! 2:30', 'info');
  }
  match.launches++;
  if (ctrl) Atomics.store(ctrl, 0, 0);
  if (interruptBuf) interruptBuf[0] = 0;
  launchInfo = { t0: phys.time, pose: { ...robot.pose, x: robotRootPose().p[0], z: robotRootPose().p[2], yaw: currentYaw() }, with: new Set(looseTouchingRobot()), side: robotInHome() };
  drives.length = 0;
  robot.rt.drives = [];
  pairs.clear();
  costAcc = 0;
  programRunning = true;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  post({ type: 'program', state: 'running', name });
  resync();
  let outcome = 'done';
  const g = py.globals.get('dict')();
  try {
    py.runPython(`import sys\nfor _m in ${JSON.stringify(PY_MODULES)}:\n    sys.modules.pop(_m, None)`);
    g.set('__name__', '__main__');
    py.runPython(code, { globals: g, filename: 'robot.py' });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('SimStop') || msg.includes('KeyboardInterrupt')) {
      outcome = msg.includes('Матч окончен') || match.ended ? 'matchend' : 'stopped';
    } else {
      outcome = 'error';
      log(cleanTraceback(msg), 'err');
    }
  } finally {
    g.destroy();
    programRunning = false;
    if (robot) robot.rt.stopAll();
    if (ctrl) Atomics.store(ctrl, 0, 0);
    if (interruptBuf) interruptBuf[0] = 0;
  }
  const msgs = { done: 'Программа завершена', stopped: 'Программа остановлена', matchend: 'Матч окончен — робот остановлен', error: 'Ошибка в программе' };
  log(msgs[outcome], outcome === 'error' ? 'err' : 'info');
  post({ type: 'program', state: outcome });
  startIdle();
}

function cleanTraceback(msg) {
  const lines = msg.split('\n');
  const out = [];
  let keep = false;
  for (const l of lines) {
    if (l.includes('File "robot.py"')) keep = true;
    if (keep || /^\w*Error|^\w+Exception|Error:/.test(l.trim())) out.push(l);
  }
  const text = (out.length ? out : lines.slice(-4)).join('\n').replace(/File "robot\.py", line (\d+)/g, 'Строка $1');
  return text.trim();
}

// ---------------------------------------------------------------------------------------------
// match actions
// ---------------------------------------------------------------------------------------------
function interrupt() {
  if (!robot) return;
  const home = robotInHome();
  const touching = looseTouchingRobot();
  let outside = !home;
  for (const id of touching) {
    const bb = phys.aabb(id);
    const pts = [[bb[0], bb[2]], [bb[3], bb[2]], [bb[0], bb[5]], [bb[3], bb[5]]];
    if (!pointsInHome(pts, 0.3)) outside = true;
  }
  let lost = false;
  if ((match.phase === 'running' || match.phase === 'ready') && outside && match.tokens > 0) {
    match.tokens--;
    lost = true;
  }
  // objects obtained outside home after the last launch go to the referee
  for (const id of touching) {
    if (launchInfo?.with?.has(id) || id === 'equip.keystone') continue;
    const bb = phys.aabb(id);
    const c = [(bb[0] + bb[3]) / 2, (bb[2] + bb[5]) / 2];
    if (!inHome('left', c[0], c[1]) && !inHome('right', c[0], c[1])) { phys.removeBody(id); log(`Объект ${id} передан судье`, 'info'); }
  }
  robot.rt.stopAll();
  const p = launchInfo?.pose || defaultPose(match.side);
  placeRobot(p.x, p.z, p.yaw);
  log(lost ? 'Прерывание вне базы: −1 жетон точности' : 'Робот возвращён на базу', lost ? 'err' : 'info');
  post({ type: 'match', ...matchStatus() });
  postScore();
}

function startMatch(side) {
  match.side = side || match.side;
  match.phase = 'ready';
  match.tokens = 6;
  match.ended = false;
  match.final = null;
  match.launches = 0;
  launchInfo = null;
  buildAll({ pose: defaultPose(match.side) });
  const insp = inspectionCheck();
  match.insp = insp.ok;
  match.inspText = insp.text;
  log(`Осмотр оборудования: ${insp.ok ? '20 очков' : '0 очков'} — ${insp.text}`, insp.ok ? 'info' : 'err');
  post({ type: 'match', ...matchStatus() });
  startIdle();
}

function freeMode() {
  match.phase = 'free';
  match.ended = false;
  match.final = null;
  match.tokens = 6;
  post({ type: 'match', ...matchStatus() });
}

// ---------------------------------------------------------------------------------------------
// drag & drop from the UI
// ---------------------------------------------------------------------------------------------
let dragState = null;
function drag(msg) {
  if (programRunning) return;
  const { id, x, z, yaw, phase } = msg;
  if (id === 'robot') {
    if (!robot) return;
    if (phase === 'start') dragState = { yaw: robot.pose.yaw };
    const y = yaw ?? robot.pose.yaw;
    placeRobot(x, z, y, 0.6);
    if (phase === 'end') { placeRobot(x, z, y, 0.02); dragState = null; }
    robot.rt.stopAll();
    postFrame(true);
    return;
  }
  const e = phys.bodies.get(id);
  if (!e || e.desc.type === 'fixed' || !e.desc.loose) return;
  const p = phys.pose(id).p;
  const lift = phase === 'end' ? 0 : 3;
  const bb = phys.aabb(id);
  const half = (bb[4] - bb[1]) / 2;
  phys.setBodyPose(id, [x, Math.max(p[1], half + lift * 0.3 + 0.5), z], phase === 'start' || phase === 'end' ? null : null);
  e.rb.wakeUp();
  postFrame(true);
}

// ---------------------------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------------------------
async function loadMat(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const img = g.getImageData(0, 0, bmp.width, bmp.height);
    return { data: img.data, width: bmp.width, height: bmp.height };
  } catch (e) {
    log('Не удалось загрузить текстуру мата для датчика цвета: ' + e.message, 'err');
    return null;
  }
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        if (msg.sab && hasSAB) {
          ctrl = new Int32Array(msg.sab);
          interruptBuf = new Uint8Array(msg.isab);
        }
        pyBase = msg.pyBase;
        await initRapier();
        matImage = await loadMat(msg.matUrl);
        design = msg.design;
        Object.assign(cfg, msg.cfg || {});
        buildAll({ pose: defaultPose('left') });
        post({ type: 'ready', sab: !!ctrl });
        startIdle();
        if (msg.preloadPython) ensurePython().catch(() => {});
        break;
      }
      case 'reset': {
        if (msg.design) design = msg.design;
        if (msg.cfg) Object.assign(cfg, msg.cfg);
        match.final = null;
        match.ended = false;
        if (match.phase !== 'free') { match.phase = 'free'; }
        match.tokens = 6;
        buildAll({ pose: msg.pose || (robot ? robot.pose : defaultPose(match.side)), katydid: msg.katydid });
        post({ type: 'match', ...matchStatus() });
        startIdle();
        break;
      }
      case 'setDesign': {
        design = msg.design;
        buildAll({ pose: robot ? robot.pose : defaultPose(match.side), katydid: cfg.katydid });
        startIdle();
        break;
      }
      case 'swapRobot':
        swapRobot(msg.design, msg.label);
        break;
      case 'run':
        await runProgram(msg.code, msg.name);
        break;
      case 'manual':
        manual.keys = msg.keys || {};
        if (msg.ports) manual.ports = { ...manual.ports, ...msg.ports };
        break;
      case 'place':
        if (robot && !programRunning) { placeRobot(msg.x, msg.z, msg.yaw); robot.rt.stopAll(); postFrame(true); }
        break;
      case 'drag':
        drag(msg);
        break;
      case 'interrupt':
        interrupt();
        break;
      case 'toStart': {
        // technicians may handle the robot freely inside home (rule 12), but not carry it to the other home
        if (!robot || programRunning) break;
        const homeSide = robotInHome();
        if (match.phase !== 'free') {
          if (msg.force) break; // the launch-area selector only moves the robot in free mode
          if (!homeSide) { log('Робот вне базы — сначала «Прервать».', 'err'); break; }
        }
        // free mode: the home the robot stands in, or the chosen one (selector change / outside home)
        const side = match.phase === 'free' ? (msg.force ? msg.side : homeSide || msg.side) || 'left' : homeSide;
        robot.rt.stopAll();
        const p = defaultPose(side);
        placeRobot(p.x, p.z, p.yaw);
        postFrame(true);
        break;
      }
      case 'matchStart':
        startMatch(msg.side);
        break;
      case 'timerStart':
        // referee starts the 2:30 clock before the first launch
        if (match.phase === 'ready') {
          match.phase = 'running';
          match.t0 = phys.time;
          log('Матч начался! 2:30', 'info');
          post({ type: 'match', ...matchStatus() });
        }
        break;
      case 'freeMode':
        freeMode();
        break;
      case 'opponent':
        cfg.opponent = { ...cfg.opponent, ...msg.opponent };
        postScore();
        break;
      case 'loadPython':
        ensurePython().catch((e) => log('Python: ' + e.message, 'err'));
        break;
      case 'debug':
        // development helper: evaluate an expression with access to the simulation state
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-new-func
          const fn = new Function('phys', 'field', 'robot', 'match', 'ctx', 'missionStates', 'simStep', 'simApi', msg.code);
          post({ type: 'debug', id: msg.id, result: JSON.stringify(fn(phys, field, robot, match, ctx, missionStates, simStep, simApi)) });
        }
        break;
      default:
        break;
    }
  } catch (e) {
    log('Ошибка симулятора: ' + (e.stack || e.message), 'err');
  }
};
