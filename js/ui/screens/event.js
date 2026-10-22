/** Событие между торгами: сначала выбор ответа, затем его результат. */
export function renderEvent(game) {
  const event = game.event;
  const eyebrow = `<span class="eyebrow">Неделя ${game.week} · новости</span><h2 class="h2">${event.title}</h2>`;
  if (game.eventResult) {
    return `<main><div class="event">${eyebrow}<p class="lede">${game.eventResult}</p>
  <div class="row"><button class="btn primary big" data-act="continueAfterEvent">К приёму лотов →</button></div></div></main>`;
  }
  const options = event.options
    .map(
      (option, i) =>
        `<button class="opt" data-act="choose" data-i="${i}" ${option.requiresCash && game.cash < option.requiresCash ? 'disabled' : ''}><b>${option.label}</b><span>${option.hint}</span></button>`,
    )
    .join('');
  return `<main><div class="event">${eyebrow}<p class="lede">${event.text}</p>
  <div class="opts">${options}</div></div></main>`;
}
