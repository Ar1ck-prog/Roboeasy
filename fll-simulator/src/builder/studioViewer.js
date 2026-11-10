import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readStudioFile, parseLDraw } from './studioFormat.js';

export function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportGLB(group, name, metresPerUnit = 0.01) {
  // glTF uses metres; the builder uses centimetres and LDraw uses 0.4 mm units.
  const wrapper = new THREE.Group(); wrapper.scale.setScalar(metresPerUnit); wrapper.add(group.clone(true));
  const result = await new GLTFExporter().parseAsync(wrapper, { binary: true, onlyVisible: true });
  download(result, name, 'model/gltf-binary');
}

export async function openStudioViewer(file) {
  const text = await readStudioFile(file);
  const parsed = parseLDraw(text);
  const root = document.createElement('div'); root.className = 'studio-overlay';
  root.innerHTML = `<div class="studio-window"><div class="studio-head"><strong>Модель Studio</strong><button class="btn small" data-a="ldr">⬇ LDraw .ldr</button><button class="btn small" data-a="glb" disabled>⬇ 3D .glb</button><button class="btn small" data-a="close">Закрыть</button></div><div class="studio-body"><div class="studio-view"></div><aside class="studio-info"><b data-status>Загрузка геометрии…</b><p>Мышь: вращение, колесо: масштаб, правая кнопка: сдвиг.</p><p>LDR хранит ссылки на детали для редактирования в Studio. GLB хранит геометрию для просмотра и не сохраняет соединения.</p><p>Просмотр не превращает модель в физического робота. Для симуляции используйте конструктор и назначьте порты моторов.</p><div data-warnings></div></aside></div></div>`;
  document.body.append(root);
  const el = root.querySelector('.studio-view'); const status = root.querySelector('[data-status]'); const warningEl = root.querySelector('[data-warnings]');
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace = THREE.SRGBColorSpace; el.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#202733');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x707080,2)); const light = new THREE.DirectionalLight(0xffffff,2); light.position.set(1,2,3); scene.add(light);
  const model = new THREE.Group(); model.scale.set(1,-1,-1); scene.add(model);
  const base = new URL('./ldraw-source/',document.baseURI).href;
  const loader = new LDrawLoader(); loader.setConditionalLineMaterial(LDrawConditionalLineMaterial); loader.setPartsLibraryPath(base);
  let live = true;
  const resize = () => { const w=el.clientWidth || 1,h=el.clientHeight || 1; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  function frame() { if (!live) return; requestAnimationFrame(frame); controls.update(); renderer.render(scene,camera); } frame();
  root.querySelector('[data-a="close"]').onclick = () => { live=false; ro.disconnect(); controls.dispose(); renderer.dispose(); root.remove(); };
  root.querySelector('[data-a="ldr"]').onclick = () => download(text, file.name.replace(/\.(io|ldr|mpd)$/i,'')+'.ldr','text/plain');
  root.querySelector('[data-a="glb"]').onclick = () => exportGLB(model, file.name.replace(/\.(io|ldr|mpd)$/i,'')+'.glb', 0.0004).catch(e=>alert('Ошибка экспорта: '+e.message));
  const known = new Set(await fetch(base+'catalog.json').then(r=>r.json()));
  await loader.preloadMaterials(base+'LDConfig.ldr');
  const cache = new Map(); const missing = new Map();
  async function getPart(id, color) {
    const key = id+'|'+color;
    if (!cache.has(key)) cache.set(key, (async () => {
      if (!known.has(id)) return null;
      try {
        const response = await fetch(base + 'packed/' + encodeURIComponent(id) + '.mpd');
        if (!response.ok) return null;
        const library = await response.text();
        const modelText = `0 FILE preview.ldr\n1 ${color} 0 0 0 1 0 0 0 1 0 0 0 1 ${id}\n0 NOFILE\n` + library;
        const result = await new Promise((resolve,reject)=>loader.parse(modelText,resolve,reject));
        let meshes = 0; result.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position?.count) meshes++; });
        return meshes ? result : null;
      } catch { return null; }
    })());
    return cache.get(key);
  }
  // Limit concurrent parsing: LDrawLoader caches shared primitives.
  for (const [i,p] of parsed.parts.entries()) {
    if (!live) return;
    const loaded = await getPart(p.id,p.color);
    let group;
    if (loaded) group = loaded.clone(true);
    else { missing.set(p.id,(missing.get(p.id)||0)+1); group = new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshStandardMaterial({color:0xff3eb5,wireframe:true})); }
    group.matrixAutoUpdate = false; group.matrix.fromArray(p.matrix); model.add(group);
    if (i % 20 === 0) status.textContent = `Загружено ${i+1} / ${parsed.parts.length}`;
  }
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model); const center=box.getCenter(new THREE.Vector3()), size=Math.max(box.getSize(new THREE.Vector3()).length(),50);
  controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(size*.65,size*.48,size*.8)); camera.near=size/10000; camera.far=size*100; camera.updateProjectionMatrix(); controls.update();
  root.querySelector('[data-a="glb"]').disabled = false;
  status.textContent = `Деталей: ${parsed.parts.length}; заменителей: ${[...missing.values()].reduce((a,b)=>a+b,0)}`;
  if (missing.size || parsed.warnings.length) {
    const title = document.createElement('b'); title.textContent='Недоступная геометрия (розовые рамки):'; warningEl.append(title);
    const list=document.createElement('ul'); for(const [id,n] of missing) {const li=document.createElement('li');li.textContent=`${id} × ${n}`;list.append(li);} for(const w of parsed.warnings){const li=document.createElement('li');li.textContent=w;list.append(li);} warningEl.append(list);
  }
}
