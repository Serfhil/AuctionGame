/** Настройки интерфейса: скорость торгов и звук. Живут дольше одной партии. */

export function createSettings() {
  return { speed: 1, sound: true };
}

/** Скорость переключается по кругу: ×1 → ×2 → ×3 → ×1. */
export function nextSpeed(speed) {
  return speed === 1 ? 2 : speed === 2 ? 3 : 1;
}

export const speedLabel = (settings) => `Скорость ×${settings.speed}`;
export const soundLabel = (settings) => `Звук: ${settings.sound ? 'вкл' : 'выкл'}`;
