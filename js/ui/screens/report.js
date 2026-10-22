import { isSeasonOver } from '../../engine/state.js';
import { formatMoney } from '../../util/format.js';

function resultRowMarkup(result) {
  const lot = result.lot;
  let status;
  let tone = '';
  let amount;
  if (result.status === 'sold') {
    status = `Продан за ${formatMoney(result.hammer)}`;
    amount = formatMoney(result.profit);
    if (result.exposed) {
      status = 'Продан, но оказался подделкой';
      tone = 'bad';
    } else {
      tone = 'good';
    }
  } else if (result.status === 'passed') {
    status = result.reason === 'nobids' ? 'Нет ставок' : 'Не дошёл до резерва';
    amount = '—';
  } else {
    status = lot.isFake ? 'Снят, это подделка' : 'Снят';
    tone = lot.isFake ? 'good' : 'bad';
    amount = result.profit ? formatMoney(result.profit) : '—';
  }
  return `<div class="tr"><span class="nm">${lot.name}</span><span class="st ${tone}">${status}</span><span class="amt ${result.profit < 0 ? 'neg' : ''}">${amount}</span></div>`;
}

const signed = (value) => (value > 0 ? `+${formatMoney(value)}` : formatMoney(value));

/** Итоги вечера: по каждому лоту и по неделе в целом. */
export function renderReport(game) {
  const report = game.report;
  const last = isSeasonOver(game);
  const rows = report.results.map(resultRowMarkup).join('');
  const overText = game.over === 'cash' ? 'Касса ушла в минус. Дом закрывается.' : game.over === 'reputation' ? 'Репутации не осталось.' : '';
  const reputationChange = `${report.reputation > 0 ? '+' : ''}${report.reputation}`;
  return `<main>
 <div class="head"><span class="eyebrow">Неделя ${game.week} · итоги вечера</span><h2 class="h2">${report.net >= 0 ? 'Вечер в плюс' : 'Вечер в минус'}</h2></div>
 <div class="table">${rows}</div>
 <section class="sum">
  <div><dt>Доход от торгов</dt><dd class="${report.profit < 0 ? 'neg' : ''}">${signed(report.profit)}</dd></div>
  <div><dt>Аренда и персонал</dt><dd>−${formatMoney(report.fixedCosts).replace('−', '')}</dd></div>
  <div><dt>Реклама, эксперты, штат</dt><dd>−${formatMoney(report.marketingCost + report.appraisalCost + report.staffCost).replace('−', '')}</dd></div>
  <div><dt>Итог недели</dt><dd class="${report.net >= 0 ? 'pos' : 'neg'}">${signed(report.net)}</dd></div>
  <div><dt>Касса</dt><dd class="${game.cash < 0 ? 'neg' : ''}">${formatMoney(game.cash)}</dd></div>
  <div><dt>Репутация за неделю</dt><dd class="${report.reputation >= 0 ? 'pos' : 'neg'}">${reputationChange}</dd></div>
 </section>
 ${game.owned.length ? `<p class="hint">У вас остались непроданные лоты: ${game.owned.length}. Они займут места в следующем каталоге.</p>` : ''}
 <div class="footbar"><span class="hint">${overText}</span>
  <button class="btn primary big" data-act="${last ? 'toEnd' : 'nextWeek'}">${last ? 'Итоги сезона →' : `Неделя ${game.week + 1} →`}</button></div>
 </main>`;
}
