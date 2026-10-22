/**
 * Зал: два ряда кресел с участниками, место телефонного клиента у трибуны и плашка дуэли.
 * Места закреплены за участниками на весь вечер (bidder.seat), свободные кресла показаны пунктиром.
 */
import { isDueling } from '../../engine/lot.js';
import { formatMoney } from '../../util/format.js';

/**
 * @param {import('../../engine/bidders.js').Participant|null} participant  null — пустое кресло
 * @param {boolean} hit  на этом такте была ставка: подсветить того, кто её сделал, и того, кого перебили
 */
export function seatMarkup(participant, session, hit) {
  if (!participant) return '<div class="seat empty" aria-hidden="true"></div>';
  const leading = participant === session.leader;
  const dropped = !participant.active && !leading;
  const duelist = isDueling(session) && (participant === session.duel.a || participant === session.duel.b);
  const classes = [
    'seat',
    leading && 'lead',
    dropped && 'out',
    duelist && 'duel',
    hit && leading && 'hit',
    hit && participant === session.previousLeader && 'beaten',
  ]
    .filter(Boolean)
    .join(' ');
  const bidder = participant.bidder;
  return `<div class="${classes}" title="${bidder.label}"><span class="pd">${bidder.num}</span><span class="nm">${bidder.label}</span>${leading ? `<span class="pr">${formatMoney(session.price)}</span>` : ''}</div>`;
}

export function hallMarkup(session, night, hit) {
  const rowSize = night.rowSize;
  const bySeat = Array(rowSize * 2).fill(null);
  for (const participant of session.participants) {
    if (!participant.phone) bySeat[participant.bidder.seat] = participant;
  }
  const rows = [0, 1]
    .map((row) => {
      const seats = bySeat.slice(row * rowSize, (row + 1) * rowSize).map((p) => seatMarkup(p, session, hit));
      return `<div class="seats" style="--n:${rowSize}">${seats.join('')}</div>`;
    })
    .join('');
  const phone = session.participants.find((p) => p.phone);
  const phoneSeat = phone
    ? seatMarkup(phone, session, hit).replace('class="seat', 'class="seat ph')
    : '<div class="seat ph empty"><span class="nm">Телефон</span></div>';
  return `<div class="podium"><span class="pt">Трибуна аукциониста</span>${phoneSeat}</div>${rows}`;
}

/** Плашка «№ 12 против № 31» над кнопками. */
export function duelMarkup(session) {
  const side = (participant) =>
    `<div class="dl${participant === session.leader ? ' on' : ''}"><span class="no">${participant.bidder.num}</span><span class="dn">${participant.bidder.label}</span><span class="dp">${participant === session.leader ? formatMoney(session.price) : 'думает…'}</span></div>`;
  return `${side(session.duel.a)}<span class="vs">ПРОТИВ</span>${side(session.duel.b)}`;
}
