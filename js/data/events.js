/**
 * Недельные события между торгами.
 *
 * Каждое событие: заголовок, текст и варианты ответа.
 * У варианта:
 *  - label / hint — подпись кнопки и пояснение последствий
 *  - requiresCash — минимальная касса, без которой вариант недоступен
 *  - apply(game) — применяет последствия и возвращает текст результата
 *
 * Флаги на game.flags живут одну неделю (их сбрасывает nextWeek):
 *  recession, magnate, commissionCut, fewOffers, estate.
 */
import { chance } from '../util/random.js';
import { addReputation } from '../engine/reputation.js';

export const EVENTS = Object.freeze([
  {
    id: 'tax',
    title: 'Налоговая проверка',
    text: 'Инспектор просит показать книги учёта за прошлый год. В них давно никто не заглядывал.',
    options: [
      {
        label: 'Нанять бухгалтера',
        hint: '−700 €',
        requiresCash: 700,
        apply(game) {
          game.cash -= 700;
          return 'Бухгалтер разобрал бумаги за два дня. Претензий нет.';
        },
      },
      {
        label: 'Разобраться самим',
        hint: '50%: штраф 2 400 €',
        apply(game) {
          if (chance(0.5)) {
            game.cash -= 2400;
            return 'В отчётах нашли ошибки. Штраф 2 400 €.';
          }
          return 'Инспектор ушёл ни с чем.';
        },
      },
    ],
  },
  {
    id: 'press',
    title: 'Статья в журнале',
    text: 'Антикварный журнал написал о вашем доме и последних торгах.',
    options: [
      {
        label: 'Приятно',
        hint: 'Репутация +6',
        apply(game) {
          addReputation(game, 6);
          return 'Телефон звонит чаще обычного.';
        },
      },
    ],
  },
  {
    id: 'recession',
    title: 'Рынок просел',
    text: 'Курсы упали, коллекционеры осторожничают. На этой неделе кошельки в зале тоньше.',
    options: [
      {
        label: 'Понятно',
        hint: 'Кошельки в зале −20%',
        apply(game) {
          game.flags.recession = true;
          return 'Придётся работать с тем, что есть.';
        },
      },
    ],
  },
  {
    id: 'magnate',
    title: 'Магнат в городе',
    text: 'Известный коллекционер-миллионер остановился в отеле рядом с залом.',
    options: [
      {
        label: 'Устроить приём',
        hint: '−900 €, придёт наверняка',
        requiresCash: 900,
        apply(game) {
          game.cash -= 900;
          game.flags.magnate = true;
          return 'Он принял приглашение и придёт на торги.';
        },
      },
      {
        label: 'Отправить приглашение',
        hint: 'Придёт с шансом 45%',
        apply(game) {
          if (chance(0.45)) {
            game.flags.magnate = true;
            return 'Ответ пришёл вечером: он будет в зале.';
          }
          return 'Ответа не последовало.';
        },
      },
    ],
  },
  {
    id: 'leak',
    title: 'Протечка в хранилище',
    text: 'После дождя на потолке второго зала проступило пятно.',
    options: [
      {
        label: 'Чинить сейчас',
        hint: '−900 €',
        requiresCash: 900,
        apply(game) {
          game.cash -= 900;
          return 'Кровельщики управились за день.';
        },
      },
      {
        label: 'Подождать',
        hint: 'Репутация −3',
        apply(game) {
          addReputation(game, -3);
          return 'Клиенты заметили пятно и обсуждают его.';
        },
      },
    ],
  },
  {
    id: 'rival',
    title: 'Конкурент демпингует',
    text: 'Соседний дом снизил комиссии и переманивает продавцов.',
    options: [
      {
        label: 'Снизить комиссии',
        hint: '−2 п.п. на эту неделю',
        apply(game) {
          game.flags.commissionCut = true;
          return 'Продавцы остались.';
        },
      },
      {
        label: 'Не реагировать',
        hint: 'Предложений будет меньше',
        apply(game) {
          game.flags.fewOffers = true;
          return 'Часть продавцов ушла к конкуренту.';
        },
      },
    ],
  },
  {
    id: 'gift',
    title: 'Неожиданный чек',
    text: 'Благодарный клиент прислал чек «за честную сделку в прошлом году».',
    options: [
      {
        label: 'Принять',
        hint: '+1 500 €',
        apply(game) {
          game.cash += 1500;
          return 'Чек на 1 500 € лёг в кассу.';
        },
      },
    ],
  },
  {
    id: 'forgery-press',
    title: 'Газета о подделках',
    text: 'Газета пишет о фальшивках на арт-рынке и обзванивает аукционные дома.',
    options: [
      {
        label: 'Ответить на вопросы',
        hint: 'Зависит от вашей истории',
        apply(game) {
          if (game.stats.exposed > 0) {
            addReputation(game, -5);
            return 'Журналисты вспомнили ваш скандал. Репутация −5.';
          }
          addReputation(game, 3);
          return 'Вас привели как пример надёжного дома. Репутация +3.';
        },
      },
    ],
  },
  {
    id: 'estate',
    title: 'Наследники коллекционера',
    text: 'Семья покойного коллекционера хочет продать часть собрания с полной документацией.',
    options: [
      {
        label: 'Принять коллекцию',
        hint: 'Два крупных лота с документами',
        apply(game) {
          game.flags.estate = true;
          return 'Лоты уже в хранилище.';
        },
      },
      {
        label: 'Отказаться',
        hint: '—',
        apply() {
          return 'Собрание ушло другому дому.';
        },
      },
    ],
  },
]);
