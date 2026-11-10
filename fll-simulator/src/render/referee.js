// Match judge behind the north wall: a big toy minifigure (yellow smiley head, striped JUDGE t-shirt)
// with the precision tokens on a stand beside it. For each lost token the figure turns to the stand,
// takes the token, holds it up and pockets it. Purely visual (not in the physics scene).
// Units: cm, the figure faces +z (towards the table).

import * as THREE from 'three';

const TOKENS = 6;                        // Robot Game Rulebook: the match starts with 6 precision tokens
const YELLOW = '#f5cd2f';
const SHOULDER = new THREE.Vector3(18, 120, 0);
const GRIP = new THREE.Vector3(3, -32.6, 13);   // centre of the C-hand relative to the shoulder pivot (x mirrored per side)
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...o });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function drawStripes(g, w, h, n) {
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#141519' : '#f6f6f3'; g.fillRect((i * w) / n, 0, w / n + 1, h); }
}

function shirtTex(front) {
  return canvasTex(512, 640, (g, w, h) => {
    drawStripes(g, w, h, 12);
    // black collar
    g.fillStyle = '#141519';
    g.beginPath(); g.moveTo(w * 0.32, 0); g.lineTo(w / 2, h * 0.12); g.lineTo(w * 0.68, 0); g.closePath(); g.fill();
    // JUDGE print on a white band
    const y = front ? h * 0.36 : h * 0.3;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(w * 0.08, y - h * 0.09, w * 0.84, h * 0.18, 26); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#c8102e'; g.stroke();
    g.fillStyle = front ? '#c8102e' : '#141519';
    g.font = `900 ${front ? 120 : 132}px system-ui, Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('JUDGE', w / 2, y + 6);
  });
}

// open-mouth smiley, drawn around the head cylinder (u = 0.5 is the front)
function faceTex() {
  return canvasTex(1024, 262, (g, w) => {
    g.fillStyle = YELLOW; g.fillRect(0, 0, w, 262);
    const cx = w / 2;
    const ink = '#18140f';
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      // eyebrows
      g.lineWidth = 10; g.strokeStyle = ink;
      g.beginPath(); g.arc(cx + s * 50, 92, 30, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
      // eyes with a highlight
      g.fillStyle = ink;
      g.beginPath(); g.ellipse(cx + s * 48, 104, 15, 21, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(cx + s * 48 - 5, 96, 5.5, 0, Math.PI * 2); g.fill();
    }
    // big open smile: black outline, white teeth on top, red mouth and tongue
    const mouth = (k) => {
      g.beginPath();
      g.moveTo(cx - 92 * k, 142);
      g.quadraticCurveTo(cx, 150 + 12 * (1 - k), cx + 92 * k, 142);
      g.quadraticCurveTo(cx + 88 * k, 252 - 28 * (1 - k), cx, 252 - 34 * (1 - k));
      g.quadraticCurveTo(cx - 88 * k, 252 - 28 * (1 - k), cx - 92 * k, 142);
      g.closePath();
    };
    g.fillStyle = ink;
    mouth(1); g.fill();
    g.save();
    mouth(0.86); g.clip();
    g.fillStyle = '#b3141c'; g.fillRect(cx - 100, 130, 200, 130);
    g.fillStyle = '#ffffff'; g.fillRect(cx - 100, 130, 200, 39);
    g.fillStyle = '#e8414b';
    g.beginPath(); g.ellipse(cx + 8, 232, 52, 30, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // dimples at the mouth corners
    g.lineWidth = 6; g.strokeStyle = ink;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 100, 140, 12, s > 0 ? Math.PI * 0.8 : Math.PI * 1.7, s > 0 ? Math.PI * 1.3 : Math.PI * 0.2);
      g.stroke();
    }
  });
}

function mesh(geo, material, pos = [0, 0, 0], parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/** Capsule between two points. */
function rod(a, b, r, material, parent) {
  const d = b.clone().sub(a);
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, d.length()), 6, 16), material, [0, 0, 0], parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  return m;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class Referee {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'referee';
    this.body = new THREE.Group();       // turns as a whole (minifig legs don't bend)
    this.group.add(this.body);
    this.build();
    this.buildStand();
    this.shown = TOKENS;
    this.queue = 0;
    this.anim = null;
    this.lookAt = null;
    this.pose = { psi: 0, th: 0 };
  }

  build() {
    const b = this.body;
    const yellow = mat(YELLOW, { roughness: 0.3 });
    const black = mat('#18191d', { roughness: 0.45 });
    const stripes = mat('#ffffff', { map: canvasTex(256, 64, (g, w, h) => drawStripes(g, w, h, 8)), roughness: 0.45 });

    // legs + hips (black trousers)
    for (const s of [-1, 1]) {
      mesh(new THREE.BoxGeometry(19, 54, 18), black, [s * 10, 35, 0], b);
      mesh(new THREE.BoxGeometry(19, 8, 24), black, [s * 10, 4, 3], b);
    }
    mesh(new THREE.BoxGeometry(40, 12, 20), black, [0, 68, 0], b);

    // torso: tapered block, striped t-shirt with JUDGE on the front and back
    const tg = new THREE.BoxGeometry(40, 52, 20);
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.75);
    tg.computeVertexNormals();
    mesh(tg, [stripes, stripes, stripes, black,
      mat('#ffffff', { map: shirtTex(true), roughness: 0.45 }), mat('#ffffff', { map: shirtTex(false), roughness: 0.45 })], [0, 100, 0], b);

    // head: yellow cylinder with the smiley, rounded top and bottom, stud on top
    const head = new THREE.Group();
    head.position.y = 126;
    b.add(head);
    this.head = head;
    mesh(new THREE.CylinderGeometry(7, 7, 6, 20), yellow, [0, 2.5, 0], head);
    mesh(new THREE.CylinderGeometry(12.5, 12.5, 20, 48, 1, true, Math.PI), mat('#ffffff', { map: faceTex(), roughness: 0.3 }), [0, 15, 0], head);
    for (const [y, up] of [[25, true], [5, false]]) {
      const cap = mesh(new THREE.SphereGeometry(12.5, 48, 10, 0, Math.PI * 2, up ? 0 : Math.PI / 2, Math.PI / 2), yellow, [0, y, 0], head);
      cap.scale.y = 0.3;
    }
    mesh(new THREE.CylinderGeometry(7.5, 7.5, 5, 32), yellow, [0, 29, 0], head);

    // arms: striped short sleeve, yellow forearm, C-shaped hand; they only swing about the shoulder axis
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * SHOULDER.x, SHOULDER.y, 0);
      b.add(shoulder);
      const elbow = new THREE.Vector3(s * 3, -22, 1);
      const wrist = new THREE.Vector3(s * 3, -30, 10);
      rod(new THREE.Vector3(s * -1, 0, 0), new THREE.Vector3(s * 1.5, -12, 0.5), 6.4, stripes, shoulder);
      rod(new THREE.Vector3(s * 1.5, -8, 0.5), elbow, 5.9, yellow, shoulder);
      rod(elbow, wrist, 5.6, yellow, shoulder);
      const hand = new THREE.Group();
      hand.position.set(s * GRIP.x, GRIP.y, GRIP.z);
      hand.rotation.set(0.72, 0, 0);
      shoulder.add(hand);
      const c = mesh(new THREE.TorusGeometry(4.4, 2.3, 12, 24, Math.PI * 1.45), yellow, [0, 0, 0], hand);
      c.rotation.z = Math.PI * 0.4;
      return { s, shoulder, hand, rest: 0 };
    });
    this.arms[1].rest = 0;          // left arm hangs at the side
  }

  buildStand() {
    // high stand at the judge's right (−x) with the tokens in a 3 × 2 tray
    const stand = new THREE.Group();
    stand.position.set(-38, 0, 10);
    this.group.add(stand);
    const grey = mat('#3b3f47', { metalness: 0.5, roughness: 0.45 });
    mesh(new THREE.CylinderGeometry(11, 13, 2, 28), grey, [0, 1, 0], stand);
    mesh(new THREE.CylinderGeometry(2, 2, 94, 14), grey, [0, 49, 0], stand);
    mesh(new THREE.BoxGeometry(22, 2.4, 16), mat('#e9eaee', { roughness: 0.55 }), [0, 96.8, 0], stand);
    for (const [w, d, x, z] of [[22, 1, 0, 8], [22, 1, 0, -8], [1, 16, 11, 0], [1, 16, -11, 0]]) {
      mesh(new THREE.BoxGeometry(w, 2, d), grey, [x, 98.6, z], stand);
    }
    this.stand = stand;

    const geo = new THREE.CylinderGeometry(2.9, 2.9, 1.8, 24);
    const cap = new THREE.CylinderGeometry(1.3, 1.3, 0.6, 16);
    const red = new THREE.MeshStandardMaterial({ color: '#d0121b', roughness: 0.32 });
    this.tokens = Array.from({ length: TOKENS }, (_, i) => {
      const m = mesh(geo, red, [0, 0, 0], stand);
      mesh(cap, red, [0, 1.2, 0], m);      // stud on top
      m.userData.home = new THREE.Vector3(-6.5 + (i % 3) * 6.5, 98.9, i < 3 ? 3.3 : -3.3);
      m.position.copy(m.userData.home);
      return m;
    });
  }

  /** Called with the match token count; lost tokens are taken one by one. */
  setTokens(n) {
    n = Math.max(0, Math.min(TOKENS, n | 0));
    const pending = this.shown - this.queue;   // tokens that stay on the stand once the queue is done
    if (n > pending) { this.reset(n); return; }
    this.queue += pending - n;
  }

  reset(n) {
    this.anim = null;
    this.queue = 0;
    this.shown = n;
    this.tokens.forEach((t, i) => {
      if (t.parent !== this.stand) this.stand.attach(t);
      t.position.copy(t.userData.home);
      t.quaternion.identity();
      t.scale.setScalar(1);
      t.visible = i < n;
    });
  }

  /** World position of the robot, so the judge keeps an eye on it. */
  watch(p) { this.lookAt = p; }

  update(dt) {
    if (!this.anim && this.queue > 0) this.startTake();
    let psi = 0;
    let th = this.arms[0].rest;
    let look = this.lookAt?.clone();
    const a = this.anim;
    if (a) {
      a.t += dt;
      const k = a.keys;
      let i = 0;
      while (i < k.length - 1 && a.t > k[i + 1].at) i++;
      if (i >= k.length - 1) this.finishTake();
      else {
        const f = ease(Math.min(1, (a.t - k[i].at) / (k[i + 1].at - k[i].at)));
        psi = k[i].psi + (k[i + 1].psi - k[i].psi) * f;
        th = k[i].th + (k[i + 1].th - k[i].th) * f;
        if (!a.grabbed && a.t >= a.grabAt) { this.arms[0].hand.attach(a.token); a.grabbed = true; }
        if (a.grabbed) {
          // pokes out of the C-hand so it can be seen while held up
          a.token.position.lerp(new THREE.Vector3(0, 0, 5.5), Math.min(1, dt * 10));
          a.token.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 8));
        }
        if (a.t >= a.pocketAt) a.token.scale.setScalar(Math.max(0.001, 1 - (a.t - a.pocketAt) * 4));
        if (a.t < a.pocketAt) look = this.arms[0].hand.getWorldPosition(new THREE.Vector3());
      }
    }
    const k = this.anim ? 1 : Math.min(1, dt * 6);
    this.pose.psi += (psi - this.pose.psi) * k;
    this.pose.th += (th - this.pose.th) * k;
    this.body.rotation.y = this.pose.psi;
    this.arms[0].shoulder.rotation.x = this.pose.th;
    this.arms[1].shoulder.rotation.x = this.arms[1].rest;
    this.aimHead(look, dt);
  }

  /** Body yaw + right-arm swing that bring the C-hand closest to `target` (judge-local). */
  reach(target) {
    let best = null;
    const g = new THREE.Vector3();
    for (let psi = -1.7; psi <= 1.7; psi += 0.02) {
      for (let th = -2.6; th <= 0.6; th += 0.02) {
        g.set(-GRIP.x, GRIP.y, GRIP.z).applyAxisAngle(X_AXIS, th);
        g.x -= SHOULDER.x;
        g.y += SHOULDER.y;
        g.applyAxisAngle(Y_AXIS, psi);
        const cost = g.distanceTo(target) + 2 * Math.abs(psi);
        if (!best || cost < best.cost) best = { cost, psi, th };
      }
    }
    return best;
  }

  startTake() {
    this.queue--;
    const token = this.tokens[this.shown - 1];
    const tp = this.group.worldToLocal(this.stand.localToWorld(token.userData.home.clone()));
    const at = this.reach(tp.clone().add(new THREE.Vector3(0, 1.5, 0)));
    const over = this.reach(tp.clone().add(new THREE.Vector3(0, 9, 0)));
    this.anim = {
      t: 0, token, grabbed: false, grabAt: 1.1, pocketAt: 3.3,
      keys: [
        { at: 0, psi: this.pose.psi, th: this.pose.th },
        { at: 0.7, psi: over.psi, th: over.th },
        { at: 1.1, psi: at.psi, th: at.th },
        { at: 1.45, psi: over.psi, th: over.th },
        { at: 2.1, psi: 0, th: -2.75 },          // turn back to the table and hold the token up
        { at: 2.9, psi: 0, th: -2.75 },
        { at: 3.4, psi: 0, th: 0.15 },           // into the pocket
        { at: 3.8, psi: 0, th: 0 },
      ],
    };
    this.shown--;
  }

  finishTake() {
    const a = this.anim;
    this.stand.attach(a.token);
    a.token.visible = false;
    a.token.scale.setScalar(1);
    a.token.position.copy(a.token.userData.home);
    a.token.quaternion.identity();
    this.anim = null;
  }

  aimHead(look, dt) {
    let yaw = 0;
    if (look) {
      const d = this.body.worldToLocal(look).sub(new THREE.Vector3(0, 140, 0));
      yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -1.2, 1.2);
    }
    this.head.rotation.y += (yaw - this.head.rotation.y) * Math.min(1, dt * 4);
  }
}
