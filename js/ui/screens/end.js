import { GOAL } from '../../config.js';
import { seasonRating } from '../../engine/rating.js';
import { netWorth } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

/** Финал сезона. bestWorth — лучший капитал за все партии. */
export function renderEnd(game, bestWorth) {
  const rating = seasonRating(game);
  const stats = game.stats;
  return `<main>
 <div class="head" style="gap:14px"><span class="eyebrow">Сезон закрыт · ${game.week} ${game.week === 1 ? 'неделя' : 'недель'}</span>
  <h1 class="endbig">${rating.title}</h1><p class="lede">${rating.subtitle}</p></div>
 <section class="sum">
  <div><dt>Капитал</dt><dd class="${rating.win ? 'pos' : ''}">${formatMoney(netWorth(game))}</dd></div>
  <div><dt>Цель</dt><dd>${formatMoney(GOAL)}</dd></div>
  <div><dt>Репутация</dt><dd>${game.reputation}/100</dd></div>
  <div><dt>Оборот торгов</dt><dd>${formatMoney(stats.turnover)}</dd></div>
  <div><dt>Продано лотов</dt><dd>${stats.sold}</dd></div>
  <div><dt>Не продано</dt><dd>${stats.unsold}</dd></div>
  <div><dt>Подделок снято вовремя</dt><dd>${stats.fakesStopped}</dd></div>
  <div><dt>Скандалов с подделками</dt><dd class="${stats.exposed ? 'neg' : ''}">${stats.exposed}</dd></div>
 </section>
 ${stats.best ? `<p class="hint">Рекорд сезона: ${stats.best.name}, молоток на ${formatMoney(stats.best.price)}.</p>` : ''}
 ${bestWorth ? `<p class="hint">Лучший капитал за все игры: ${formatMoney(bestWorth)}.</p>` : ''}
 <div class="row"><button class="btn primary big" data-act="restart">Сыграть ещё раз</button></div>
 </main>`;
}
