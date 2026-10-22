/** Мелкие помощники для работы с DOM. */

export const $ = (selector) => document.querySelector(selector);

/** Перезапустить CSS-анимацию, которая включается классом. */
export function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // принудительный пересчёт стилей, без него браузер склеит удаление и добавление класса
  element.classList.add(className);
}
