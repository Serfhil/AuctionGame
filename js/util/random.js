/**
 * Источник случайности игры.
 *
 * Весь игровой движок берёт случайные числа отсюда, а не из Math.random напрямую.
 * Так партию и симуляцию можно воспроизвести: seedRandom(42) даёт один и тот же ход игры.
 */

let source = Math.random;

/** Подменить источник случайных чисел (функция без аргументов, возвращает число из [0, 1)). */
export function setRandomSource(fn) {
  source = fn;
}

/** Вернуть обычный Math.random. */
export function resetRandomSource() {
  source = Math.random;
}

/** Детерминированный генератор mulberry32. */
export function createSeededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Переключить игру на детерминированный генератор. */
export function seedRandom(seed) {
  source = createSeededRandom(seed);
}

export const random = () => source();
export const randomBetween = (min, max) => min + random() * (max - min);
/** Целое число из [min, max] включительно. */
export const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));
export const chance = (probability) => random() < probability;
export const pick = (items) => items[Math.floor(random() * items.length)];

/** Выбрать элемент с весами. Отрицательные веса считаются нулевыми. */
export function weightedPick(items, weights) {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  let roll = random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Перемешать копию массива (Фишер — Йейтс). */
export function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
