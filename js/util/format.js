/** Форматирование чисел и слов для интерфейса и журнала торгов. */

/** 12500 → «12 500 €» (разделитель тысяч и узкий неразрывный пробел перед знаком евро). */
export function formatMoney(amount) {
  const value = Math.round(amount);
  return (value < 0 ? '−' : '') + Math.abs(value).toLocaleString('ru-RU') + ' €';
}

/** plural(3, ['лот', 'лота', 'лотов']) → «3 лота» */
export function plural(count, forms) {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  let form;
  if (lastTwo > 10 && lastTwo < 20) form = forms[2];
  else if (lastDigit === 1) form = forms[0];
  else if (lastDigit > 1 && lastDigit < 5) form = forms[1];
  else form = forms[2];
  return `${count} ${form}`;
}
