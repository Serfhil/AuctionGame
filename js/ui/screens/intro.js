import { BUYER_PREMIUM, COMMISSION_CHOICES, FIXED_COSTS, GOAL, START_CASH, WEEKS } from '../../config.js';
import { formatMoney } from '../../util/format.js';

/** Заставка. bestWorth — лучший капитал за все партии (0, если игр ещё не было). */
export function renderIntro(bestWorth) {
  const commissionMin = Math.round(Math.min(...COMMISSION_CHOICES) * 100);
  const commissionMax = Math.round(Math.max(...COMMISSION_CHOICES) * 100);
  return `<main>
 <div class="hero">
  <div class="head" style="gap:18px">
   <span class="eyebrow">Игра про аукционный дом</span>
   <h1>Последний<br><em>лот</em></h1>
   <p class="lede">Вы унаследовали аукционный дом: громкая фамилия, ${formatMoney(START_CASH)} в кассе и аренда зала, которая не ждёт. У вас ${WEEKS} недель, чтобы довести капитал до ${formatMoney(GOAL)}.</p>
   <div class="row"><button class="btn primary big" data-act="start">Открыть сезон</button></div>
   ${bestWorth ? `<p class="facts"><span>Лучший капитал: <b>${formatMoney(bestWorth)}</b></span></p>` : ''}
  </div>
  <div class="paddle-art" aria-hidden="true"><div class="face">17</div><div class="stick"></div></div>
 </div>
 <ol class="steps">
  <li><span class="n">1 · ПРИЁМ</span><b>Выберите лоты</b><span>Продавцы приносят вещи. Берите на комиссию или выкупайте сами. Подделки встречаются. Экспертиза платная, а штатный эксперт оценивает часть лотов сам.</span></li>
  <li><span class="n">2 · ЗАЛ</span><b>Соберите покупателей</b><span>Реклама привлекает больше людей и более толстые кошельки, но стоит денег.</span></li>
  <li><span class="n">3 · ТОРГИ</span><b>Ведите торги</b><span>Подбадривайте зал, слушайте шёпот, снимайте сомнительные лоты и вовремя бейте молотком.</span></li>
 </ol>
 <p class="facts"><span>Покупатель платит дому <b>+${Math.round(BUYER_PREMIUM * 100)}%</b> к цене</span><span>Продавец платит <b>${commissionMin}–${commissionMax}%</b></span><span>Расходы дома <b>${formatMoney(FIXED_COSTS)}</b> в неделю</span></p>
 </main>`;
}
