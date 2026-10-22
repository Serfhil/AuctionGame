/** Лучший результат хранится в localStorage. Он может быть недоступен (приватный режим), поэтому всё в try/catch. */

const BEST_KEY = 'lastlot-best';

export function loadBestWorth() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBestWorth(value) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.round(value)));
  } catch {
    /* хранилище недоступно — не страшно */
  }
}
