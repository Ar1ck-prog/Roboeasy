// Robot runtime: SPIKE Prime style motors (speed/position control with torque limits),
// a Pybricks-like DriveBase, colour / distance / force sensors and the hub IMU.
// Motor angles are "physical" degrees: positive = clockwise when looking at the motor output.

import RAPIER from '@dimforge/rapier3d-simd-compat';
import { Quaternion, Vector3 } from 'three';
import { DT } from './physics.js';
import { worldToMatUV } from '../shared/field.js';
import { GROUP } from '../shared/scene.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const KP = 14; // position -> velocity gain (1/s)

export function trapezoid(dist, vmax, acc, dec) {
  dist = Math.abs(dist);
  vmax = Math.max(1e-3, Math.abs(vmax));
  acc = Math.max(1, acc);
  dec = Math.max(1, dec);
  let v = vmax;
  let ta = v / acc;
  let td = v / dec;
  let sa = 0.5 * acc * ta * ta;
  let sd = 0.5 * dec * td * td;
  if (sa + sd > dist) {
    v = Math.sqrt((2 * dist * acc * dec) / (acc + dec));
    ta = v / acc; td = v / dec;
    sa = 0.5 * acc * ta * ta; sd = 0.5 * dec * td * td;
  }
  const tc = v > 0 ? Math.max(0, (dist - sa - sd) / v) : 0;
  const T = ta + tc + td;
  return {
    T,
    at(t) {
      if (t <= 0) return [0, 0];
      if (t < ta) return [0.5 * acc * t * t, acc * t];
      if (t < ta + tc) return [sa + v * (t - ta), v];
      if (t < T) { const u = T - t; return [dist - 0.5 * dec * u * u, dec * u]; }
      return [dist, 0];
    },
  };
}

let cmdSeq = 1;

export class Motor {
  constructor(phys, info) {
    this.phys = phys;
    this.info = info;
    this.port = info.port;
    this.jointId = info.joint;
    this.maxSpeed = info.specs.maxSpeed; // deg/s
    this.stall = info.specs.stall; // torque, kg*cm^2/s^2
    this.kd = this.stall / 2.5;
    this.offset = 0;
    this.mode = 'coast';
    this.cmd = null; // active command { id, ... }
    this.stallTime = 0;
    this.lastCmdV = 0;
    const e = phys.joints.get(this.jointId);
    this.joint = e.j;
    this.joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    this.joint.configureMotorVelocity(0, 0);
    this.defaultAccel = 2000;
  }
  raw() { return -this.phys.jointValue(this.jointId) * R2D; }
  angle() { return this.raw() - this.offset; }
  speed() { return -this.phys.jointVelocity(this.jointId) * R2D; }
  resetAngle(a = 0) { this.offset = this.raw() - a; if (this.mode === 'hold') this.holdAt = this.raw(); }
  stalled() { return this.stallTime > 0.25; }
  newCmd(extra) { this.cmd = { id: cmdSeq++, done: false, ...extra }; return this.cmd.id; }
  finish(then) {
    if (this.cmd) this.cmd.done = true;
    this.applyThen(then);
  }
  applyThen(then) {
    if (then === 'hold') { this.mode = 'hold'; this.holdAt = this.raw(); }
    else if (then === 'brake') this.mode = 'brake';
    else if (then === 'continue') { /* keep running */ }
    else this.mode = 'coast';
  }
  isDone(id) { return !this.cmd || this.cmd.id !== id || this.cmd.done; }

  coast() { this.mode = 'coast'; if (this.cmd) this.cmd.done = true; }
  brake() { this.mode = 'brake'; if (this.cmd) this.cmd.done = true; }
  hold() { this.mode = 'hold'; this.holdAt = this.raw(); if (this.cmd) this.cmd.done = true; }
  /** run forever at speed (deg/s, physical) */
  run(speed, accel) {
    const v = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, speed));
    if (this.mode !== 'speed') { this.vref = this.speed(); this.pref = this.raw(); }
    this.mode = 'speed';
    this.vtarget = v;
    this.accel = accel || this.defaultAccel;
    if (this.cmd) this.cmd.done = true;
    return this.newCmd({ done: true });
  }
  dc(duty) {
    this.mode = 'dc';
    this.duty = Math.max(-100, Math.min(100, duty));
    if (this.cmd) this.cmd.done = true;
  }
  /** move to an absolute physical angle (deg, relative to the reset offset) */
  runTarget(speed, target, then = 'hold', accel, decel) {
    const start = this.raw();
    const goal = target + this.offset;
    const dist = goal - start;
    const prof = trapezoid(dist, Math.min(Math.abs(speed) || 1, this.maxSpeed), accel || this.defaultAccel, decel || accel || this.defaultAccel);
    this.mode = 'profile';
    this.prof = { prof, t0: this.phys.time, start, dir: Math.sign(dist) || 1, then, goal };
    return this.newCmd();
  }
  runAngle(speed, angle, then = 'hold', accel, decel) {
    const dir = Math.sign(speed || 1) * Math.sign(angle || 1);
    return this.runTarget(Math.abs(speed), this.angle() + dir * Math.abs(angle), then, accel, decel);
  }
  runTime(speed, ms, then = 'hold', accel) {
    this.run(speed, accel);
    this.mode = 'speed';
    return this.newCmd({ until: this.phys.time + ms / 1000, then });
  }
  /** follow an externally supplied reference (used by DriveBase / motor pairs) */
  track(pos, vel) {
    this.mode = 'track';
    this.trackPos = pos;
    this.trackVel = vel;
  }

  update(dt) {
    const ang = this.raw();
    const spd = this.speed();
    let vcmd = 0;
    let factor = this.kd;
    let maxF = this.stall * Math.max(0.18, Math.min(1, 1 - Math.abs(spd) / (this.maxSpeed * 1.3)));
    switch (this.mode) {
      // a coasting SPIKE motor is back-drivable but its gearbox has noticeable friction
      case 'coast': vcmd = 0; factor = this.kd * 0.05; maxF = this.stall * 0.08; break;
      case 'brake': vcmd = 0; factor = this.kd * 0.12; maxF = this.stall * 0.35; break;
      case 'hold': vcmd = KP * (this.holdAt - ang); break;
      case 'speed': {
        const a = this.accel * dt;
        this.vref += Math.max(-a, Math.min(a, this.vtarget - this.vref));
        this.pref += this.vref * dt;
        // anti wind-up: do not let the reference run away when blocked
        if (Math.abs(this.pref - ang) > 40) this.pref = ang + Math.sign(this.pref - ang) * 40;
        vcmd = this.vref + KP * (this.pref - ang);
        if (this.cmd && this.cmd.until && !this.cmd.done && this.phys.time >= this.cmd.until) { const then = this.cmd.then; this.cmd.done = true; this.applyThen(then); }
        break;
      }
      case 'profile': {
        const p = this.prof;
        const t = this.phys.time - p.t0;
        const [s, v] = p.prof.at(t);
        const ref = p.start + p.dir * s;
        vcmd = p.dir * v + KP * (ref - ang);
        const blocked = this.stallTime > 0.6;
        if ((t >= p.prof.T && Math.abs(p.goal - ang) < 4) || t >= p.prof.T + 1.5 || (blocked && t > 0.2)) {
          this.finish(p.then);
          if (this.mode === 'hold') this.holdAt = blocked ? ang : p.goal;
        }
        break;
      }
      case 'track': vcmd = this.trackVel + KP * (this.trackPos - ang); break;
      case 'dc': vcmd = (this.duty / 100) * this.maxSpeed * 1.2; factor = this.kd * 0.4; break;
    }
    vcmd = Math.max(-this.maxSpeed * 1.25, Math.min(this.maxSpeed * 1.25, vcmd));
    this.lastCmdV = vcmd;
    this.joint.configureMotorVelocity(-vcmd * D2R, factor);
    this.joint.setMotorMaxForce(maxF);
    // stall detection
    const active = this.mode !== 'coast' && this.mode !== 'brake';
    if (active && Math.abs(vcmd) > 25 && Math.abs(spd) < Math.abs(vcmd) * 0.2) this.stallTime += dt;
    else this.stallTime = Math.max(0, this.stallTime - dt * 2);
  }
}

// ---------------------------------------------------------------------------------------------
export class DriveBase {
  constructor(rt, left, right, dirL, dirR, wheelD, track) {
    this.rt = rt;
    this.L = left;
    this.R = right;
    this.dirL = dirL; // +1 if positive user angle is the physical clockwise direction
    this.dirR = dirR;
    this.D = wheelD; // mm
    this.T = track; // mm
    this.gyro = false;
    this.cfg = { straightSpeed: 250, straightAccel: 750, turnRate: 180, turnAccel: 720 };
    this.move = null;
    // with the gyro, consecutive maneuvers continue from the previous *target* heading (like Pybricks),
    // so a bump during one move is corrected by the next instead of accumulating
    this.hTarget = null;
    this.reset();
  }
  wheel(m, dir) { return (m.angle() * dir * Math.PI * this.D) / 360; }
  rawS() { return (this.wheel(this.L, this.dirL) + this.wheel(this.R, this.dirR)) / 2; }
  rawH() {
    if (this.gyro) return this.rt.imu.heading();
    return ((this.wheel(this.L, this.dirL) - this.wheel(this.R, this.dirR)) / this.T) * R2D;
  }
  reset(distance = 0, angle = 0) {
    this.s0 = this.rawS() - distance;
    this.h0 = this.rawH() - angle;
    this.hTarget = null;
  }
  distance() { return this.rawS() - this.s0; }
  angle() { return this.rawH() - this.h0; }
  settings(o) { Object.assign(this.cfg, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined))); }
  start(kind, sDist, hDeg, then = 'hold', speed) {
    const sL0 = this.wheel(this.L, this.dirL);
    const sR0 = this.wheel(this.R, this.dirR);
    const gyroH0 = this.gyro && this.hTarget !== null ? this.hTarget : this.rt.imu.heading();
    if (this.gyro) this.hTarget = gyroH0 + (kind === 'straight' ? 0 : hDeg);
    let prof;
    if (kind === 'straight') prof = trapezoid(sDist, speed || this.cfg.straightSpeed, this.cfg.straightAccel, this.cfg.straightAccel);
    else prof = trapezoid(hDeg, speed || this.cfg.turnRate, this.cfg.turnAccel, this.cfg.turnAccel);
    const id = cmdSeq++;
    this.move = { id, kind, prof, t0: this.rt.phys.time, sL0, sR0, sDist, hDeg, then, gyroH0, corr: 0, done: false };
    return id;
  }
  straight(d, then, speed) { return this.start('straight', d, 0, then, speed); }
  turn(a, then, speed) { return this.start('turn', 0, a, then, speed); }
  curve(radius, angle, then) {
    const rate = Math.min(this.cfg.turnRate, (this.cfg.straightSpeed / Math.max(1, Math.abs(radius))) * R2D);
    const id = this.start('turn', 0, angle, then, rate);
    this.move.kind = 'curve';
    this.move.radius = radius;
    if (this.gyro) this.hTarget = this.move.gyroH0 + angle * (Math.sign(radius) || 1);
    return id;
  }
  drive(speed, rate) {
    this.hTarget = null;
    const prev = this.move && this.move.kind === 'drive' ? this.move : null;
    this.move = prev || { id: cmdSeq++, kind: 'drive', sL: this.wheel(this.L, this.dirL), sR: this.wheel(this.R, this.dirR), v: 0, w: 0, corr: 0, gyroH: this.rt.imu.heading(), done: true };
    this.move.vt = speed;
    this.move.wt = rate;
  }
  stop() { this.move = null; this.hTarget = null; this.L.coast(); this.R.coast(); }
  brake() { this.move = null; this.hTarget = null; this.L.brake(); this.R.brake(); }
  isDone(id) { return !this.move || this.move.id !== id || this.move.done; }
  stalled() { return this.L.stalled() || this.R.stalled(); }

  wheelTargets(sL, sR, vL, vR) {
    const k = 360 / (Math.PI * this.D);
    this.L.track((sL * k) / this.dirL + this.L.offset, (vL * k) / this.dirL);
    this.R.track((sR * k) / this.dirR + this.R.offset, (vR * k) / this.dirR);
  }

  update(dt) {
    const m = this.move;
    if (!m) return;
    const half = this.T / 2;
    if (m.kind === 'drive') {
      const a = this.cfg.straightAccel * dt;
      m.v += Math.max(-a, Math.min(a, m.vt - m.v));
      const b = this.cfg.turnAccel * dt;
      m.w += Math.max(-b, Math.min(b, m.wt - m.w));
      let corr = 0;
      if (this.gyro) {
        m.gyroH += m.w * dt;
        corr = (m.gyroH - this.rt.imu.heading()) * D2R * half * 0.8;
      }
      const dl = (m.v + m.w * D2R * half) * dt;
      const dr = (m.v - m.w * D2R * half) * dt;
      m.sL += dl;
      m.sR += dr;
      this.wheelTargets(m.sL + corr, m.sR - corr, m.v + m.w * D2R * half, m.v - m.w * D2R * half);
      return;
    }
    if (m.done) return;
    const t = this.rt.phys.time - m.t0;
    const [p, v] = m.prof.at(t);
    let sL; let sR; let vL; let vR;
    if (m.kind === 'straight') {
      const dir = Math.sign(m.sDist) || 1;
      sL = m.sL0 + dir * p; sR = m.sR0 + dir * p;
      vL = vR = dir * v;
      if (this.gyro) {
        const err = (m.gyroH0 - this.rt.imu.heading()) * D2R * half;
        m.corr += (err - m.corr) * Math.min(1, dt * 8);
        sL += m.corr; sR -= m.corr;
      }
    } else {
      // turn: heading change hDeg (clockwise +). curve: angle hDeg along a circle of radius (right turn if radius > 0).
      const sA = Math.sign(m.hDeg) || 1;
      const sRad = m.kind === 'curve' ? Math.sign(m.radius) || 1 : 1;
      const h = sA * sRad * p * D2R;
      const w = sA * sRad * v * D2R;
      const sArc = m.kind === 'curve' ? sA * Math.abs(m.radius) * p * D2R : 0;
      const vArc = m.kind === 'curve' ? sA * Math.abs(m.radius) * v * D2R : 0;
      sL = m.sL0 + sArc + h * half; sR = m.sR0 + sArc - h * half;
      vL = vArc + w * half; vR = vArc - w * half;
      if (this.gyro) {
        const target = m.gyroH0 + h * R2D;
        const err = (target - this.rt.imu.heading()) * D2R * half;
        m.corr += (err - m.corr) * Math.min(1, dt * 8);
        sL += m.corr; sR -= m.corr;
      }
    }
    this.wheelTargets(sL, sR, vL, vR);
    const settled = t >= m.prof.T && Math.abs(this.L.speed()) < 30 && Math.abs(this.R.speed()) < 30;
    if (settled || t >= m.prof.T + 1.5 || (this.stalled() && t > 0.3)) {
      m.done = true;
      if (m.then === 'hold') { this.L.hold(); this.R.hold(); }
      else if (m.then === 'brake') { this.L.brake(); this.R.brake(); }
      else if (m.then === 'coast') { this.L.coast(); this.R.coast(); }
      else { this.L.hold(); this.R.hold(); }
      this.move = { ...m, done: true };
    }
  }
}

// ---------------------------------------------------------------------------------------------
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function classifyColor(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const s = max > 0 ? (max - min) / max : 0;
  let h = 0;
  if (max !== min) {
    if (max === r) h = 60 * ((g - b) / (max - min));
    else if (max === g) h = 60 * (2 + (b - r) / (max - min));
    else h = 60 * (4 + (r - g) / (max - min));
    if (h < 0) h += 360;
  }
  let name;
  if (v < 0.17) name = 'black';
  else if (s < 0.2) name = v > 0.6 ? 'white' : v < 0.32 ? 'black' : 'gray';
  else if (h < 15 || h >= 335) name = v < 0.45 && s > 0.4 ? (h < 15 ? 'brown' : 'red') : 'red';
  else if (h < 42) name = v < 0.5 ? 'brown' : 'orange';
  else if (h < 70) name = 'yellow';
  else if (h < 160) name = 'green';
  else if (h < 195) name = 'azure';
  else if (h < 255) name = 'blue';
  else if (h < 290) name = 'violet';
  else name = 'magenta';
  return { name, h, s: s * 100, v: v * 100 };
}

export class RobotRuntime {
  constructor(phys, compiled, matImage) {
    this.phys = phys;
    this.compiled = compiled;
    this.mat = matImage; // { data, width, height } or null
    this.motors = {};
    for (const m of compiled.motors) if (m.port) this.motors[m.port] = new Motor(phys, m);
    this.sensors = {};
    for (const s of compiled.sensors) if (s.port) this.sensors[s.port] = s;
    this.rootId = compiled.bodies[0].id;
    this.bodyIds = compiled.bodies.map((b) => b.id);
    this.drives = [];
    this.imu = new IMU(this);
    for (const s of compiled.sensors) {
      if (s.type === 'force') {
        const e = phys.bodies.get(s.body);
        // the button collider is tagged 'button'
        s.collider = e.colliders.find((c) => phys.colInfo.get(c.handle)?.tag === 'button') || e.colliders[0];
      }
    }
    this.display = '';
  }
  motor(port) {
    const m = this.motors[port];
    if (!m) throw new Error(`На порту ${port} нет мотора`);
    return m;
  }
  sensor(port, type) {
    const s = this.sensors[port];
    if (!s) throw new Error(`На порту ${port} нет датчика`);
    if (type && s.type !== type) throw new Error(`На порту ${port} другой датчик (${s.type})`);
    return s;
  }
  update(dt) {
    this.imu.update();
    for (const d of this.drives) d.update(dt);
    for (const m of Object.values(this.motors)) m.update(dt);
  }
  stopAll() {
    this.drives.forEach((d) => { d.move = null; });
    for (const m of Object.values(this.motors)) m.coast();
  }

  // ---- sensors ----
  sensorRay(s) {
    const o = this.phys.toWorld(s.body, s.origin);
    const d = this.phys.axisWorld(s.body, s.dir);
    return { o, d };
  }
  readColor(port) {
    const s = this.sensor(port, 'color');
    const { o, d } = this.sensorRay(s);
    const hit = this.phys.castRay(o, d, 6, (info) => info.group === GROUP.ROBOT);
    let rgb = [0, 0, 0];
    let dist = 99;
    if (hit) {
      dist = hit.toi;
      const p = [o[0] + d[0] * dist, o[1] + d[1] * dist, o[2] + d[2] * dist];
      if (hit.info.tag === 'mat' && this.mat) rgb = this.sampleMat(p[0], p[2]);
      else if (hit.info.tag === 'mat') rgb = [0.4, 0.6, 0.35];
      else if (hit.info.tag === 'wall') rgb = [0.08, 0.08, 0.09];
      else rgb = hexToRgb(hit.info.color);
    }
    const k = Math.max(0, Math.min(1, 1 - (dist - 0.9) / 2.6));
    const r = rgb[0] * k;
    const g = rgb[1] * k;
    const b = rgb[2] * k;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const noise = () => (Math.random() - 0.5) * 0.012;
    const reflection = Math.round(Math.max(0, Math.min(100, (lum + noise()) * 100)));
    const cls = k > 0.35 ? classifyColor(r, g, b) : { name: 'none', h: 0, s: 0, v: 0 };
    return { color: cls.name, reflection, ambient: 22 + Math.round(Math.random() * 2), h: Math.round(cls.h), s: Math.round(cls.s), v: Math.round(cls.v), rgb: [r, g, b] };
  }
  sampleMat(x, z) {
    const [u, v] = worldToMatUV(x, z);
    if (u < 0 || u > 1 || v < 0 || v > 1) return [0.22, 0.23, 0.25];
    const { data, width, height } = this.mat;
    const cx = Math.floor(u * (width - 1));
    const cy = Math.floor(v * (height - 1));
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = Math.max(0, Math.min(width - 1, cx + dx));
      const Y = Math.max(0, Math.min(height - 1, cy + dy));
      const i = (Y * width + X) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return [r / n / 255, g / n / 255, b / n / 255];
  }
  readDistance(port) {
    const s = this.sensor(port, 'distance');
    const { o, d } = this.sensorRay(s);
    const D = new Vector3(...d);
    const up = Math.abs(D.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const side = new Vector3().crossVectors(D, up).normalize();
    const up2 = new Vector3().crossVectors(side, D).normalize();
    let best = Infinity;
    for (const [a, b2] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.1], [0, -0.1]]) {
      const dir = D.clone().add(side.clone().multiplyScalar(a)).add(up2.clone().multiplyScalar(b2)).normalize();
      const hit = this.phys.castRay(o, [dir.x, dir.y, dir.z], 200, (info) => info.group === GROUP.ROBOT);
      if (hit) best = Math.min(best, hit.toi);
    }
    if (!isFinite(best) || best > 200) return -1;
    if (best < 4) return 40;
    return Math.round(best * 10 + (Math.random() - 0.5) * 6);
  }
  readForce(port) {
    const s = this.sensor(port, 'force');
    if (!s.collider) return 0;
    const f = this.phys.colliderForce(s.collider);
    s.f = (s.f || 0) * 0.6 + Math.min(10, f) * 0.4;
    return Math.round(s.f * 10) / 10;
  }
  status() {
    const motors = {};
    for (const [p, m] of Object.entries(this.motors)) motors[p] = { angle: Math.round(m.angle()), speed: Math.round(m.speed()), stalled: m.stalled() };
    return { motors, heading: Math.round(this.imu.heading() * 10) / 10, display: this.display };
  }
}

export class IMU {
  constructor(rt) {
    this.rt = rt;
    this.yaw = 0; // unwrapped CCW degrees
    this.prev = null;
    this.zero = 0;
    this.drift = 0;
  }
  raw() {
    const q = this.rt.phys.pose(this.rt.rootId).q;
    const Q = new Quaternion(...q);
    const f = new Vector3(0, 0, -1).applyQuaternion(Q);
    const r = new Vector3(1, 0, 0).applyQuaternion(Q);
    const u = new Vector3(0, 1, 0).applyQuaternion(Q);
    const yaw = Math.atan2(-f.x, -f.z) * R2D;
    const pitch = Math.asin(Math.max(-1, Math.min(1, f.y))) * R2D;
    const roll = Math.atan2(-r.y, u.y) * R2D;
    return { yaw, pitch, roll };
  }
  update() {
    const { yaw, pitch, roll } = this.raw();
    if (this.prev === null) this.prev = yaw;
    let d = yaw - this.prev;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.yaw += d;
    this.prev = yaw;
    this.pitch = pitch;
    this.roll = roll;
  }
  /** Pybricks heading: clockwise positive, continuous */
  heading() { return -(this.yaw - this.zero); }
  resetHeading(a = 0) { this.zero = this.yaw + a; }
}
