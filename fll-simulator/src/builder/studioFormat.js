import { ZipReader, BlobReader, TextWriter } from '@zip.js/zip.js';
import { Matrix4 } from 'three';

const MAX_FILE = 30 * 1024 * 1024;
export async function readStudioFile(file) {
  if (file.size > MAX_FILE) throw new Error('Файл превышает 30 МБ');
  if (!/\.io$/i.test(file.name)) return file.text();
  const zip = new ZipReader(new BlobReader(file));
  try {
    const entries = await zip.getEntries();
    const entry = entries.find(e => e.filename.toLowerCase() === 'model.ldr');
    if (!entry || entry.uncompressedSize > MAX_FILE) throw new Error('В архиве нет подходящего model.ldr');
    return await entry.getData(new TextWriter(), { password: 'soho0909', maxWorkers: 1 });
  } finally { await zip.close(); }
}

export function parseLDraw(text) {
  if (text.length > MAX_FILE) throw new Error('Модель слишком велика');
  const files = new Map(); let current = null; let first = null;
  const initial = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const file = /^0\s+FILE\s+(.+)$/i.exec(line);
    if (file) { current = file[1].trim().toLowerCase().replaceAll('\\','/'); if (!first) first = current; if (!files.has(current)) files.set(current, []); continue; }
    if (/^0\s+NOFILE\b/i.test(line)) { current = null; continue; }
    if (current) files.get(current).push(line); else if (!first) initial.push(line);
  }
  if (!first) { first = 'model.ldr'; files.set(first, initial); }
  const out = []; const warnings = [];
  function walk(name, parent, color, stack) {
    if (stack.includes(name) || stack.length > 32) { warnings.push(`Циклическая или слишком глубокая сборка: ${name}`); return; }
    for (const line of files.get(name) || []) {
      if (!/^1\s/.test(line)) continue;
      const t = line.split(/\s+/);
      if (t.length < 15) { warnings.push('Пропущена повреждённая строка детали'); continue; }
      const n = t.slice(2,14).map(Number); if (n.some(x => !Number.isFinite(x))) { warnings.push('Неверная матрица детали'); continue; }
      const [x,y,z,a,b,c,d,e,f,g,h,i] = n;
      const m = new Matrix4().set(a,b,c,x,d,e,f,y,g,h,i,z,0,0,0,1);
      const world = parent.clone().multiply(m);
      const part = t.slice(14).join(' ').replaceAll('\\','/').toLowerCase();
      const nextColor = t[1] === '16' ? color : t[1];
      if (files.has(part) && !part.endsWith('.dat')) walk(part, world, nextColor, [...stack,name]);
      else out.push({ id: part, color: nextColor, matrix: world.elements.slice() });
      if (out.length > 10000) throw new Error('Слишком много деталей (максимум 10000)');
    }
  }
  walk(first, new Matrix4(), '16', []);
  if (!out.length) throw new Error('В файле не найдено деталей LDraw');
  return { parts: out, warnings };
}
