/**
 * Участники торгов.
 *
 * Bidder — человек в зале на весь вечер (номер, класс, кошелёк, место).
 * Participant — его участие в конкретном лоте: личный потолок цены и знание о подделке.
 *
 * @typedef {Object} Bidder
 * @property {number|string} num     номер таблички
 * @property {string} cls            ключ из BIDDER_CLASSES (или 'phone')
 * @property {string} label          подпись для игрока
 * @property {number} wallet         сколько денег осталось
 * @property {string[]} favorites    любимые категории: за них участник готов платить больше
 * @property {number} aggression     насколько часто делает ставки (0..1)
 * @property {number} [seat]         индекс места в зале
 *
 * @typedef {Object} Participant
 * @property {Bidder} bidder
 * @property {number} limit          больше этой цены участник не заплатит
 * @property {boolean} active        ещё в торгах
 * @property {boolean} detected      распознал подделку и считает лот почти бесплатным
 * @property {boolean} phone         телефонный клиент
 */
import { BIDDER_CLASSES, BIDDER_CLASS_KEYS, PHONE_BIDDER_LABEL, PHONE_BIDDER_NUMBER } from '../data/bidder-classes.js';
import { CATEGORY_KEYS } from '../data/categories.js';
import { findMarketing } from '../data/marketing.js';
import { BUYER_PREMIUM, FAKE_VALUE_SHARE, MAX_BIDDERS, MIN_BIDDERS } from '../config.js';
import { chance, pick, randomBetween, randomInt, shuffle, weightedPick } from '../util/random.js';

/** Коэффициенты любимой категории: шанс распознать подделку и готовность переплатить. */
const FAVORITE_DETECT_BONUS = 0.2;
const FAVORITE_PRICE_BOOST = 1.2;
const NEUTRAL_PRICE_FACTOR = 0.9;
/** Склонность делать ставки у типичных участников. */
const AGGRESSION_LEVELS = [0.35, 0.55, 0.8];
/** Кошелёк магната, приглашённого событием. */
const INVITED_MAGNATE_WALLET = 150000;

/** Собрать зал на вечер: число и состав зависят от репутации, рекламы и недельных событий. */
export function generateBidders(game) {
  const marketing = findMarketing(game.marketingId);
  const reputation = game.reputation;
  const flags = game.flags;
  const count = Math.min(MAX_BIDDERS, MIN_BIDDERS + Math.floor(reputation / 25) + marketing.extraBidders);

  const classWeights = {
    amateur: Math.max(10, 40 - marketing.topWeight * 8 - reputation / 5),
    collector: 35 + marketing.topWeight * 5,
    dealer: 15 + reputation / 8,
    magnate: 4 + reputation / 10 + marketing.topWeight * 7,
  };
  const numbers = shuffle(Array.from({ length: 70 }, (_, i) => i + 3));
  const labels = Object.fromEntries(BIDDER_CLASS_KEYS.map((key) => [key, shuffle(BIDDER_CLASSES[key].labels)]));

  const create = (cls, wallet) => ({
    num: numbers.pop(),
    cls,
    label: labels[cls].pop() ?? BIDDER_CLASSES[cls].name,
    wallet:
      wallet ??
      randomBetween(BIDDER_CLASSES[cls].wallet[0], BIDDER_CLASSES[cls].wallet[1]) *
        marketing.wealth *
        (flags.recession ? 0.8 : 1),
    favorites: shuffle(CATEGORY_KEYS).slice(0, randomInt(1, 2)),
    aggression: pick(AGGRESSION_LEVELS),
  });

  const bidders = [];
  for (let i = 0; i < count; i++) {
    bidders.push(create(weightedPick(BIDDER_CLASS_KEYS, BIDDER_CLASS_KEYS.map((key) => classWeights[key]))));
  }
  if (flags.magnate) bidders.push(create('magnate', INVITED_MAGNATE_WALLET));
  return bidders;
}

/** Телефонный клиент: не сидит в зале, кошелёк не ограничен, подделки почти не распознаёт. */
export function createPhoneBidder() {
  return {
    num: PHONE_BIDDER_NUMBER,
    cls: 'phone',
    label: PHONE_BIDDER_LABEL,
    wallet: 1e9,
    favorites: [],
    aggression: 0.7,
  };
}

/**
 * Определить, сколько участник готов заплатить за этот лот.
 * Кто распознал подделку, считает её почти бесплатной. Остальные оценивают лот около настоящей цены.
 */
export function createParticipant(bidder, lot, { phone = false } = {}) {
  const profile = phone ? null : BIDDER_CLASSES[bidder.cls];
  const favorite = !phone && bidder.favorites.includes(lot.category);
  const detected = lot.isFake && chance(phone ? 0.3 : profile.detect + (favorite ? FAVORITE_DETECT_BONUS : 0));

  let limit;
  if (detected) {
    limit = lot.trueValue * FAKE_VALUE_SHARE * randomBetween(0.6, 1.4);
  } else if (phone) {
    limit = lot.trueValue * randomBetween(1, 1.3);
  } else {
    limit = lot.trueValue * randomBetween(profile.multiplier[0], profile.multiplier[1]) * (favorite ? FAVORITE_PRICE_BOOST : NEUTRAL_PRICE_FACTOR);
  }
  // Вместе с надбавкой покупателя участник не должен тратить больше, чем у него в кошельке.
  if (!phone) limit = Math.min(limit, bidder.wallet / (1 + BUYER_PREMIUM));
  return { bidder, limit, active: true, detected, phone };
}
