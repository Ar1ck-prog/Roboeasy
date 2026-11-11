// Live scoresheet (mirrors the official BIOGLOW Founders Edition robot game scoresheet).

import { icon } from '../roboeasy/icons.js';
import { SHEET } from '../shared/scoring.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class ScorePanel {
  constructor(sheetEl, { onTotal } = {}) {
    this.el = sheetEl;
    this.onTotal = onTotal;
    this.cards = new Map();
    for (const m of SHEET) {
      const card = document.createElement('div');
      card.className = 'm-card';
      card.innerHTML = `
        <div class="m-head">
          <span class="m-num">${m.num === '—' ? '' : m.num}</span>
          <div class="m-name">${esc(m.ru)}<small>${esc(m.name)}</small></div>
          ${m.noEquip ? '<span class="m-noeq" title="Ограничение «без оборудования»: модель не должна касаться робота в конце матча">' + icon('ban') + '</span>' : ''}
          <span class="m-pts">0</span>
        </div>
        <div class="m-items">${m.items.map((it) => `<div class="m-item" data-key="${it.key}"><span class="v">—</span><span class="t">${esc(it.ru)}</span><span class="p">${esc(it.pts)}</span></div>`).join('')}</div>
        <div class="m-warn"></div>`;
      this.el.appendChild(card);
      this.cards.set(m.id, card);
    }
  }

  update({ answers, breakdown, warns }) {
    for (const m of SHEET) {
      const card = this.cards.get(m.id);
      const pts = breakdown[m.id] ?? 0;
      card.querySelector('.m-pts').textContent = pts;
      card.classList.toggle('scored', pts > 0);
      for (const it of m.items) {
        const v = answers[it.key];
        const cell = card.querySelector(`[data-key="${it.key}"] .v`);
        let text;
        let cls = '';
        if (it.type === 'yn') { text = v ? 'Да' : 'Нет'; cls = v ? 'yes' : 'no'; }
        else if (it.type === 'opt') { text = it.opts[v] ?? '—'; cls = it.key === 'm15_dock' ? '' : v ? 'yes' : 'no'; }
        else { text = String(v ?? 0); cls = v ? 'yes' : ''; }
        cell.textContent = text;
        cell.className = 'v ' + cls;
      }
      const w = (warns || []).filter((x) => x.startsWith(m.id.toUpperCase()));
      card.querySelector('.m-warn').textContent = w.join(' · ');
    }
  }
}
