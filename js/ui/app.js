/**
 * Приложение: хранит игру, рисует экран по фазе и обрабатывает клики по кнопкам.
 *
 * Любая кнопка в разметке помечена data-act="имя". Клик ловится на корневом элементе,
 * а имя ищется в таблице handlers ниже. Чтобы добавить действие, достаточно дописать обработчик.
 */
import { startNight } from '../engine/night.js';
import { acceptOffer, appraiseOffer, buyOffer, rejectOffer, restoreOffer, unacceptOffer } from '../engine/offers.js';
import { selectStaff } from '../engine/staff.js';
import { createGame, netWorth } from '../engine/state.js';
import { beginWeek, chooseEventOption, nextWeek } from '../engine/week.js';
import { createAudio } from './audio.js';
import { headerMarkup } from './components/header.js';
import { createEffects } from './effects.js';
import { createNightController } from './night/controller.js';
import { renderEnd } from './screens/end.js';
import { renderEvent } from './screens/event.js';
import { renderIntake } from './screens/intake.js';
import { renderIntro } from './screens/intro.js';
import { renderNight } from './screens/night.js';
import { renderPrep } from './screens/prep.js';
import { renderReport } from './screens/report.js';
import { createSettings, nextSpeed, soundLabel, speedLabel } from './settings.js';
import { loadBestWorth, saveBestWorth } from './storage.js';

/**
 * @param {HTMLElement} root  корневой элемент приложения (у него должен быть id="app")
 * @param {{scheduler?: {setTimeout: Function, clearTimeout: Function}}} [options]
 */
export function createApp(root, { scheduler = globalThis } = {}) {
  const settings = createSettings();
  const audio = createAudio(settings);
  const effects = createEffects(root);
  const fx = { ...effects, tone: audio.tone, later: (fn, ms) => scheduler.setTimeout(fn, ms) };

  let game = createGame();
  const night = createNightController({
    getGame: () => game,
    settings,
    fx,
    scheduler,
    onNightFinished: () => render(),
  });

  /** Разметка экрана для текущей фазы игры. */
  function markup() {
    switch (game.phase) {
      case 'intro':
        return renderIntro(loadBestWorth());
      case 'event':
        return headerMarkup(game) + renderEvent(game);
      case 'intake':
        return headerMarkup(game) + renderIntake(game);
      case 'prep':
        return headerMarkup(game) + renderPrep(game);
      case 'night':
        return headerMarkup(game) + renderNight(game, settings);
      case 'report':
        return headerMarkup(game) + renderReport(game);
      case 'end':
        return headerMarkup(game) + renderEnd(game, loadBestWorth());
      default:
        throw new Error(`Неизвестная фаза игры: ${game.phase}`);
    }
  }

  /** Перерисовать экран. keepScroll сохраняет прокрутку (для кнопок внутри длинных списков). */
  function render({ keepScroll = false } = {}) {
    const scrollY = window.scrollY;
    night.stop();
    root.innerHTML = markup();
    if (game.phase === 'night') night.begin();
    window.scrollTo(0, keepScroll ? scrollY : 0);
  }

  /** После действия на экране приёма остаёмся на месте. */
  const stay = (change) => (params) => {
    change(params);
    render({ keepScroll: true });
  };
  /** После действия переходим на другой экран с прокруткой вверх. */
  const go = (change) => (params) => {
    change(params);
    render();
  };

  const handlers = {
    start: go(() => {
      game = createGame();
      beginWeek(game);
    }),
    restart: go(() => {
      game = createGame();
    }),

    // Приём лотов
    accept: stay(({ id }) => acceptOffer(game, id)),
    unaccept: stay(({ id }) => unacceptOffer(game, id)),
    reject: stay(({ id }) => rejectOffer(game, id)),
    restore: stay(({ id }) => restoreOffer(game, id)),
    buy: stay(({ id }) => buyOffer(game, id)),
    appraise: stay(({ id }) => appraiseOffer(game, id)),
    staff: stay(({ id }) => selectStaff(game, id)),
    toPrep: go(() => {
      game.phase = 'prep';
    }),

    // Подготовка
    toIntake: go(() => {
      game.phase = 'intake';
    }),
    marketing: stay(({ value }) => {
      game.marketingId = value;
    }),
    startNight: go(() => startNight(game)),

    // Торги
    speed({ element }) {
      settings.speed = nextSpeed(settings.speed);
      element.textContent = speedLabel(settings);
    },
    sound({ element }) {
      settings.sound = !settings.sound;
      element.textContent = soundLabel(settings);
    },
    encourage: () => night.encourage(),
    hammer: () => night.hammer(),
    withdraw: () => night.withdraw(),
    nextLot: () => night.next(),

    // Итоги, события, финал
    nextWeek: go(() => nextWeek(game)),
    choose: go(({ index }) => chooseEventOption(game, index)),
    continueAfterEvent: go(() => beginWeek(game)),
    toEnd: go(() => {
      game.phase = 'end';
      const worth = netWorth(game);
      if (worth > loadBestWorth()) saveBestWorth(worth);
    }),
  };

  function dispatch(action, params = {}) {
    const handler = handlers[action];
    if (!handler) throw new Error(`Неизвестное действие: ${action}`);
    handler(params);
  }

  root.addEventListener('click', (event) => {
    const element = event.target.closest('[data-act]');
    if (!element || element.disabled) return;
    const { act, id, i } = element.dataset;
    dispatch(act, { element, id: Number(id), value: id, index: Number(i) });
  });

  return {
    /** Показать первый экран. */
    start: () => render(),
    dispatch,
    render,
    night,
    settings,
    /** Текущая игра (для тестов и отладки в консоли). */
    getGame: () => game,
  };
}
