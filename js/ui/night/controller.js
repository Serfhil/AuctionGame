/**
 * Контроллер вечера торгов: таймеры, смена лотов, реакция на кнопки сцены.
 *
 * Движок (engine/lot.js) не знает о времени. Здесь каждые 0,7–2 секунды вызывается stepLot,
 * а результат перерисовывается. Таймеры идут через scheduler, поэтому тесты подставляют свой.
 */
import { advanceLot, finishNight } from '../../engine/night.js';
import { encourageRoom, hammerLot, isDueling, startLot, stepLot, withdrawLot } from '../../engine/lot.js';
import { randomIn } from '../cosmetic.js';
import { $ } from '../dom.js';
import { hallMarkup } from './hall.js';
import { describeResult, playResultEffects, resultMarkup } from './result.js';
import { paintSession, stageMarkup } from './stage.js';

/** Паузы в миллисекундах при скорости ×1. */
const TIMING = Object.freeze({
  bid: [1300, 1900],
  duelBid: [700, 1050],
  countdown: 2100,
  autoAdvance: 8000,
});

/**
 * @param {Object} deps
 * @param {() => import('../../engine/state.js').Game} deps.getGame
 * @param {{speed: number}} deps.settings
 * @param {Object} deps.fx  { init, tone, veil, shake, confetti, vibrate, later }
 * @param {{setTimeout: Function, clearTimeout: Function}} deps.scheduler
 * @param {() => void} deps.onNightFinished  вызывается, когда лоты закончились и итоги недели готовы
 */
export function createNightController({ getGame, settings, fx, scheduler, onNightFinished }) {
  let tickTimer = null;
  let advanceTimer = null;
  let view = { shownPrice: 0, shownStage: 0 };

  const currentSession = () => getGame().night?.current ?? null;

  function stop() {
    scheduler.clearTimeout(tickTimer);
    scheduler.clearTimeout(advanceTimer);
    tickTimer = null;
    advanceTimer = null;
  }

  function delayFor(session) {
    const base = isDueling(session) ? randomIn(...TIMING.duelBid) : session.stage > 0 ? TIMING.countdown : randomIn(...TIMING.bid);
    return Math.round(base / settings.speed);
  }

  function scheduleTick() {
    scheduler.clearTimeout(tickTimer);
    const session = currentSession();
    if (!session || session.over) return;
    tickTimer = scheduler.setTimeout(tick, delayFor(session));
  }

  function tick() {
    const game = getGame();
    const session = currentSession();
    if (!session || session.over) return;
    const events = stepLot(game, session);
    paintSession(game, session, view, events, fx);
    if (session.over) showResult();
    else scheduleTick();
  }

  /** Открыть текущий лот вечера. */
  function begin() {
    const game = getGame();
    const session = startLot(game);
    view = { shownPrice: session.price, shownStage: 0 };
    fx.init();
    $('#stage').innerHTML = stageMarkup(session, game.night);
    paintSession(game, session, view, [], fx);
    scheduleTick();
  }

  /** Показать результат лота и через паузу перейти к следующему. */
  function showResult() {
    const game = getGame();
    const night = game.night;
    const session = night.current;
    const summary = describeResult(game, session);
    const stage = $('#stage');

    $('#count').className = 'count';
    stage.dataset.st = 0;
    stage.dataset.duel = 0;
    $('#duelbar').hidden = true;
    $('#room').innerHTML = hallMarkup(session, night, false);
    playResultEffects(summary, session, fx, stage);

    $('#acts').innerHTML = '';
    $('#tip')?.remove();
    const isLast = night.index >= night.lots.length - 1;
    stage.insertAdjacentHTML('beforeend', resultMarkup(summary, isLast));

    scheduler.clearTimeout(advanceTimer);
    advanceTimer = scheduler.setTimeout(next, Math.round(TIMING.autoAdvance / settings.speed));
  }

  /** К следующему лоту или к итогам вечера. */
  function next() {
    scheduler.clearTimeout(advanceTimer);
    const game = getGame();
    const session = currentSession();
    if (!session || !session.over) return;
    if (advanceLot(game)) {
      begin();
    } else {
      finishNight(game);
      onNightFinished();
    }
  }

  function encourage() {
    const game = getGame();
    const session = currentSession();
    if (!session || !encourageRoom(game, session)) return;
    fx.tone(440, 0.12, 'sine', 0.1);
    fx.later(() => fx.tone(660, 0.16, 'sine', 0.1), 110);
    fx.veil('var(--accent)', 0.15);
    paintSession(game, session, view, [], fx);
    scheduleTick();
  }

  function hammer() {
    const game = getGame();
    const session = currentSession();
    if (!session || session.over) return;
    hammerLot(game, session);
    if (!session.over) return; // молоток без ставок не бьют
    paintSession(game, session, view, [], fx);
    showResult();
  }

  function withdraw() {
    const game = getGame();
    const session = currentSession();
    if (!session || session.over) return;
    withdrawLot(game, session);
    paintSession(game, session, view, [], fx);
    showResult();
  }

  return { begin, stop, next, encourage, hammer, withdraw };
}
