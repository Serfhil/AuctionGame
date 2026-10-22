import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { buildHtml, bundleModules } from '../tools/build.mjs';

/** Временный проект из набора файлов { 'main.js': '...' }. Возвращает путь к main.js. */
async function project(files, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'bundle-'));
  try {
    for (const [name, code] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
      await writeFile(path.join(dir, name), code);
    }
    return await run(path.join(dir, 'main.js'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('сборка в один файл', () => {
  it('получается HTML без модульных скриптов и внешних локальных файлов', async () => {
    const html = await buildHtml();
    assert.ok(!html.includes('type="module"'));
    assert.ok(!/<link[^>]+href="css\//.test(html), 'стили встроены');
    assert.ok(!/src="js\//.test(html), 'скрипт встроен');
    assert.match(html, /<style>/);
  });

  it('встроенный скрипт — корректный JavaScript', async () => {
    const html = await buildHtml();
    const script = html.match(/<script>\n([\s\S]*)\n<\/script>/)[1];
    assert.doesNotThrow(() => new vm.Script(script));
    assert.ok(!/^\s*(import|export)\s/m.test(script), 'import/export убраны');
  });

  it('модули склеиваются в порядке зависимостей', async () => {
    await project(
      { 'main.js': "import { a } from './a.js';\nconsole.log(a);", 'a.js': 'export const a = 1;' },
      async (entry) => {
        const code = await bundleModules(entry);
        assert.ok(code.indexOf('const a = 1') < code.indexOf('console.log(a)'));
        let output;
        new vm.Script(code).runInNewContext({ console: { log: (v) => (output = v) } });
        assert.equal(output, 1);
      },
    );
  });
});

describe('ограничения сборщика', () => {
  const fails = (files, pattern) => project(files, (entry) => assert.rejects(() => bundleModules(entry), pattern));

  it('одинаковое имя в двух модулях', () =>
    fails({ 'main.js': "import { a } from './a.js';\nconst between = 1;", 'a.js': 'export const a = 1;\nconst between = 2;' }, /дважды/));

  it('псевдоним в import', () =>
    fails({ 'main.js': "import { a as b } from './a.js';", 'a.js': 'export const a = 1;' }, /псевдонимы/));

  it('export default', () => fails({ 'main.js': "import { a } from './a.js';", 'a.js': 'export default 1;' }, /export default|export const/));

  it('export { }', () => fails({ 'main.js': "import { a } from './a.js';", 'a.js': 'const a = 1;\nexport { a };' }, /export/));

  it('import *', () => fails({ 'main.js': "import * as a from './a.js';", 'a.js': 'export const a = 1;' }, /import/));

  it('внешний пакет', () => fails({ 'main.js': "import { x } from 'lodash';" }, /внешние пакеты/));

  it('циклическая зависимость', () =>
    fails({ 'main.js': "import { a } from './a.js';", 'a.js': "import { b } from './b.js';\nexport const a = 1;", 'b.js': "import { a } from './a.js';\nexport const b = 1;" }, /Цикличес/));
});
