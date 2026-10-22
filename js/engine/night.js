/**
 * Вечер торгов: сбор зала и рассадка, переход между лотами, подсчёт итогов недели.
 */
import { ENCOURAGEMENTS_PER_NIGHT, FIXED_COSTS, MIN_ROW_SEATS } from '../config.js';
import { findMarketing } from '../data/marketing.js';
import { shuffle } from '../util/random.js';
import { generateBidders } from './bidders.js';
import { catalogLots } from './state.js';

/** Открыть торги: списать рекламу, собрать зал, рассадить участников и упорядочить лоты. */
export function startNight(game) {
  const marketing = findMarketing(game.marketingId);
  game.cash -= marketing.cost;
  game.ledger = {
    marketingCost: marketing.cost,
    appraisalCost: game.weekAppraisalCost,
    staffCost: game.weekStaffCost,
    results: [],
    reputation: 0,
  };
  game.weekAppraisalCost = 0;

  // Дешёвые лоты идут первыми: так зал разогревается к дорогим.
  const lots = catalogLots(game)
    .slice()
    .sort((a, b) => a.estLow - b.estLow);

  const bidders = generateBidders(game);
  // Два ряда кресел; мест всегда чуть больше, чем участников.
  const rowSize = Math.max(MIN_ROW_SEATS, Math.ceil((bidders.length + 1) / 2));
  const seats = shuffle(Array.from({ length: rowSize * 2 }, (_, i) => i));
  bidders.forEach((bidder, i) => {
    bidder.seat = seats[i];
  });

  game.night = { bidders, rowSize, lots, index: 0, encouragements: ENCOURAGEMENTS_PER_NIGHT, current: null };
  game.phase = 'night';
}

/** Перейти к следующему лоту. Возвращает false, если лоты закончились. */
export function advanceLot(game) {
  game.night.index += 1;
  return game.night.index < game.night.lots.length;
}

/** Закончить вечер: списать постоянные расходы, подвести итог недели, проверить условия поражения. */
export function finishNight(game) {
  const ledger = game.ledger;
  ledger.profit = ledger.results.reduce((sum, result) => sum + result.profit, 0);
  ledger.fixedCosts = FIXED_COSTS;
  game.cash -= FIXED_COSTS;
  ledger.net = ledger.profit - ledger.fixedCosts - ledger.marketingCost - ledger.appraisalCost - ledger.staffCost;

  if (game.cash < 0) game.over = 'cash';
  else if (game.reputation <= 0) game.over = 'reputation';

  game.report = ledger;
  game.phase = 'report';
}
