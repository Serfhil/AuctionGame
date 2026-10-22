import { soundLabel, speedLabel } from '../settings.js';

/**
 * Каркас вечера торгов. Содержимое сцены, зала и журнала заполняет контроллер (ui/night/controller.js),
 * потому что оно меняется на каждом такте.
 */
export function renderNight(game, settings) {
  return `<main>
 <div class="night-top"><div class="head"><span class="eyebrow">Неделя ${game.week} · вечер торгов</span></div>
  <div class="row"><button class="btn small" data-act="speed">${speedLabel(settings)}</button><button class="btn small" data-act="sound">${soundLabel(settings)}</button></div></div>
 <div class="night-grid"><div class="stage" id="stage"></div>
  <div class="room"><h3>Зал</h3><div class="hall" id="room"></div></div><ol class="log" id="log"></ol></div>
 </main>`;
}
