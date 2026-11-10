// Attachments ("насадки"): groups of parts built on the robot in the builder and saved separately.
// On the field they lie on the storage strips; one click puts one on the robot (its parts are merged
// into the robot design at the same robot-frame positions they were built at).

import { PARTS } from '../shared/parts.js';
import { partShapes, shapeToCm, analyzeDesign } from '../shared/robot.js';

const KEY = 'fll.bioglow.attachments';

export const MISSIONS = [
  ['', 'любое задание'], ['m01', 'M01 Разведка дроном'], ['m02', 'M02 Взрывающиеся семена'], ['m03', 'M03 Переверни камень'],
  ['m04', 'M04 Счастливые листья'], ['m05', 'M05 Тянущиеся корни'], ['m06', 'M06 Муравьи-листорезы'], ['m07', 'M07 Огромный гриб'],
  ['m08', 'M08 Запутанная лиана'], ['m09', 'M09 Исследовательская платформа'], ['m10', 'M10 Хрупкие микросреды'],
  ['m11', 'M11 Окно в прошлое'], ['m12', 'M12 Лесной старейшина'], ['m13', 'M13 Ключевой вид'], ['m14', 'M14 Семена возрождения'],
  ['m15', 'M15 Биоцентричная архитектура'],
];
export const missionName = (id) => (MISSIONS.find((m) => m[0] === id) || MISSIONS[0])[1];

export function loadAttachments() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(a)) return a.filter((x) => x && Array.isArray(x.parts));
  } catch { /* ignore */ }
  return [];
}

export function saveAttachments(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

/** Robot design with the given attachments mounted. Part uids are prefixed so they never clash. */
export function composeDesign(base, atts) {
  const parts = base.parts.map((p) => ({ ...p }));
  for (const a of atts) for (const p of a.parts) parts.push({ ...p, uid: `${a.id}.${p.uid}` });
  return { ...base, parts };
}

/** How many of the attachment's parts would not be connected to the hub. */
export function looseParts(base, att) {
  const d = composeDesign(base, [att]);
  const an = analyzeDesign(d);
  let n = 0;
  d.parts.forEach((p, i) => { if (i >= base.parts.length && an.floating.has(i)) n++; });
  return n;
}

/** Display shapes (cm, robot frame) for drawing an attachment that lies on the table. */
export function attachmentShapes(att) {
  const out = [];
  for (const inst of att.parts) {
    const def = PARTS[inst.type];
    if (!def) continue;
    for (const s of partShapes(def)) out.push(shapeToCm(s, inst, def));
  }
  return out;
}

export const newAttachmentId = () => 'att' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
