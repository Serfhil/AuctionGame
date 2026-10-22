/**
 * Сезон целиком: воспроизводимость, инварианты и защита баланса.
 * Если тест «баланс» упал после правки config.js, это сигнал пересмотреть цифры (docs/BALANCE.md), а не просто подогнать порог.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GOAL, WEEKS } from '../js/config.js';
import { seasonRating } from '../js/engine/rating.js';
import { resetRandomSource, seedRandom } from '../js/util/random.js';
import { summarize } from '../tools/simulate.mjs';
import { POLICIES, careful, dealer, lazy, playSeason } from '../tools/policies.mjs';

afterEach(() => resetRandomSource());

describe('сезон', () => {
  it('партия воспроизводима: тот же seed — тот же результат', () => {
    seedRandom(2024);
    const first = playSeason(careful);
    seedRandom(2024);
    const second = playSeason(careful);
    assert.equal(first.netWorth, second.netWorth);
    assert.equal(first.reputation, second.reputation);
    assert.deepEqual(first.game.stats, second.game.stats);
  });

  it('инварианты: числа конечны, репутация в пределах, неделя не больше сезона', () => {
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= 25; seed++) {
        seedRandom(seed);
        const { game } = playSeason(policy);
        assert.ok(Number.isFinite(game.cash), `${policy.name} ${seed}: касса`);
        assert.ok(game.reputation >= 0 && game.reputation <= 100, `${policy.name} ${seed}: репутация`);
        assert.ok(game.week <= WEEKS, `${policy.name} ${seed}: неделя`);
        assert.ok(game.stats.sold >= 0 && game.stats.unsold >= 0);
        assert.equal(game.phase, 'report');
      }
    }
  });

  it('если касса ушла в минус, игра заканчивается досрочно', () => {
    let early = 0;
    for (let seed = 1; seed <= 60; seed++) {
      seedRandom(seed);
      const { game } = playSeason(lazy);
      if (game.over) {
        early += 1;
        assert.ok(game.cash < 0 || game.reputation <= 0);
        assert.ok(game.week <= WEEKS);
      }
    }
    assert.ok(early > 0, 'ленивая игра хотя бы иногда заканчивается банкротством');
  });

  it('оценка сезона соответствует капиталу', () => {
    seedRandom(11);
    const { game } = playSeason(dealer);
    const rating = seasonRating(game);
    assert.equal(rating.win, !game.over && game.cash >= GOAL - game.owned.reduce((s, l) => s + l.cost, 0));
  });
});

describe('баланс (150 сезонов на политику)', () => {
  const RUNS = 150;
  const results = Object.fromEntries(POLICIES.map((policy) => [policy.name, summarize(policy, RUNS, 1)]));

  it('аккуратный игрок побеждает примерно в половине партий', () => {
    const { winRate } = results.careful;
    assert.ok(winRate > 0.3 && winRate < 0.8, `доля побед ${winRate}`);
  });

  it('ленивая игра заметно хуже аккуратной', () => {
    assert.ok(results.lazy.median < results.careful.median);
    assert.ok(results.lazy.winRate < results.careful.winRate);
  });

  it('проверка подлинности и выкуп ниже рынка выгодны', () => {
    assert.ok(results.dealer.median > results.careful.median);
  });

  it('штатный эксперт окупается: меньше скандалов с подделками', () => {
    assert.ok(results['careful+staff'].scandals < results.careful.scandals);
  });

  it('банкротство остаётся редким для разумной игры', () => {
    assert.ok(results.careful.bankruptRate < 0.4);
    assert.ok(results.dealer.bankruptRate < 0.25);
  });

  it('ленивая игра не побеждает чаще, чем в каждой третьей партии', () => {
    assert.ok(results.lazy.winRate < 0.34);
  });
});
