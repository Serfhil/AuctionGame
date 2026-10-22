/**
 * Состояние игры и простые выборки из него.
 *
 * Движок не хранит ничего в глобальных переменных: каждая функция получает объект игры
 * первым аргументом и меняет его на месте. Интерфейс держит ровно один такой объект.
 *
 * @typedef {Object} Game
 * @property {'intro'|'event'|'intake'|'prep'|'night'|'report'|'end'} phase  текущий экран
 * @property {number} week                номер недели (1..WEEKS)
 * @property {number} cash                касса, €
 * @property {number} reputation          репутация 0..100
 * @property {Offer[]} offers              предложения продавцов этой недели
 * @property {Offer[]} owned               лоты, которые дом выкупил и пока не продал
 * @property {string} marketingId          выбранная реклама (см. data/marketing.js)
 * @property {Object} flags                недельные эффекты событий (сбрасываются каждую неделю)
 * @property {Object|null} event           текущее событие
 * @property {string|null} eventResult     текст результата выбранного ответа
 * @property {string|null} lastEventId     чтобы одно событие не выпадало дважды подряд
 * @property {Night|null} night            вечер торгов
 * @property {Ledger|null} ledger          ведомость текущей недели (пока идут торги)
 * @property {Ledger|null} report          ведомость завершённой недели
 * @property {null|'cash'|'reputation'} over  причина досрочного конца игры
 * @property {number} staffLevel           уровень штатного эксперта сейчас
 * @property {number} nextStaffLevel       уровень на следующую неделю
 * @property {number} weekStaffCost        жалованье, уплаченное на этой неделе
 * @property {number} weekAppraisalCost    потрачено на платные экспертизы на этой неделе
 * @property {number} nextOfferId          счётчик id предложений
 * @property {Stats} stats                 статистика сезона
 *
 * @typedef {Object} Offer  предложение продавца или лот в собственности дома
 * @property {number} id
 * @property {string} category             ключ из CATEGORIES
 * @property {number} tier                 0..3: от дешёвого до музейного
 * @property {string} name
 * @property {string} provenance           ключ из PROVENANCE
 * @property {string} provenanceLabel
 * @property {string} provenanceTone
 * @property {string} conditionLabel
 * @property {string} conditionTone
 * @property {string} description
 * @property {string} seller
 * @property {number} trueValue            настоящая рыночная цена, скрыта до экспертизы
 * @property {boolean} isFake              подделка ли это, скрыто до экспертизы
 * @property {number} estLow               оценка продавца, нижняя граница
 * @property {number} estHigh              оценка продавца, верхняя граница
 * @property {number} reserve              резерв: ниже этой цены лот не продаётся
 * @property {number} commission           комиссия продавца (доля от молотка)
 * @property {number} buyPrice             за сколько дом может выкупить лот
 * @property {number} appraisalRoll        бросок для автоматической оценки штатным экспертом
 * @property {boolean} appraised           известна ли игроку правда о лоте
 * @property {boolean} autoAppraised       оценил ли его штатный эксперт
 * @property {'offer'|'accepted'|'rejected'|'owned'} status
 * @property {boolean} owned
 * @property {number} cost                 цена выкупа, если лот в собственности
 *
 * @typedef {Object} Night
 * @property {Bidder[]} bidders            участники вечера с закреплёнными местами
 * @property {number} rowSize              кресел в ряду (рядов два)
 * @property {Offer[]} lots                лоты по возрастанию оценки
 * @property {number} index                номер текущего лота
 * @property {number} encouragements       сколько раз ещё можно подбодрить зал
 * @property {LotSession|null} current     текущий лот
 *
 * @typedef {Object} Ledger  ведомость недели
 * @property {number} marketingCost
 * @property {number} appraisalCost
 * @property {number} staffCost
 * @property {Object[]} results            итоги по каждому лоту
 * @property {number} reputation           изменение репутации за вечер
 * @property {number} [profit]             заполняется в конце вечера
 * @property {number} [fixedCosts]
 * @property {number} [net]
 *
 * @typedef {Object} Stats
 * @property {number} sold
 * @property {number} turnover
 * @property {{price:number,name:string}|null} best
 * @property {number} exposed              скандалы с подделками
 * @property {number} unsold
 * @property {number} fakesStopped         подделок, снятых с торгов вовремя
 */
import {
  START_CASH,
  START_REPUTATION,
  BASE_CATALOG_SLOTS,
  EXTRA_SLOT_REPUTATION,
  MIN_COMMISSION,
  COMMISSION_CUT,
  WEEKS,
} from '../config.js';

/** @returns {Game} */
export function createGame() {
  return {
    phase: 'intro',
    week: 1,
    cash: START_CASH,
    reputation: START_REPUTATION,
    offers: [],
    owned: [],
    marketingId: 'none',
    flags: {},
    event: null,
    eventResult: null,
    lastEventId: null,
    night: null,
    ledger: null,
    report: null,
    over: null,
    staffLevel: 0,
    nextStaffLevel: 0,
    weekStaffCost: 0,
    weekAppraisalCost: 0,
    nextOfferId: 1,
    stats: { sold: 0, turnover: 0, best: null, exposed: 0, unsold: 0, fakesStopped: 0 },
  };
}

/** Сколько лотов помещается в каталог вечера. */
export function catalogCapacity(game) {
  return BASE_CATALOG_SLOTS + EXTRA_SLOT_REPUTATION.filter((threshold) => game.reputation >= threshold).length;
}

/** Репутация, при которой откроется следующий слот каталога, или null, если все открыты. */
export function nextSlotReputation(game) {
  return EXTRA_SLOT_REPUTATION.find((threshold) => game.reputation < threshold) ?? null;
}

/** Лоты каталога: собственные плюс принятые на комиссию. */
export function catalogLots(game) {
  return [...game.owned, ...game.offers.filter((offer) => offer.status === 'accepted')];
}

/** Капитал: касса плюс нераспроданные лоты по цене выкупа. */
export function netWorth(game) {
  return game.cash + game.owned.reduce((sum, lot) => sum + lot.cost, 0);
}

/** Комиссия продавца с учётом недельной скидки. */
export function commissionRate(game, lot) {
  return Math.max(MIN_COMMISSION, lot.commission - (game.flags.commissionCut ? COMMISSION_CUT : 0));
}

export function findOffer(game, id) {
  return game.offers.find((offer) => offer.id === id) ?? game.owned.find((lot) => lot.id === id);
}

/** Сезон закончен: прошли все недели или игра прервана. */
export function isSeasonOver(game) {
  return game.week >= WEEKS || Boolean(game.over);
}
