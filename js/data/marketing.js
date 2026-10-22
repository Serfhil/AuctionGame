/**
 * Способы привлечь людей на торги.
 *
 *  - extraBidders: сколько дополнительных участников приходит
 *  - wealth: множитель к кошелькам
 *  - topWeight: насколько чаще приходят коллекционеры и магнаты вместо любителей
 */
export const MARKETING = Object.freeze([
  { id: 'none', name: 'Без рекламы', cost: 0, extraBidders: 0, wealth: 1, topWeight: 0, description: 'Придут постоянные клиенты.' },
  { id: 'paper', name: 'Объявление в газете', cost: 500, extraBidders: 1, wealth: 1, topWeight: 0, description: '+1 участник в зале.' },
  {
    id: 'glossy',
    name: 'Глянцевый каталог',
    cost: 1500,
    extraBidders: 2,
    wealth: 1.15,
    topWeight: 1,
    description: '+2 участника, кошельки толще на 15%, чаще приходят крупные покупатели.',
  },
  {
    id: 'gala',
    name: 'Приём для коллекционеров',
    cost: 3200,
    extraBidders: 3,
    wealth: 1.3,
    topWeight: 2,
    description: '+3 участника, кошельки толще на 30%, в зале много богатых гостей.',
  },
]);

export function findMarketing(id) {
  return MARKETING.find((option) => option.id === id) ?? MARKETING[0];
}
