/**
 * Предложения продавцов: генерация и действия игрока на экране приёма.
 */
import {
  EXPERT_FEE_MIN,
  EXPERT_FEE_SHARE,
  ESTIMATE_RANGE,
  MIN_ESTIMATE_GAP,
  RESERVE_SHARE,
  BUYOUT_SHARE,
  COMMISSION_CHOICES,
  GREEDY_SELLER_CHANCE,
  GREEDY_SELLER_MARKUP,
  FAKE_CHANCE_BASE,
  FAKE_CHANCE_PER_TIER,
  FAKE_CHANCE_MAX,
} from '../config.js';
import { CATEGORY_KEYS, TEMPLATES } from '../data/categories.js';
import { CONDITIONS, PROVENANCE, PROVENANCE_KEYS } from '../data/lot-traits.js';
import { chance, pick, random, randomBetween, weightedPick } from '../util/random.js';
import { roundPrice } from './pricing.js';
import { catalogCapacity, catalogLots, findOffer } from './state.js';

/** Цена платной экспертизы: минимум плюс доля от середины оценки продавца. */
export function expertFee(offer) {
  const midpoint = (offer.estLow + offer.estHigh) / 2;
  return Math.round((EXPERT_FEE_MIN + EXPERT_FEE_SHARE * midpoint) / 10) * 10;
}

/** Веса уровней лотов: чем выше репутация, тем чаще приносят дорогие вещи. */
function tierWeights(reputation) {
  return [Math.max(2, 6 - reputation / 12), 5, Math.max(0.5, reputation / 12 - 1), Math.max(0, (reputation - 45) / 12)];
}

/**
 * Создать предложение продавца.
 * @param {import('./state.js').Game} game
 * @param {{tier?: number, provenance?: string}} [options] зафиксировать уровень или происхождение
 */
export function generateOffer(game, { tier, provenance } = {}) {
  const level = tier ?? weightedPick([0, 1, 2, 3], tierWeights(game.reputation));
  const category = pick(CATEGORY_KEYS);
  const [name, minValue, maxValue] = TEMPLATES[category][level];
  const condition = weightedPick(CONDITIONS, CONDITIONS.map((c) => c.weight));
  const provenanceKey = provenance ?? weightedPick(PROVENANCE_KEYS, PROVENANCE_KEYS.map((key) => PROVENANCE[key].weight));
  const origin = PROVENANCE[provenanceKey];

  // Цена внутри вилки выбирается логарифмически: дешёвые вещи встречаются чаще дорогих.
  const trueValue = roundPrice(Math.exp(randomBetween(Math.log(minValue), Math.log(maxValue))) * condition.factor);
  const fakeChance = Math.min(FAKE_CHANCE_MAX, (FAKE_CHANCE_BASE + FAKE_CHANCE_PER_TIER * (level + 1)) * origin.fakeFactor);
  const isFake = chance(fakeChance);

  // Оценка продавца может расходиться с реальностью, а жадный продавец ещё и завышает её.
  const greedy = chance(GREEDY_SELLER_CHANCE);
  const estimateMid =
    trueValue * randomBetween(origin.estimate[0], origin.estimate[1]) * (greedy ? randomBetween(...GREEDY_SELLER_MARKUP) : 1);
  const estLow = roundPrice(estimateMid * ESTIMATE_RANGE[0]);
  // У самых дешёвых вещей обе границы могли округлиться до одного значения: вилка не должна схлопываться.
  const estHigh = Math.max(roundPrice(estimateMid * ESTIMATE_RANGE[1]), estLow + MIN_ESTIMATE_GAP);

  return {
    id: game.nextOfferId++,
    category,
    tier: level,
    name,
    provenance: provenanceKey,
    provenanceLabel: origin.label,
    provenanceTone: origin.tone,
    conditionLabel: condition.label,
    conditionTone: condition.tone,
    description: `${pick(origin.texts)} ${condition.sentence}`,
    seller: pick(origin.sellers),
    trueValue,
    isFake,
    estLow,
    estHigh,
    reserve: roundPrice(estLow * randomBetween(...RESERVE_SHARE)),
    commission: pick(COMMISSION_CHOICES),
    buyPrice: roundPrice(estimateMid * randomBetween(...BUYOUT_SHARE)),
    appraisalRoll: random(),
    appraised: false,
    autoAppraised: false,
    status: 'offer',
    owned: false,
    cost: 0,
  };
}

/* ---------- Действия игрока ---------- */

/** Принять на комиссию. */
export function acceptOffer(game, id) {
  const offer = findOffer(game, id);
  if (offer && offer.status === 'offer' && catalogLots(game).length < catalogCapacity(game)) offer.status = 'accepted';
}

export function unacceptOffer(game, id) {
  const offer = findOffer(game, id);
  if (offer && offer.status === 'accepted') offer.status = 'offer';
}

export function rejectOffer(game, id) {
  const offer = findOffer(game, id);
  if (offer && offer.status === 'offer') offer.status = 'rejected';
}

export function restoreOffer(game, id) {
  const offer = findOffer(game, id);
  if (offer && offer.status === 'rejected') offer.status = 'offer';
}

/** Выкупить лот за счёт дома: он пойдёт на торги без резерва, вся выручка достанется дому. */
export function buyOffer(game, id) {
  const offer = findOffer(game, id);
  if (!offer || offer.status !== 'offer') return;
  if (game.cash < offer.buyPrice || catalogLots(game).length >= catalogCapacity(game)) return;
  game.cash -= offer.buyPrice;
  offer.status = 'owned';
  offer.owned = true;
  offer.cost = offer.buyPrice;
  offer.reserve = 0;
  game.owned.push(offer);
  game.offers = game.offers.filter((candidate) => candidate !== offer);
}

/** Заказать платную экспертизу: после неё игрок знает, подлинник это или подделка. */
export function appraiseOffer(game, id) {
  const offer = findOffer(game, id);
  if (!offer || offer.appraised) return;
  const fee = expertFee(offer);
  if (game.cash < fee) return;
  game.cash -= fee;
  offer.appraised = true;
  game.weekAppraisalCost += fee;
}
