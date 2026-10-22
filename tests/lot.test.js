import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { BUYER_PREMIUM, ENCOURAGE_LIMIT_BOOST, REPUTATION_EFFECTS, START_REPUTATION } from '../js/config.js';
import { LotEvent, closeLot, encourageRoom, hammerLot, isDueling, startLot, stepLot, withdrawLot } from '../js/engine/lot.js';
import { commissionRate } from '../js/engine/state.js';
import { resetRandomSource, seedRandom, setRandomSource } from '../js/util/random.js';
import { makeBidder, makeFinishedBidding, makeLot, makeNight } from './helpers/game.js';

afterEach(() => resetRandomSource());

/** Вечер с одним лотом и двумя участниками с заданными потолками цены. */
function duelSetup(seed, limits) {
  seedRandom(seed);
  const bidders = limits.map((_, i) => makeBidder(10 + i));
  const game = makeNight(bidders, []);
  const lot = makeLot(game, { trueValue: 3000, isFake: false, estLow: 1000, estHigh: 1500, reserve: 0 });
  game.night.lots = [lot];
  const session = startLot(game);
  session.phoneJoinsAt = 0;
  session.participants.forEach((p, i) => {
    p.limit = limits[i];
    p.detected = false;
  });
  return { game, session };
}

function playOut(game, session, maxTicks = 500) {
  const seen = [];
  let guard = 0;
  while (!session.over && guard++ < maxTicks) seen.push(...stepLot(game, session));
  return seen;
}

describe('ход лота', () => {
  it('цена не падает, лот всегда закрывается с результатом', () => {
    for (let seed = 1; seed <= 60; seed++) {
      seedRandom(seed);
      const bidders = Array.from({ length: 6 }, (_, i) => makeBidder(i + 3, { aggression: [0.35, 0.55, 0.8][i % 3] }));
      const game = makeNight(bidders, []);
      const lot = makeLot(game);
      game.night.lots = [lot];
      const session = startLot(game);
      let last = session.price;
      let guard = 0;
      while (!session.over && guard++ < 800) {
        stepLot(game, session);
        assert.ok(session.price >= last, `seed ${seed}: цена упала`);
        last = session.price;
      }
      assert.ok(session.over, `seed ${seed}: лот не закрылся`);
      assert.ok(['sold', 'passed'].includes(session.result.status));
    }
  });

  it('продажа возможна только при цене не ниже резерва', () => {
    for (let seed = 1; seed <= 60; seed++) {
      seedRandom(seed);
      const bidders = Array.from({ length: 5 }, (_, i) => makeBidder(i + 3));
      const game = makeNight(bidders, []);
      const lot = makeLot(game);
      game.night.lots = [lot];
      const session = startLot(game);
      playOut(game, session);
      if (session.result.status === 'sold') assert.ok(session.result.hammer >= lot.reserve);
    }
  });

  it('без ставок лот не продаётся', () => {
    const game = makeNight([], []);
    const lot = makeLot(game);
    game.night.lots = [lot];
    const session = startLot(game);
    playOut(game, session);
    assert.equal(session.result.status, 'passed');
    assert.equal(session.result.reason, 'nobids');
  });

  it('если ставки не дошли до резерва, лот не продан, а репутация падает', () => {
    seedRandom(4);
    const game = makeNight([makeBidder(3)], []);
    const lot = makeLot(game, { reserve: 1e9, trueValue: 2000, isFake: false });
    game.night.lots = [lot];
    const session = startLot(game);
    const before = game.reputation;
    playOut(game, session);
    assert.equal(session.result.status, 'passed');
    assert.equal(game.reputation, before + REPUTATION_EFFECTS.unsoldForSeller);
  });

  it('молоток без лидера ничего не делает', () => {
    const game = makeNight([], []);
    const lot = makeLot(game);
    game.night.lots = [lot];
    const session = startLot(game);
    hammerLot(game, session);
    assert.equal(session.over, false);
  });

  it('телефонный клиент вступает в торги в назначенный такт', () => {
    seedRandom(8);
    const game = makeNight([makeBidder(3)], []);
    const lot = makeLot(game);
    game.night.lots = [lot];
    const session = startLot(game);
    session.phoneJoinsAt = 2;
    stepLot(game, session);
    const events = stepLot(game, session);
    assert.ok(events.includes(LotEvent.PHONE));
    assert.ok(session.participants.some((p) => p.phone));
  });

  it('подбадривание тратит заряд и один раз повышает потолки', () => {
    seedRandom(2);
    const game = makeNight([makeBidder(3), makeBidder(4)], []);
    const lot = makeLot(game, { isFake: false });
    game.night.lots = [lot];
    const session = startLot(game);
    session.participants.forEach((p) => {
      p.detected = false;
      p.limit = 1000;
    });
    assert.equal(encourageRoom(game, session), true);
    assert.equal(game.night.encouragements, 1);
    assert.ok(session.participants.every((p) => Math.abs(p.limit - 1000 * ENCOURAGE_LIMIT_BOOST) < 1e-9));
    encourageRoom(game, session);
    assert.ok(session.participants.every((p) => Math.abs(p.limit - 1000 * ENCOURAGE_LIMIT_BOOST) < 1e-9), 'повышение только один раз');
    assert.equal(encourageRoom(game, session), false, 'заряды закончились');
  });
});

describe('дуэль', () => {
  it('начинается, когда остаются двое, и побеждает тот, у кого выше потолок', () => {
    let duels = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { game, session } = duelSetup(seed, [6000, 3500]);
      const events = playOut(game, session);
      if (!events.includes(LotEvent.DUEL)) continue;
      duels += 1;
      assert.equal(session.result.status, 'sold');
      assert.equal(session.leader, session.participants[0], `seed ${seed}: выиграл не тот`);
      assert.ok(session.price <= 6000);
      assert.ok(session.duel.rounds >= 0 && session.duel.over);
    }
    assert.ok(duels > 40, `дуэли должны быть частыми, случилось ${duels} из 60`);
  });

  it('во время дуэли соперники ставят по очереди, лидер меняется', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { game, session } = duelSetup(seed, [8000, 7000]);
      let previousLeader = null;
      let alternated = 0;
      let guard = 0;
      while (!session.over && guard++ < 500) {
        const events = stepLot(game, session);
        if (isDueling(session) && events.includes(LotEvent.BID)) {
          if (previousLeader && session.leader !== previousLeader) alternated += 1;
          previousLeader = session.leader;
        }
      }
      if (session.duel && session.duel.rounds >= 2) assert.ok(alternated >= 1, `seed ${seed}`);
    }
  });

  it('шаг ставки в дуэли мельче обычного', () => {
    // При цене 2000 € обычный шаг 200 €, в дуэли 100 €. Видно по разности цен подряд идущих перебиваний.
    for (let seed = 1; seed <= 40; seed++) {
      const { game, session } = duelSetup(seed, [30000, 25000]);
      let last = null;
      let guard = 0;
      while (!session.over && guard++ < 600) {
        const events = stepLot(game, session);
        if (isDueling(session) && events.includes(LotEvent.BID)) {
          if (last !== null && session.duel.rounds <= 8) assert.ok(session.price - last <= 5000, 'шаг не больше обычного');
          last = session.price;
        }
      }
    }
  });

  it('третий участник прерывает дуэль', () => {
    seedRandom(5);
    const { game, session } = duelSetup(5, [9000, 8000]);
    let guard = 0;
    while (!session.over && !isDueling(session) && guard++ < 50) stepLot(game, session);
    assert.ok(isDueling(session), 'дуэль началась');
    const intruder = { bidder: makeBidder(99), limit: 1e7, active: true, detected: false, phone: false };
    session.participants.push(intruder);
    const events = stepLot(game, session);
    assert.ok(events.includes(LotEvent.DUEL_END));
    assert.equal(session.duel, null);
  });
});

describe('итоги лота', () => {
  it('своя вещь: дом получает цену плюс надбавку покупателя, лот выбывает из собственности', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { owned: true, cost: 1000, status: 'owned', reserve: 0, isFake: false });
    game.owned = [lot];
    const session = makeFinishedBidding(game, lot, 2000);
    const cash = game.cash;
    const result = closeLot(game, session, 'hammer');
    assert.equal(result.status, 'sold');
    assert.equal(result.revenue, 2000 * (1 + BUYER_PREMIUM));
    assert.equal(result.profit, 2000 * (1 + BUYER_PREMIUM) - 1000);
    assert.equal(game.cash, cash + result.revenue);
    assert.deepEqual(game.owned, []);
  });

  it('вещь на комиссии: дом получает надбавку и комиссию продавца', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { commission: 0.1, reserve: 500, isFake: false });
    const session = makeFinishedBidding(game, lot, 2000);
    const result = closeLot(game, session, 'hammer');
    assert.equal(result.revenue, 2000 * (BUYER_PREMIUM + commissionRate(game, lot)));
    assert.equal(result.profit, result.revenue);
  });

  it('кошелёк покупателя уменьшается на цену с надбавкой', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { reserve: 0, isFake: false });
    const session = makeFinishedBidding(game, lot, 1000);
    session.leader.bidder.wallet = 5000;
    closeLot(game, session, 'hammer');
    assert.equal(session.leader.bidder.wallet, 5000 - 1000 * (1 + BUYER_PREMIUM));
  });

  it('проданная подделка вскрывается: сделка аннулируется, репутация падает', () => {
    setRandomSource(() => 0); // вскрытие срабатывает всегда
    const game = makeNight([], []);
    const lot = makeLot(game, { isFake: true, reserve: 0 });
    const session = makeFinishedBidding(game, lot, 2000);
    const cash = game.cash;
    const reputation = game.reputation;
    const result = closeLot(game, session, 'hammer');
    assert.equal(result.exposed, true);
    assert.equal(game.cash, cash, 'деньги возвращены');
    assert.equal(game.reputation, reputation + REPUTATION_EFFECTS.fakeExposed);
    assert.equal(game.stats.exposed, 1);
    assert.equal(game.stats.sold, 0, 'аннулированная сделка не считается продажей');
  });

  it('снять подделку: репутация растёт, это записывается в статистику', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { isFake: true });
    const session = makeFinishedBidding(game, lot, 500);
    const reputation = game.reputation;
    withdrawLot(game, session);
    assert.equal(session.result.status, 'withdrawn');
    assert.equal(game.reputation, reputation + REPUTATION_EFFECTS.fakeStopped);
    assert.equal(game.stats.fakesStopped, 1);
  });

  it('снять подлинник: репутация падает', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { isFake: false });
    const session = makeFinishedBidding(game, lot, 500);
    withdrawLot(game, session);
    assert.equal(game.reputation, START_REPUTATION + REPUTATION_EFFECTS.genuineWithdrawn);
  });

  it('снятая своя подделка: выкуп потерян, лот убран из собственности', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { isFake: true, owned: true, cost: 800, status: 'owned' });
    game.owned = [lot];
    const session = makeFinishedBidding(game, lot, 300);
    withdrawLot(game, session);
    assert.equal(session.result.profit, -800);
    assert.deepEqual(game.owned, []);
  });

  it('репутация растёт, если молоток выше оценки', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { estLow: 1000, estHigh: 1500, reserve: 0, isFake: false });
    const session = makeFinishedBidding(game, lot, 2500);
    closeLot(game, session, 'hammer');
    assert.equal(game.reputation, START_REPUTATION + REPUTATION_EFFECTS.soldAtEstimate + REPUTATION_EFFECTS.soldAboveEstimate);
  });

  it('результат попадает в ведомость вечера', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { reserve: 0, isFake: false });
    const session = makeFinishedBidding(game, lot, 900);
    closeLot(game, session, 'hammer');
    assert.equal(game.ledger.results.length, 1);
    assert.equal(game.ledger.results[0], session.result);
  });

  it('закрытый лот не меняется повторными шагами', () => {
    const game = makeNight([], []);
    const lot = makeLot(game, { reserve: 0, isFake: false });
    const session = makeFinishedBidding(game, lot, 900);
    closeLot(game, session, 'hammer');
    assert.deepEqual(stepLot(game, session), []);
  });
});
