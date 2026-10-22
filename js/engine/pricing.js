/** Ценовая сетка: округление цен и шаг ставки. */

/** Округлить цену до «красивого» значения (50 €, 100 € или 500 € в зависимости от величины). */
export function roundPrice(value) {
  const step = value < 1000 ? 50 : value < 10000 ? 100 : 500;
  return Math.max(50, Math.round(value / step) * step);
}

/** Минимальный шаг ставки при текущей цене. */
export function bidStep(price) {
  if (price < 200) return 10;
  if (price < 500) return 25;
  if (price < 1000) return 50;
  if (price < 2000) return 100;
  if (price < 5000) return 200;
  if (price < 10000) return 500;
  if (price < 20000) return 1000;
  if (price < 50000) return 2000;
  return 5000;
}

/** Округлить вниз до шага ставки (не меньше 10 €). */
export function floorToStep(value) {
  const step = bidStep(value);
  return Math.max(10, Math.floor(value / step) * step);
}

/** Шаг ставки в дуэли: вдвое мельче обычного, чтобы соперники успели перебить друг друга несколько раз. */
export function duelStep(price) {
  return Math.max(10, 5 * Math.floor(bidStep(price) / 10));
}
