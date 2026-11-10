// LDraw part meshes (LDraw.org parts library, CC BY 2.0 / 4.0 — see public/ldraw/CAreadme.txt).
// scripts/pack-ldraw.mjs parses the parts once at build time (smooth normals, edge lines dropped)
// into public/ldraw/parts.bin: per model, one geometry per colour in centimetres, y up.
// Here it is decoded into BufferGeometries.

import * as THREE from 'three';

const cache = new Map();
const listeners = new Set();
let readyPromise = null;

/** { pieces: [{ geom, color, main, glass }], box: Box3 } or undefined while not loaded. */
export function getLDraw(name) {
  return cache.get(name);
}

export function onLDrawReady(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Load every robot part mesh (once). Resolves when they are cached; on failure parts keep their stand-ins. */
export function loadLDraw() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      const base = new URL('./ldraw/', document.baseURI).href;
      const [index, bin] = await Promise.all([
        fetch(base + 'parts.json').then((r) => r.json()),
        fetch(base + 'parts.bin').then((r) => r.arrayBuffer()),
      ]);
      const k = 1 / index.posScale;
      for (const [name, m] of Object.entries(index.models)) {
        const pieces = m.pieces.map((p) => {
          const n = p.count * 3;
          const qp = new Int16Array(bin, p.pos, n);
          const qn = new Int8Array(bin, p.nrm, n);
          const pos = new Float32Array(n);
          const nrm = new Float32Array(n);
          for (let i = 0; i < n; i++) { pos[i] = qp[i] * k; nrm[i] = qn[i] / 127; }
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geom.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
          return { geom, color: p.color, main: p.main, glass: p.glass };
        });
        const b = m.box;
        cache.set(name, { pieces, box: new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])) });
      }
    } catch (e) {
      console.warn('LDraw parts not loaded, using simple shapes', e);
    }
    for (const cb of listeners) cb();
    return cache;
  })();
  return readyPromise;
}
