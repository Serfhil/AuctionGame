/**
 * Сцена текущего лота: разметка и перерисовка на каждом такте.
 *
 * paintSession вызывается после каждого stepLot. Он обновляет цену, лидера, зал, журнал и
 * запускает эффекты по событиям такта (ставка, шёпот, телефон, дуэль, «раз, два, три»).
 */
import { CATEGORIES } from '../../data/categories.js';
import { isDueling, LotEvent } from '../../engine/lot.js';
import { formatMoney } from '../../util/format.js';
import { $, replayAnimation } from '../dom.js';
import { duelMarkup, hallMarkup } from './hall.js';

const COUNTDOWN_WORDS = ['', 'РАЗ', 'ДВА', 'ТРИ'];

export function stageMarkup(session, night) {
  const lot = session.lot;
  const reserveText = lot.owned ? 'Без резерва' : `Резерв ${formatMoney(lot.reserve)} (зал не знает)`;
  const verdict = lot.appraised
    ? `<div><span class="chip ${lot.isFake ? 'bad' : 'good'}">Эксперт: ${lot.isFake ? 'подделка' : 'подлинник'}</span></div>`
    : '';
  return `<div class="count" id="count"></div>
 <div class="lotno">Лот<b>${session.index + 1}</b>из ${night.lots.length} · ${CATEGORIES[lot.category]}</div>
 <h2 class="lotname">${lot.name}${lot.owned ? ' <span class="chip">ваш лот</span>' : ''}</h2>
 <p class="catdesc">${lot.description}</p>
 <div class="resv mono" style="display:flex;flex-wrap:wrap;gap:4px 16px"><span>Оценка ${formatMoney(lot.estLow)}–${formatMoney(lot.estHigh)}</span><span>${reserveText}</span></div>
 ${verdict}
 <div class="priceblock"><div class="price mono" id="price"></div><div class="delta mono" id="delta"></div><div class="leader" id="leader"></div><div class="stageword" id="sword"></div><div class="resv" id="resv"></div></div>
 <div class="duelbar" id="duelbar" hidden></div>
 <div class="acts" id="acts"></div>
 <p class="hint" id="tip">Шёпот в зале намекает на подделку. Лот можно снять, пока не ударил молоток. В финале двое самых упорных участников вступают в дуэль.</p>`;
}

/** Показать крупную надпись за содержимым сцены («РАЗ», «ДУЭЛЬ»). */
function flashCount(text, classes) {
  const count = $('#count');
  count.textContent = text;
  count.className = 'count';
  void count.offsetWidth;
  count.className = `count ${classes} on`;
}

function statusLine(session, dueling) {
  if (session.over) return '';
  if (session.stage) return 'Лот уходит с торгов…';
  if (dueling) return 'Дуэль: двое перебивают друг друга';
  return session.leader ? 'Торги идут' : 'Начальная ставка';
}

/**
 * @param {Object} view  { shownPrice, shownStage } — что уже показано, чтобы анимировать только изменения
 * @param {Object} fx    { tone, veil, shake, later } — звук и эффекты
 */
export function paintSession(game, session, view, events, fx) {
  const night = game.night;
  const lot = session.lot;
  const stage = $('#stage');
  const dueling = isDueling(session) && !session.over;
  const bid = events.includes(LotEvent.BID);

  const price = $('#price');
  price.textContent = formatMoney(session.price);

  if (bid && session.price > view.shownPrice) {
    replayAnimation(price, 'bump');
    const delta = $('#delta');
    delta.textContent = `+${formatMoney(session.price - view.shownPrice)}`;
    replayAnimation(delta, 'on');
    replayAnimation(stage, 'flash');
    if (dueling) {
      // В дуэли тоны чередуются по высоте и растут с каждым перебиванием.
      const rounds = session.duel.rounds;
      fx.tone((rounds % 2 ? 880 : 660) + Math.min(300, rounds * 30), 0.1, 'square', 0.07);
    } else {
      fx.tone(520 + Math.min(520, (session.price / Math.max(1, lot.estHigh)) * 260), 0.09, 'square', 0.05);
    }
  }
  if (events.includes(LotEvent.WHISPER)) {
    fx.tone(150, 0.5, 'sawtooth', 0.06, 90);
    fx.veil('var(--warn)', 0.14);
  }
  if (events.includes(LotEvent.PHONE)) {
    fx.tone(1250, 0.08, 'square', 0.05);
    fx.later(() => fx.tone(1250, 0.08, 'square', 0.05), 130);
    fx.veil('var(--accent)', 0.16);
  }
  if (events.includes(LotEvent.DUEL)) {
    flashCount('ДУЭЛЬ', 'sm hot');
    fx.tone(196, 0.5, 'sawtooth', 0.08, 392);
    fx.later(() => fx.tone(392, 0.25, 'square', 0.06), 420);
    fx.veil('var(--bad)', 0.18);
    fx.shake();
  }
  if (events.includes(LotEvent.DUEL_END)) fx.tone(330, 0.35, 'triangle', 0.1, 165);
  view.shownPrice = session.price;

  if (session.stage !== view.shownStage) {
    if (session.stage > 0 && !session.over) {
      flashCount(COUNTDOWN_WORDS[session.stage], session.stage === 3 ? 'hot' : '');
      fx.tone([0, 330, 392, 494][session.stage], 0.35, 'triangle', 0.14);
      if (session.stage === 3) fx.shake();
    } else {
      $('#count').className = 'count';
    }
    view.shownStage = session.stage;
  }

  stage.dataset.st = session.over ? 0 : session.stage;
  stage.dataset.duel = dueling ? 1 : 0;

  const duelBar = $('#duelbar');
  duelBar.hidden = !dueling;
  if (dueling) duelBar.innerHTML = duelMarkup(session);

  $('#leader').innerHTML = session.leader
    ? `Лидирует <b>№ ${session.leader.bidder.num}</b> · ${session.leader.bidder.label}`
    : 'Ставок пока нет';
  $('#sword').textContent = statusLine(session, dueling);

  const reserve = $('#resv');
  if (lot.owned) {
    reserve.textContent = '';
    reserve.className = 'resv';
  } else {
    const reached = Boolean(session.leader) && session.price >= lot.reserve;
    reserve.textContent = reached ? 'Резерв продавца достигнут' : 'Резерв продавца пока не достигнут';
    reserve.className = `resv${reached ? ' ok' : ''}`;
  }

  if (!session.over) {
    $('#acts').innerHTML = `<button class="btn primary" data-act="hammer" ${session.leader ? '' : 'disabled'}>Молоток</button>
   <button class="btn" data-act="encourage" ${night.encouragements <= 0 ? 'disabled' : ''}>Подбодрить зал · ${night.encouragements}</button>
   <button class="btn quiet" data-act="withdraw">Снять лот</button>`;
  }

  $('#room').innerHTML = hallMarkup(session, night, bid);
  $('#log').innerHTML = session.log
    .slice(0, 7)
    .map((entry) => `<li class="${entry.kind === 'bid' || entry.kind === 'sys' ? '' : entry.kind}">${entry.text}</li>`)
    .join('');
}
