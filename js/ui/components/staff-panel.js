import { EXPERT_FEE_MIN, EXPERT_FEE_SHARE } from '../../config.js';
import { STAFF } from '../../data/staff.js';
import { formatMoney } from '../../util/format.js';

function stateText(game, option) {
  const upgrade = option.level > game.staffLevel;
  const cost = option.salary - STAFF[game.staffLevel].salary;
  if (game.staffLevel === option.level) return game.nextStaffLevel !== option.level ? 'работает, уйдёт со следующей недели' : 'работает';
  if (game.nextStaffLevel === option.level) return 'придёт со следующей недели';
  return upgrade ? `нанять сейчас, ${formatMoney(cost)}` : 'назначить на следующую неделю';
}

/** Панель найма штатного эксперта. */
export function staffPanelMarkup(game) {
  const current = STAFF[game.staffLevel];
  const cards = STAFF.map((option) => {
    const upgrade = option.level > game.staffLevel;
    const unaffordable = upgrade && game.cash < option.salary - current.salary;
    const salary = option.salary ? `${formatMoney(option.salary)} в неделю` : 'бесплатно';
    const effect = option.appraisalShare ? `Сам оценивает около ${Math.round(option.appraisalShare * 100)}% лотов` : 'Оценки только за плату';
    return `<button class="stf ${game.staffLevel === option.level ? 'on' : ''}" data-act="staff" data-id="${option.level}" ${unaffordable ? 'disabled' : ''}><b>${option.name}</b><span class="mono">${salary}</span><span>${effect}</span><span>${stateText(game, option)}</span></button>`;
  }).join('');
  const feeNote = `${formatMoney(EXPERT_FEE_MIN)} + ${Math.round(EXPERT_FEE_SHARE * 100)}% от оценки продавца`;
  return `<section class="staff"><div class="section-t">Штат · собственный эксперт</div>
 <div class="staffrow">${cards}</div>
 <p class="hint">Платные оценки: ${feeNote}. Штатный эксперт оценивает часть предложений бесплатно в начале недели, жалованье списывается сразу.</p></section>`;
}
