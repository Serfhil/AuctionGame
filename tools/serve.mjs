#!/usr/bin/env node
/**
 * Локальный сервер для разработки: npm start, затем http://localhost:8080
 * ES-модули не работают с file://, поэтому нужен хотя бы такой сервер.
 * Без зависимостей. Порт можно задать переменной PORT.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let target = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!target.startsWith(ROOT)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(target).catch(() => null))?.isDirectory()) target = path.join(target, 'index.html');
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не найдено');
  }
});

server.listen(PORT, () => console.log(`Игра: http://localhost:${PORT}`));
