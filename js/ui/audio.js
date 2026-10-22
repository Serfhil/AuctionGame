/**
 * Звук без файлов: короткие тона через Web Audio API.
 * Звук запускается только после действия игрока, поэтому автоплей-ограничения браузера не мешают.
 */
export function createAudio(settings) {
  let context = null;

  /**
   * @param {number} frequency  начальная частота, Гц
   * @param {number} duration   длительность, с
   * @param {OscillatorType} [type]
   * @param {number} [volume]
   * @param {number} [toFrequency] частота, к которой тон плавно переходит
   */
  function tone(frequency, duration, type = 'sine', volume = 0.12, toFrequency) {
    if (!settings.sound) return;
    try {
      context = context || new (window.AudioContext || window.webkitAudioContext)();
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (toFrequency) oscillator.frequency.exponentialRampToValueAtTime(toFrequency, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      /* звук недоступен — игра продолжается без него */
    }
  }

  return { tone };
}
