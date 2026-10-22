/**
 * Ход недели: событие между торгами и открытие нового приёма лотов.
 */
import { EVENT_CHANCE, OFFERS_PER_WEEK, OFFERS_PER_WEEK_REDUCED } from '../config.js';
import { EVENTS } from '../data/events.js';
import { STAFF } from '../data/staff.js';
import { chance, pick } from '../util/random.js';
import { generateOffer } from './offers.js';
import { autoAppraise } from './staff.js';

/** Начать приём лотов: списать жалованье, получить предложения продавцов. */
export function beginWeek(game) {
  game.staffLevel = game.nextStaffLevel;
  game.weekStaffCost = STAFF[game.staffLevel].salary;
  game.cash -= game.weekStaffCost;

  const count = game.flags.fewOffers ? OFFERS_PER_WEEK_REDUCED : OFFERS_PER_WEEK;
  game.offers = Array.from({ length: count }, () => generateOffer(game));
  if (game.flags.estate) {
    game.offers.push(
      generateOffer(game, { tier: 2, provenance: 'documented' }),
      generateOffer(game, { tier: 3, provenance: 'documented' }),
    );
  }
  autoAppraise(game);
  game.marketingId = 'none';
  game.phase = 'intake';
}

/** Перейти к следующей неделе: показать событие (с вероятностью EVENT_CHANCE) или сразу открыть приём. */
export function nextWeek(game) {
  game.week += 1;
  game.flags = {};
  game.report = null;
  game.night = null;
  game.ledger = null;
  if (chance(EVENT_CHANCE)) {
    game.event = pick(EVENTS.filter((event) => event.id !== game.lastEventId));
    game.lastEventId = game.event.id;
    game.eventResult = null;
    game.phase = 'event';
  } else {
    game.event = null;
    beginWeek(game);
  }
}

/** Выбрать вариант ответа на событие. Повторный выбор и недоступные варианты игнорируются. */
export function chooseEventOption(game, index) {
  if (!game.event || game.eventResult) return;
  const option = game.event.options[index];
  if (!option) return;
  if (option.requiresCash && game.cash < option.requiresCash) return;
  game.eventResult = option.apply(game);
}
