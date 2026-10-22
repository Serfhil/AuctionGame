#!/usr/bin/env node
/**
 * Симулятор баланса: прогоняет сезоны автоматическими игроками и печатает статистику.
 *
 *   npm run simulate                      300 сезонов на политику
 *   npm run simulate -- --runs 1000       больше сезонов
 *   npm run simulate -- --seed 7          другой старт (результат воспроизводим)
 *
 * Как читать результат — в docs/BALANCE.md.
 */
import { seedRandom } from '../js/util/random.js';
import { GOAL, WEEKS } from '../js/config.js';
import { POLICIES, playSeason } from './policies.mjs';

function parseArgs(argv) {
  const args = { runs: 300, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--runs') args.runs = Number(argv[++i]);
    else if (argv[i] === '--seed') args.seed = Number(argv[++i]);
  }
  return args;
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const pct = (x) => `${(x * 100).toFixed(0)}%`;
const money = (x) => `${Math.round(x).toLocaleString('ru-RU')} €`;

export function summarize(policy, runs, seed) {
  const seasons = [];
  for (let i = 0; i < runs; i++) {
    seedRandom(seed * 100003 + i);
    seasons.push(playSeason(policy));
  }
  const worth = seasons.map((s) => s.netWorth).sort((a, b) => a - b);
  return {
    policy: policy.name,
    median: quantile(worth, 0.5),
    p10: quantile(worth, 0.1),
    p90: quantile(worth, 0.9),
    winRate: seasons.filter((s) => s.win).length / runs,
    bankruptRate: seasons.filter((s) => s.over).length / runs,
    scandals: mean(seasons.map((s) => s.game.stats.exposed)),
    sold: mean(seasons.map((s) => s.game.stats.sold)),
    unsold: mean(seasons.map((s) => s.game.stats.unsold)),
    reputation: mean(seasons.map((s) => s.reputation)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runs, seed } = parseArgs(process.argv.slice(2));
  console.log(`Сезонов на политику: ${runs}, seed ${seed}, цель ${money(GOAL)}, недель ${WEEKS}\n`);
  console.log('политика        медиана     p10        p90        победы  банкрот  скандалы  продано  не продано  репутация');
  for (const policy of POLICIES) {
    const r = summarize(policy, runs, seed);
    console.log(
      [
        r.policy.padEnd(15),
        money(r.median).padStart(10),
        money(r.p10).padStart(10),
        money(r.p90).padStart(10),
        pct(r.winRate).padStart(7),
        pct(r.bankruptRate).padStart(8),
        r.scandals.toFixed(2).padStart(9),
        r.sold.toFixed(1).padStart(8),
        r.unsold.toFixed(1).padStart(11),
        r.reputation.toFixed(0).padStart(10),
      ].join(' '),
    );
  }
}
