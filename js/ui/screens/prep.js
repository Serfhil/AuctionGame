import { FIXED_COSTS } from '../../config.js';
import { MARKETING, findMarketing } from '../../data/marketing.js';
import { catalogLots } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

/** Подготовка торгов: реклама и просмотр каталога вечера. */
export function renderPrep(game) {
  const lots = catalogLots(game)
    .slice()
    .sort((a, b) => a.estLow - b.estLow);
  const chosen = findMarketing(game.marketingId);
  const remaining = game.cash - chosen.cost - FIXED_COSTS;
  const options = MARKETING.map(
    (option) =>
      `<button class="mkt ${option.id === game.marketingId ? 'on' : ''}" data-act="marketing" data-id="${option.id}" ${option.cost > game.cash ? 'disabled' : ''}><b>${option.name}</b><span class="cost">${formatMoney(option.cost)}</span><span>${option.description}</span></button>`,
  ).join('');
  const rows = lots
    .map(
      (lot, i) =>
        `<div><span>${i + 1}. ${lot.name}${lot.owned ? ' <span class="chip">ваш</span>' : ''}</span><span class="mono">${formatMoney(lot.estLow)}–${formatMoney(lot.estHigh)}</span></div>`,
    )
    .join('');
  return `<main>
 <div class="head"><span class="eyebrow">Неделя ${game.week} · подготовка торгов</span><h2 class="h2">Кого позвать в зал?</h2>
  <p class="lede">Чем богаче зал, тем выше цены на дорогие лоты. Дешёвым вещам богатые покупатели не нужны.</p></div>
 <div class="mkts">${options}</div>
 <section class="section"><div class="section-t">Каталог вечера</div>
  <div class="list">${rows}</div></section>
 <section class="sum">
  <div><dt>Касса сейчас</dt><dd>${formatMoney(game.cash)}</dd></div>
  <div><dt>Реклама</dt><dd>−${formatMoney(chosen.cost).replace('−', '')}</dd></div>
  <div><dt>Аренда и персонал</dt><dd>−${formatMoney(FIXED_COSTS)}</dd></div>
  <div><dt>Останется до выручки</dt><dd class="${remaining < 0 ? 'neg' : ''}">${formatMoney(remaining)}</dd></div>
 </section>
 <div class="footbar"><button class="btn" data-act="toIntake">← К лотам</button><button class="btn primary big" data-act="startNight">Открыть торги</button></div>
 </main>`;
}
