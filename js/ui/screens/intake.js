import { catalogCapacity, catalogLots, nextSlotReputation } from '../../engine/state.js';
import { plural } from '../../util/format.js';
import { lotTableMarkup } from '../components/lot-table.js';
import { staffPanelMarkup } from '../components/staff-panel.js';

/** Приём лотов: выбор предложений для каталога вечера. */
export function renderIntake(game) {
  const inCatalog = catalogLots(game).length;
  const capacity = catalogCapacity(game);
  const cells = Array.from({ length: capacity }, (_, i) => `<i class="${i < inCatalog ? 'on' : ''}"></i>`).join('');
  const nextSlot = nextSlotReputation(game);
  const slotHint = nextSlot === null ? '' : `Ещё один слот откроется при репутации ${nextSlot}.`;
  const leftovers = game.owned.length
    ? `<section class="section"><div class="section-t">Уже ваши · не проданы с прошлых торгов</div>${lotTableMarkup(game, game.owned)}</section>`
    : '';
  return `<main>
 <div class="head"><span class="eyebrow">Неделя ${game.week} · приём лотов</span>
  <h2 class="h2">Что выставим на торги?</h2>
  <p class="lede">В каталог помещается ${plural(capacity, ['лот', 'лота', 'лотов'])}. Продавцы иногда завышают оценку и резерв: резерв — цена, ниже которой лот не продаётся. Если ставки до него не дойдут, вы ничего не заработаете.</p>
  <div class="row" style="gap:14px"><div class="cap" title="Каталог">${cells}</div><span class="mono" style="font-size:13px">${inCatalog} из ${capacity}</span><span class="hint">${slotHint}</span></div>
 </div>
 ${staffPanelMarkup(game)}
 ${leftovers}
 <section class="section"><div class="section-t">Предложения продавцов</div>${lotTableMarkup(game, game.offers)}</section>
 <div class="footbar"><span class="hint">Выкупленный лот вы продаёте без резерва и забираете всю выручку, но подделка ляжет на вас.</span>
  <button class="btn primary big" data-act="toPrep" ${inCatalog ? '' : 'disabled'}>К подготовке торгов →</button></div>
 </main>`;
}
