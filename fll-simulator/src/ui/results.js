// End-of-match card in the top-right corner of the field: fouls, scored missions and the total.

import { icon } from '../roboeasy/icons.js';
import { SHEET, MAX_SCORE } from '../shared/scoring.js';
import { MATCH_TIME } from '../shared/field.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class MatchResults {
  constructor(el) {
    this.el = el;
    this.fouls = [];          // { at: seconds since match start }
    this.tokens = 6;
    this.closed = false;
    el.addEventListener('click', (e) => { if (e.target.closest('.res-close')) { this.closed = true; this.hide(); } });
  }

  /** Called with every match status: a drop in tokens is an interruption outside home. */
  track(m) {
    if (m.tokens < this.tokens && m.phase !== 'free') {
      for (let i = m.tokens; i < this.tokens; i++) this.fouls.push({ at: MATCH_TIME - m.time });
    }
    if (m.tokens > this.tokens) this.fouls = [];
    this.tokens = m.tokens;
  }

  /** New match / free mode / field reset. */
  clear() {
    this.fouls = [];
    this.closed = false;
    this.hide();
  }

  hide() { this.el.classList.remove('show'); }

  show({ breakdown, total, warns, answers }) {
    if (this.closed) return;
    const fouls = this.fouls.map((f) => `<li><span class="res-ico">${icon('hand')}</span><span>${fmt(f.at)} — прерывание вне базы</span><b>−1 жетон</b></li>`);
    if (!answers.insp) fouls.unshift('<li><span class="res-ico">' + icon('x') + '</span><span>Осмотр оборудования не пройден</span><b>0</b></li>');
    for (const w of warns || []) fouls.push(`<li><span class="res-ico">${icon('alert')}</span><span>${esc(w)}</span></li>`);
    const missions = SHEET.filter((m) => /^m\d/.test(m.id) && breakdown[m.id] > 0)
      .map((m) => `<li><span class="res-num">${m.num}</span><span>${esc(m.ru)}</span><b>${breakdown[m.id]}</b></li>`);
    const extra = [
      answers.insp ? `<li><span class="res-num"></span><span>Осмотр оборудования</span><b>${breakdown.insp}</b></li>` : '',
      `<li><span class="res-num"></span><span>Жетоны точности (${answers.tokens} из 6)</span><b>${breakdown.tokens}</b></li>`,
    ];
    this.el.innerHTML = `
      <div class="res-head">
        <img src="./assets/logo-small.png" alt="" />
        <div><div class="res-title">BIOGLOW</div><div class="res-sub">Итог матча 2:30</div></div>
        <button class="res-close" title="Закрыть"></button>
      </div>
      <div class="res-sec">Фолы <span>${this.fouls.length}</span></div>
      <ul class="res-list fouls">${fouls.length ? fouls.join('') : '<li class="none">Фолов нет — все 6 жетонов на месте</li>'}</ul>
      <div class="res-sec">Выполненные задания <span>${missions.length}</span></div>
      <ul class="res-list">${missions.length ? missions.join('') : '<li class="none">Пока ни одной миссии</li>'}${extra.join('')}</ul>
      <div class="res-total"><span>Набрано баллов</span><b>${total}</b><small>/ ${MAX_SCORE}</small></div>`;
    this.el.classList.add('show');
  }
}
