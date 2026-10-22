/**
 * Автоматические «игроки» для симуляции и тестов баланса.
 *
 * Политика — объект с методами:
 *   prepare(game)   — приём лотов: нанять эксперта, оценить, принять, выкупить
 *   marketing(game) — id рекламы на неделю
 *   lot?(game, session, event) — необязательно: вмешательство в ход лота
 *
 * playSeason прогоняет сезон целиком и возвращает краткую сводку.
 */
import { appraiseOffer, acceptOffer, buyOffer } from '../js/engine/offers.js';
import { selectStaff } from '../js/engine/staff.js';
import { advanceLot, finishNight, startNight } from '../js/engine/night.js';
import { startLot, stepLot, hammerLot, withdrawLot } from '../js/engine/lot.js';
import { beginWeek, chooseEventOption, nextWeek } from '../js/engine/week.js';
import { catalogCapacity, catalogLots, createGame, isSeasonOver, netWorth } from '../js/engine/state.js';
import { GOAL } from '../js/config.js';

/** Принять на комиссию самые дорогие из неотвергнутых предложений, пока есть место. */
function fillCatalog(game, offers) {
  for (const offer of offers) {
    if (catalogLots(game).length >= catalogCapacity(game)) break;
    acceptOffer(game, offer.id);
  }
}

const byEstimateDesc = (a, b) => b.estLow - a.estLow;

/** Осторожный игрок: проверяет дорогие лоты у эксперта и выбрасывает подделки. */
export const careful = {
  name: 'careful',
  prepare(game) {
    for (const offer of game.offers.slice()) {
      if (!offer.appraised && offer.estLow >= 1200 && game.cash >= 3000) appraiseOffer(game, offer.id);
    }
    const safe = game.offers.filter((offer) => !(offer.appraised && offer.isFake)).sort(byEstimateDesc);
    fillCatalog(game, safe);
  },
  marketing: (game) => (game.cash > 9000 ? 'glossy' : game.cash > 5000 ? 'paper' : 'none'),
};

/** То же, но со штатным младшим экспертом с третьей недели. */
export const carefulWithStaff = {
  ...careful,
  name: 'careful+staff',
  prepare(game) {
    if (game.week >= 3 && game.cash > 8000) selectStaff(game, 1);
    careful.prepare(game);
  },
};

/** Ленивый игрок: берёт самые дорогие лоты вслепую и не тратится на рекламу. */
export const lazy = {
  name: 'lazy',
  prepare(game) {
    fillCatalog(game, game.offers.slice().sort(byEstimateDesc));
  },
  marketing: () => 'none',
};

/** Игрок-перекупщик: выкупает проверенные лоты заметно ниже рынка. */
export const dealer = {
  name: 'dealer',
  prepare(game) {
    for (const offer of game.offers.slice()) {
      if (catalogLots(game).length >= catalogCapacity(game)) break;
      if (offer.estLow > 800 && game.cash > 5000) {
        appraiseOffer(game, offer.id);
        if (!offer.isFake && offer.buyPrice < offer.trueValue * 0.8) buyOffer(game, offer.id);
      }
    }
    const safe = game.offers.filter((offer) => offer.status === 'offer' && !(offer.appraised && offer.isFake)).sort(byEstimateDesc);
    fillCatalog(game, safe);
  },
  marketing: (game) => (game.cash > 9000 ? 'glossy' : 'paper'),
};

/** Игрок, который снимает с торгов все лоты, про которые знает, что они подделки. */
export const vigilant = {
  ...careful,
  name: 'vigilant',
  lot(game, session) {
    if (session.lot.isFake && session.lot.appraised) withdrawLot(game, session);
  },
};

export const POLICIES = [careful, carefulWithStaff, lazy, dealer];

const MAX_TICKS_PER_LOT = 1000;

/** Прогнать один лот до конца. */
export function playLot(game, policy) {
  const session = startLot(game);
  if (policy.lot) policy.lot(game, session);
  let guard = 0;
  while (!session.over && guard++ < MAX_TICKS_PER_LOT) {
    stepLot(game, session);
  }
  if (!session.over) hammerLot(game, session);
  return session;
}

/** Выбрать для события первый доступный вариант. */
function answerEvent(game) {
  const index = game.event.options.findIndex((option) => !option.requiresCash || game.cash >= option.requiresCash);
  chooseEventOption(game, index >= 0 ? index : 0);
}

/**
 * Сыграть сезон целиком.
 * @returns {{netWorth: number, reputation: number, over: string|null, win: boolean, game: object}}
 */
export function playSeason(policy) {
  const game = createGame();
  beginWeek(game);
  for (;;) {
    policy.prepare(game);
    game.marketingId = policy.marketing(game);
    startNight(game);
    do {
      playLot(game, policy);
    } while (advanceLot(game));
    finishNight(game);
    if (isSeasonOver(game)) break;
    nextWeek(game);
    if (game.phase === 'event') {
      answerEvent(game);
      beginWeek(game);
    }
  }
  const worth = netWorth(game);
  return { netWorth: worth, reputation: game.reputation, over: game.over, win: !game.over && worth >= GOAL, game };
}
