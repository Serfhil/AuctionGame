/**
 * Штатный эксперт. Уровень — индекс в массиве.
 *
 *  - salary: недельное жалованье
 *  - appraisalShare: какая доля предложений оценивается автоматически и бесплатно
 */
export const STAFF = Object.freeze([
  { level: 0, name: 'Без штатного эксперта', salary: 0, appraisalShare: 0 },
  { level: 1, name: 'Младший эксперт', salary: 500, appraisalShare: 0.4 },
  { level: 2, name: 'Старший эксперт', salary: 1100, appraisalShare: 0.75 },
]);
