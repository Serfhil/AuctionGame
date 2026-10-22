/**
 * Ход одного лота: торги, дуэль, молоток, снятие, итог.
 *
 * Движок ничего не знает о таймерах. Интерфейс вызывает stepLot раз в «такт»,
 * а возвращённые события использует для анимации и звука.
 *
 * @typedef {Object} LotSession
 * @property {Offer} lot
 * @property {number} index           номер лота в вечере
 * @property {number} price           текущая цена
 * @property {Participant|null} leader        кто сейчас держит ставку
 * @property {Participant|null} previousLeader  кого только что перебили
 * @property {Duel|null} duel         идёт ли дуэль двух участников
 * @property {number} stage           0 — торги идут, 1..3 — «раз, два, три»
 * @property {number} idle            тактов без ставок
 * @property {number} ticks           сколько тактов прошло
 * @property {number} heat            дополнительный шанс ставки после подбадривания
 * @property {number} heatTicks       сколько тактов ещё действует подбадривание
 * @property {boolean} encouraged
 * @property {boolean} whispered      уже слышен шёпот о подделке
 * @property {boolean} over
 * @property {Object|null} result
 * @property {{kind:string,text:string}[]} log   журнал, новые записи в начале
 * @property {Participant[]} participants
 * @property {number} phoneJoinsAt    такт, на котором вступает телефонный клиент (0 — не вступит)
 *
 * @typedef {Object} Duel
 * @property {Participant} a
 * @property {Participant} b
 * @property {number} rounds          сколько перебиваний уже было
 * @property {boolean} over
 */
import {
  BUYER_PREMIUM,
  DUEL,
  ENCOURAGE_HEAT,
  ENCOURAGE_HEAT_TICKS,
  ENCOURAGE_LIMIT_BOOST,
  ESTIMATE_BONUS_HIGH,
  ESTIMATE_BONUS_LOW,
  FAKE_EXPOSURE_CHANCE,
  PHONE_CLIENT_BASE,
  PHONE_CLIENT_DIVISOR,
  PHONE_JOIN_TICKS,
  REPUTATION_EFFECTS,
  START_BID_SHARE,
} from '../config.js';
import { chance, pick, randomInt } from '../util/random.js';
import { formatMoney } from '../util/format.js';
import { createParticipant, createPhoneBidder } from './bidders.js';
import { bidStep, duelStep, floorToStep } from './pricing.js';
import { addReputation } from './reputation.js';
import { commissionRate } from './state.js';

/** События, которые stepLot возвращает интерфейсу. */
export const LotEvent = Object.freeze({
  BID: 'bid',
  STAGE: 'stage',
  CLOSE: 'close',
  WHISPER: 'whisper',
  PHONE: 'phone',
  DUEL: 'duel',
  DUEL_END: 'duelend',
});

/** Вероятность шёпота в зале: если кто-то распознал подделку — высокая, иначе редкая ложная тревога. */
const WHISPER_IF_DETECTED = 0.3;
const WHISPER_FALSE_ALARM = 0.015;
/** Когда торги уже «на счёте», участники реже решаются на ставку. */
const COUNTDOWN_AGGRESSION = 0.55;
const COUNTDOWN_STAGES = 3;
const IDLE_TICKS_BEFORE_COUNTDOWN = 3;

function addLog(session, kind, text) {
  session.log.unshift({ kind, text });
}

export function isDueling(session) {
  return Boolean(session.duel && !session.duel.over);
}

/** Открыть текущий лот вечера. */
export function startLot(game) {
  const night = game.night;
  const lot = night.lots[night.index];
  const session = {
    lot,
    index: night.index,
    price: floorToStep(lot.estLow * START_BID_SHARE),
    leader: null,
    previousLeader: null,
    duel: null,
    stage: 0,
    idle: 0,
    ticks: 0,
    heat: 0,
    heatTicks: 0,
    encouraged: false,
    whispered: false,
    over: false,
    result: null,
    log: [],
    participants: night.bidders.map((bidder) => createParticipant(bidder, lot)),
    phoneJoinsAt: chance(PHONE_CLIENT_BASE + game.reputation / PHONE_CLIENT_DIVISOR) ? randomInt(PHONE_JOIN_TICKS[0], PHONE_JOIN_TICKS[1]) : 0,
  };
  addLog(session, 'sys', `Лот открыт. Начальная ставка ${formatMoney(session.price)}`);
  night.current = session;
  return session;
}

/**
 * Один такт торгов.
 * @returns {string[]} события LotEvent, произошедшие за такт
 */
export function stepLot(game, session) {
  if (session.over) return [];
  const events = [];
  session.ticks += 1;

  if (session.phoneJoinsAt && session.ticks === session.phoneJoinsAt) {
    session.participants.push(createParticipant(createPhoneBidder(), session.lot, { phone: true }));
    addLog(session, 'sys', 'Телефонный клиент вступает в торги');
    events.push(LotEvent.PHONE);
  }

  const dueling = isDueling(session);
  const step = dueling && session.duel.rounds < DUEL.halfStepRounds ? duelStep(session.price) : bidStep(session.price);

  // Кому цена уже не по карману, тот выбывает.
  for (const p of session.participants) {
    if (p.active && p !== session.leader && p.limit < session.price + step) p.active = false;
  }

  if (!session.whispered && session.ticks >= 2) {
    const someoneDetected = session.participants.some((p) => p.detected && !p.phone);
    if (chance(someoneDetected ? WHISPER_IF_DETECTED : session.lot.isFake ? 0 : WHISPER_FALSE_ALARM)) {
      session.whispered = true;
      addLog(session, 'warn', 'В зале шёпот: кто-то сомневается в подлинности лота');
      events.push(LotEvent.WHISPER);
    }
  }

  const challengers = session.participants.filter((p) => p.active && p !== session.leader);

  if (dueling) {
    const outcome = stepDuel(session, challengers, step, events);
    if (outcome === 'done') return events;
  } else if (!session.duel && session.leader && session.stage === 0 && session.ticks >= DUEL.minTicks && challengers.length === 1) {
    // В торгах остались двое: начинается дуэль.
    session.duel = { a: session.leader, b: challengers[0], rounds: 0, over: false };
    addLog(session, 'duel', `Дуэль! № ${session.leader.bidder.num} против № ${challengers[0].bidder.num}`);
    events.push(LotEvent.DUEL);
    return events;
  }

  // Обычный такт: кто-то из желающих может поднять цену.
  const countdown = session.stage !== 0;
  const heat = session.heatTicks > 0 ? session.heat : 0;
  if (session.heatTicks > 0) session.heatTicks -= 1;
  const willing = challengers.filter((p) => chance(p.bidder.aggression * (countdown ? COUNTDOWN_AGGRESSION : 1) + heat));
  if (willing.length) {
    const chosen = pick(willing);
    let steps = 1;
    if (chosen.bidder.aggression > 0.7 && chance(0.35)) steps = 2;
    if (chosen.bidder.cls === 'magnate' && chance(0.3)) steps = randomInt(2, 3);
    while (steps > 1 && session.price + step * steps > chosen.limit) steps -= 1;
    const nextPrice = session.price + step * steps;
    if (nextPrice <= chosen.limit) {
      const late = countdown ? ' (в последний момент)' : '';
      placeBid(session, chosen, nextPrice, `№ ${chosen.bidder.num} — ${formatMoney(nextPrice)}${late}`);
      session.stage = 0;
      events.push(LotEvent.BID);
      return events;
    }
  }

  // Никто не ответил: нарастает «раз, два, три».
  session.idle += 1;
  if (session.stage === 0) {
    if (!challengers.length || session.idle >= IDLE_TICKS_BEFORE_COUNTDOWN) {
      session.stage = 1;
      events.push(LotEvent.STAGE);
    }
  } else {
    session.stage += 1;
    if (session.stage > COUNTDOWN_STAGES) {
      closeLot(game, session, 'auto');
      events.push(LotEvent.CLOSE);
    } else {
      events.push(LotEvent.STAGE);
    }
  }
  return events;
}

function placeBid(session, participant, price, text) {
  session.previousLeader = session.leader;
  session.price = price;
  session.leader = participant;
  session.idle = 0;
  addLog(session, 'bid', text);
}

/**
 * Такт дуэли. Возвращает 'done', если такт полностью обработан, и 'continue', если дуэль прервалась
 * и этот такт надо доиграть как обычный.
 */
function stepDuel(session, challengers, step, events) {
  const duel = session.duel;
  const rival = challengers.find((p) => p === duel.a || p === duel.b);
  const intruders = challengers.filter((p) => p !== duel.a && p !== duel.b);

  if (intruders.length) {
    duel.over = true;
    session.duel = null;
    addLog(session, 'sys', 'В борьбу вступает ещё кто-то. Дуэль окончена');
    events.push(LotEvent.DUEL_END);
    return 'continue';
  }
  if (!rival) {
    // Одному из соперников не хватило денег: он сдаётся, и лот уходит на счёт.
    const loser = duel.a === session.leader ? duel.b : duel.a;
    duel.over = true;
    session.stage = 1;
    session.idle = 0;
    addLog(session, 'duel', `№ ${loser.bidder.num} сдаётся. Победа за № ${session.leader.bidder.num}`);
    events.push(LotEvent.DUEL_END, LotEvent.STAGE);
    return 'done';
  }
  if (!chance(DUEL.answerChance)) {
    session.idle += 1; // соперник на мгновение задумался
    return 'done';
  }

  let steps = 1;
  if (rival.bidder.aggression > 0.5 && chance(0.22) && rival.limit >= session.price + step * 2) steps = 2;
  if (duel.rounds >= DUEL.burstRounds) {
    while (steps < DUEL.maxBurst && rival.limit >= session.price + step * (steps + 1)) steps += 1;
  }
  const price = session.price + step * steps;
  placeBid(session, rival, price, `№ ${rival.bidder.num} перебивает — ${formatMoney(price)}`);
  duel.rounds += 1;
  events.push(LotEvent.BID);
  return 'done';
}

/** Подбодрить зал: повышается желание делать ставки. Возвращает false, если подбадриваний не осталось. */
export function encourageRoom(game, session) {
  const night = game.night;
  if (session.over || night.encouragements <= 0) return false;
  night.encouragements -= 1;
  session.heat = ENCOURAGE_HEAT;
  session.heatTicks = ENCOURAGE_HEAT_TICKS;
  if (!session.encouraged) {
    session.encouraged = true;
    for (const p of session.participants) if (!p.detected) p.limit *= ENCOURAGE_LIMIT_BOOST;
  }
  if (session.stage > 0) {
    session.stage = 0;
    session.idle = 0;
  }
  addLog(session, 'sys', 'Аукционист шутит, зал оживляется');
  return true;
}

/** Ударить молотком, не дожидаясь «раз, два, три». */
export function hammerLot(game, session) {
  if (!session.over && session.leader) closeLot(game, session, 'hammer');
}

/** Снять лот с торгов. */
export function withdrawLot(game, session) {
  if (!session.over) closeLot(game, session, 'withdraw');
}

/**
 * Закрыть лот и посчитать итог.
 * @param {'auto'|'hammer'|'withdraw'} mode
 * @returns {Object} result: {status: 'sold'|'passed'|'withdrawn', profit, ...}
 */
export function closeLot(game, session, mode) {
  const lot = session.lot;
  session.over = true;
  if (session.duel) session.duel.over = true;
  let result;

  if (mode === 'withdraw') {
    result = closeWithdrawn(game, lot);
  } else if (session.leader && session.price >= lot.reserve) {
    result = closeSold(game, session);
  } else {
    result = { lot, status: 'passed', profit: 0, reason: session.leader ? 'reserve' : 'nobids', topBid: session.leader ? session.price : 0 };
    if (!lot.owned) addReputation(game, REPUTATION_EFFECTS.unsoldForSeller);
    game.stats.unsold += 1;
  }

  session.result = result;
  game.ledger.results.push(result);
  const text =
    result.status === 'sold'
      ? `Продано! № ${result.buyer.num} — ${formatMoney(result.hammer)}`
      : result.status === 'passed'
        ? 'Лот не продан'
        : 'Лот снят';
  addLog(session, result.status === 'sold' ? 'good' : 'sys', text);
  return result;
}

function closeWithdrawn(game, lot) {
  const result = { lot, status: 'withdrawn', profit: 0 };
  if (lot.isFake) {
    addReputation(game, REPUTATION_EFFECTS.fakeStopped);
    game.stats.fakesStopped += 1;
    result.note = `Лот снят. Позже выяснилось, что это подделка. Репутация +${REPUTATION_EFFECTS.fakeStopped}.`;
    result.good = true;
    if (lot.owned) {
      result.profit = -lot.cost;
      game.owned = game.owned.filter((item) => item !== lot);
    }
  } else {
    addReputation(game, REPUTATION_EFFECTS.genuineWithdrawn);
    result.note = `Лот снят, хотя он был подлинным. Продавец недоволен. Репутация −${Math.abs(REPUTATION_EFFECTS.genuineWithdrawn)}.`;
    result.bad = true;
  }
  return result;
}

function closeSold(game, session) {
  const lot = session.lot;
  const hammer = session.price;
  // Свой лот приносит всю цену плюс надбавку; чужой — надбавку и комиссию продавца.
  const revenue = lot.owned ? hammer * (1 + BUYER_PREMIUM) : hammer * (BUYER_PREMIUM + commissionRate(game, lot));
  const buyer = session.leader.bidder;
  const result = { lot, status: 'sold', hammer, buyer, revenue, profit: revenue - (lot.owned ? lot.cost : 0) };

  if (!session.leader.phone) buyer.wallet -= hammer * (1 + BUYER_PREMIUM);
  game.cash += revenue;

  if (lot.isFake && chance(FAKE_EXPOSURE_CHANCE)) {
    // Подделка вскрылась: сделка аннулирована, деньги возвращены, репутация падает.
    game.cash -= revenue;
    result.exposed = true;
    result.profit = lot.owned ? -lot.cost : 0;
    addReputation(game, REPUTATION_EFFECTS.fakeExposed);
    game.stats.exposed += 1;
    result.note = `Через несколько дней покупатель принёс заключение: лот — подделка. Сделка аннулирована. Репутация −${Math.abs(REPUTATION_EFFECTS.fakeExposed)}.`;
    result.bad = true;
  } else {
    game.stats.sold += 1;
    game.stats.turnover += hammer;
    if (!game.stats.best || hammer > game.stats.best.price) game.stats.best = { price: hammer, name: lot.name };
    let bonus = 0;
    if (hammer >= lot.estLow * ESTIMATE_BONUS_LOW) bonus += REPUTATION_EFFECTS.soldAtEstimate;
    if (hammer > lot.estHigh * ESTIMATE_BONUS_HIGH) bonus += REPUTATION_EFFECTS.soldAboveEstimate;
    addReputation(game, bonus);
    if (bonus > 1) result.note = `Цена выше оценки. Об этом лоте говорят. Репутация +${bonus}.`;
  }
  if (lot.owned) game.owned = game.owned.filter((item) => item !== lot);
  return result;
}
