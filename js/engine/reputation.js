import { REPUTATION_MAX } from '../config.js';

/**
 * Изменить репутацию (в пределах 0..100).
 * Если сейчас идёт вечер торгов, изменение также записывается в ведомость недели.
 */
export function addReputation(game, delta) {
  game.reputation = Math.max(0, Math.min(REPUTATION_MAX, game.reputation + delta));
  if (game.ledger) game.ledger.reputation += delta;
}
