/**
 * Таблица лотов на экране приёма. Одна строка — одно предложение.
 * На узких экранах строка превращается в карточку (см. css/lots.css).
 */
import { EXPERT_VALUE_SPREAD, FAKE_VALUE_SHARE } from '../../config.js';
import { CATEGORIES } from '../../data/categories.js';
import { expertFee } from '../../engine/offers.js';
import { catalogCapacity, catalogLots, commissionRate } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

const LOT_TABLE_HEAD =
  '<div class="lh"><span>Лот</span><span>Происхождение</span><span>Состояние</span><span>Оценка продавца</span><span>Резерв</span><span>Комиссия</span><span>Выкуп</span><span>Эксперт</span><span></span></div>';

/** «+18% к рынку» / «−7% к рынку» — показывается только после экспертизы. */
function marketDeltaMarkup(price, trueValue) {
  const delta = Math.round((price / trueValue - 1) * 100);
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `<div class="sub ${delta <= 0 ? 'pos' : 'neg'}">${sign}${Math.abs(delta)}% к рынку</div>`;
}

function appraisalCellMarkup(game, lot) {
  if (!lot.appraised) {
    const fee = expertFee(lot);
    return `<button class="btn small" data-act="appraise" data-id="${lot.id}" ${game.cash < fee ? 'disabled' : ''}>Оценить ${formatMoney(fee)}</button>`;
  }
  const verdict = lot.isFake
    ? `<span class="chip bad">Подделка</span><div class="sub">реально ≈ ${formatMoney(lot.trueValue * FAKE_VALUE_SHARE)}</div>`
    : `<span class="chip good">Подлинник</span><div class="sub">рынок ${formatMoney(lot.trueValue * (1 - EXPERT_VALUE_SPREAD))}–${formatMoney(lot.trueValue * (1 + EXPERT_VALUE_SPREAD))}</div>`;
  return verdict + (lot.autoAppraised ? '<div class="sub">оценил штатный эксперт</div>' : '');
}

function actionsMarkup(game, lot) {
  if (lot.status === 'owned') return '<span class="chip">Ваш лот</span>';
  if (lot.status === 'accepted') {
    return `<span class="chip good">В каталоге</span><button class="btn small" data-act="unaccept" data-id="${lot.id}">Убрать</button>`;
  }
  if (lot.status === 'rejected') return `<button class="btn small quiet" data-act="restore" data-id="${lot.id}">Вернуть</button>`;
  const full = catalogLots(game).length >= catalogCapacity(game);
  return `<button class="btn small primary" data-act="accept" data-id="${lot.id}" ${full ? 'disabled title="Каталог заполнен"' : ''}>В каталог</button>
  <button class="btn small" data-act="buy" data-id="${lot.id}" ${full || game.cash < lot.buyPrice ? 'disabled' : ''}>Выкупить</button>
  <button class="btn small quiet" data-act="reject" data-id="${lot.id}">Отказать</button>`;
}

/** Ячейки «резерв», «комиссия», «выкуп»: у собственного лота они другие. */
function termsMarkup(game, lot) {
  if (lot.owned) {
    return {
      reserve: '<span class="mono">нет</span>',
      commission: '<span class="mono">—</span>',
      buyout: `<b class="mono">${formatMoney(lot.cost)}</b><div class="sub">куплен вами</div>`,
    };
  }
  const known = lot.appraised && !lot.isFake;
  let buyout = `<b class="mono">${formatMoney(lot.buyPrice)}</b>`;
  if (known) buyout += marketDeltaMarkup(lot.buyPrice, lot.trueValue);
  else if (lot.appraised) buyout += '<div class="sub neg">вещь почти ничего не стоит</div>';
  let reserve = `<span class="mono">${formatMoney(lot.reserve)}</span>`;
  if (known) reserve += marketDeltaMarkup(lot.reserve, lot.trueValue);
  return { reserve, commission: `<span class="mono">${Math.round(commissionRate(game, lot) * 100)}%</span>`, buyout };
}

export function lotRowMarkup(game, lot) {
  const classes = [lot.status === 'accepted' || lot.status === 'owned' ? 'in' : '', lot.status === 'rejected' ? 'out' : ''].join(' ').trim();
  const terms = termsMarkup(game, lot);
  return `<div class="lr ${classes}">
  <div class="c wide"><div class="nm">${lot.name} <span class="chip mute">${CATEGORIES[lot.category]}</span></div><p class="catdesc">${lot.description}</p>${lot.owned ? '' : `<div class="sub">Продавец: ${lot.seller}</div>`}</div>
  <div class="c" data-l="Происхождение"><span class="tone-${lot.provenanceTone}">${lot.provenanceLabel}</span></div>
  <div class="c" data-l="Состояние"><span class="tone-${lot.conditionTone || 'none'}">${lot.conditionLabel}</span></div>
  <div class="c" data-l="Оценка продавца"><span class="mono">${formatMoney(lot.estLow)}–${formatMoney(lot.estHigh)}</span></div>
  <div class="c" data-l="Резерв">${terms.reserve}</div>
  <div class="c" data-l="Комиссия">${terms.commission}</div>
  <div class="c" data-l="Выкуп">${terms.buyout}</div>
  <div class="c" data-l="Эксперт">${appraisalCellMarkup(game, lot)}</div>
  <div class="c wide"><div class="acts2">${actionsMarkup(game, lot)}</div></div>
 </div>`;
}

export function lotTableMarkup(game, lots) {
  return `<div class="lt">${LOT_TABLE_HEAD}${lots.map((lot) => lotRowMarkup(game, lot)).join('')}</div>`;
}
