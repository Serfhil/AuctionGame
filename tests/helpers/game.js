/** Помощники для тестов движка: игра с заданным состоянием, лоты и вечер с управляемыми участниками. */
import { generateOffer } from '../../js/engine/offers.js';
import { createGame } from '../../js/engine/state.js';

export function makeGame(overrides = {}) {
  return Object.assign(createGame(), overrides);
}

/** Предложение с заданными полями поверх случайного. */
export function makeLot(game, overrides = {}) {
  return Object.assign(generateOffer(game), overrides);
}

/** Участник вечера без случайностей. */
export function makeBidder(num, overrides = {}) {
  return {
    num,
    cls: 'collector',
    label: `Участник ${num}`,
    wallet: 1e9,
    favorites: [],
    aggression: 0.8,
    seat: num,
    ...overrides,
  };
}

/** Игра с уже открытым вечером: заданные участники и лоты, пустая ведомость. */
export function makeNight(bidders, lots, gameOverrides = {}) {
  const game = makeGame(gameOverrides);
  game.phase = 'night';
  game.ledger = { marketingCost: 0, appraisalCost: 0, staffCost: 0, results: [], reputation: 0 };
  game.night = { bidders, rowSize: 4, lots, index: 0, encouragements: 2, current: null };
  return game;
}

/** Пустая сессия лота с лидером: для проверки итогов без хода торгов. */
export function makeFinishedBidding(game, lot, price, { phone = false } = {}) {
  const bidder = makeBidder(7);
  const participant = { bidder, limit: price * 2, active: true, detected: false, phone };
  return {
    lot,
    index: 0,
    price,
    leader: participant,
    previousLeader: null,
    duel: null,
    stage: 3,
    idle: 0,
    ticks: 10,
    heat: 0,
    heatTicks: 0,
    encouraged: false,
    whispered: false,
    over: false,
    result: null,
    log: [],
    participants: [participant],
    phoneJoinsAt: 0,
  };
}
