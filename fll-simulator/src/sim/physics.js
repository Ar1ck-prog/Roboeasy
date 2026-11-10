// Rapier world built from a scene description (see src/shared/scene.js).
// Units: cm, kg, s. Gravity 981 cm/s^2.

import RAPIER from '@dimforge/rapier3d-simd-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP } from '../shared/scene.js';

export const DT = 1 / 200;
const ALL = 0xffff;
// Soft contacts let a resting tyre sink ~0.15 mm into the mat, which makes it roll on a slightly
// smaller radius (-0.32 % distance per turn). Tyre colliders are enlarged by this amount so one
// wheel turn covers exactly pi * diameter, like a real SPIKE Prime wheel (see scripts/drive-check.mjs).
export const TIRE_SINK_CM = 0.009;

let rapierReady = null;
export function initRapier() {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

function groupsFor(member) {
  const filter = member === GROUP.ROBOT ? ALL & ~GROUP.ROBOT : ALL;
  return ((member & 0xffff) << 16) | filter;
}

const tmpQ = new Quaternion();
const tmpQ2 = new Quaternion();
const tmpV = new Vector3();

export class PhysicsWorld {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -981, z: 0 });
    this.world.timestep = DT;
    this.world.lengthUnit = 100;
    this.world.numSolverIterations = 4;
    // extra friction iterations: with the default (1) tyres creep on the mat (-1.6 % distance and
    // several degrees of drift per metre); 8 keeps wheel rotations and travelled distance 1:1
    this.world.integrationParameters.numInternalPgsIterations = 8;
    // speculative contacts start 0.5 cm away (default 2 cm): small hooks and loops would otherwise collide in mid-air
    this.world.integrationParameters.normalizedPredictionDistance = 0.005;
    this.bodies = new Map(); // id -> { rb, desc, colliders: [] }
    this.order = []; // body ids in snapshot order
    this.joints = new Map(); // id -> { j, desc, kind, angle, prevRaw }
    this.colInfo = new Map(); // collider handle -> { body, tag, color, group }
    this.removed = new Set();
    this.matHandles = new Set();
    this.time = 0;
    this.step = 0;
  }

  free() {
    try { this.world.free(); } catch { /* already freed */ }
  }

  addBody(desc, poseOverride) {
    const R = RAPIER;
    const type = desc.type === 'fixed' ? R.RigidBodyDesc.fixed() : desc.type === 'kinematic' ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.dynamic();
    const pos = poseOverride?.pos || desc.pos;
    const rot = poseOverride?.rot || desc.rot;
    type.setTranslation(pos[0], pos[1], pos[2]).setRotation({ x: rot[0], y: rot[1], z: rot[2], w: rot[3] });
    if (desc.type !== 'fixed') {
      type.setLinearDamping(desc.damping?.[0] ?? 0.05).setAngularDamping(desc.damping?.[1] ?? 0.05);
      type.setCcdEnabled(!!desc.ccd);
      // sleeping bodies are not always woken by kinematic/robot contacts -> keep everything awake
      type.setCanSleep(false);
      if (desc.gravity !== undefined && desc.gravity !== 1) type.setGravityScale(desc.gravity);
    }
    const rb = this.world.createRigidBody(type);
    const entry = { rb, desc, colliders: [], index: this.order.length };
    const groups = groupsFor(desc.group || GROUP.MODEL);
    for (const s of desc.shapes) {
      if (!s.collide) continue;
      for (const cd of this.colliderDescs(s)) {
        cd.setCollisionGroups(groups);
        cd.setFriction(s.friction ?? 0.6);
        cd.setRestitution(s.restitution ?? 0.02);
        if (s.mass !== undefined) cd.setMass(s.mass / (cd.__split || 1));
        else cd.setDensity(s.density ?? 0.0004);
        if (s.friction !== undefined && s.friction < 0.1) cd.setFrictionCombineRule(R.CoefficientCombineRule.Min);
        if (s.tag === 'tire') cd.setFrictionCombineRule(R.CoefficientCombineRule.Max);
        const col = this.world.createCollider(cd, rb);
        entry.colliders.push(col);
        this.colInfo.set(col.handle, { body: desc.id, tag: s.tag || null, color: s.color || '#888888', group: desc.group || GROUP.MODEL });
        if (s.tag === 'mat') this.matHandles.add(col.handle);
      }
    }
    if (entry.colliders.length === 0 && desc.type !== 'fixed') {
      // massless dynamic bodies are not allowed: tiny sensor-less ball inside
      const cd = R.ColliderDesc.ball(0.1).setMass(0.0005).setCollisionGroups((GROUP.MODEL << 16) | 0);
      const col = this.world.createCollider(cd, rb);
      entry.colliders.push(col);
      this.colInfo.set(col.handle, { body: desc.id, tag: null, color: '#888888', group: desc.group });
    }
    this.bodies.set(desc.id, entry);
    this.order.push(desc.id);
    return entry;
  }

  colliderDescs(s) {
    const R = RAPIER;
    const out = [];
    const q = s.q || [0, 0, 0, 1];
    const place = (cd, at, quat) => {
      cd.setTranslation(at[0], at[1], at[2]);
      cd.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] });
      return cd;
    };
    if (s.kind === 'box') out.push(place(s.round ? R.ColliderDesc.roundCuboid(Math.max(0.01, s.size[0] / 2 - 0.05), Math.max(0.01, s.size[1] / 2 - 0.05), Math.max(0.01, s.size[2] / 2 - 0.05), 0.05) : R.ColliderDesc.cuboid(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2), s.at, q));
    else if (s.kind === 'cyl') {
      const br = Math.min(0.12, s.r * 0.25, s.h * 0.25);
      const r = s.tag === 'tire' ? s.r + TIRE_SINK_CM : s.r;
      out.push(place(R.ColliderDesc.roundCylinder(Math.max(0.01, s.h / 2 - br), Math.max(0.01, r - br), br), s.at, q));
    } else if (s.kind === 'ball') out.push(place(R.ColliderDesc.ball(s.r), s.at, q));
    else if (s.kind === 'capsule') out.push(place(R.ColliderDesc.capsule(s.len / 2, s.r), s.at, q));
    else if (s.kind === 'cone') out.push(place(R.ColliderDesc.cone(s.h / 2, s.r), s.at, q));
    else if (s.kind === 'torus') {
      // ring of capsules in the local XZ plane
      const n = 8;
      const Q = new Quaternion(...q);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const p0 = new Vector3(Math.cos(a0) * s.R, 0, Math.sin(a0) * s.R);
        const p1 = new Vector3(Math.cos(a1) * s.R, 0, Math.sin(a1) * s.R);
        const mid = p0.clone().add(p1).multiplyScalar(0.5).applyQuaternion(Q).add(new Vector3(...s.at));
        const d = p1.clone().sub(p0);
        const len = d.length();
        const cq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
        const fq = Q.clone().multiply(cq);
        const cd = place(R.ColliderDesc.capsule(len / 2, s.r), [mid.x, mid.y, mid.z], [fq.x, fq.y, fq.z, fq.w]);
        cd.__split = n;
        out.push(cd);
      }
    }
    return out;
  }

  addJoint(jd) {
    const R = RAPIER;
    const A = this.bodies.get(jd.a);
    const B = this.bodies.get(jd.b);
    if (!A || !B) throw new Error('joint bodies missing ' + jd.id);
    const v = (p) => ({ x: p[0], y: p[1], z: p[2] });
    let data;
    if (jd.kind === 'revolute') data = R.JointData.revolute(v(jd.anchorA), v(jd.anchorB), v(jd.axis));
    else if (jd.kind === 'prismatic') data = R.JointData.prismatic(v(jd.anchorA), v(jd.anchorB), v(jd.axis));
    else if (jd.kind === 'fixed') data = R.JointData.fixed(v(jd.anchorA), { x: 0, y: 0, z: 0, w: 1 }, v(jd.anchorB), { x: 0, y: 0, z: 0, w: 1 });
    else if (jd.kind === 'rope') data = R.JointData.rope(jd.length, v(jd.anchorA), v(jd.anchorB));
    if ((jd.kind === 'revolute' || jd.kind === 'prismatic') && jd.limits) {
      data.limitsEnabled = true;
      data.limits = jd.limits;
    }
    const j = this.world.createImpulseJoint(data, A.rb, B.rb, true);
    j.setContactsEnabled(!!jd.contacts);
    // rapier.js ignores JointData.limits for revolute joints at creation time -> set them explicitly
    if ((jd.kind === 'revolute' || jd.kind === 'prismatic') && jd.limits) j.setLimits(jd.limits[0], jd.limits[1]);
    const entry = { j, desc: jd, kind: jd.kind, angle: 0, prevRaw: 0, motorOn: false };
    this.joints.set(jd.id, entry);
    if (jd.kind === 'revolute' || jd.kind === 'prismatic') {
      if (jd.spring) {
        j.configureMotorPosition(jd.spring.target, jd.spring.stiffness, jd.spring.damping);
        if (jd.spring.maxForce) j.setMotorMaxForce(jd.spring.maxForce);
        entry.motorOn = true;
      } else if (jd.friction) {
        j.configureMotorVelocity(0, jd.friction);
        entry.motorOn = true;
      }
    }
    return entry;
  }

  build(desc) {
    for (const b of desc.bodies) this.addBody(b);
    for (const j of desc.joints) this.addJoint(j);
  }

  // ---- joint state ----
  rawJointValue(e) {
    const A = this.bodies.get(e.desc.a).rb;
    const B = this.bodies.get(e.desc.b).rb;
    const qa = A.rotation();
    const qb = B.rotation();
    if (e.kind === 'revolute') {
      tmpQ.set(qa.x, qa.y, qa.z, qa.w).invert();
      tmpQ2.set(qb.x, qb.y, qb.z, qb.w);
      tmpQ.multiply(tmpQ2);
      const ax = e.desc.axis;
      const s = tmpQ.x * ax[0] + tmpQ.y * ax[1] + tmpQ.z * ax[2];
      // 2*atan2 lies in (-2pi, 2pi]; wrap to (-pi, pi] so unwrapping only ever sees 2pi jumps
      let a = 2 * Math.atan2(s, tmpQ.w);
      if (a > Math.PI) a -= 2 * Math.PI;
      else if (a <= -Math.PI) a += 2 * Math.PI;
      return a;
    }
    if (e.kind === 'prismatic') {
      const pa = A.translation();
      const pb = B.translation();
      const wa = tmpV.set(...e.desc.anchorA).applyQuaternion(tmpQ.set(qa.x, qa.y, qa.z, qa.w)).add(new Vector3(pa.x, pa.y, pa.z));
      const wb = new Vector3(...e.desc.anchorB).applyQuaternion(tmpQ2.set(qb.x, qb.y, qb.z, qb.w)).add(new Vector3(pb.x, pb.y, pb.z));
      const axis = new Vector3(...e.desc.axis).applyQuaternion(tmpQ);
      return wb.sub(wa).dot(axis);
    }
    return 0;
  }

  /** Update unwrapped joint angles; call once per step after world.step(). */
  updateJoints() {
    for (const e of this.joints.values()) {
      if (e.removed) continue;
      const raw = this.rawJointValue(e);
      if (e.kind === 'revolute') {
        let d = raw - e.prevRaw;
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        e.angle += d;
        e.prevRaw = raw;
      } else e.angle = raw;
    }
  }

  jointValue(id) {
    const e = this.joints.get(id);
    return e ? e.angle : 0;
  }

  jointVelocity(id) {
    const e = this.joints.get(id);
    if (!e || e.kind !== 'revolute') return 0;
    const A = this.bodies.get(e.desc.a).rb;
    const B = this.bodies.get(e.desc.b).rb;
    const wa = A.angvel();
    const wb = B.angvel();
    const q = A.rotation();
    const axis = tmpV.set(...e.desc.axis).applyQuaternion(tmpQ.set(q.x, q.y, q.z, q.w));
    return (wb.x - wa.x) * axis.x + (wb.y - wa.y) * axis.y + (wb.z - wa.z) * axis.z;
  }

  removeJoint(id) {
    const e = this.joints.get(id);
    if (!e || e.removed) return;
    this.world.removeImpulseJoint(e.j, true);
    e.removed = true;
  }

  // ---- stepping ----
  stepWorld() {
    this.world.step();
    this.time += DT;
    this.step++;
    this.updateJoints();
  }

  snapshot(out) {
    const n = this.order.length;
    const arr = out && out.length === n * 7 ? out : new Float32Array(n * 7);
    for (let i = 0; i < n; i++) {
      const e = this.bodies.get(this.order[i]);
      const t = e.rb.translation();
      const r = e.rb.rotation();
      const o = i * 7;
      if (this.removed.has(e.desc.id)) { arr[o] = 0; arr[o + 1] = -500; arr[o + 2] = 0; }
      else { arr[o] = t.x; arr[o + 1] = t.y; arr[o + 2] = t.z; }
      arr[o + 3] = r.x; arr[o + 4] = r.y; arr[o + 5] = r.z; arr[o + 6] = r.w;
    }
    return arr;
  }

  // ---- queries ----
  pose(id) {
    const e = this.bodies.get(id);
    const t = e.rb.translation();
    const r = e.rb.rotation();
    return { p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
  }

  toWorld(id, local) {
    const e = this.bodies.get(id);
    const t = e.rb.translation();
    const r = e.rb.rotation();
    const v = new Vector3(...local).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
    return [v.x + t.x, v.y + t.y, v.z + t.z];
  }

  axisWorld(id, local) {
    const r = this.bodies.get(id).rb.rotation();
    const v = new Vector3(...local).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
    return [v.x, v.y, v.z];
  }

  aabb(id) {
    const e = this.bodies.get(id);
    const t = e.rb.translation();
    const r = e.rb.rotation();
    const Q = new Quaternion(r.x, r.y, r.z, r.w);
    const T = new Vector3(t.x, t.y, t.z);
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const s of e.desc.shapes) {
      if (!s.collide) continue;
      const ext = s.kind === 'box' ? s.size.map((v) => v / 2) : s.kind === 'torus' ? [s.R + s.r, s.r, s.R + s.r] : s.kind === 'cyl' ? [s.r, s.h / 2, s.r] : s.kind === 'capsule' ? [s.r, s.len / 2 + s.r, s.r] : [s.r, s.r, s.r];
      const sq = new Quaternion(...(s.q || [0, 0, 0, 1]));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const v = new Vector3(sx * ext[0], sy * ext[1], sz * ext[2]).applyQuaternion(sq).add(new Vector3(...s.at)).applyQuaternion(Q).add(T);
        mn[0] = Math.min(mn[0], v.x); mn[1] = Math.min(mn[1], v.y); mn[2] = Math.min(mn[2], v.z);
        mx[0] = Math.max(mx[0], v.x); mx[1] = Math.max(mx[1], v.y); mx[2] = Math.max(mx[2], v.z);
      }
    }
    return [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
  }

  /** Is any collider of body `id` within `tol` cm of a collider matching pred(colliderInfo)? */
  bodyTouches(id, pred, tol = 0.15) {
    const e = this.bodies.get(id);
    if (!e || this.removed.has(id)) return false;
    let hit = false;
    for (const col of e.colliders) {
      this.world.contactPairsWith(col, (other) => {
        if (hit) return;
        const info = this.colInfo.get(other.handle);
        if (!info || info.body === id || this.removed.has(info.body) || !pred(info, other)) return;
        // exact signed distance between the two shapes (manifold contactDist is not a surface gap)
        const c = col.contactCollider(other, tol);
        if (c && c.distance < tol) hit = true;
      });
      if (hit) break;
    }
    return hit;
  }

  /** Total normal force (in N) on a collider from non-robot colliders. */
  colliderForce(col) {
    let imp = 0;
    this.world.contactPairsWith(col, (other) => {
      const info = this.colInfo.get(other.handle);
      if (!info || info.group === GROUP.ROBOT) return;
      this.world.contactPair(col, other, (manifold) => {
        const n = manifold.numContacts();
        for (let i = 0; i < n; i++) imp += manifold.contactImpulse(i);
      });
    });
    return imp / DT / 100; // kg*cm/s^2 -> N
  }

  /** Take a body (with its colliders and joints) out of the world completely, e.g. to swap the robot. */
  deleteBody(id) {
    const e = this.bodies.get(id);
    if (!e) return;
    for (const [jid, je] of this.joints) {
      if (je.desc.a !== id && je.desc.b !== id) continue;
      if (!je.removed) this.world.removeImpulseJoint(je.j, true);
      this.joints.delete(jid);
    }
    for (const c of e.colliders) { this.colInfo.delete(c.handle); this.matHandles.delete(c.handle); }
    this.world.removeRigidBody(e.rb);
    this.bodies.delete(id);
    this.removed.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.order.forEach((x, i) => { this.bodies.get(x).index = i; });
  }

  removeBody(id) {
    const e = this.bodies.get(id);
    if (!e || this.removed.has(id)) return;
    this.removed.add(id);
    e.rb.setEnabled(false);
  }

  setBodyPose(id, p, q, keepVel = false) {
    const e = this.bodies.get(id);
    e.rb.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    if (q) e.rb.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true);
    if (!keepVel && e.desc.type !== 'fixed') {
      e.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      e.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  castRay(origin, dir, maxToi, excludePred) {
    const ray = new RAPIER.Ray({ x: origin[0], y: origin[1], z: origin[2] }, { x: dir[0], y: dir[1], z: dir[2] });
    const hit = this.world.castRay(ray, maxToi, true, undefined, undefined, undefined, undefined, (col) => {
      const info = this.colInfo.get(col.handle);
      if (!info || this.removed.has(info.body)) return false;
      return !excludePred(info);
    });
    if (!hit) return null;
    const info = this.colInfo.get(hit.collider.handle);
    return { toi: hit.timeOfImpact ?? hit.toi, info, handle: hit.collider.handle };
  }
}
