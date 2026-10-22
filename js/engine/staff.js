/**
 * Штатный эксперт: бесплатно оценивает часть предложений в начале недели.
 */
import { STAFF } from '../data/staff.js';

/** Оценить бесплатно долю предложений в зависимости от уровня эксперта. */
export function autoAppraise(game) {
  const share = STAFF[game.staffLevel].appraisalShare;
  for (const offer of game.offers) {
    if (!offer.appraised && offer.appraisalRoll < share) {
      offer.appraised = true;
      offer.autoAppraised = true;
    }
  }
}

/**
 * Выбрать эксперта.
 * Повышение вступает в силу сразу и доплачивается из кассы; понижение и увольнение — со следующей недели.
 */
export function selectStaff(game, level) {
  if (!STAFF[level]) return;
  if (level > game.staffLevel) {
    const extra = STAFF[level].salary - STAFF[game.staffLevel].salary;
    if (game.cash < extra) return;
    game.cash -= extra;
    game.weekStaffCost += extra;
    game.staffLevel = level;
    game.nextStaffLevel = level;
    autoAppraise(game);
  } else {
    game.nextStaffLevel = level;
  }
}
