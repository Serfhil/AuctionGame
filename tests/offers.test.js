import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { BASE_CATALOG_SLOTS, FIXED_COSTS } from '../js/config.js';
import { STAFF } from '../js/data/staff.js';
import { acceptOffer, appraiseOffer, buyOffer, expertFee, generateOffer, rejectOffer, restoreOffer, unacceptOffer } from '../js/engine/offers.js';
import { selectStaff } from '../js/engine/staff.js';
import { catalogCapacity, catalogLots, createGame, netWorth, nextSlotReputation } from '../js/engine/state.js';
import { beginWeek, chooseEventOption, nextWeek } from '../js/engine/week.js';
import { EVENTS } from '../js/data/events.js';
import { resetRandomSource, seedRandom, setRandomSource } from '../js/util/random.js';
import { makeGame, makeLot } from './helpers/game.js';

beforeEach(() => seedRandom(1));
afterEach(() => resetRandomSource());

describe('экспертиза', () => {
  it('стоит минимум плюс 2% от середины оценки продавца', () => {
    assert.equal(expertFee({ estLow: 2300, estHigh: 3300 }), 160);
    assert.equal(expertFee({ estLow: 11000, estHigh: 16000 }), 370);
    assert.equal(expertFee({ estLow: 250, estHigh: 350 }), 110);
  });

  it('цена кратна 10 €', () => {
    for (let i = 0; i < 200; i++) {
      const offer = generateOffer(createGame());
      assert.equal(expertFee(offer) % 10, 0);
    }
  });
});

describe('генерация предложений', () => {
  const game = createGame();
  const offers = Array.from({ length: 3000 }, () => generateOffer(game));

  it('оценка, резерв и цена выкупа согласованы', () => {
    for (const offer of offers) {
      assert.ok(offer.estLow < offer.estHigh, 'нижняя оценка ниже верхней');
      assert.ok(offer.reserve <= offer.estLow, 'резерв не выше нижней оценки');
      assert.ok(offer.buyPrice > 0 && offer.reserve > 0);
    }
  });

  it('id уникальны', () => {
    assert.equal(new Set(offers.map((offer) => offer.id)).size, offers.length);
  });

  it('подделки встречаются, но редко', () => {
    const share = offers.filter((offer) => offer.isFake).length / offers.length;
    assert.ok(share > 0.05 && share < 0.2, `доля подделок ${share}`);
  });

  it('без документов подделок больше, чем с документами', () => {
    const rate = (key) => {
      const group = offers.filter((offer) => offer.provenance === key);
      return group.filter((offer) => offer.isFake).length / group.length;
    };
    assert.ok(rate('unknown') > rate('documented'));
  });

  it('выкуп дороже рынка бывает редко: это жадные продавцы', () => {
    const genuine = offers.filter((offer) => !offer.isFake);
    const share = genuine.filter((offer) => offer.buyPrice > offer.trueValue).length / genuine.length;
    assert.ok(share > 0.02 && share < 0.25, `доля ${share}`);
  });

  it('можно зафиксировать уровень и происхождение', () => {
    const offer = generateOffer(createGame(), { tier: 3, provenance: 'documented' });
    assert.equal(offer.tier, 3);
    assert.equal(offer.provenance, 'documented');
  });

  it('при высокой репутации дорогие лоты встречаются чаще', () => {
    const rich = makeGame({ reputation: 90 });
    const poor = makeGame({ reputation: 5 });
    const topShare = (g) => Array.from({ length: 1500 }, () => generateOffer(g)).filter((o) => o.tier >= 2).length;
    assert.ok(topShare(rich) > topShare(poor));
  });
});

describe('каталог', () => {
  it('вместимость растёт с репутацией', () => {
    assert.equal(catalogCapacity(makeGame({ reputation: 10 })), BASE_CATALOG_SLOTS);
    assert.equal(catalogCapacity(makeGame({ reputation: 45 })), BASE_CATALOG_SLOTS + 1);
    assert.equal(catalogCapacity(makeGame({ reputation: 65 })), BASE_CATALOG_SLOTS + 2);
  });

  it('nextSlotReputation называет следующий порог', () => {
    assert.equal(nextSlotReputation(makeGame({ reputation: 10 })), 45);
    assert.equal(nextSlotReputation(makeGame({ reputation: 50 })), 65);
    assert.equal(nextSlotReputation(makeGame({ reputation: 80 })), null);
  });

  it('нельзя принять больше лотов, чем помещается', () => {
    const game = makeGame();
    beginWeek(game);
    for (const offer of game.offers) acceptOffer(game, offer.id);
    assert.equal(catalogLots(game).length, catalogCapacity(game));
  });

  it('принятое можно убрать, отказанное — вернуть', () => {
    const game = makeGame();
    beginWeek(game);
    const [first, second] = game.offers;
    acceptOffer(game, first.id);
    assert.equal(first.status, 'accepted');
    unacceptOffer(game, first.id);
    assert.equal(first.status, 'offer');
    rejectOffer(game, second.id);
    assert.equal(second.status, 'rejected');
    restoreOffer(game, second.id);
    assert.equal(second.status, 'offer');
  });

  it('выкуп списывает деньги и переносит лот в собственность без резерва', () => {
    const game = makeGame({ cash: 10000 });
    const lot = makeLot(game, { buyPrice: 1500, reserve: 900 });
    game.offers = [lot];
    buyOffer(game, lot.id);
    assert.equal(game.cash, 8500);
    assert.equal(lot.status, 'owned');
    assert.equal(lot.reserve, 0);
    assert.equal(lot.cost, 1500);
    assert.deepEqual(game.owned, [lot]);
    assert.deepEqual(game.offers, []);
  });

  it('выкуп невозможен без денег', () => {
    const game = makeGame({ cash: 100 });
    const lot = makeLot(game, { buyPrice: 1500 });
    game.offers = [lot];
    buyOffer(game, lot.id);
    assert.equal(game.cash, 100);
    assert.equal(lot.status, 'offer');
  });

  it('капитал учитывает невыкупленные лоты по цене покупки', () => {
    const game = makeGame({ cash: 5000 });
    game.owned = [{ cost: 2000 }, { cost: 500 }];
    assert.equal(netWorth(game), 7500);
  });
});

describe('платная экспертиза', () => {
  it('списывает деньги, открывает правду и записывается в расходы недели', () => {
    const game = makeGame({ cash: 1000 });
    const lot = makeLot(game, { estLow: 2000, estHigh: 3000, appraised: false });
    game.offers = [lot];
    appraiseOffer(game, lot.id);
    assert.equal(lot.appraised, true);
    assert.equal(game.cash, 1000 - 150);
    assert.equal(game.weekAppraisalCost, 150);
  });

  it('повторно не списывает', () => {
    const game = makeGame({ cash: 1000 });
    const lot = makeLot(game, { estLow: 2000, estHigh: 3000 });
    game.offers = [lot];
    appraiseOffer(game, lot.id);
    appraiseOffer(game, lot.id);
    assert.equal(game.cash, 850);
  });

  it('не работает без денег', () => {
    const game = makeGame({ cash: 50 });
    const lot = makeLot(game, { estLow: 2000, estHigh: 3000 });
    game.offers = [lot];
    appraiseOffer(game, lot.id);
    assert.equal(lot.appraised, false);
    assert.equal(game.cash, 50);
  });
});

describe('штатный эксперт', () => {
  it('повышение вступает сразу и списывает разницу жалованья', () => {
    const game = makeGame({ cash: 5000 });
    beginWeek(game);
    const before = game.cash;
    selectStaff(game, 1);
    assert.equal(game.staffLevel, 1);
    assert.equal(game.cash, before - STAFF[1].salary);
    assert.equal(game.weekStaffCost, STAFF[1].salary);
  });

  it('после найма часть предложений оценивается бесплатно', () => {
    const game = makeGame({ cash: 50000 });
    beginWeek(game);
    selectStaff(game, 2);
    const share = game.offers.filter((offer) => offer.autoAppraised).length / game.offers.length;
    assert.ok(share > 0, 'хотя бы одно предложение оценено');
    for (const offer of game.offers.filter((o) => o.autoAppraised)) assert.equal(offer.appraised, true);
  });

  it('без денег нанять нельзя', () => {
    const game = makeGame({ cash: 100 });
    beginWeek(game);
    selectStaff(game, 2);
    assert.equal(game.staffLevel, 0);
  });

  it('увольнение вступает со следующей недели', () => {
    const game = makeGame({ cash: 8000 });
    beginWeek(game);
    selectStaff(game, 1);
    selectStaff(game, 0);
    assert.equal(game.staffLevel, 1, 'эта неделя оплачена');
    assert.equal(game.nextStaffLevel, 0);
    const cash = game.cash;
    beginWeek(game);
    assert.equal(game.staffLevel, 0);
    assert.equal(game.cash, cash, 'жалованье больше не списывается');
  });

  it('начало недели списывает жалованье действующего эксперта', () => {
    const game = makeGame({ cash: 8000, nextStaffLevel: 1 });
    beginWeek(game);
    assert.equal(game.cash, 8000 - STAFF[1].salary);
  });
});

describe('неделя и события', () => {
  it('nextWeek увеличивает номер недели, сбрасывает флаги и открывает приём или событие', () => {
    const game = makeGame();
    beginWeek(game);
    game.flags = { recession: true };
    nextWeek(game);
    assert.equal(game.week, 2);
    assert.deepEqual(game.flags, {});
    assert.ok(game.phase === 'event' || game.phase === 'intake');
  });

  it('одно событие не выпадает дважды подряд', () => {
    const game = makeGame();
    setRandomSource(() => 0); // событие выпадает всегда
    let previous = null;
    for (let i = 0; i < 10; i++) {
      nextWeek(game);
      assert.notEqual(game.event.id, previous);
      previous = game.event.id;
    }
  });

  it('у каждого события есть варианты, и каждый вариант возвращает текст', () => {
    for (const event of EVENTS) {
      assert.ok(event.options.length >= 1, event.id);
      for (const option of event.options) {
        const game = makeGame({ cash: 100000 });
        assert.equal(typeof option.apply(game), 'string', `${event.id}: ${option.label}`);
        assert.ok(Number.isFinite(game.cash) && game.reputation >= 0 && game.reputation <= 100);
      }
    }
  });

  it('вариант с требованием к кассе недоступен без денег', () => {
    const game = makeGame({ cash: 100 });
    game.event = EVENTS.find((event) => event.id === 'tax');
    chooseEventOption(game, 0); // нанять бухгалтера — нужно 700 €
    assert.equal(game.eventResult, null);
    assert.equal(game.cash, 100);
  });

  it('ответ на событие даётся один раз', () => {
    const game = makeGame({ cash: 5000 });
    game.event = EVENTS.find((event) => event.id === 'gift');
    chooseEventOption(game, 0);
    chooseEventOption(game, 0);
    assert.equal(game.cash, 6500);
  });

  it('событие «наследники» добавляет два лота с документами', () => {
    const game = makeGame();
    game.flags.estate = true;
    beginWeek(game);
    const documented = game.offers.filter((offer) => offer.provenance === 'documented' && offer.tier >= 2);
    assert.ok(documented.length >= 2);
    assert.equal(game.offers.length, 8);
  });

  it('постоянные расходы заданы и положительны', () => {
    assert.ok(FIXED_COSTS > 0);
  });
});
