// Robot builder: place SPIKE Prime parts, snap them together by their pin/axle holes,
// check connectivity (parts not connected to the hub are highlighted) and export the design.

import { icon } from '../roboeasy/icons.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PARTS, CATEGORIES, PART_COLORS, LU_CM, PORTS, MALE, FEMALE, linkKind } from '../shared/parts.js';
import { analyzeDesign, partShapes, shapeToCm, partConnectorsWorld, compileRobot, TEMPLATES, qFromBasis, snapQuat } from '../shared/robot.js';
import { buildShapesGroup, disposeGroup } from '../render/meshes.js';
import { LAUNCH_R, HEIGHT_LIMIT } from '../shared/field.js';
import { openStudioViewer, exportGLB } from './studioViewer.js';
import { loadAttachments, saveAttachments, newAttachmentId, MISSIONS, missionName } from '../ui/attachments.js';

const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// all 24 axis-aligned orientations
const ORIENTS = (() => {
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const out = [];
  for (const x of dirs) for (const y of dirs) {
    if (Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2]) > 0.5) continue;
    out.push(new THREE.Quaternion(...qFromBasis(x, y)));
  }
  return out;
})();

function partLocalShapesCm(def, color) {
  const inst = { uid: 'g', pos: [0, 0, 0], q: [0, 0, 0, 1], color };
  return partShapes(def).map((s) => shapeToCm(s, inst, def));
}

function boxesOf(def) {
  // collision boxes (LU, part-local) used for overlap tests
  const out = [];
  for (const s of def.shapes) {
    if (s.collide === false && s.kind !== 'box') continue;
    if (s.kind === 'box') out.push({ c: new THREE.Vector3(...s.at), h: new THREE.Vector3(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2) });
    else if (s.kind === 'cyl') {
      const h = s.axis === 'x' ? [s.h / 2, s.r, s.r] : s.axis === 'z' ? [s.r, s.r, s.h / 2] : [s.r, s.h / 2, s.r];
      out.push({ c: new THREE.Vector3(...s.at), h: new THREE.Vector3(...h) });
    } else if (s.kind === 'ball') out.push({ c: new THREE.Vector3(...s.at), h: new THREE.Vector3(s.r, s.r, s.r) });
  }
  return out;
}

function worldBoxes(type, pos, q) {
  const def = PARTS[type];
  if (def.cat === 'pins' || def.cat === 'axles') return [];
  const Q = q instanceof THREE.Quaternion ? q : new THREE.Quaternion(...q);
  const P = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos);
  const m = new THREE.Matrix4().makeRotationFromQuaternion(Q).elements;
  return boxesOf(def).map((b) => {
    const c = b.c.clone().applyQuaternion(Q).add(P);
    // axis-aligned extent of the rotated box: e_i = sum_j |R_ij| * h_j (works for any angle)
    const e = new THREE.Vector3(
      Math.abs(m[0]) * b.h.x + Math.abs(m[4]) * b.h.y + Math.abs(m[8]) * b.h.z,
      Math.abs(m[1]) * b.h.x + Math.abs(m[5]) * b.h.y + Math.abs(m[9]) * b.h.z,
      Math.abs(m[2]) * b.h.x + Math.abs(m[6]) * b.h.y + Math.abs(m[10]) * b.h.z,
    );
    return { min: c.clone().sub(e), max: c.clone().add(e) };
  });
}

function boxesOverlap(a, b, shrink = 0.12) {
  return a.min.x + shrink < b.max.x && a.max.x - shrink > b.min.x && a.min.y + shrink < b.max.y && a.max.y - shrink > b.min.y && a.min.z + shrink < b.max.z && a.max.z - shrink > b.min.z;
}

const snap = (v, s = 0.5) => Math.round(v / s) * s;
/** Clean a free position (LU): snap values within 0.001 of the quarter grid, round the rest. */
const tidy = (v) => { const g = Math.round(v * 4) / 4; return Math.abs(v - g) < 1e-3 ? g : Math.round(v * 1e4) / 1e4; };
let uidSeq = Date.now() % 100000;

export class RobotBuilder {
  constructor({ palette, view, props, hint, design, onApply, onAttachments }) {
    this.paletteEl = palette;
    this.viewEl = view;
    this.propsEl = props;
    this.hintEl = hint;
    this.onApply = onApply;
    this.onAttachments = onAttachments;
    this.attachments = loadAttachments();
    this.attForm = { name: '', mission: '' };
    // Draft is separate from the active field robot: reopening the builder must not apply it automatically.
    try {
      const draft = JSON.parse(localStorage.getItem('fll.bioglow.builderDraft'));
      this.design = draft && Array.isArray(draft.parts) ? draft : design;
    } catch { this.design = design; }
    this.undo = [];
    this.redo = [];
    this.tool = null; // { type, color }
    this.selected = -1; // primary selected part (properties panel)
    this.selection = new Set(); // all selected parts (Shift/Ctrl+click adds)
    this.move = null; // Fusion-style Move tool (M): { mode: 'translate' | 'rotate' }
    this.p2p = null; // Point to Point step: { stage: 'from' | 'to', from }
    this.alignAxes = true;
    this.autoPinOnPlace = true;
    this.rotIndex = 0;
    this.connCycle = 0;
    this.freeQ = new THREE.Quaternion();
    this.ghost = null;
    this.ghostState = null;
    this.color = null;
    this.initScene();
    this.buildPalette();
    this.rebuild();
    this.updateHint();
  }

  // ---------------------------------------------------------------------------------------------
  initScene() {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    this.renderer = r;
    this.viewEl.prepend(r.domElement);
    r.domElement.tabIndex = 0;
    this.scene = new THREE.Scene();
    const builderColor = () => getComputedStyle(document.documentElement).getPropertyValue('--re-builder').trim() || '#1b1f26';
    this.scene.background = new THREE.Color(builderColor());
    new MutationObserver(() => this.scene.background.set(builderColor())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
    this.camera.position.set(30, 24, -36);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(0, 0, -4);
    this.controls.enableDamping = true;
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#334', 0.9));
    const sun = new THREE.DirectionalLight('#fff', 1.6);
    sun.position.set(20, 40, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
    this.scene.add(sun);
    this.grid = new THREE.GridHelper(80, 100, '#3b4250', '#2a2f39');
    this.scene.add(this.grid);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.25 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    // forward arrow
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -14), 6, '#8fd14f', 1.6, 1.2);
    this.arrow = arrow;
    this.scene.add(arrow);
    this.partsRoot = new THREE.Group();
    this.scene.add(this.partsRoot);
    this.labels = new THREE.Group();
    this.scene.add(this.labels);
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), '#ffd84a');
    this.selBox.visible = false;
    this.scene.add(this.selBox);
    // Move tool (M): gizmo on a pivot at the selection centre; snaps 4 mm / 15 deg (Shift = free)
    this.pivot = new THREE.Object3D();
    this.scene.add(this.pivot);
    const tc = new TransformControls(this.camera, r.domElement);
    tc.setSize(0.9);
    tc.setTranslationSnap(0.5 * LU_CM);
    tc.setRotationSnap(THREE.MathUtils.degToRad(15));
    tc.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !e.value;
      if (e.value) this.moveDragStart(); else this.commitMove();
    });
    tc.addEventListener('objectChange', () => this.previewMove());
    tc.enabled = false;
    tc.getHelper().visible = false;
    this.scene.add(tc.getHelper());
    this.tc = tc;
    const snapKeys = (e) => {
      if (e.key !== 'Shift') return;
      tc.setTranslationSnap(e.type === 'keydown' ? null : 0.5 * LU_CM);
      tc.setRotationSnap(e.type === 'keydown' ? null : THREE.MathUtils.degToRad(15));
    };
    window.addEventListener('keydown', snapKeys);
    window.addEventListener('keyup', snapKeys);
    // free holes that fit the held part: small green rings
    const ring = new THREE.TorusGeometry(0.27, 0.05, 6, 20);
    this.holeMarks = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: '#5dff7a', transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }), 4000);
    this.holeMarks.renderOrder = 9;
    this.holeMarks.count = 0;
    this.holeMarks.frustumCulled = false;
    this.scene.add(this.holeMarks);
    // Point to Point: picked source point (cyan) and the rubber band to the target
    this.p2pMarker = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshBasicMaterial({ color: '#35d4ff', depthTest: false }));
    this.p2pMarker.renderOrder = 11;
    this.p2pMarker.visible = false;
    this.scene.add(this.p2pMarker);
    this.p2pLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#35d4ff', dashSize: 0.4, gapSize: 0.25, depthTest: false }));
    this.p2pLine.renderOrder = 11;
    this.p2pLine.visible = false;
    this.scene.add(this.p2pLine);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd84a', depthTest: false }));
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    const el = r.domElement;
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5 || e.button !== 0) return;
      this.onClick(e);
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.setTool(null); });
    window.addEventListener('keydown', (e) => this.onKey(e));
    new ResizeObserver(() => this.resize()).observe(this.viewEl);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.viewEl.offsetParent) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  activate() {
    this.resize();
    this.renderer.domElement.focus();
  }

  resize() {
    const w = this.viewEl.clientWidth || 1;
    const h = this.viewEl.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------------------------
  buildPalette() {
    const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setSize(88, 68);
    thumbR.outputColorSpace = THREE.SRGBColorSpace;
    const ts = new THREE.Scene();
    ts.add(new THREE.HemisphereLight('#fff', '#556', 1.6));
    const dl = new THREE.DirectionalLight('#fff', 1.4);
    dl.position.set(3, 5, 4);
    ts.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 88 / 68, 0.1, 500);
    const html = [`<input type="search" id="partSearch" placeholder="Поиск детали…" />`];
    const thumbs = {};
    for (const p of Object.values(PARTS)) {
      const g = buildShapesGroup(partLocalShapesCm(p, p.color), { castShadow: false });
      const box = new THREE.Box3().setFromObject(g);
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      g.position.sub(c);
      ts.add(g);
      cam.position.set(size * 0.95, size * 0.75, size * 1.15);
      cam.lookAt(0, 0, 0);
      thumbR.render(ts, cam);
      thumbs[p.id] = thumbR.domElement.toDataURL();
      ts.remove(g);
      disposeGroup(g);
    }
    thumbR.dispose();
    for (const cat of CATEGORIES) {
      html.push(`<h4>${cat.name}</h4>`);
      for (const p of Object.values(PARTS).filter((x) => x.cat === cat.id)) {
        html.push(`<button class="part-btn" data-type="${p.id}" title="${esc(p.desc)}"><img src="${thumbs[p.id]}" width="44" height="34" style="border-radius:5px;background:#2a2e36"/><span><div class="nm">${esc(p.name)}</div><div class="ds">${esc(p.desc)}</div></span></button>`);
      }
    }
    this.paletteEl.innerHTML = html.join('');
    this.paletteEl.addEventListener('click', (e) => {
      const b = e.target.closest('.part-btn');
      if (!b) return;
      this.setTool(this.tool?.type === b.dataset.type ? null : { type: b.dataset.type, color: null });
    });
    this.paletteEl.querySelector('#partSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      this.paletteEl.querySelectorAll('.part-btn').forEach((b) => { b.style.display = !q || b.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
  }

  setTool(tool) {
    if (tool && this.move) this.toggleMove(false);
    this.tool = tool;
    this.showFreeHoles();
    this.rotIndex = 0;
    this.connCycle = 0;
    this.freeQ.identity();
    this.paletteEl.querySelectorAll('.part-btn').forEach((b) => b.classList.toggle('active', !!tool && b.dataset.type === tool.type));
    if (this.ghost) { this.scene.remove(this.ghost); disposeGroup(this.ghost); this.ghost = null; }
    this.marker.visible = false;
    if (tool) {
      const def = PARTS[tool.type];
      this.ghost = buildShapesGroup(partLocalShapesCm(def, tool.color || def.color), { castShadow: false });
      this.ghost.traverse((o) => {
        if (!o.material) return;
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.62;
        o.material.emissiveIntensity = 0.55;
      });
      this.ghost.visible = false;
      this.scene.add(this.ghost);
      this.select(-1);
    }
    this.updateHint();
  }

  // ---------------------------------------------------------------------------------------------
  pushUndo() {
    this.undo.push(JSON.stringify(this.design));
    if (this.undo.length > 80) this.undo.shift();
    this.redo = [];
  }
  doUndo() {
    if (!this.undo.length) return;
    this.redo.push(JSON.stringify(this.design));
    this.design = JSON.parse(this.undo.pop());
    this.select(-1);
    this.rebuild();
  }
  doRedo() {
    if (!this.redo.length) return;
    this.undo.push(JSON.stringify(this.design));
    this.design = JSON.parse(this.redo.pop());
    this.select(-1);
    this.rebuild();
  }

  rebuild() {
    try { localStorage.setItem('fll.bioglow.builderDraft', JSON.stringify(this.design)); } catch { /* storage unavailable */ }
    for (const g of [...this.partsRoot.children]) { this.partsRoot.remove(g); disposeGroup(g); }
    for (const l of [...this.labels.children]) { this.labels.remove(l); l.material?.map?.dispose(); }
    const an = analyzeDesign(this.design);
    this.analysis = an;
    this.design.parts.forEach((inst, i) => {
      const def = PARTS[inst.type];
      if (!def) return;
      const floating = an.floating.has(i);
      const g = buildShapesGroup(partLocalShapesCm(def, inst.color || def.color), floating ? { tint: '#b01010' } : {});
      g.position.set(inst.pos[0] * LU_CM, inst.pos[1] * LU_CM, inst.pos[2] * LU_CM);
      g.quaternion.set(...inst.q);
      g.userData.partIndex = i;
      g.traverse((o) => { o.userData.partIndex = i; });
      this.partsRoot.add(g);
      const port = an.ports.byPart[i];
      if (port) this.labels.add(this.makeLabel(port, g.position.clone().add(new THREE.Vector3(0, 2.6, 0))));
    });
    this.partsRoot.updateMatrixWorld(true);
    // ground level of the robot (lowest collider) for the grid
    const c = compileRobot(this.design);
    this.compiled = c;
    const groundY = c.error ? -2.8 : -c.lift;
    this.grid.position.y = groundY;
    this.ground.position.y = groundY - 0.01;
    this.arrow.position.y = groundY + 0.05;
    this.showFreeHoles();
    for (const i of [...this.selection]) if (!this.design.parts[i]) this.selection.delete(i);
    if (!this.selection.has(this.selected)) this.selected = this.selection.size ? [...this.selection].at(-1) : -1;
    this.updateSelBox();
    this.renderProps();
    if (this.move && !this.selection.size) this.toggleMove(false);
  }

  makeLabel(text, pos) {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffd84a';
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.font = 'bold 38px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 32, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(1.6, 1.6, 1);
    sp.position.copy(pos);
    sp.renderOrder = 5;
    return sp;
  }

  // ---------------------------------------------------------------------------------------------
  pointerRay(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  pickPart() {
    const hits = this.raycaster.intersectObjects(this.partsRoot.children, true);
    for (const h of hits) {
      const i = h.object.userData.partIndex;
      if (i === undefined) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      return { index: i, point: h.point, normal: n };
    }
    return null;
  }

  onMove(e) {
    this.pointerRay(e);
    this.lastEvent = e;
    if (this.tool) this.updateGhost();
    else if (this.p2p) this.updateP2P();
  }

  updateGhost() {
    if (!this.ghost || !this.lastEvent) return;
    const def = PARTS[this.tool.type];
    const hit = this.pickPart();
    let state = null;
    if (hit) state = this.snapTo(def, hit);
    if (!state) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const p = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(plane, p)) { this.ghost.visible = false; return; }
      const pos = new THREE.Vector3(snap(p.x / LU_CM, 1), 0, snap(p.z / LU_CM, 1));
      state = { pos, q: this.freeQ.clone(), snapped: false };
    }
    state.valid = !this.collides(this.tool.type, state.pos, state.q);
    this.ghostState = state;
    this.ghost.visible = true;
    this.ghost.position.copy(state.pos).multiplyScalar(LU_CM);
    this.ghost.quaternion.copy(state.q);
    const tint = state.valid ? (state.snapped ? '#1f7a1f' : '#555500') : '#a01010';
    this.ghost.traverse((o) => { if (o.material) o.material.emissive.set(tint); });
    this.marker.visible = !!state.snapped;
    if (state.snapped) this.marker.position.copy(state.target).multiplyScalar(LU_CM);
  }

  /** Green rings on every free hole / axle the held part can go into (none when no part is held). */
  showFreeHoles() {
    const marks = this.holeMarks;
    if (!marks) return;
    marks.count = 0;
    const def = this.tool && PARTS[this.tool.type];
    if (!def || !this.analysis) return;
    const mine = def.conns.filter((c) => !c.legacy);
    const fits = (k) => mine.some((g) => (FEMALE[k] ? MALE[g.k] && linkKind(g.k, k) : FEMALE[g.k] && linkKind(k, g.k)) || (FEMALE[k] && FEMALE[g.k]));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    this.design.parts.forEach((inst, i) => {
      if (!PARTS[inst.type]) return;
      for (const c of partConnectorsWorld(inst)) {
        if (c.legacy || this.analysis.occupied.has(`${i}:${c.ci}`) || !fits(c.k) || marks.count >= 3998) continue;
        const a = new THREE.Vector3(...c.a).normalize();
        q.setFromUnitVectors(AX.z, a);
        // a ring at both mouths of the hole slot; the one inside the part is hidden by the part itself
        for (const sgn of [-1, 1]) {
          m.compose(new THREE.Vector3(...c.p).addScaledVector(a, 0.5 * sgn).multiplyScalar(LU_CM), q, one);
          marks.setMatrixAt(marks.count++, m);
        }
      }
    });
    marks.instanceMatrix.needsUpdate = true;
  }

  /** Find the best placement of `def` snapped to the connector nearest to the hit point. */
  snapTo(def, hit) {
    const inst = this.design.parts[hit.index];
    const pLU = hit.point.clone().multiplyScalar(1 / LU_CM);
    const conns = partConnectorsWorld(inst).filter((c) => !c.legacy).map((c) => ({ ...c, P: new THREE.Vector3(...c.p), A: new THREE.Vector3(...c.a) }));
    // nearest connector to the pointer (surface points are ~0.5 LU from hole centres); a hole that is
    // already used counts as farther away, so the part goes into the free hole next to it
    const occupied = this.analysis?.occupied || new Set();
    let T = null;
    let best = 1.8;
    for (const c of conns) {
      const d = c.P.distanceTo(pLU) + (occupied.has(`${hit.index}:${c.ci}`) ? 0.7 : 0);
      if (d < best) { best = d; T = c; }
    }
    if (!T) return null;
    const n = hit.normal.clone();
    const tFemale = FEMALE[T.k];
    // ghost connectors compatible with T
    const cands = [];
    def.conns.forEach((g, gi) => {
      if (g.legacy) return;
      if (tFemale && MALE[g.k] && linkKind(g.k, T.k)) cands.push({ gi, mode: 'insert' });
      else if (!tFemale && FEMALE[g.k] && linkKind(T.k, g.k)) cands.push({ gi, mode: 'insert' });
    });
    if (tFemale) def.conns.forEach((g, gi) => { if (FEMALE[g.k] && !g.legacy) cands.push({ gi, mode: 'face' }); });
    if (!cands.length) return null;
    const pick = cands[this.connCycle % cands.length];
    const G = def.conns[pick.gi];
    const gAxis = AX[G.a];
    const gP = new THREE.Vector3(...G.p);
    const along = Math.abs(T.A.dot(n)) > 0.5;
    let offset = new THREE.Vector3();
    if (pick.mode === 'face') {
      offset = along ? T.A.clone().multiplyScalar(Math.sign(T.A.dot(n)) || 1) : new THREE.Vector3(Math.round(n.x), Math.round(n.y), Math.round(n.z));
      if (offset.lengthSq() < 0.5) offset.set(0, 1, 0);
    }
    const target = T.P.clone().add(offset);
    // candidate orientations: ghost connector axis parallel to the target axis
    const options = [];
    for (const q of ORIENTS) {
      const a = gAxis.clone().applyQuaternion(q);
      if (Math.abs(a.dot(T.A)) < 0.99) continue;
      const pos = target.clone().sub(gP.clone().applyQuaternion(q));
      const bx = worldBoxes(def.id, pos, q);
      let cen = new THREE.Vector3();
      if (bx.length) { for (const b of bx) cen.add(b.min).add(b.max); cen.multiplyScalar(1 / (2 * bx.length)); } else cen = pos.clone();
      const score = cen.clone().sub(target).dot(n) - (this.collides(def.id, pos, q) ? 100 : 0);
      options.push({ q, pos, score });
    }
    if (!options.length) return null;
    options.sort((a, b) => b.score - a.score);
    const o = options[this.rotIndex % options.length];
    const pos = new THREE.Vector3(snap(o.pos.x, 0.25), snap(o.pos.y, 0.25), snap(o.pos.z, 0.25));
    return { pos, q: o.q.clone(), snapped: true, target, mode: pick.mode, nOptions: options.length };
  }

  collides(type, pos, q, ignore = -1) {
    const mine = worldBoxes(type, pos, q);
    if (!mine.length) return false;
    for (let i = 0; i < this.design.parts.length; i++) {
      if (i === ignore) continue;
      const p = this.design.parts[i];
      for (const b of worldBoxes(p.type, p.pos, p.q)) for (const m of mine) if (boxesOverlap(b, m)) return true;
    }
    return false;
  }

  onClick(e) {
    this.pointerRay(e);
    if (this.tool) {
      this.updateGhost();
      const s = this.ghostState;
      if (!s || !this.ghost.visible) return;
      if (!s.valid) { this.flash('Деталь пересекается с другой — поверните (R) или выберите другое место'); return; }
      this.pushUndo();
      const def = PARTS[this.tool.type];
      const inst = { uid: 'p' + uidSeq++, type: def.id, pos: [s.pos.x, s.pos.y, s.pos.z], q: [s.q.x, s.q.y, s.q.z, s.q.w] };
      if (this.tool.color) inst.color = this.tool.color;
      this.design.parts.push(inst);
      this.rebuild();
      // one click = part in place and pinned: friction pins into every coaxial hole pair it touches
      if (this.autoPinOnPlace && def.cat !== 'pins' && def.cat !== 'axles') {
        const n = this.autoPins({ part: this.design.parts.length - 1, undo: false });
        if (n) this.flash(`Деталь установлена и закреплена: штифтов ${n}`);
      }
      if (!e.shiftKey && this.tool.keep === false) this.setTool(null);
      this.updateGhost();
      return;
    }
    if (this.p2p) { this.clickP2P(); return; }
    if (this.move && this.tc.axis) return; // click on the gizmo
    const hit = this.pickPart();
    this.select(hit ? hit.index : -1, e.shiftKey || e.ctrlKey || e.metaKey);
  }

  /** Select part i (-1 = nothing). add: toggle it in the multi-selection. */
  select(i, add = false) {
    if (!add) this.selection.clear();
    if (i >= 0) {
      if (add && this.selection.has(i)) this.selection.delete(i);
      else this.selection.add(i);
    }
    this.selected = this.selection.has(i) ? i : this.selection.size ? [...this.selection].at(-1) : -1;
    this.updateSelBox();
    this.renderProps();
    if (this.move) { if (this.selection.size) this.placePivot(); else this.toggleMove(false); }
  }

  updateSelBox() {
    const box = new THREE.Box3();
    for (const g of this.partsRoot.children) if (this.selection.has(g.userData.partIndex)) box.expandByObject(g);
    this.selBox.visible = !box.isEmpty();
    if (!box.isEmpty()) this.selBox.box.copy(box);
  }

  groupOf(i) {
    return this.partsRoot.children.find((c) => c.userData.partIndex === i);
  }

  /** Centre of the selected parts' bounds (cm). */
  selectionCentre() {
    const box = new THREE.Box3();
    for (const i of this.selection) { const g = this.groupOf(i); if (g) box.expandByObject(g); }
    return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  }

  // ---- transforms (X/Y/Z rotation, Move, Point to Point) -----------------------------------------
  /** Rotate the selection by dq about `fromCm`, then move that point to `toCm`. One undo step. */
  transformSelection(dq, fromCm, toCm) {
    const idx = [...this.selection].filter((i) => this.design.parts[i]);
    if (!idx.length) return;
    this.pushUndo();
    const from = fromCm.clone().multiplyScalar(1 / LU_CM);
    const to = toCm.clone().multiplyScalar(1 / LU_CM);
    for (const i of idx) {
      const p = this.design.parts[i];
      const v = new THREE.Vector3(...p.pos).sub(from).applyQuaternion(dq).add(to);
      let q = dq.clone().multiply(new THREE.Quaternion(...p.q)).normalize();
      // stay exactly on one of the 24 grid orientations when within 0.5 deg of it (clean connectors)
      const sq = new THREE.Quaternion(...snapQuat([q.x, q.y, q.z, q.w]));
      if (q.angleTo(sq) < THREE.MathUtils.degToRad(0.5)) q = sq;
      p.pos = [tidy(v.x), tidy(v.y), tidy(v.z)];
      p.q = [q.x, q.y, q.z, q.w];
    }
    this.rebuild();
    if (this.move) this.placePivot();
  }

  rotateSelection(axis, deg) {
    if (!this.selection.size) return;
    const c = this.selectionCentre();
    this.transformSelection(new THREE.Quaternion().setFromAxisAngle(AX[axis], THREE.MathUtils.degToRad(deg)), c, c);
  }

  /** Move by (dx, dy, dz) mm and rotate by (rx, ry, rz) degrees about the selection centre (typed values). */
  typedMove(d, r) {
    const c = this.selectionCentre();
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.map((a) => THREE.MathUtils.degToRad(a || 0)), 'XYZ'));
    this.transformSelection(dq, c, c.clone().add(new THREE.Vector3(...d.map((v) => (v || 0) / 10))));
  }

  toggleMove(on = !this.move) {
    if (on && !this.selection.size) { this.flash('Сначала выделите деталь (клик; Shift+клик — несколько)'); return; }
    if (on && this.tool) this.setTool(null);
    this.move = on ? { mode: 'translate' } : null;
    this.p2p = null;
    this.p2pMarker.visible = false;
    this.p2pLine.visible = false;
    this.marker.visible = false;
    this.tc.enabled = on;
    this.tc.getHelper().visible = on;
    if (on) { this.placePivot(); this.tc.setMode('translate'); this.tc.attach(this.pivot); } else this.tc.detach();
    this.updateHint();
    this.renderProps();
  }

  placePivot() {
    this.pivot.position.copy(this.selectionCentre());
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld();
  }

  moveDragStart() {
    this.drag = {
      pos: this.pivot.position.clone(),
      q: this.pivot.quaternion.clone(),
      parts: [...this.selection].map((i) => this.groupOf(i)).filter(Boolean).map((g) => ({ g, pos: g.position.clone(), q: g.quaternion.clone() })),
    };
  }

  dragDelta() {
    return this.pivot.quaternion.clone().multiply(this.drag.q.clone().invert());
  }

  previewMove() {
    if (!this.drag) return;
    const dq = this.dragDelta();
    for (const d of this.drag.parts) {
      d.g.position.copy(d.pos).sub(this.drag.pos).applyQuaternion(dq).add(this.pivot.position);
      d.g.quaternion.copy(dq).multiply(d.q);
    }
    this.updateSelBox();
  }

  commitMove() {
    if (!this.drag) return;
    const dq = this.dragDelta();
    const from = this.drag.pos;
    this.drag = null;
    if (from.distanceTo(this.pivot.position) < 1e-6 && Math.abs(dq.w) > 1 - 1e-9) return;
    this.transformSelection(dq, from, this.pivot.position.clone());
  }

  startP2P() {
    if (!this.selection.size) { this.flash('Сначала выделите деталь, которую нужно переместить'); return; }
    if (!this.move) this.toggleMove(true);
    this.p2p = { stage: 'from' };
    this.tc.detach();
    this.tc.getHelper().visible = false;
    this.updateHint();
    this.renderProps();
  }

  endP2P() {
    this.p2p = null;
    this.p2pMarker.visible = false;
    this.p2pLine.visible = false;
    this.marker.visible = false;
    if (this.move) { this.placePivot(); this.tc.attach(this.pivot); this.tc.getHelper().visible = true; }
    this.updateHint();
    this.renderProps();
  }

  /** Point under the cursor for Point to Point: nearest pin/axle connector (with its axis) or the surface point. */
  p2pPoint() {
    const hit = this.pickPart();
    if (!hit) return null;
    const own = this.selection.has(hit.index);
    if ((this.p2p.stage === 'from') !== own) return null; // from: on the moved parts, to: on any other part
    const pLU = hit.point.clone().multiplyScalar(1 / LU_CM);
    let best = null;
    let bd = 1.0;
    for (const c of partConnectorsWorld(this.design.parts[hit.index])) {
      if (c.legacy) continue;
      const d = new THREE.Vector3(...c.p).distanceTo(pLU);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) return { P: new THREE.Vector3(...best.p).multiplyScalar(LU_CM), A: new THREE.Vector3(...best.a).normalize(), conn: true };
    return { P: hit.point.clone(), A: null, conn: false };
  }

  updateP2P() {
    const pt = this.p2pPoint();
    this.marker.visible = !!pt;
    if (pt) this.marker.position.copy(pt.P);
    if (this.p2p.from && pt) {
      this.p2pLine.geometry.setFromPoints([this.p2p.from.P, pt.P]);
      this.p2pLine.computeLineDistances();
      this.p2pLine.visible = true;
    }
  }

  clickP2P() {
    const pt = this.p2pPoint();
    if (!pt) { this.flash(this.p2p.stage === 'from' ? 'Щёлкните точку на выделенной детали' : 'Щёлкните точку на другой детали'); return; }
    if (this.p2p.stage === 'from') {
      this.p2p = { stage: 'to', from: pt };
      this.p2pMarker.position.copy(pt.P);
      this.p2pMarker.visible = true;
      this.updateHint();
      return;
    }
    const from = this.p2p.from;
    let dq = new THREE.Quaternion();
    if (this.alignAxes && from.A && pt.A) {
      const target = pt.A.dot(from.A) < 0 ? pt.A.clone().negate() : pt.A;
      dq = new THREE.Quaternion().setFromUnitVectors(from.A, target);
    }
    this.endP2P();
    this.transformSelection(dq, from.P, pt.P);
    this.flash(from.conn && pt.conn ? 'Точка к точке: отверстия совмещены' : 'Точка к точке: деталь перенесена');
  }

  onKey(e) {
    if (!this.viewEl.offsetParent) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) this.doRedo(); else this.doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.doRedo(); return; }
    if (k === 'escape') {
      if (this.p2p) { this.endP2P(); return; }
      if (this.move) { this.toggleMove(false); return; }
      this.setTool(null);
      this.select(-1);
      return;
    }
    if (this.tool) {
      if (k === 'r') { this.rotIndex++; this.freeQ.premultiply(new THREE.Quaternion().setFromAxisAngle(AX.y, Math.PI / 2)); this.updateGhost(); }
      if (k === 't') { this.freeQ.premultiply(new THREE.Quaternion().setFromAxisAngle(AX.x, Math.PI / 2)); this.rotIndex += 4; this.updateGhost(); }
      if (k === 'x' || k === 'y' || k === 'z') {
        this.freeQ.premultiply(new THREE.Quaternion().setFromAxisAngle(AX[k], THREE.MathUtils.degToRad(e.shiftKey ? 15 : 90)));
        this.rotIndex++;
        this.updateGhost();
      }
      if (k === 'c') { this.connCycle++; this.updateGhost(); }
      return;
    }
    if (this.selection.size) {
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.removeSelected(); }
      if (k === 'x' || k === 'y' || k === 'z') { e.preventDefault(); this.rotateSelection(k, e.shiftKey ? 15 : 90); }
      if (k === 'm') this.toggleMove();
      if (k === 'p') this.startP2P();
      if (k === 'r' && this.move && !this.p2p) { this.move.mode = this.move.mode === 'translate' ? 'rotate' : 'translate'; this.tc.setMode(this.move.mode); this.updateHint(); this.renderProps(); }
      if (k === 'enter' && this.move) this.toggleMove(false);
      if (k === 'g') this.pickUp();
      if (k === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.duplicate(); }
    }
  }

  removeSelected() {
    if (!this.selection.size) return;
    this.pushUndo();
    for (const i of [...this.selection].sort((a, b) => b - a)) this.design.parts.splice(i, 1);
    this.selection.clear();
    this.selected = -1;
    this.rebuild();
  }

  pickUp() {
    const inst = this.design.parts[this.selected];
    if (!inst) return;
    this.select(this.selected);
    this.removeSelected();
    this.setTool({ type: inst.type, color: inst.color || null });
  }

  duplicate() {
    const inst = this.design.parts[this.selected];
    if (inst) this.setTool({ type: inst.type, color: inst.color || null });
  }

  /**
   * Add friction pins between coaxial, touching holes of different parts that are not yet pinned.
   * opts.part: only pairs that involve this part; opts.undo === false: no own undo step / message.
   * Returns the number of pins added.
   */
  autoPins(opts = {}) {
    const parts = this.design.parts;
    const holes = [];
    parts.forEach((inst, i) => {
      if (!PARTS[inst.type]) return;
      for (const c of partConnectorsWorld(inst)) if (c.k === 'H' && !c.legacy) holes.push({ part: i, ...c, P: new THREE.Vector3(...c.p), A: new THREE.Vector3(...c.a) });
    });
    const occupied = this.analysis.occupied;
    const added = [];
    const used = new Set();
    for (let a = 0; a < holes.length; a++) {
      const A = holes[a];
      if (occupied.has(`${A.part}:${A.ci}`) || used.has(a)) continue;
      for (let b = 0; b < holes.length; b++) {
        if (b === a || used.has(b)) continue;
        const B = holes[b];
        if (B.part === A.part || occupied.has(`${B.part}:${B.ci}`)) continue;
        if (opts.part !== undefined && A.part !== opts.part && B.part !== opts.part) continue;
        if (Math.abs(Math.abs(A.A.dot(B.A)) - 1) > 1e-3) continue;
        const d = B.P.clone().sub(A.P);
        if (Math.abs(d.length() - 1) > 0.05 || Math.abs(Math.abs(d.clone().normalize().dot(A.A)) - 1) > 1e-3) continue;
        const dir = d.clone().normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(AX.x, dir);
        added.push({ uid: 'p' + uidSeq++, type: 'pin', pos: [A.P.x, A.P.y, A.P.z], q: [q.x, q.y, q.z, q.w] });
        used.add(a);
        used.add(b);
        break;
      }
    }
    if (!added.length) {
      if (opts.undo !== false) this.flash('Свободных соосных отверстий вплотную не найдено');
      return 0;
    }
    if (opts.undo !== false) this.pushUndo();
    parts.push(...added);
    this.rebuild();
    if (opts.undo !== false) this.flash(`Добавлено штифтов: ${added.length}`);
    return added.length;
  }

  // ---------------------------------------------------------------------------------------------
  fitCheck() {
    const c = this.compiled;
    if (!c || c.error) return { ok: false, text: 'нет хаба' };
    const pts = c.footprint;
    if (!pts.length) return { ok: false, text: '' };
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const w = maxX - minX;
    const l = maxZ - minZ;
    // place the bounding box in the corner of the quarter circle: farthest corner distance
    const rFit = Math.hypot(w, l);
    const h = c.height;
    return { ok: rFit <= LAUNCH_R && h <= HEIGHT_LIMIT, w, l, h, rFit };
  }

  renderProps() {
    const an = this.analysis;
    const d = this.design;
    let mass = 0;
    let motors = 0;
    let sensors = 0;
    for (const p of d.parts) { const def = PARTS[p.type]; if (!def) continue; mass += def.mass; if (def.electronic === 'motor') motors++; if (def.sensor) sensors++; }
    const fit = this.fitCheck();
    const sel = this.selected >= 0 ? d.parts[this.selected] : null;
    const sdef = sel ? PARTS[sel.type] : null;
    const portOf = sel ? an.ports.byPart[this.selected] : null;
    this.propsEl.innerHTML = `
      <div class="box">
        <h3>${icon('bot')} ${esc(d.name || 'Робот')}</h3>
        <div class="btns">
          <button class="btn small primary" data-act="apply">${icon('check')} Применить на поле</button>
          <button class="btn small" data-act="rename">${icon('pencil')} Имя</button>
        </div>
      </div>
      <div class="box">
        <h3>Характеристики</h3>
        <div class="row"><span class="muted">Деталей</span><span>${d.parts.length}</span></div>
        <div class="row"><span class="muted">Масса</span><span>${(mass * 1000).toFixed(0)} г</span></div>
        <div class="row"><span class="muted">Моторы</span><span class="${motors > 4 ? 'bad' : ''}">${motors} / 4</span></div>
        <div class="row"><span class="muted">Датчики</span><span>${sensors}</span></div>
        <div class="row"><span class="muted">Габариты Ш×Д×В</span><span>${fit.w ? `${fit.w.toFixed(1)}×${fit.l.toFixed(1)}×${fit.h.toFixed(1)} см` : '—'}</span></div>
        <div class="row"><span class="muted">Осмотр (зона запуска, 30,5 см)</span><span class="${fit.ok ? 'ok' : 'bad'}">${fit.ok ? icon('check') + ' помещается' : icon('x') + ' не помещается'}</span></div>
        <div class="row"><span class="muted">Жёстких узлов (тел)</span><span>${an.reach.size}</span></div>
      </div>
      <div class="box">
        <h3>Проверка соединений</h3>
        ${an.warnings.length ? `<ul class="warnlist">${an.warnings.map((w) => `<li>${esc(w.text)}</li>`).join('')}</ul>` : '<div class="ok">' + icon('check') + ' Все детали соединены, ошибок нет</div>'}
        <div class="btns" style="margin-top:8px">
          <button class="btn small" data-act="autopins" title="Вставить штифты во все соосные отверстия соседних деталей">${icon('pin')} Авто-штифты</button>
        </div>
        <label class="muted" style="display:block;margin-top:6px"><input type="checkbox" data-act="autoPinOnPlace" ${this.autoPinOnPlace ? 'checked' : ''}/> Сразу закреплять штифтами при установке</label>
      </div>
      <div class="box">
        <h3>${icon('puzzle')} Насадки (${this.attachments.length})</h3>
        <div class="muted" style="font-size:11px;margin-bottom:6px">Соберите насадку прямо на роботе, выделите её детали (Shift+клик) и сохраните — она снимется с робота.
          На поле насадки лежат по краям стола и надеваются одним кликом.</div>
        <input class="att-in" data-att="name" placeholder="Название, напр. «Крюк для M08»" value="${esc(this.attForm.name)}"/>
        <select class="att-in" data-att="mission">${MISSIONS.map(([id, n]) => `<option value="${id}" ${this.attForm.mission === id ? 'selected' : ''}>${esc(id ? n : 'Для задания: ' + n)}</option>`).join('')}</select>
        <div class="btns"><button class="btn small primary" data-act="attSave" ${this.selection.size ? '' : 'disabled'}>${icon('save')} Сохранить насадку${this.selection.size ? ` (${this.selection.size} дет.)` : ''}</button></div>
        ${this.attachments.length ? `<ul class="att-list">${this.attachments.map((a) => `<li><div><b>${esc(a.name)}</b><small>${esc(missionName(a.mission))} · ${a.parts.length} дет.</small></div>
          <button class="icon-btn" title="Надеть на робота, чтобы изменить (потом снова сохранить)" data-act="attEdit" data-id="${a.id}">${icon('pencil')}</button>
          <button class="icon-btn" title="Удалить насадку" data-act="attDel" data-id="${a.id}">${icon('trash')}</button></li>`).join('')}</ul>` : ''}
      </div>
      ${sel ? `<div class="box">
        <h3>${icon('move')} Переместить${this.selection.size > 1 ? ` (${this.selection.size} дет.)` : ''}</h3>
        <div class="btns">
          <button class="btn small ${this.move && !this.p2p ? 'primary' : ''}" data-act="move">${icon('move')} Гизмо (M)</button>
          <button class="btn small ${this.move && this.move.mode === 'rotate' ? 'primary' : ''}" data-act="moveMode" ${this.move ? '' : 'disabled'}>${this.move && this.move.mode === 'rotate' ? icon('rotate') + ' Поворот' : icon('swap') + ' Сдвиг'} (R)</button>
          <button class="btn small ${this.p2p ? 'primary' : ''}" data-act="p2p">⊙ Точка к точке (P)</button>
        </div>
        <label class="muted" style="display:block;margin:6px 0"><input type="checkbox" data-act="align" ${this.alignAxes ? 'checked' : ''}/> Точка к точке: выровнять оси отверстий</label>
        <div class="xyz"><span class="muted">Сдвиг, мм</span>${['X', 'Y', 'Z'].map((a) => `<label>${a}<input type="number" step="4" value="0" data-mv="d${a}"/></label>`).join('')}</div>
        <div class="xyz"><span class="muted">Поворот, °</span>${['X', 'Y', 'Z'].map((a) => `<label>${a}<input type="number" step="15" value="0" data-mv="r${a}"/></label>`).join('')}</div>
        <div class="btns" style="margin-top:6px">
          <button class="btn small" data-act="typed">${icon('check')} Применить</button>
          <button class="btn small" data-act="rotX">${icon('rotate')} X 90°</button>
          <button class="btn small" data-act="rotY">${icon('rotate')} Y 90°</button>
          <button class="btn small" data-act="rotZ">${icon('rotate')} Z 90°</button>
        </div>
      </div>
      <div class="box">
        <h3>Выбрано: ${esc(sdef.name)}</h3>
        <div class="muted" style="font-size:11px;margin-bottom:6px">${esc(sdef.desc)}</div>
        ${sdef.electronic && sdef.electronic !== 'hub' ? `<div class="row"><span>Порт хаба</span><select data-act="port"><option value="">авто (${portOf || '—'})</option>${PORTS.map((p) => `<option ${sel.port === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>` : ''}
        <div class="muted" style="margin-top:6px">Цвет</div>
        <div class="swatches">${Object.entries(PART_COLORS).map(([n, c]) => `<button title="${esc(n)}" data-color="${c}" style="background:${c}" class="${(sel.color || sdef.color) === c ? 'on' : ''}"></button>`).join('')}</div>
        <div class="btns" style="margin-top:8px">
          <button class="btn small" data-act="pickup">${icon('hand')} Взять (G)</button>
          <button class="btn small" data-act="dup">⧉ Копия</button>
          <button class="btn small stop" data-act="del">${icon('trash')} Удалить (Del)</button>
        </div>
      </div>` : ''}
      <div class="box">
        <h3>Файл</h3>
        <div class="btns">
          <select data-act="template"><option value="">Шаблон…</option>${TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
          <button class="btn small" data-act="undo" ${this.undo.length ? '' : 'disabled'}>${icon('undo')} Отменить</button>
          <button class="btn small" data-act="redo" ${this.redo.length ? '' : 'disabled'}>${icon('redo')} Повторить</button>
          <button class="btn small" data-act="export">${icon('download')} Сохранить .json</button>
          <button class="btn small" data-act="import">${icon('upload')} Открыть .json</button>
          <button class="btn small" data-act="studio">${icon('upload')} Просмотр .io / .ldr / .mpd</button>
          <button class="btn small" data-act="glb">${icon('download')} Модель .glb</button>
          <div class="muted">Черновик сохраняется в браузере. JSON — редактируемая сборка с портами и соединениями; GLB — только геометрия. Импорт Studio открывается отдельно, без физики.</div>
        </div>
      </div>`;
    this.propsEl.querySelectorAll('[data-act]').forEach((el) => {
      const act = el.dataset.act;
      if (el.tagName === 'SELECT') el.addEventListener('change', () => this.action(act, el.value));
      else if (el.type === 'checkbox') el.addEventListener('change', () => this.action(act, el.checked));
      else el.addEventListener('click', () => this.action(act, el.dataset.id));
    });
    this.propsEl.querySelectorAll('[data-att]').forEach((el) => el.addEventListener('input', () => { this.attForm[el.dataset.att] = el.value; }));
    this.propsEl.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      if (this.selected < 0) return;
      this.pushUndo();
      this.design.parts[this.selected].color = b.dataset.color;
      this.rebuild();
    }));
  }

  storeAttachments() {
    saveAttachments(this.attachments);
    this.onAttachments?.(this.attachments);
  }

  /** Selected parts -> a new attachment; they are taken off the robot. */
  saveAttachment() {
    const idx = [...this.selection].filter((i) => this.design.parts[i]).sort((a, b) => a - b);
    if (!idx.length) { this.flash('Выделите детали насадки (клик, Shift+клик — несколько)'); return; }
    if (idx.some((i) => this.design.parts[i].type === 'hub')) { this.flash('Хаб — часть робота, а не насадки'); return; }
    const name = this.attForm.name.trim() || `Насадка ${this.attachments.length + 1}`;
    const old = this.attachments.find((a) => a.name === name);
    if (old && !confirm(`Насадка «${name}» уже есть. Заменить?`)) return;
    const parts = idx.map((i) => JSON.parse(JSON.stringify(this.design.parts[i])));
    const att = { id: old?.id || newAttachmentId(), name, mission: this.attForm.mission, program: old?.program || '', parts };
    this.attachments = old ? this.attachments.map((a) => (a === old ? att : a)) : [...this.attachments, att];
    this.storeAttachments();
    this.pushUndo();
    for (const i of idx.reverse()) this.design.parts.splice(i, 1);
    this.selection.clear();
    this.selected = -1;
    this.attForm = { name: '', mission: '' };
    this.rebuild();
    this.flash(`Насадка «${name}» сохранена (${parts.length} дет.). Нажмите «Применить на поле» — она появится у края стола`);
  }

  /** Put an attachment back on the robot to change it; it is saved again with «Сохранить насадку». */
  editAttachment(id) {
    const a = this.attachments.find((x) => x.id === id);
    if (!a) return;
    this.pushUndo();
    const start = this.design.parts.length;
    a.parts.forEach((p, k) => this.design.parts.push({ ...JSON.parse(JSON.stringify(p)), uid: `e${Date.now().toString(36)}${k}` }));
    this.selection = new Set(a.parts.map((_, k) => start + k));
    this.selected = start;
    this.attForm = { name: a.name, mission: a.mission || '' };
    this.attachments = this.attachments.filter((x) => x !== a);
    this.storeAttachments();
    this.rebuild();
    this.flash(`Насадка «${a.name}» на роботе и выделена — измените и снова нажмите «Сохранить насадку»`);
  }

  action(act, value) {
    const d = this.design;
    switch (act) {
      case 'apply': {
        const an = this.analysis;
        if (an.warnings.some((w) => w.type === 'nohub')) { this.flash('Нужен хаб SPIKE Prime'); return; }
        if (an.floating.size && !confirm(`${an.floating.size} дет. не соединены с хабом и не попадут на поле. Продолжить?`)) return;
        this.onApply?.(JSON.parse(JSON.stringify(d)));
        break;
      }
      case 'rename': { const n = prompt('Имя робота:', d.name || ''); if (n) { d.name = n; this.renderProps(); } break; }
      case 'autopins': this.autoPins(); break;
      case 'attSave': this.saveAttachment(); break;
      case 'attEdit': this.editAttachment(value); break;
      case 'attDel': {
        const a = this.attachments.find((x) => x.id === value);
        if (a && confirm(`Удалить насадку «${a.name}»?`)) { this.attachments = this.attachments.filter((x) => x !== a); this.storeAttachments(); this.renderProps(); }
        break;
      }
      case 'port': this.pushUndo(); if (value) d.parts[this.selected].port = value; else delete d.parts[this.selected].port; this.rebuild(); break;
      case 'pickup': this.pickUp(); break;
      case 'move': this.toggleMove(); break;
      case 'moveMode': if (this.move) { this.move.mode = this.move.mode === 'translate' ? 'rotate' : 'translate'; this.tc.setMode(this.move.mode); this.updateHint(); this.renderProps(); } break;
      case 'p2p': if (this.p2p) this.endP2P(); else this.startP2P(); break;
      case 'align': this.alignAxes = !!value; break;
      case 'autoPinOnPlace': this.autoPinOnPlace = !!value; break;
      case 'rotX': this.rotateSelection('x', 90); break;
      case 'rotY': this.rotateSelection('y', 90); break;
      case 'rotZ': this.rotateSelection('z', 90); break;
      case 'typed': {
        const v = (k) => parseFloat(this.propsEl.querySelector(`[data-mv="${k}"]`)?.value) || 0;
        this.typedMove([v('dX'), v('dY'), v('dZ')], [v('rX'), v('rY'), v('rZ')]);
        break;
      }
      case 'dup': this.duplicate(); break;
      case 'del': this.removeSelected(); break;
      case 'undo': this.doUndo(); break;
      case 'redo': this.doRedo(); break;
      case 'template': {
        const t = TEMPLATES.find((x) => x.id === value);
        if (t && confirm(`Заменить текущего робота шаблоном «${t.name}»?`)) { this.pushUndo(); this.design = t.make(); this.select(-1); this.rebuild(); }
        else this.renderProps();
        break;
      }
      case 'studio': {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.io,.ldr,.mpd';
        inp.onchange = async () => { if (!inp.files?.length) return; try { await openStudioViewer(inp.files[0]); } catch (err) { alert('Не удалось открыть модель: ' + err.message); } };
        inp.click(); break;
      }
      case 'glb': {
        exportGLB(this.partsRoot, (d.name || 'robot').replace(/[^\wа-яё-]+/gi, '_') + '.glb').catch(err => alert('Ошибка экспорта: ' + err.message));
        break;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (d.name || 'robot').replace(/[^\wа-яё-]+/gi, '_') + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        break;
      }
      case 'import': {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.json,application/json';
        inp.onchange = async () => {
          try {
            const j = JSON.parse(await inp.files[0].text());
            if (!Array.isArray(j.parts)) throw new Error('нет списка деталей');
            this.pushUndo();
            this.design = j;
            this.select(-1);
            this.rebuild();
          } catch (err) { alert('Не удалось открыть файл: ' + err.message); }
        };
        inp.click();
        break;
      }
      default: break;
    }
  }

  flash(text) {
    this.hintEl.innerHTML = `<b style="color:#ffd84a">${esc(text)}</b>`;
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => this.updateHint(), 2600);
  }

  updateHint() {
    let h;
    if (this.tool) h = `Ставим: <b>${esc(PARTS[this.tool.type].name)}</b>. Наведите на отверстие/ось детали — деталь «прилипнет» (жёлтая точка). <b>Клик</b> — поставить, <b>R</b> — повернуть вариант, <b>T</b> — наклонить, <b>X/Y/Z</b> — повернуть вокруг оси (Shift — 15°), <b>C</b> — другим отверстием, <b>Esc</b>/ПКМ — закончить.`;
    else if (this.p2p?.stage === 'from') h = '<b>Точка к точке</b>: щёлкните исходную точку на выделенной детали (отверстие или ось подсвечивается). <b>Esc</b> — отмена.';
    else if (this.p2p) h = '<b>Точка к точке</b>: щёлкните целевую точку на другой детали — выделенное переедет туда' + (this.alignAxes ? ' и повернётся так, чтобы оси отверстий совпали' : '') + '. <b>Esc</b> — отмена.';
    else if (this.move) h = `<b>Переместить (M)</b>: тяните ${this.move.mode === 'rotate' ? 'кольца — поворот вокруг X/Y/Z' : 'стрелки — сдвиг по X/Y/Z, квадраты — в плоскости'} (шаг 4 мм / 15°, <b>Shift</b> — без шага). <b>R</b> — сдвиг/поворот, <b>P</b> — точка к точке, <b>X/Y/Z</b> — поворот на 90°, <b>Enter</b>/<b>Esc</b> — готово.`;
    else h = 'Выберите деталь слева. <b>Клик</b> — выделить (<b>Shift+клик</b> — несколько), <b>M</b> — переместить/повернуть, <b>P</b> — точка к точке, <b>X/Y/Z</b> — повернуть на 90° (Shift — 15°), <b>Del</b> — удалить, <b>G</b> — взять, <b>Ctrl+Z</b> — отменить. Зелёная стрелка — «вперёд» робота. Красные детали не соединены с хабом.';
    this.hintEl.innerHTML = h;
  }
}
