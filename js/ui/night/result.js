/**
 * Итог лота для игрока: печать на сцене, текст и эффекты.
 * describeResult — чистая функция, её удобно проверять в тестах.
 */
import { BUYER_PREMIUM } from '../../config.js';
import { commissionRate } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

/**
 * @typedef {Object} ResultSummary
 * @property {'sold'|'exposed'|'passed'|'withdrawn-good'|'withdrawn-bad'} outcome
 * @property {{text: string, tone: 'good'|'bad'|'mute'}} stamp
 * @property {string} headline
 * @property {string} detail
 * @property {{text: string, tone: 'pos'|'neg'}|null} note
 */

/** @returns {ResultSummary} */
export function describeResult(game, session) {
  const result = session.result;
  const lot = result.lot;

  if (result.status === 'sold') {
    const headline = `Продано № ${result.buyer.num} за ${formatMoney(result.hammer)}`;
    if (result.exposed) {
      return {
        outcome: 'exposed',
        stamp: { text: 'ПОДДЕЛКА', tone: 'bad' },
        headline,
        detail: `Сделка аннулирована. ${lot.owned ? 'Выкуп пропал.' : 'Комиссия возвращена.'}`,
        note: { text: result.note, tone: 'neg' },
      };
    }
    const percent = Math.round(commissionRate(game, lot) * 100);
    const detail = lot.owned
      ? `Дому: ${formatMoney(result.revenue)}, прибыль ${formatMoney(result.profit)}`
      : `Дому: ${formatMoney(result.revenue)} (премия ${Math.round(BUYER_PREMIUM * 100)}% и комиссия ${percent}%)`;
    return {
      outcome: 'sold',
      stamp: { text: 'ПРОДАНО', tone: 'good' },
      headline,
      detail,
      note: result.note ? { text: result.note, tone: 'pos' } : null,
    };
  }

  if (result.status === 'passed') {
    return {
      outcome: 'passed',
      stamp: { text: 'НЕ ПРОДАН', tone: 'mute' },
      headline: result.reason === 'nobids' ? 'Ставок не было' : `Ставки остановились на ${formatMoney(result.topBid)}, а резерв ${formatMoney(lot.reserve)}`,
      detail: lot.owned ? 'Лот остаётся у вас и пойдёт в следующий каталог.' : 'Лот возвращён продавцу. Репутация −1.',
      note: null,
    };
  }

  return {
    outcome: result.good ? 'withdrawn-good' : 'withdrawn-bad',
    stamp: { text: 'СНЯТ', tone: result.good ? 'good' : 'bad' },
    headline: result.note,
    detail: '',
    note: null,
  };
}

/** Блок результата под ценой и печать поверх сцены. */
export function resultMarkup(summary, isLastLot) {
  const note = summary.note ? `<p class="${summary.note.tone}">${summary.note.text}</p>` : '';
  return `<div class="stamp ${summary.stamp.tone}">${summary.stamp.text}</div><div class="result"><p class="big">${summary.headline}</p><p class="hint">${summary.detail}</p>${note}
  <div class="row"><button class="btn primary" data-act="nextLot">${isLastLot ? 'Итоги вечера →' : 'Следующий лот →'}</button></div></div>`;
}

/** Звук, вспышка, тряска, конфетти и вибрация под результат. */
export function playResultEffects(summary, session, fx, anchor) {
  switch (summary.outcome) {
    case 'sold':
    case 'exposed': {
      fx.tone(190, 0.2, 'triangle', 0.5, 70);
      fx.later(() => fx.tone(150, 0.18, 'triangle', 0.35, 60), 170);
      fx.shake();
      if (summary.outcome === 'exposed') {
        fx.veil('var(--bad)', 0.3);
        fx.tone(110, 0.6, 'sawtooth', 0.08, 60);
        fx.vibrate([60, 40, 60]);
      } else {
        fx.veil('var(--good)', 0.2);
        fx.confetti(session.result.hammer > session.lot.estHigh ? 150 : 70, anchor);
        fx.vibrate(40);
      }
      break;
    }
    case 'passed':
      fx.tone(220, 0.45, 'triangle', 0.1, 110);
      break;
    default:
      fx.tone(300, 0.25, 'triangle', 0.12, 200);
      if (summary.outcome === 'withdrawn-good') fx.veil('var(--good)', 0.15);
  }
}
