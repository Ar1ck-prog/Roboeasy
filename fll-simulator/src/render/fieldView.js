// 3D view of the robot game table. Builds meshes from the worker's scene description and
// applies pose snapshots every frame. Supports camera presets and dragging robot / loose pieces.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildShapesGroup, disposeGroup } from './meshes.js';
import { onLDrawReady } from './ldraw.js';
import { Referee } from './referee.js';
import { MAT_W, MAT_D, TABLE_W, HALF_W, STRIP_W } from '../shared/field.js';

export class FieldView {
  constructor(container, { onDrag, onKey, onAttachment } = {}) {
    this.container = container;
    this.onDrag = onDrag;
    this.onAttachment = onAttachment;
    this.attGroups = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;

    this.scene = new THREE.Scene();
    const sceneColor = () => getComputedStyle(document.documentElement).getPropertyValue('--re-scene').trim() || '#14161b';
    this.scene.background = new THREE.Color(sceneColor());
    this.scene.fog = new THREE.Fog(sceneColor(), 600, 1400);
    new MutationObserver(() => { const color = sceneColor(); this.scene.background.set(color); this.scene.fog.color.set(color); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // soft studio reflections: makes the plastic read as plastic instead of flat colour
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);
    this.camera.position.set(0, 165, 175);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 900;
    this.controls.addEventListener('start', () => { this.userMoved = true; });

    const hemi = new THREE.HemisphereLight('#f4f6ff', '#2a2620', 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e8', 2.1);
    sun.position.set(-60, 220, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -135; sc.right = 135; sc.top = 80; sc.bottom = -80; sc.near = 50; sc.far = 500;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#b8d4ff', 0.35);
    fill.position.set(120, 80, -150);
    this.scene.add(fill);

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#202329', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -78;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const legMat = new THREE.MeshStandardMaterial({ color: '#2c2f35', roughness: 0.8 });
    for (const x of [-TABLE_W / 2 + 4, TABLE_W / 2 - 4]) for (const z of [-MAT_D / 2 + 4, MAT_D / 2 - 4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(6, 68, 6), legMat);
      leg.position.set(x, -44, z);
      this.scene.add(leg);
    }

    // mat
    const tex = new THREE.TextureLoader().load(new URL('./assets/mat.jpg', document.baseURI).href);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(MAT_W, MAT_D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.03;
    mat.receiveShadow = true;
    this.scene.add(mat);
    this.matMesh = mat;

    // the match judge behind the north wall, with the precision tokens on a stand
    this.referee = new Referee();
    this.referee.group.position.set(48, -78, -MAT_D / 2 - 26);
    this.scene.add(this.referee.group);
    this.lastFrame = performance.now();

    this.bodyGroups = [];
    this.bodyIndex = new Map();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.robotIds = new Set();
    this.follow = false;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.drag = null;
    this.hover = null;

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.pointerDown(e));
    el.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
    el.addEventListener('keydown', (e) => onKey?.(e, true));
    el.addEventListener('keyup', (e) => onKey?.(e, false));
    el.addEventListener('wheel', (e) => {
      if (this.drag && this.drag.id === 'robot') {
        e.preventDefault();
        this.drag.yaw += e.deltaY > 0 ? -5 : 5;
        this.sendDrag('move');
      }
    }, { passive: false });

    // post-processing: MSAA scene target + ground-truth ambient occlusion (contact shadows between bricks)
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.ao.blendIntensity = 0.9;
    this.ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());

    // redraw the robot with the real LDraw part meshes once they have loaded
    onLDrawReady(() => {
      if (!this.bodies) return;
      this.setScene(this.bodies, [...this.robotIds]);
      if (this.lastPoses) this.applyPoses(this.lastPoses);
    });

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      this.render();
    };
    loop();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved && (this.view || '3d') !== 'follow') this.setView(this.view || '3d');
  }

  setScene(bodies, robotIds) {
    for (const g of this.bodyGroups) { this.root.remove(g); disposeGroup(g); }
    this.bodyGroups = [];
    this.bodyIndex.clear();
    this.robotIds = new Set(robotIds || []);
    this.bodies = bodies;
    bodies.forEach((b, i) => {
      const g = buildShapesGroup(b.shapes);
      g.userData = { id: b.id, index: i, loose: b.loose, robot: this.robotIds.has(b.id), model: b.model };
      g.traverse((o) => { o.userData.bodyId = b.id; });
      g.matrixAutoUpdate = true;
      this.root.add(g);
      this.bodyGroups.push(g);
      this.bodyIndex.set(b.id, i);
    });
  }

  applyPoses(arr) {
    const n = Math.min(this.bodyGroups.length, arr.length / 7);
    for (let i = 0; i < n; i++) {
      const g = this.bodyGroups[i];
      const o = i * 7;
      g.position.set(arr[o], arr[o + 1], arr[o + 2]);
      g.quaternion.set(arr[o + 3], arr[o + 4], arr[o + 5], arr[o + 6]);
      g.visible = arr[o + 1] > -400;
    }
    this.lastPoses = arr;
  }

  setTokens(n) { this.referee.setTokens(n); }

  /** Attachments that are not on the robot lie on the storage strips left and right of the mat. */
  setAttachments(items) {
    for (const g of this.attGroups) { this.scene.remove(g); disposeGroup(g); }
    this.attGroups = [];
    items.forEach((it, i) => {
      const g = new THREE.Group();
      const inner = buildShapesGroup(it.shapes);
      g.add(inner);
      const box = new THREE.Box3().setFromObject(inner);
      const c = box.getCenter(new THREE.Vector3());
      inner.position.set(-c.x, -box.min.y + 0.05, -c.z);
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      g.position.set(side * (HALF_W + STRIP_W / 2), 0.03, -MAT_D / 2 + 12 + row * 19);
      g.rotation.y = side * Math.PI / 2;
      g.add(this.labelSprite(it.name, box.max.y - box.min.y + 3));
      g.userData.attId = it.id;
      g.traverse((o) => { o.userData.attId = it.id; o.castShadow = true; });
      this.scene.add(g);
      this.attGroups.push(g);
    });
  }

  labelSprite(text, y) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const g = c.getContext('2d');
    g.font = 'bold 40px system-ui, sans-serif';
    const w = Math.min(500, g.measureText(text).width + 40);
    g.fillStyle = 'rgba(17,19,23,.85)';
    g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 68, 18); g.fill();
    g.fillStyle = '#c8e86b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 50, 470);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(24, 4.5, 1);
    s.position.y = y;
    s.renderOrder = 10;
    return s;
  }

  robotPose() {
    const id = [...this.robotIds][0];
    const g = this.bodyGroups[this.bodyIndex.get(id)];
    return g ? { p: g.position, q: g.quaternion } : null;
  }

  /** Distance at which a box of `w` x `h` (screen-space extents) fits the view. */
  fitDistance(w, h) {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    return Math.max(w / 2 / Math.tan(hfov / 2), h / 2 / Math.tan(vfov / 2));
  }

  setView(kind, byUser = false) {
    if (byUser) this.userMoved = false;
    this.follow = kind === 'follow';
    this.view = kind;
    const c = this.controls;
    if (kind === 'top') { const d = this.fitDistance(TABLE_W + 12, MAT_D + 14); this.camera.position.set(0, d, 0.01); c.target.set(0, 0, 0); }
    else if (kind === '3d') {
      // the extra height keeps the judge behind the north wall in the picture
      const d = this.fitDistance(TABLE_W + 4, MAT_D * 0.95 + 70) * 1.08;
      const tgt = new THREE.Vector3(0, 16, -4);
      const dir = new THREE.Vector3(0, 0.72, 0.69).normalize();
      this.camera.position.copy(dir.multiplyScalar(d)).add(tgt);
      c.target.copy(tgt);
    }
    else if (kind === 'side') { this.camera.position.set(-200, 80, 60); c.target.set(-20, 0, 0); }
    else if (kind === 'home') { this.camera.position.set(-70, 70, 120); c.target.set(-70, 0, 20); }
    c.update();
  }

  render() {
    if (this.follow) {
      const rp = this.robotPose();
      if (rp) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(rp.q);
        fwd.y = 0;
        fwd.normalize();
        const desired = rp.p.clone().add(fwd.clone().multiplyScalar(-45)).add(new THREE.Vector3(0, 32, 0));
        this.camera.position.lerp(desired, 0.08);
        this.controls.target.lerp(rp.p.clone().add(fwd.multiplyScalar(25)), 0.15);
      }
    }
    const rp = this.robotPose();
    if (rp) this.referee.watch(rp.p);
    const now = performance.now();
    this.referee.update(Math.min(0.05, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.controls.update();
    this.composer.render();
  }

  // ---- picking / dragging ----
  setPointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  groundPoint(y = 0) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }
  pick() {
    const hits = this.raycaster.intersectObjects(this.bodyGroups, true);
    for (const h of hits) {
      const id = h.object.userData.bodyId;
      if (!id) continue;
      const g = this.bodyGroups[this.bodyIndex.get(id)];
      if (g.userData.robot) return { id: 'robot', point: h.point };
      if (g.userData.loose) return { id, point: h.point };
      return null;
    }
    return null;
  }
  pointerDown(e) {
    if (e.button !== 0 || !this.dragEnabled) return;
    this.setPointer(e);
    const ah = this.raycaster.intersectObjects(this.attGroups, true).find((h) => h.object.userData.attId && !h.object.isSprite);
    if (ah) { this.onAttachment?.(ah.object.userData.attId); return; }
    const hit = this.pick();
    if (!hit) return;
    const gp = this.groundPoint();
    if (!gp) return;
    let base;
    if (hit.id === 'robot') {
      const rp = this.robotPose();
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(rp.q);
      base = { x: rp.p.x, z: rp.p.z, yaw: (Math.atan2(-f.x, -f.z) * 180) / Math.PI };
    } else {
      const g = this.bodyGroups[this.bodyIndex.get(hit.id)];
      base = { x: g.position.x, z: g.position.z, yaw: 0 };
    }
    this.drag = { id: hit.id, dx: base.x - gp.x, dz: base.z - gp.z, x: base.x, z: base.z, yaw: Math.round(base.yaw) };
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.sendDrag('start');
  }
  pointerMove(e) {
    if (!this.drag) return;
    this.setPointer(e);
    const gp = this.groundPoint();
    if (!gp) return;
    this.drag.x = Math.round((gp.x + this.drag.dx) * 2) / 2;
    this.drag.z = Math.round((gp.z + this.drag.dz) * 2) / 2;
    this.sendDrag('move');
  }
  pointerUp() {
    if (!this.drag) return;
    this.sendDrag('end');
    this.drag = null;
    this.controls.enabled = true;
  }
  rotateDrag(delta) {
    if (this.drag && this.drag.id === 'robot') { this.drag.yaw += delta; this.sendDrag('move'); return true; }
    return false;
  }
  sendDrag(phase) {
    const d = this.drag;
    this.onDrag?.({ id: d.id, x: d.x, z: d.z, yaw: d.yaw, phase });
  }
}
