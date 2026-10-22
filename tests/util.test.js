import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { bidStep, duelStep, floorToStep, roundPrice } from '../js/engine/pricing.js';
import { formatMoney, plural } from '../js/util/format.js';
import { chance, createSeededRandom, pick, resetRandomSource, seedRandom, shuffle, weightedPick, random } from '../js/util/random.js';

afterEach(() => resetRandomSource());

describe('генератор случайных чисел', () => {
  it('один seed даёт одну и ту же последовательность', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  it('разные seed дают разные последовательности', () => {
    assert.notEqual(createSeededRandom(1)(), createSeededRandom(2)());
  });

  it('значения лежат в [0, 1)', () => {
    const next = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      assert.ok(value >= 0 && value < 1);
    }
  });

  it('seedRandom переключает общий источник', () => {
    seedRandom(5);
    const first = [random(), random()];
    seedRandom(5);
    assert.deepEqual([random(), random()], first);
  });

  it('weightedPick не выбирает элементы с нулевым весом', () => {
    seedRandom(1);
    for (let i = 0; i < 200; i++) assert.equal(weightedPick(['a', 'b', 'c'], [0, 1, 0]), 'b');
  });

  it('shuffle возвращает перестановку и не меняет исходный массив', () => {
    seedRandom(3);
    const source = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(source);
    assert.deepEqual(source, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(shuffled.slice().sort(), source);
  });

  it('chance(0) никогда не срабатывает, chance(1) срабатывает всегда', () => {
    seedRandom(9);
    for (let i = 0; i < 100; i++) {
      assert.equal(chance(0), false);
      assert.equal(chance(1), true);
    }
  });

  it('pick выбирает из массива', () => {
    seedRandom(2);
    assert.ok(['x', 'y'].includes(pick(['x', 'y'])));
  });
});

describe('ценовая сетка', () => {
  it('roundPrice округляет до 50, 100 и 500 € по величине', () => {
    assert.equal(roundPrice(333), 350);
    assert.equal(roundPrice(1234), 1200);
    assert.equal(roundPrice(12340), 12500);
    assert.equal(roundPrice(1), 50);
  });

  it('bidStep растёт вместе с ценой', () => {
    const prices = [100, 300, 700, 1500, 3000, 7000, 15000, 30000, 80000];
    const steps = prices.map(bidStep);
    assert.deepEqual(steps, [10, 25, 50, 100, 200, 500, 1000, 2000, 5000]);
  });

  it('floorToStep не опускается ниже 10 € и кратен шагу', () => {
    assert.equal(floorToStep(3), 10);
    assert.equal(floorToStep(1234), 1200);
    assert.equal(floorToStep(920) % bidStep(920), 0);
  });

  it('duelStep вдвое мельче обычного шага, но не меньше 10 €', () => {
    assert.equal(duelStep(150), 10);
    assert.equal(duelStep(1500), 50);
    assert.equal(duelStep(30000), 1000);
    for (const price of [100, 400, 900, 1800, 4000, 9000, 18000, 40000, 90000]) {
      assert.ok(duelStep(price) <= bidStep(price));
      assert.ok(duelStep(price) >= 10);
    }
  });
});

describe('форматирование', () => {
  const normalize = (text) => text.replace(/[  ]/g, ' ');

  it('formatMoney разделяет тысячи и добавляет знак евро', () => {
    assert.equal(normalize(formatMoney(12345)), '12 345 €');
    assert.equal(normalize(formatMoney(0)), '0 €');
  });

  it('formatMoney показывает минус символом «−»', () => {
    assert.equal(normalize(formatMoney(-1500)), '−1 500 €');
  });

  it('plural склоняет слова по-русски', () => {
    const forms = ['лот', 'лота', 'лотов'];
    assert.equal(plural(1, forms), '1 лот');
    assert.equal(plural(2, forms), '2 лота');
    assert.equal(plural(5, forms), '5 лотов');
    assert.equal(plural(11, forms), '11 лотов');
    assert.equal(plural(21, forms), '21 лот');
    assert.equal(plural(24, forms), '24 лота');
  });
});
