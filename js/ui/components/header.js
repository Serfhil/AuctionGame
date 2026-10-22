import { EXTRA_SLOT_REPUTATION, GOAL, WEEKS } from '../../config.js';
import { netWorth } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

/** Верхняя планка: неделя, касса, репутация и прогресс к цели. */
export function headerMarkup(game) {
  const worth = netWorth(game);
  const progress = Math.max(0, Math.min(100, (worth / GOAL) * 100));
  // Риски на шкале репутации показывают, где открываются дополнительные слоты каталога.
  const slotMarks = EXTRA_SLOT_REPUTATION.map((threshold) => `<b style="left:${threshold}%"></b>`).join('');
  return `<header class="bar">
 <div class="brand"><span class="mark">ДОМ ВЕРНЬЕ</span><span class="sub">аукционы с 1887 года</span></div>
 <dl class="stats">
  <div><dt>Неделя</dt><dd>${game.week}<small>/${WEEKS}</small></dd></div>
  <div><dt>Касса</dt><dd class="${game.cash < 0 ? 'neg' : ''}">${formatMoney(game.cash)}</dd></div>
  <div><dt>Репутация</dt><dd>${game.reputation}<small>/100</small></dd><div class="meter"><i style="width:${game.reputation}%"></i>${slotMarks}</div></div>
  <div><dt>Капитал · цель ${formatMoney(GOAL)}</dt><dd>${formatMoney(worth)}</dd><div class="meter"><i style="width:${progress}%"></i></div></div>
 </dl></header>`;
}
