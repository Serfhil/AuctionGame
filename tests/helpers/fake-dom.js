/**
 * Минимальная подмена DOM для тестов интерфейса. HTML не разбирается:
 * любой селектор вида #id возвращает заглушку-элемент, в которую можно писать innerHTML.
 * Этого достаточно, чтобы проверить, какая разметка получается и что код не падает.
 */
export function createElement() {
  const element = {
    innerHTML: '',
    textContent: '',
    className: '',
    hidden: false,
    dataset: {},
    style: {},
    offsetWidth: 0,
    listeners: {},
    classes: new Set(),
    classList: {
      add: (name) => element.classes.add(name),
      remove: (name) => element.classes.delete(name),
      toggle: (name, on) => (on === undefined ? element.classes.has(name) : on) ? element.classes.add(name) : element.classes.delete(name),
      contains: (name) => element.classes.has(name),
    },
    addEventListener(type, listener) {
      element.listeners[type] = listener;
    },
    insertAdjacentHTML(_where, html) {
      element.innerHTML += html;
    },
    remove() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }),
    querySelector: () => createElement(),
    closest: () => null,
  };
  return element;
}

/** Установить глобальные document, window и т. п. Возвращает корневой элемент и функцию возврата. */
export function installFakeDom() {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const saved = {};
  const globals = {
    document: {
      querySelector: (selector) => (selector.startsWith('#') ? get(selector.slice(1)) : createElement()),
      getElementById: (id) => get(id),
      body: createElement(),
    },
    window: { scrollY: 0, scrollTo() {}, innerWidth: 1000, innerHeight: 800 },
    requestAnimationFrame: () => 0,
  };
  for (const [key, value] of Object.entries(globals)) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  globals.window.scrollTo = () => {};
  return {
    root: get('app'),
    get,
    restore() {
      for (const [key, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

/** Планировщик с ручным временем: тест сам решает, когда сработает следующий таймер. */
export function createFakeScheduler() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    get pending() {
      return timers.size;
    },
    /** Запустить самый ранний таймер. Возвращает false, если таймеров нет. */
    runNext() {
      const first = [...timers.entries()].sort((a, b) => a[1].ms - b[1].ms)[0];
      if (!first) return false;
      timers.delete(first[0]);
      first[1].fn();
      return true;
    },
  };
}
