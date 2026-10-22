import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { WEEKS } from '../js/config.js';
import { createApp } from '../js/ui/app.js';
import { resetRandomSource, seedRandom } from '../js/util/random.js';
import { createFakeScheduler, installFakeDom } from './helpers/fake-dom.js';

let dom;
let scheduler;
let app;
const captured = [];

beforeEach(() => {
  seedRandom(7);
  dom = installFakeDom();
  scheduler = createFakeScheduler();
  app = createApp(dom.root, { scheduler });
  captured.length = 0;
});
afterEach(() => {
  dom.restore();
  resetRandomSource();
});

/** Собрать всю разметку, которую увидел бы игрок. */
function snapshot() {
  const parts = [dom.root.innerHTML];
  for (const id of ['stage', 'room', 'acts', 'log', 'leader']) parts.push(dom.get(id).innerHTML);
  return parts.join('\n');
}

function assertClean(text, where) {
  for (const bad of ['undefined', 'NaN', '[object', 'null']) {
    assert.ok(!text.includes(bad), `${where}: в разметке найдено «${bad}»`);
  }
}

/** Играть вечер: таймеры крутятся, пока игра не уйдёт с экрана торгов. */
function playNight() {
  let guard = 0;
  while (app.getGame().phase === 'night' && guard++ < 5000) {
    if (!scheduler.runNext()) break;
    assertClean(snapshot(), `неделя ${app.getGame().week}, торги`);
  }
}

function playWeek() {
  const game = app.getGame();
  if (game.phase === 'event') {
    app.dispatch('choose', { index: 0 });
    app.dispatch('continueAfterEvent');
  }
  const offers = [...app.getGame().offers];
  for (const offer of offers.slice(0, 3)) app.dispatch('accept', { id: offer.id });
  app.dispatch('toPrep');
  app.dispatch('startNight');
  playNight();
}

describe('экраны', () => {
  it('первый экран показывает название и кнопку старта', () => {
    app.start();
    assert.match(dom.root.innerHTML, /data-act="start"/);
    assertClean(dom.root.innerHTML, 'intro');
  });

  it('неизвестное действие — понятная ошибка', () => {
    assert.throws(() => app.dispatch('nope'), /Неизвестное действие/);
  });

  it('старт открывает приём лотов с кнопками', () => {
    app.start();
    app.dispatch('start');
    const html = dom.root.innerHTML;
    assert.equal(app.getGame().phase, 'intake');
    assert.match(html, /data-act="accept"/);
    assertClean(html, 'intake');
  });

  it('кнопки приёма меняют состояние и перерисовывают экран', () => {
    app.start();
    app.dispatch('start');
    const [offer] = app.getGame().offers;
    app.dispatch('accept', { id: offer.id });
    assert.equal(offer.status, 'accepted');
    assert.match(dom.root.innerHTML, /data-act="unaccept"/);
    app.dispatch('reject', { id: app.getGame().offers[1].id });
    assert.match(dom.root.innerHTML, /data-act="restore"/);
  });

  it('клик по элементу с data-act вызывает действие', () => {
    app.start();
    let handled = null;
    const button = { disabled: false, dataset: { act: 'start' } };
    handled = dom.root.listeners.click({ target: { closest: () => button } });
    assert.equal(app.getGame().phase, 'intake');
    assert.equal(handled, undefined);
  });

  it('скорость и звук переключаются и подписывают кнопку', () => {
    const element = { textContent: '' };
    app.dispatch('speed', { element });
    assert.equal(app.settings.speed, 2);
    assert.match(element.textContent, /×2/);
    app.dispatch('sound', { element });
    assert.equal(app.settings.sound, false);
    assert.match(element.textContent, /выкл/);
  });
});

describe('сезон через интерфейс', () => {
  it('партия до конца проходит без ошибок и пустых значений', () => {
    app.start();
    app.dispatch('start');
    let weeks = 0;
    while (weeks++ < WEEKS + 2) {
      const game = app.getGame();
      if (game.phase === 'end') break;
      playWeek();
      assert.equal(app.getGame().phase, 'report', 'после вечера открывается отчёт');
      assertClean(dom.root.innerHTML, `отчёт, неделя ${app.getGame().week}`);
      if (app.getGame().over || app.getGame().week >= WEEKS) {
        app.dispatch('toEnd');
        break;
      }
      app.dispatch('nextWeek');
      if (app.getGame().phase === 'event') assertClean(dom.root.innerHTML, 'событие');
    }
    assert.equal(app.getGame().phase, 'end');
    assertClean(dom.root.innerHTML, 'финал');
    assert.match(dom.root.innerHTML, /data-act="restart"/);
  });

  it('«Играть ещё раз» начинает новую партию', () => {
    app.start();
    app.dispatch('start');
    app.dispatch('restart');
    assert.equal(app.getGame().week, 1);
    assert.equal(app.getGame().phase, 'intro');
  });

  it('молоток и снятие лота работают во время торгов', () => {
    app.start();
    app.dispatch('start');
    for (const offer of app.getGame().offers.slice(0, 2)) app.dispatch('accept', { id: offer.id });
    app.dispatch('toPrep');
    app.dispatch('startNight');
    let guard = 0;
    while (!app.getGame().night.current.leader && guard++ < 200) scheduler.runNext();
    app.dispatch('hammer');
    assert.equal(app.getGame().night.current.over, true);
    assert.match(snapshot(), /data-act="nextLot"/);
    app.dispatch('nextLot');
    assert.equal(app.getGame().night.current.over, false);
    app.dispatch('withdraw');
    assert.equal(app.getGame().night.current.result.status, 'withdrawn');
  });
});
