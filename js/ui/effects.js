/**
 * Экранные эффекты торгов: цветная вспышка, тряска, конфетти, вибрация.
 * Все эффекты выключаются, если в системе включено «уменьшить движение».
 * Случайность здесь только декоративная (см. cosmetic.js).
 */
import { randomIn } from './cosmetic.js';
import { replayAnimation } from './dom.js';

const CONFETTI_COLORS = ['#2140DC', '#17794A', '#E0A44A', '#EDEEF0', '#C4302B', '#8197FF'];

export function createEffects(root) {
  let reduced = null;

  function prefersReducedMotion() {
    if (reduced === null) {
      try {
        reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        reduced = false;
      }
    }
    return reduced;
  }

  /** Добавить на страницу слой конфетти и слой вспышки (один раз). */
  function init() {
    try {
      if (!document.getElementById('fx')) {
        document.body.insertAdjacentHTML('beforeend', '<canvas id="fx"></canvas><div id="veil"></div>');
      }
    } catch {
      /* без эффектов игра работает */
    }
  }

  /** Короткая цветная вспышка на весь экран. */
  function veil(color, opacity = 0.25) {
    if (prefersReducedMotion()) return;
    const layer = document.getElementById('veil');
    if (!layer) return;
    layer.style.transition = 'none';
    layer.style.background = color;
    layer.style.opacity = opacity;
    requestAnimationFrame(() => {
      layer.style.transition = 'opacity .7s';
      layer.style.opacity = 0;
    });
  }

  /** Встряхнуть страницу. */
  function shake() {
    if (prefersReducedMotion()) return;
    replayAnimation(root, 'shake');
  }

  /** Конфетти из центра сцены. */
  function confetti(count, anchor) {
    if (prefersReducedMotion() || !count || !anchor) return;
    const canvas = document.getElementById('fx');
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const rect = anchor.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = Math.max(120, Math.min(window.innerHeight * 0.6, rect.top + 160));
    const pieces = Array.from({ length: count }, () => ({
      x: originX + randomIn(-40, 40),
      y: originY,
      vx: randomIn(-8, 8),
      vy: randomIn(-16, -5),
      size: randomIn(5, 10),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      angle: randomIn(0, 6),
      spin: randomIn(-0.3, 0.3),
    }));

    let frame = 0;
    (function animate() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += 0.42;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.angle);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        context.restore();
      }
      if (++frame < 110) requestAnimationFrame(animate);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  /** Вибрация на телефонах, где она поддерживается. */
  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* не поддерживается */
    }
  }

  return { init, veil, shake, confetti, vibrate };
}
