#!/usr/bin/env node
/**
 * Сборка игры в один HTML-файл: dist/auction.html.
 *
 * Зачем: ES-модули не открываются двойным кликом по index.html (file://). Собранный файл открывается
 * откуда угодно и подходит для публикации одним файлом.
 *
 * Как работает: без внешних зависимостей. CSS из <link rel="stylesheet" href="css/..."> вставляется
 * в <style>, а модули из js/main.js склеиваются в один скрипт в порядке зависимостей.
 *
 * Правила для кода, которые проверяет сборщик (иначе он остановится с понятной ошибкой):
 *   - импорты только вида  import { a, b } from './file.js';  без псевдонимов и без import *
 *   - экспорты только вида  export const/let/function/class ...  (без export default и export { })
 *   - имена верхнего уровня уникальны во всём проекте, потому что после склейки все модули делят одну область видимости
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*\r?\n?/gm;
const ANY_IMPORT_RE = /^import\b/m;
const EXPORT_DECL_RE = /^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm;
const BAD_EXPORT_RE = /^export\s+(?:\{|\*|default\b)/m;
const TOP_LEVEL_NAME_RE = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

/** Разобрать модуль: найти зависимости и убрать import/export. */
function parseModule(file, source) {
  const rel = path.relative(ROOT, file);
  const deps = [];

  const withoutImports = source.replace(IMPORT_RE, (match, names, spec) => {
    if (/\bas\b/.test(names)) throw new Error(`${rel}: псевдонимы в import не поддерживаются: ${match.trim()}`);
    if (!spec.startsWith('.')) throw new Error(`${rel}: внешние пакеты не поддерживаются: ${spec}`);
    deps.push(path.resolve(path.dirname(file), spec));
    return '';
  });
  if (ANY_IMPORT_RE.test(withoutImports)) {
    throw new Error(`${rel}: найден import в неподдерживаемой форме. Используйте import { a } from './file.js';`);
  }
  if (BAD_EXPORT_RE.test(withoutImports)) {
    throw new Error(`${rel}: поддерживается только export const/let/function/class (без export default и export { })`);
  }

  const names = [...withoutImports.matchAll(TOP_LEVEL_NAME_RE)].map((m) => m[1]);
  const code = withoutImports.replace(EXPORT_DECL_RE, '');
  return { file, rel, deps, names, code };
}

/** Склеить модули в порядке зависимостей (сначала то, что импортируется). */
export async function bundleModules(entry) {
  const modules = new Map();
  const order = [];
  const visiting = new Set();

  async function visit(file) {
    if (modules.has(file)) return;
    if (visiting.has(file)) throw new Error(`Циклическая зависимость модулей: ${path.relative(ROOT, file)}`);
    visiting.add(file);
    const module = parseModule(file, await readFile(file, 'utf8'));
    for (const dep of module.deps) await visit(dep);
    visiting.delete(file);
    modules.set(file, module);
    order.push(module);
  }
  await visit(entry);

  const owners = new Map();
  for (const module of order) {
    for (const name of module.names) {
      if (owners.has(name)) {
        throw new Error(`Имя «${name}» объявлено дважды: ${owners.get(name)} и ${module.rel}. Переименуйте одно из них.`);
      }
      owners.set(name, module.rel);
    }
  }

  const body = order.map((module) => `/* ===== ${module.rel} ===== */\n${module.code.trim()}\n`).join('\n');
  return `(() => {\n'use strict';\n${body}\n})();`;
}

/** Собрать HTML-страницу целиком. */
export async function buildHtml() {
  let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');

  const links = [...html.matchAll(/[ \t]*<link\s+rel="stylesheet"\s+href="(css\/[^"]+)"\s*\/?>/g)];
  for (const match of links) {
    const css = await readFile(path.join(ROOT, match[1]), 'utf8');
    html = html.replace(match[0], `    <style>\n/* ${match[1]} */\n${css.trim()}\n</style>`);
  }

  const scriptTag = /<script\s+type="module"\s+src="(js\/[^"]+)"\s*><\/script>/;
  const scriptMatch = html.match(scriptTag);
  if (!scriptMatch) throw new Error('В index.html не найден <script type="module" src="js/...">');
  const code = (await bundleModules(path.join(ROOT, scriptMatch[1]))).replace(/<\/script/gi, '<\\/script');
  html = html.replace(scriptTag, () => `<script>\n${code}\n</script>`);
  return html;
}

async function main() {
  const html = await buildHtml();
  const out = path.join(ROOT, 'dist', 'auction.html');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html, 'utf8');
  console.log(`Готово: ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(1)} КБ)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
