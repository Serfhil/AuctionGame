/** Итоговая оценка сезона. */
import { GOAL } from '../config.js';
import { netWorth } from './state.js';

const TIERS = [
  { min: 60000, title: 'Легенда торгов', subtitle: 'Ваши каталоги коллекционируют сами.', win: true },
  { min: GOAL, title: 'Цель достигнута', subtitle: 'Респектабельный дом, о котором пишут в газетах.', win: true },
  { min: 25000, title: 'Дом держится', subtitle: 'Сезон закрыт в плюс, но до большой сцены далеко.', win: false },
  { min: 10000, title: 'Выжили', subtitle: 'Стартовый капитал сохранён, и только.', win: false },
  { min: -Infinity, title: 'Убыточный сезон', subtitle: 'Дом остался на плаву, но с потерями.', win: false },
];

/** @returns {{title: string, subtitle: string, win: boolean}} */
export function seasonRating(game) {
  if (game.over === 'cash') {
    return { title: 'Дом закрыт за долги', subtitle: 'Кредиторы опечатали зал. Молоток остаётся на последнем столе.', win: false };
  }
  if (game.over === 'reputation') {
    return { title: 'Дом потерял имя', subtitle: 'Продавцы и покупатели обходят ваш зал стороной.', win: false };
  }
  const worth = netWorth(game);
  const tier = TIERS.find((candidate) => worth >= candidate.min);
  return { title: tier.title, subtitle: tier.subtitle, win: tier.win };
}
