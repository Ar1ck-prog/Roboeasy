import './styles.css';
import './roboeasy/theme.css';
import './roboeasy/mobile.css';
// FLL BIOGLOW simulator — main thread: UI, rendering, communication with the physics worker.

import { FieldView } from './render/fieldView.js';
import { ScorePanel } from './ui/scorePanel.js';
import { CodeEditor, EXAMPLES } from './ui/editor.js';
import { renderHelp } from './ui/help.js';
import { RUNS } from './ui/runs.js';
import { MatchResults } from './ui/results.js';
import { loadAttachments, saveAttachments, composeDesign, attachmentShapes, looseParts, missionName } from './ui/attachments.js';
import { templateDriveBase } from './shared/robot.js';
import { loadLDraw } from './render/ldraw.js';

// real SPIKE Prime part meshes (LDraw); the field view and the builder redraw once they are in
loadLDraw().then(() => refreshAttachments());

const $ = (s) => document.querySelector(s);
const DESIGN_KEY = 'fll.bioglow.design';
const MOUNTED_KEY = 'fll.bioglow.mounted';
const SETTINGS_KEY = 'fll.bioglow.settings';

// ---------------------------------------------------------------------------------------------
// persistent state
// ---------------------------------------------------------------------------------------------
function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function saveJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

const state = {
  design: loadJSON(DESIGN_KEY, null) || templateDriveBase(),
  attachments: loadAttachments(),
  mounted: loadJSON(MOUNTED_KEY, []),
  settings: { docks: { farm: 'm13', mine: 'm14', city: 'm15' }, side: 'left', opponent: { rootFull: false, mycelium: false }, gp: 3, ...loadJSON(SETTINGS_KEY, {}) },
  running: false,
  match: null,
  sab: null,
  ctrl: null,
  isab: null,
  worker: null,
  scene: null,
  paused: false,
};

// ---------------------------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------------------------
let builder = null;
document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', async () => {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
  if (btn.dataset.tab === 'builder' && !builder) {
    const [{ RobotBuilder }] = await Promise.all([import('./builder/builder.js'), loadLDraw()]);
    builder = new RobotBuilder({
      palette: $('#palette'), view: $('#builderView'), props: $('#props'), hint: $('#builderHint'),
      design: structuredClone(state.design),
      onApply: (d) => applyDesign(d),
      onAttachments: (list) => { state.attachments = list; state.mounted = state.mounted.filter((id) => list.some((a) => a.id === id)); saveJSON(MOUNTED_KEY, state.mounted); refreshAttachments(); },
    });
    if (import.meta.env.DEV) window.__builder = builder;
  }
  if (btn.dataset.tab === 'builder' && builder) builder.activate();
}));

function applyDesign(d) {
  state.design = structuredClone(d);
  saveJSON(DESIGN_KEY, state.design);
  // a new base robot starts without attachments: they lie at the table edges
  state.mounted = [];
  saveJSON(MOUNTED_KEY, state.mounted);
  refreshAttachments();
  state.worker?.postMessage({ type: 'setDesign', design: state.design });
  document.querySelector('.tab[data-tab="sim"]').click();
  logLine('🤖 Новый робот загружен на поле: ' + (d.name || ''), 'info');
}

// ---------------------------------------------------------------------------------------------
// console
// ---------------------------------------------------------------------------------------------
const consoleEl = $('#console');
function logLine(text, kind = 'out') {
  const div = document.createElement('div');
  div.className = kind;
  div.textContent = text;
  consoleEl.appendChild(div);
  while (consoleEl.childElementCount > 400) consoleEl.firstChild.remove();
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ---------------------------------------------------------------------------------------------
// field view & score panel
// ---------------------------------------------------------------------------------------------
const field = new FieldView($('#field'), {
  onDrag: (d) => state.worker?.postMessage({ type: 'drag', ...d }),
  onAttachment: (id) => toggleAttachment(id),
  onKey: (e, down) => handleKey(e, down),
});
field.dragEnabled = true;
const scorePanel = new ScorePanel($('#sheet'));
const results = new MatchResults($('#results'));

// ---------------------------------------------------------------------------------------------
// keyboard manual driving
// ---------------------------------------------------------------------------------------------
const keyMap = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyR: 'au', KeyF: 'ad', KeyT: 'bu', KeyG: 'bd', ShiftLeft: 'slow', ShiftRight: 'slow' };
const keys = {};
function handleKey(e, down) {
  if ((e.code === 'KeyQ' || e.code === 'KeyE') && down) {
    if (field.rotateDrag(e.code === 'KeyQ' ? 5 : -5)) { e.preventDefault(); return; }
  }
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  if (keys[k] === down) return;
  keys[k] = down;
  state.worker?.postMessage({ type: 'manual', keys: { ...keys } });
}
window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; state.worker?.postMessage({ type: 'manual', keys: {} }); });

// ---------------------------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------------------------
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function renderTokens(n) {
  $('#tokens').innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="${i < n ? '' : 'lost'}"></span>`).join('');
}
renderTokens(6);

function updateHud(frame) {
  const m = frame.match;
  state.match = m;
  const timer = $('#timer');
  timer.textContent = fmtTime(m.time);
  timer.classList.toggle('running', m.phase === 'running');
  timer.classList.toggle('low', m.phase === 'running' && m.time < 15);
  timer.classList.toggle('free', m.phase === 'free');
  showMode(m.phase);
  renderTokens(m.tokens);
  field.setTokens(m.tokens);
  results.track(m);
  const phaseText = { free: '🏋 Тренировка (без таймера)', ready: 'Матч: ждёт старта таймера', running: 'Матч идёт', ended: 'Матч окончен' }[m.phase];
  $('#hudMatch').innerHTML = `<div class="ttl">${phaseText}</div>
    <div class="row"><span class="k">Время</span><span>${m.phase === 'free' ? '—' : fmtTime(m.time)}</span></div>
    <div class="row"><span class="k">Запусков</span><span>${m.launches}</span></div>
    ${m.phase !== 'free' ? `<div class="row"><span class="k">Осмотр</span><span>${m.insp ? '✅ 20' : '❌ 0'}</span></div>` : ''}`;
  const r = frame.robot;
  if (r) {
    const motors = Object.entries(r.motors).map(([p, v]) => `<div class="row"><span class="k">Мотор ${p}</span><span>${v.angle}° · ${v.speed}°/с${v.stalled ? ' ⚠' : ''}</span></div>`).join('');
    $('#hudRobot').innerHTML = `<div class="ttl">Робот ${frame.running ? '· программа работает' : ''}</div>
      <div class="row"><span class="k">Гироскоп (курс)</span><span>${r.heading}°</span></div>${motors}`;
  }
}

// ---------------------------------------------------------------------------------------------
// worker
// ---------------------------------------------------------------------------------------------
function createWorker() {
  const w = new Worker(new URL('./sim/worker.js', import.meta.url), { type: 'module' });
  state.worker = w;
  if (self.crossOriginIsolated) {
    state.sab = new SharedArrayBuffer(16);
    state.ctrl = new Int32Array(state.sab);
    state.ctrl[2] = 100;
    state.isab = new SharedArrayBuffer(4);
    state.interrupt = new Uint8Array(state.isab);
  }
  w.onmessage = (ev) => onWorkerMessage(ev.data);
  w.onerror = (e) => logLine('Ошибка воркера: ' + e.message, 'err');
  w.postMessage({
    type: 'init',
    sab: state.sab,
    isab: state.isab,
    pyBase: new URL('./pyodide/', document.baseURI).href,
    matUrl: new URL('./assets/mat.jpg', document.baseURI).href,
    design: robotDesign(),
    cfg: { docks: state.settings.docks, opponent: state.settings.opponent },
    preloadPython: true,
  });
}

function onWorkerMessage(msg) {
  switch (msg.type) {
    case 'ready':
      $('#loading').classList.add('hidden');
      if (!msg.sab) logLine('⚠ Нет SharedArrayBuffer: пауза/стоп программы работают через перезапуск симулятора.', 'sys');
      break;
    case 'scene':
      state.scene = msg;
      field.setScene(msg.bodies, msg.robot?.bodies);
      if (msg.robot?.warnings?.length) for (const w of msg.robot.warnings) logLine('🤖 ' + w, 'err');
      break;
    case 'frame':
      field.applyPoses(msg.poses);
      updateHud(msg);
      break;
    case 'score':
      if (import.meta.env.DEV) window.__lastScore = msg;
      scorePanel.update(msg);
      $('#scoreTotal').textContent = msg.total;
      $('#scoreMode').textContent = msg.final ? 'ИТОГ матча' : 'в реальном времени';
      if (msg.final) results.show(msg);
      break;
    case 'console':
      logLine(msg.text, msg.kind);
      break;
    case 'program':
      state.running = msg.state === 'running';
      clearTimeout(state.stopTimer);
      $('#btnRun').disabled = state.running;
      break;
    case 'py':
      $('#pyState').textContent = msg.state === 'loading' ? '⏳ Python загружается…' : '🐍 Python готов';
      break;
    case 'swap':
      if (msg.ok && state.pendingMount) {
        state.mounted = state.pendingMount;
        saveJSON(MOUNTED_KEY, state.mounted);
        refreshAttachments();
        if (state.pendingMsg) logLine(state.pendingMsg, 'info');
        const prog = state.pendingProgram;
        const pi = prog ? editor.programs.findIndex((p) => p.name === prog) : -1;
        if (pi >= 0 && pi !== editor.current) { editor.select(pi); refreshPrograms(); logLine(`📄 Открыта программа «${prog}» для этой насадки`, 'sys'); }
      }
      state.pendingMount = null;
      break;
    case 'match':
      state.match = msg;
      if (msg.inspText && msg.phase === 'ready') $('#inspText').textContent = (msg.insp ? '✅ ' : '❌ ') + msg.inspText;
      break;
    case 'debug':
      window.__debugResults = window.__debugResults || {};
      window.__debugResults[msg.id] = msg.result;
      break;
    case 'hub':
      if (msg.display !== undefined) {
        const d = $('#hubDisplay');
        d.textContent = msg.display;
        d.style.display = msg.display ? 'block' : 'none';
      }
      if (msg.beep) beep(msg.beep[0], msg.beep[1]);
      break;
    default:
      break;
  }
}

let audio = null;
function beep(freq, ms) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + Math.min(2, ms / 1000));
  } catch { /* audio unavailable */ }
}

function hardRestart() {
  logLine('♻ Перезапуск симулятора…', 'sys');
  state.worker?.terminate();
  state.running = false;
  $('#btnRun').disabled = false;
  $('#loading').classList.remove('hidden');
  createWorker();
}

// ---------------------------------------------------------------------------------------------
// code editor & program control
// ---------------------------------------------------------------------------------------------
const editor = new CodeEditor($('#editor'), { onRun: () => runProgram() });
const progSel = $('#programSelect');
function refreshPrograms() {
  progSel.innerHTML = editor.programs.map((p, i) => `<option value="${i}" ${i === editor.current ? 'selected' : ''}>${p.name}</option>`).join('');
  if ($('#attPanel').classList.contains('show')) renderAttPanel();
}
refreshPrograms();
progSel.addEventListener('change', () => { editor.select(+progSel.value); });
$('#btnNewProg').onclick = () => { const n = prompt('Название программы (запуска):', `Запуск ${editor.programs.length + 1}`); if (n) { editor.add(n); refreshPrograms(); } };
$('#btnRenameProg').onclick = () => { const n = prompt('Новое название:', editor.name); if (n) { editor.rename(n); refreshPrograms(); } };
$('#btnDelProg').onclick = () => { if (confirm('Удалить программу «' + editor.name + '»?')) { editor.remove(); refreshPrograms(); } };
const exSel = $('#exampleSelect');
exSel.innerHTML += `<optgroup label="Примеры">${EXAMPLES.map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}</optgroup>`
  + `<optgroup label="Готовые выезды (Робот-база FLL)">${RUNS.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}`
  + '<option value="all-runs">⚡ Загрузить все выезды сразу</option></optgroup>';
exSel.addEventListener('change', () => {
  const id = exSel.value;
  exSel.value = '';
  if (id === 'all-runs') {
    if (!confirm(`Добавить ${RUNS.length} программ-выездов, каждую в свою вкладку?`)) return;
    const first = editor.programs.length;
    for (const r of RUNS) editor.add(r.name, r.code);
    editor.select(first);
    refreshPrograms();
    logLine('Выезды загружены. Порядок: 1 и 2 — с левой базы, 3 заканчивается в правой базе, 4 и 5 — с правой. Перед каждым выездом нажимайте «🏠 На старт».', 'info');
    return;
  }
  const ex = EXAMPLES.find((e) => e.id === id) || RUNS.find((r) => r.id === id);
  if (!ex) return;
  if (confirm(`Открыть «${ex.name}» в новой вкладке программы?`)) { editor.add(ex.name, ex.code); refreshPrograms(); }
});

function runProgram() {
  if (state.running) return;
  editor.save();
  logLine(`▶ Запуск «${editor.name}»`, 'sys');
  state.worker.postMessage({ type: 'run', code: editor.code, name: editor.name });
}
function stopProgram() {
  if (!state.running) return;
  if (state.ctrl) {
    Atomics.store(state.ctrl, 0, 1);
    if (state.interrupt) state.interrupt[0] = 2;
    clearTimeout(state.stopTimer);
    state.stopTimer = setTimeout(() => { if (state.running) hardRestart(); }, 2500);
  } else hardRestart();
}
$('#btnRun').onclick = runProgram;
$('#btnStop').onclick = stopProgram;
$('#btnInterrupt').onclick = () => {
  stopProgram();
  setTimeout(() => state.worker.postMessage({ type: 'interrupt' }), state.running ? 120 : 0);
};

// ---------------------------------------------------------------------------------------------
// toolbar
// ---------------------------------------------------------------------------------------------
$('#matchSide').value = state.settings.side;
$('#matchSide').onchange = () => {
  state.settings.side = $('#matchSide').value;
  saveJSON(SETTINGS_KEY, state.settings);
  // in free mode the robot moves to the chosen launch area right away
  state.worker.postMessage({ type: 'toStart', side: state.settings.side, force: true });
};
$('#btnMatch').onclick = () => {
  stopProgram();
  results.clear();
  state.worker.postMessage({ type: 'matchStart', side: $('#matchSide').value });
  logLine('🏁 Матч: поле сброшено, осмотр оборудования… Нажмите ⏱ Старт 2:30 или ▶ Запуск — таймер пойдёт.', 'info');
};
// hide / show the code and score panels; with the code panel hidden its run buttons move to the toolbar
state.settings.panels = { code: true, score: true, ...state.settings.panels };
function applyPanels() {
  const { code, score } = state.settings.panels;
  $('#codePanel').classList.toggle('hidden', !code);
  $('#scorePanel').classList.toggle('hidden', !score);
  $('#btnToggleCode').classList.toggle('on', code);
  $('#btnToggleScore').classList.toggle('on', score);
  if (code) $('#codePanel').insertBefore($('#runBar'), $('#console'));
  else $('#runSlot').appendChild($('#runBar'));
}
function togglePanel(name) {
  state.settings.panels[name] = !state.settings.panels[name];
  saveJSON(SETTINGS_KEY, state.settings);
  applyPanels();
}
$('#btnToggleCode').onclick = () => togglePanel('code');
$('#btnToggleScore').onclick = () => togglePanel('score');
applyPanels();
// ---------------------------------------------------------------------------------------------
// attachments: lie at the table edges, one click puts one on the robot (only while it is at home)
// ---------------------------------------------------------------------------------------------
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function robotDesign(mounted = state.mounted) {
  return composeDesign(state.design, state.attachments.filter((a) => mounted.includes(a.id)));
}
function refreshAttachments() {
  field.setAttachments(state.attachments.filter((a) => !state.mounted.includes(a.id)).map((a) => ({ id: a.id, name: a.name, shapes: attachmentShapes(a) })));
  renderAttPanel();
}
function toggleAttachment(id) {
  const a = state.attachments.find((x) => x.id === id);
  if (!a || state.pendingMount) return;
  const on = state.mounted.includes(id);
  const next = on ? state.mounted.filter((x) => x !== id) : [...state.mounted, id];
  if (!on) {
    const loose = looseParts(state.design, a);
    if (loose === a.parts.length) { logLine(`⛔ Насадка «${a.name}» не держится на этом роботе: ни одна деталь не соединена с ним. Соберите её заново в 🔧 Конструкторе.`, 'err'); return; }
    if (loose) logLine(`⚠ У насадки «${a.name}» ${loose} дет. не соединены с роботом — они не попадут на поле`, 'err');
  }
  state.pendingMount = next;
  state.pendingMsg = on ? `🧩 Насадка «${a.name}» снята и лежит у края стола` : `🧩 Надета насадка «${a.name}»${a.mission ? ' — ' + missionName(a.mission) : ''}`;
  state.pendingProgram = on ? '' : a.program;
  state.worker.postMessage({ type: 'swapRobot', design: robotDesign(next), label: a.name });
}
function renderAttPanel() {
  const el = $('#attPanel');
  const list = state.attachments;
  el.innerHTML = `<div class="ap-head"><b>🧩 Насадки</b><button class="res-close" data-ap="close" title="Закрыть">✕</button></div>
    ${list.length ? `<div class="muted ap-hint">Клик по насадке у края стола или кнопка — надеть / снять. Менять насадку можно, пока робот на базе.</div>
    <ul class="ap-list">${list.map((a) => {
      const on = state.mounted.includes(a.id);
      return `<li class="${on ? 'on' : ''}"><div class="ap-row"><div><b>${escHtml(a.name)}</b><small>${escHtml(missionName(a.mission))}</small></div>
        <button class="btn small ${on ? 'stop' : 'primary'}" data-ap="toggle" data-id="${a.id}">${on ? 'Снять' : 'Надеть'}</button></div>
        <label class="ap-prog">Программа <select data-ap="prog" data-id="${a.id}"><option value="">—</option>${editor.programs.map((p) => `<option ${a.program === p.name ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('')}</select></label></li>`;
    }).join('')}</ul>` : `<div class="muted ap-hint">Насадок пока нет. Откройте 🔧 Конструктор робота, соберите насадку на роботе, выделите её детали и нажмите «💾 Сохранить насадку».</div>`}`;
}
$('#attPanel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ap]');
  if (!b) return;
  if (b.dataset.ap === 'close') toggleAttPanel(false);
  if (b.dataset.ap === 'toggle') toggleAttachment(b.dataset.id);
});
$('#attPanel').addEventListener('change', (e) => {
  const s = e.target.closest('[data-ap="prog"]');
  if (!s) return;
  const a = state.attachments.find((x) => x.id === s.dataset.id);
  if (!a) return;
  a.program = s.value;
  saveAttachments(state.attachments);
});
function toggleAttPanel(show = !$('#attPanel').classList.contains('show')) {
  if (show) renderAttPanel();
  $('#attPanel').classList.toggle('show', show);
  $('#btnAtt').classList.toggle('on', show);
}
$('#btnAtt').onclick = () => toggleAttPanel();

// training (no clock, no penalties) <-> match (2:30 clock, precision tokens, result card)
function showMode(phase) {
  if (phase === state.shownPhase) return;
  state.shownPhase = phase;
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'free') === (phase === 'free')));
  $('#btnTimer').classList.toggle('hidden', phase !== 'ready');
  $('#btnMatch').classList.toggle('hidden', phase === 'free');
}
$('#modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.mode === 'match') { if (state.match?.phase === 'free' || !state.match) $('#btnMatch').onclick(); return; }
  if (state.match?.phase === 'free') return;
  results.clear();
  state.worker.postMessage({ type: 'freeMode' });
  logLine('🏋 Тренировка: без таймера и штрафов.', 'sys');
});
$('#btnTimer').onclick = () => state.worker.postMessage({ type: 'timerStart' });
$('#btnReset').onclick = () => { stopProgram(); results.clear(); state.worker.postMessage({ type: 'reset' }); };
$('#btnToStart').onclick = () => state.worker.postMessage({ type: 'toStart', side: $('#matchSide').value });
$('#speedSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  document.querySelectorAll('#speedSeg button').forEach((x) => x.classList.toggle('on', x === b));
  if (state.ctrl) Atomics.store(state.ctrl, 2, Math.round(parseFloat(b.dataset.speed) * 100));
});
$('#btnPause').onclick = () => {
  state.paused = !state.paused;
  if (state.ctrl) Atomics.store(state.ctrl, 1, state.paused ? 1 : 0);
  $('#btnPause').textContent = state.paused ? '▶' : '⏸';
};
$('#viewSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  document.querySelectorAll('#viewSeg button').forEach((x) => x.classList.toggle('on', x === b));
  field.setView(b.dataset.view, true);
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runProgram(); }
  if (e.key === 'Escape' && state.running) stopProgram();
});

// ---------------------------------------------------------------------------------------------
// setup box: docks, opponent (M07 bonus), GP
// ---------------------------------------------------------------------------------------------
const DOCK_NAMES = { mine: 'Шахта', city: 'Город', farm: 'Ферма' };
const MODEL_NAMES = { m13: 'M13 Ключевой вид', m14: 'M14 Семена возрождения', m15: 'M15 Архитектура' };
function renderSetup() {
  const s = state.settings;
  const byModel = Object.fromEntries(Object.entries(s.docks).map(([d, m]) => [m, d]));
  $('#setupBox').innerHTML = `
    ${['m13', 'm14', 'm15'].map((m) => `<div class="row"><span>${MODEL_NAMES[m]}</span><select data-model="${m}">${Object.keys(DOCK_NAMES).map((d) => `<option value="${d}" ${byModel[m] === d ? 'selected' : ''}>Док: ${DOCK_NAMES[d]}</option>`).join('')}</select></div>`).join('')}
    <label title="Бонус M07 возможен только при наличии соперника за соседним столом"><input type="checkbox" id="oppRoot" ${s.opponent.rootFull ? 'checked' : ''}/> Соперник: корень M05 полностью выдвинут</label>
    <label><input type="checkbox" id="oppMyc" ${s.opponent.mycelium ? 'checked' : ''}/> Соперник: мицелий M07 выдвинут</label>
    <div class="row"><span class="muted">Gracious Professionalism® (не входит в очки игры)</span><select id="gpSel">${[2, 3, 4].map((v) => `<option ${s.gp === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="muted" id="inspText"></div>`;
  $('#setupBox').querySelectorAll('select[data-model]').forEach((sel) => sel.addEventListener('change', () => {
    const model = sel.dataset.model;
    const dock = sel.value;
    const docks = { ...s.docks };
    const prevDock = Object.keys(docks).find((d) => docks[d] === model);
    const other = docks[dock];
    docks[dock] = model;
    docks[prevDock] = other;
    s.docks = docks;
    saveJSON(SETTINGS_KEY, s);
    renderSetup();
    state.worker.postMessage({ type: 'reset', cfg: { docks } });
    logLine(`Доки: Шахта=${docks.mine.toUpperCase()}, Город=${docks.city.toUpperCase()}, Ферма=${docks.farm.toUpperCase()}`, 'sys');
  }));
  const opp = () => {
    s.opponent = { rootFull: $('#oppRoot').checked, mycelium: $('#oppMyc').checked };
    saveJSON(SETTINGS_KEY, s);
    state.worker.postMessage({ type: 'opponent', opponent: s.opponent });
  };
  $('#oppRoot').onchange = opp;
  $('#oppMyc').onchange = opp;
  $('#gpSel').onchange = () => { s.gp = +$('#gpSel').value; saveJSON(SETTINGS_KEY, s); };
}
renderSetup();

// ---------------------------------------------------------------------------------------------
if (import.meta.env.DEV) {
  window.__field = field;
  // dev helper: await window.simDebug("return phys.time")
  let seq = 0;
  window.simDebug = (code) => new Promise((resolve) => {
    const id = ++seq;
    state.worker.postMessage({ type: 'debug', id, code });
    const t = setInterval(() => {
      if (window.__debugResults?.[id] !== undefined) { clearInterval(t); resolve(JSON.parse(window.__debugResults[id])); }
    }, 20);
  });
  // dev helper: reset the field, run a program, wait for the score to settle; returns a short report
  window.simTest = async (code, { reset = true, settle = 1500, side = 'left', katydid } = {}) => {
    if (reset) {
      const pose = side === 'left' ? { x: -78, z: 42.15, yaw: 0 } : { x: 78, z: 42.15, yaw: 0 };
      state.worker.postMessage({ type: 'reset', pose, katydid });
      await new Promise((r) => setTimeout(r, 2200));
    }
    const lines = await window.simRun(code);
    await new Promise((r) => setTimeout(r, settle));
    const s = window.__lastScore;
    const pts = Object.fromEntries(Object.entries(s.breakdown).filter(([k, v]) => v && k !== 'tokens' && k !== 'insp'));
    const pose = await window.simDebug('return simApi.debug_pose()');
    return { total: s.total, pts, lines: lines.filter((l) => !l.startsWith('✅')), pose };
  };
  // dev helper: play ready-made runs one after another like a driver would (🏠 before each run)
  window.simRuns = async (ids = RUNS.map((r) => r.id), { reset = true, settle = 1500 } = {}) => {
    const out = [];
    for (const [i, id] of ids.entries()) {
      const r = RUNS.find((x) => x.id === id);
      if (i > 0 || !reset) {
        state.worker.postMessage({ type: 'toStart', side: r.side });
        await new Promise((res) => setTimeout(res, 600));
      }
      const t0 = await window.simDebug('return phys.time');
      const res = await window.simTest(r.code, { settle, side: r.side, reset: reset && i === 0 });
      const t1 = await window.simDebug('return phys.time');
      out.push({ id, total: res.total, pts: res.pts, pose: res.pose, time: +(t1 - t0).toFixed(1) });
    }
    return out;
  };
  // dev helper: run a program and wait until it ends, returns console lines printed meanwhile
  window.simRun = (code) => new Promise((resolve) => {
    const start = consoleEl.childElementCount;
    state.worker.postMessage({ type: 'run', code, name: 'test' });
    state.running = true;
    const t = setInterval(() => {
      if (!state.running) {
        clearInterval(t);
        resolve([...consoleEl.children].slice(start).map((d) => d.textContent));
      }
    }, 50);
  });
}

renderHelp($('#help'));
logLine('Добро пожаловать в симулятор FLL BIOGLOW! Слева — код робота (Python), справа — протокол очков.', 'info');
logLine('Робот стоит в левой зоне запуска. Нажмите ▶ Запуск или поуправляйте с клавиатуры (щёлкните по полю).', 'sys');
createWorker();

