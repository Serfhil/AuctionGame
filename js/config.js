/**
 * Все числа, которые влияют на баланс и правила, собраны здесь.
 * Менять баланс нужно в этом файле, а не в логике движка.
 * Как проверить результат: `npm run simulate` (см. docs/BALANCE.md).
 */

/* ---------- Сезон ---------- */
export const WEEKS = 12;
export const GOAL = 40000;
export const START_CASH = 10000;
export const START_REPUTATION = 35;

/** Вероятность недельного события между торгами. */
export const EVENT_CHANCE = 0.7;

/* ---------- Деньги ---------- */
/** Надбавка покупателя: он платит цену молотка плюс 25%, всё это получает дом. */
export const BUYER_PREMIUM = 0.25;
/** Аренда зала и персонал, списывается после каждых торгов. */
export const FIXED_COSTS = 4400;
/** Комиссия продавца не опускается ниже этого значения даже со скидкой. */
export const MIN_COMMISSION = 0.04;
export const COMMISSION_CUT = 0.02;

/** Платная экспертиза: минимум плюс доля от середины оценки продавца. */
export const EXPERT_FEE_MIN = 100;
export const EXPERT_FEE_SHARE = 0.02;
/** Стоимость настоящей вещи после экспертизы показывается с разбросом ±8%. */
export const EXPERT_VALUE_SPREAD = 0.08;
/** Подделка стоит примерно 4% от цены оригинала. */
export const FAKE_VALUE_SHARE = 0.04;

/* ---------- Каталог ---------- */
export const BASE_CATALOG_SLOTS = 4;
/** Репутация, при которой открывается 5-й и 6-й слот каталога. */
export const EXTRA_SLOT_REPUTATION = [45, 65];
export const OFFERS_PER_WEEK = 6;
export const OFFERS_PER_WEEK_REDUCED = 4;

/* ---------- Предложения продавцов ---------- */
/** Вероятность, что продавец называет цену заметно выше рынка. */
export const GREEDY_SELLER_CHANCE = 0.2;
export const GREEDY_SELLER_MARKUP = [1.3, 1.7];
export const COMMISSION_CHOICES = [0.08, 0.1, 0.1, 0.12];
/** Вилка оценки продавца вокруг его «середины»: нижняя и верхняя граница. */
export const ESTIMATE_RANGE = [0.82, 1.18];
/** Минимальный разрыв между границами оценки, €. */
export const MIN_ESTIMATE_GAP = 50;
/** Резерв продавца как доля нижней границы оценки. */
export const RESERVE_SHARE = [0.78, 0.98];
/** Цена выкупа как доля середины оценки. */
export const BUYOUT_SHARE = [0.6, 0.85];
/** Базовая вероятность подделки: BASE + PER_TIER * (уровень + 1), затем множитель происхождения. */
export const FAKE_CHANCE_BASE = 0.06;
export const FAKE_CHANCE_PER_TIER = 0.03;
export const FAKE_CHANCE_MAX = 0.6;
/** Вероятность, что проданная подделка вскроется. */
export const FAKE_EXPOSURE_CHANCE = 0.65;

/* ---------- Репутация ---------- */
export const REPUTATION_MAX = 100;
export const REPUTATION_EFFECTS = Object.freeze({
  fakeExposed: -12,
  fakeStopped: 2,
  genuineWithdrawn: -3,
  unsoldForSeller: -1,
  soldAtEstimate: 1,
  soldAboveEstimate: 1,
});
/** Молоток считается «выше оценки» при превышении этих множителей. */
export const ESTIMATE_BONUS_LOW = 1.05;
export const ESTIMATE_BONUS_HIGH = 1.1;

/* ---------- Торги ---------- */
export const ENCOURAGEMENTS_PER_NIGHT = 2;
export const ENCOURAGE_HEAT = 0.45;
export const ENCOURAGE_HEAT_TICKS = 2;
/** Один раз за лот подбадривание повышает пределы всех участников. */
export const ENCOURAGE_LIMIT_BOOST = 1.07;
/** Стартовая ставка как доля нижней границы оценки. */
export const START_BID_SHARE = 0.4;
export const MIN_BIDDERS = 4;
export const MAX_BIDDERS = 9;
/** Шанс телефонного клиента: BASE + репутация / DIVISOR. */
export const PHONE_CLIENT_BASE = 0.1;
export const PHONE_CLIENT_DIVISOR = 500;
export const PHONE_JOIN_TICKS = [4, 9];

/* ---------- Дуэль ---------- */
export const DUEL = Object.freeze({
  /** Раньше этого такта дуэль не начинается. */
  minTicks: 3,
  /** Шанс, что соперник ответит ставкой в этот такт. */
  answerChance: 0.92,
  /** После стольких перебиваний шаг ставки возвращается к обычному. */
  halfStepRounds: 8,
  /** После стольких перебиваний ставки идут крупнее, чтобы дуэль не затягивалась. */
  burstRounds: 12,
  maxBurst: 4,
});

/* ---------- Место в зале ---------- */
export const MIN_ROW_SEATS = 4;
