'use strict';
/* Документы на столе и телефонные звонки */
const Content = (() => {
  const live = fn => G.emps.filter(e => !e.gone && !e.exiting && fn(e));
  const emp = fn => { const l = live(fn); return l.length ? U.pick(l) : null; };
  const nm = e => (e ? `${e.name} ${e.surname}` : '—');
  const STAGE_TXT = ['в норме', 'нервничает', 'на грани срыва', 'БЕЗУМИЕ'];
  const R = (text, type) => ({ text, type: type || 'info' });
  const noCash = () => R('Не хватает денег! Документ вернулся неоплаченным.', 'bad');

  /* ---------- Документы ---------- */
  const DOCS = {
    rubber_legit() {
      const kg = 500, total = 1500;
      return {
        title: 'Счёт на закупку резины', from: 'Отдел снабжения', kind: 'invoice',
        body: 'Прошу согласовать оплату очередной партии резины для производства уток. Поставщик проверенный, работаем много лет.',
        rows: [
          ['Поставщик', 'ТОО «Каучук-Трейд» (с 1994 г.)'], ['Объём', `${kg} кг`], ['Цена', '$3.00 за кг'],
          ['Итого', U.money(total)], ['Оплата', 'по факту поставки'], ['Доставка', 'через 25 минут'],
          ['На складе (на момент запроса)', `${Math.round(G.rubber)} кг`],
        ],
        sign: 'Нач. снабжения Л. Резинкина',
        /* склад переполнен — закупка не обязательна */
        correct: () => (G.rubber + G.sched.filter(ev => ev.type === 'deliver').reduce((t, ev) => t + ev.kg, 0) < 650 ? 'approve' : null),
        approve() {
          if (G.cash < total) return noCash();
          Sim.money(-total, 'materials');
          Sim.queue({ t: G.time + 25, type: 'deliver', kg });
          return R(`Оплачено ${U.money(total)}. Резина приедет через 25 минут.`, 'good');
        },
        reject: () => R('Закупка отклонена. Следите за складом резины!', 'warn'),
      };
    },

    rubber_fake() {
      const total = 4250;
      return {
        title: 'СРОЧНО: премиальная резина', from: 'Входящее письмо (переслано снабжением)', kind: 'letter',
        body: 'Уважаемый партнёр! Только сегодня — премиальная резина нового поколения. Утки из неё пищат на октаву выше! Ответ нужен немедленно, иначе предложение сгорит.',
        rows: [
          ['Поставщик', 'ООО «Гусиный Пух»'], ['Объём', '500 кг'], ['Цена', '$8.50 за кг'], ['Итого', U.money(total)],
          ['Оплата', '100% предоплата'], ['Банк получателя', 'Cayman Goose Bank, Каймановы о-ва'], ['Сертификат качества', '«вышлем позже»'],
        ],
        sign: 'Ген. директор Г. Гусев',
        correct: 'reject',
        approve() {
          if (G.cash < total) return noCash();
          Sim.money(-total, 'materials'); G.rep -= 3; Market.jump('GOOS', 4);
          Sim.queue({ t: G.time + 40, type: 'deliver', kg: 200 });
          Sim.queue({ t: G.time + 41, type: 'effect', text: '«Гусиный Пух» оказался подставной фирмой ГусьКорп! Пришло всего 200 кг, и те пахнут гусём.', tone: 'bad' });
          return R(`Отправлено ${U.money(total)} предоплатой на Каймановы острова. Ждём резину…`, 'warn');
        },
        reject() { G.rep += 1; return R('Отклонено. Позже выяснилось: «Гусиный Пух» — подставная фирма ГусьКорп.', 'good'); },
      };
    },

    massage() {
      return {
        title: 'Заявка: массажное кресло', from: 'HR-отдел', kind: 'memo',
        body: 'Сотрудники всё чаще смотрят в одну точку. Предлагаем поставить массажное кресло в комнату отдыха. Говорят, помогает не сойти с ума.',
        rows: [['Стоимость', '$900 (один раз)'], ['Эффект', 'безумие растёт на 15% медленнее — сегодня и во все следующие дни']],
        sign: 'HR-менеджер', correct: 'approve',
        approve() { if (G.owned.massage) return R('Кресло уже стоит в комнате отдыха.', 'info'); if (G.cash < 900) return noCash(); Sim.money(-900, 'office'); G.mods.decay *= 0.85; G.owned.massage = true; return R('Кресло установлено. Очередь к нему — уже на час вперёд.', 'good'); },
        reject: () => R('Отклонено. Сотрудники продолжают смотреть в одну точку.', 'info'),
      };
    },
    coffee_machine() {
      return {
        title: 'Заявка: новая кофемашина', from: 'Хозяйственный отдел', kind: 'memo',
        body: 'Старая кофемашина варит нечто, похожее на мазут. Предлагаем купить новую — эспрессо, капучино и даже латте!',
        rows: [['Стоимость', '$600 (один раз)'], ['Эффект', '«Кофе всем» по телефону станет вдвое дешевле и полезнее — навсегда'], ['Бонус', '+5 рассудка всем сразу']],
        sign: 'Завхоз', correct: 'approve',
        approve() { if (G.owned.coffee) return R('Новая кофемашина уже шипит на кухне.', 'info'); if (G.cash < 600) return noCash(); Sim.money(-600, 'office'); G.mods.coffee = true; G.owned.coffee = true; Sim.present().forEach(e => Sim.heal(e, 5)); return R('Новая кофемашина шипит и радует. Офис пахнет латте.', 'good'); },
        reject: () => R('Отклонено. Мазут продолжает литься.', 'info'),
      };
    },
    printer() {
      return {
        title: 'Счёт: ремонт ксерокса', from: 'Хозяйственный отдел', kind: 'invoice',
        body: 'Ксерокс жуёт бумагу и мигает красным. В очереди к нему сотрудники начинают звереть.',
        rows: [['Стоимость ремонта', '$250'], ['Эффект', 'безумие растёт на 7% медленнее до конца дня']],
        sign: 'Завхоз', correct: 'approve',
        approve() { if (G.cash < 250) return noCash(); Sim.money(-250, 'office'); G.mods.decay *= 0.93; return R('Ксерокс снова ксерит. Очередь рассосалась.', 'good'); },
        reject: () => R('Отклонено. У ксерокса кто-то уже рычит.', 'info'),
      };
    },

    enron() {
      const k = G.market.t.ENGN;
      const an = emp(e => e.role === 'Аналитик') || emp(() => true);
      return {
        title: 'Инвестиционное предложение', from: `Аналитик ${nm(an)}`, kind: 'memo',
        body: 'Предлагаю вложить свободные средства в акции «Энергон». Надёжная энергетическая компания с рейтингом AAA. Отчётность у них сложная, но это признак серьёзности!',
        rows: [
          ['Бумага', 'ENGN — Энергон'], ['Цена сейчас', `$${k.price.toFixed(2)}`], ['Сумма', '$6 000'],
          ['Прогноз', '«Покупать!» (наш аналитик)'], ['Аудитор', '«Андерсенко и Ко»'], ['Долги компании', 'не раскрываются (офшорные «дочки»)'],
        ],
        sign: nm(an), correct: 'reject',
        approve() {
          const n = Market.buy('ENGN', 6000);
          return n ? R(`Куплено ${n} акций Энергона. Курс — в терминале.`, 'info') : noCash();
        },
        reject: () => R('Отклонено. Деньги остались в кассе.', 'info'),
      };
    },

    dotcom() {
      const k = G.market.t.UTKA;
      const m = emp(e => e.role === 'Маркетолог') || emp(() => true);
      return {
        title: 'Вложиться в «новую экономику»!', from: `Маркетолог ${nm(m)}`, kind: 'memo',
        body: 'Утка.ком растёт как на дрожжах! Все уже купили, даже моя бабушка. Предлагаю вложить $8 000, пока не поздно. Это же ИНТЕРНЕТ!',
        rows: [
          ['Бумага', 'UTKA — Утка.ком'], ['Цена сейчас', `$${k.price.toFixed(2)}`], ['Рост за год', '+300%'],
          ['Прибыль компании', '−$40 млн (зато сайт красивый)'], ['Сумма', '$8 000'], ['Риск', '«Какой риск? Это же интернет!»'],
        ],
        sign: nm(m), correct: 'reject',
        approve() {
          const n = Market.buy('UTKA', 8000);
          return n ? R(`Куплено ${n} акций Утка.ком. Добро пожаловать в новую экономику!`, 'info') : noCash();
        },
        reject: () => R('Отклонено. Маркетолог обиженно обновляет котировки.', 'info'),
      };
    },

    ad() {
      const left = (CFG.DAY_END - G.time) / 60;
      return {
        title: 'Рекламная кампания на ТВ', from: 'Отдел маркетинга', kind: 'memo',
        body: 'Ролик «Кря-кря — и ванна твоя!» готов. Если запустить его сейчас, магазины поднимут закупочную цену наших уток до конца рабочего дня.',
        rows: [
          ['Стоимость', '$1 200'], ['Эффект', 'цена утки +$0.80 до конца дня'], ['Цена сейчас', `$${G.price.toFixed(2)} за утку`],
          ['Осталось рабочего дня', `${left.toFixed(1).replace('.', ',')} ч`], ['Выпуск сейчас', `≈${Math.round(paceNow())} уток в час`],
        ],
        sign: 'Креативный директор',
        correct: () => ((CFG.DAY_END - G.time) >= 300 ? 'approve' : 'reject'),
        approve() {
          if (G.cash < 1200) return noCash();
          Sim.money(-1200, 'office'); G.price += 0.8;
          return R(`Ролик в эфире! Утки теперь продаются по $${G.price.toFixed(2)}.`, 'good');
        },
        reject: () => R('Реклама отклонена. Креативный директор рыдает в раскадровку.', 'info'),
      };
    },

    denounce() {
      const lazy = emp(e => e.trait === 'lazy' && !e.lazyFixed);
      const inn = emp(e => e.trait === 'normal' || e.trait === 'star');
      const target = (lazy && (U.chance(0.65) || !inn)) ? lazy : inn;
      if (!target) return null;
      const isLazy = target.trait === 'lazy';
      const what = isLazy
        ? 'с утра ничего не делает: то спит, то раскладывает «Косынку».'
        : 'слишком часто ходит к кулеру и громко смеётся. Мне кажется, {он|она} бездельничает.';
      return {
        title: 'Анонимная записка', from: 'Аноним (почерк корявый)', kind: 'note',
        body: U.fill(`Довожу до вашего сведения, что {name} ${target.surname} (${target.role.toLowerCase()}) ${what} Прошу принять меры!`, target),
        rows: [['Предлагаемая мера', 'выговор и контроль выработки'], ['Подсказка', 'выработку можно сверить в досье (кнопка «Сотрудники»)']],
        sign: 'без подписи', correct: isLazy ? 'approve' : 'reject',
        approve() {
          if (target.gone || target.exiting) return R('Этот сотрудник уже не работает.', 'info');
          if (isLazy) {
            target.lazyFixed = true; Sim.hurt(target, 8);
            target.clues.push({ t: G.time, text: 'получил{|а} выговор по анонимке', strong: false });
            return R(U.fill('{name} получил{|а} выговор и взял{ся|ась} за работу.', target), 'good');
          }
          Sim.hurt(target, 20); Sim.present().forEach(o => Sim.hurt(o, 3));
          return R(U.fill('{name} получил{|а} выговор ни за что — выработка у {него|неё} отличная. Офис шепчется.', target), 'bad');
        },
        reject: () => R('Анонимка отправлена в шредер.', 'info'),
      };
    },

    it_spy() {
      const spy = emp(e => e.trait === 'spy' && !e.doubleAgent);
      const inn = emp(e => e.trait !== 'spy');
      const herring = !spy || U.chance(0.25);
      const target = herring ? inn : spy;
      if (!target) return null;
      return {
        title: 'Отчёт ИТ-отдела', from: 'Сисадмин Ахмет', kind: 'memo',
        body: U.fill(`Зафиксирована подозрительная активность на компьютере сотрудника: {name} ${target.surname} (${target.role.toLowerCase()}).`, target),
        rows: herring
          ? [['Файл', 'zvezdnye_voyny_trailer.mpg (40 МБ)'], ['Действие', 'скачивание из интернета, 6 часов по модему'], ['Куда', 'папка «Мои документы»'], ['Мера', 'служебное расследование']]
          : [['Файл', 'pishalka_v3_SECRET.dwg'], ['Действие', 'копирование на дискеты (3 шт.)'], ['Куда', 'дискеты вынесены из офиса'], ['Мера', 'служебное расследование']],
        sign: 'Ахмет, ИТ-отдел (весь)',
        correct: herring ? 'reject' : 'approve',
        approve() {
          if (target.gone || target.exiting) return R('Этот сотрудник уже не работает.', 'info');
          if (!herring) {
            target.evidence = true; target.suspicion = 100;
            target.clues.push({ t: G.time, text: U.fill('ИТ: копировал{|а} секретные чертежи на дискеты', target), strong: true });
            return R(U.fill('Расследование подтвердило: {name} сливает чертежи! Вызовите {его|её} в кабинет.', target), 'good');
          }
          Sim.hurt(target, 15);
          return R(U.fill('Расследование выяснило: {name} просто качал{|а} трейлер. Сотрудник обижен.', target), 'bad');
        },
        reject: () => R('Отчёт отправлен в долгий ящик.', 'info'),
      };
    },

    contract_legit() {
      const s = emp(e => e.role === 'Менеджер по продажам') || emp(() => true);
      return {
        title: 'Договор поставки', from: `Отдел продаж — ${nm(s)}`, kind: 'invoice',
        body: 'Сеть отелей «Пена Плаза» хочет закупить партию наших уток для номеров люкс. Условия хорошие.',
        rows: [
          ['Заказчик', 'Сеть отелей «Пена Плаза»'], ['Объём', '600 уток'], ['Цена', '$5.20 за утку (выше рынка)'],
          ['Оплата', 'по факту отгрузки, вечером'], ['Неустойка', 'нет'],
        ],
        sign: nm(s), correct: 'approve',
        approve() { G.contracts.legit = true; return R('Договор подписан. Доплата придёт при отгрузке вечером.', 'good'); },
        reject() { Market.jump('GOOS', 2); return R('Отклонено. «Пена Плаза» ушла к ГусьКорп.', 'warn'); },
      };
    },

    contract_fake() {
      return {
        title: 'СРОЧНЫЙ договор поставки', from: 'Входящий факс', kind: 'letter',
        body: 'Крупный зарубежный клиент готов купить ВСЁ, что мы произведём. Но условия жёсткие — подписывать нужно прямо сейчас.',
        rows: [
          ['Заказчик', 'Goose & Partners Ltd. (о-в Мэн)'], ['Объём', '6 000 уток — до 18:00 сегодня'], ['Цена', '$6.00 за утку'],
          ['Предоплата', '0%'], ['Неустойка за срыв', '$4 000'], ['Подписант', 'Г. Гусев (по доверенности)'],
        ],
        sign: 'p.p. Г. Гусев', correct: 'reject',
        approve() { G.contracts.fake = true; return R('Договор подписан. Осталось произвести 6 000 уток до вечера…', 'warn'); },
        reject() { G.rep += 1; return R('Отклонено. Позже выяснилось, что Goose & Partners — ловушка ГусьКорп.', 'good'); },
      };
    },

    vacation() {
      const c = live(e => e.state === 'seated' && e.trait !== 'spy').sort((a, b) => a.sanity - b.sanity);
      if (!c.length) return null;
      const lazy = c.find(e => e.trait === 'lazy' && e.sanity > 55);
      const e = lazy && U.chance(0.35) ? lazy : c[0];
      const lazyReq = e.trait === 'lazy' && e.sanity > 55;
      return {
        title: 'Заявление на отгул', from: `${nm(e)}, ${e.role.toLowerCase()}`, kind: 'letter',
        body: U.fill(lazyReq
          ? 'Прошу отпустить меня домой прямо сейчас. Устал{|а}. Очень. Ну правда очень.'
          : 'Прошу отпустить меня домой. Я на грани. Вчера мне приснилось, что я резиновая утка и меня продали за $4.', e),
        rows: [
          ['Сотрудник', `${nm(e)}, ${e.role.toLowerCase()}`], ['Состояние (оценка HR)', STAGE_TXT[Sim.stage(e)]],
          ['Выработка сегодня', `${Math.round(e.produced)} уток`], ['Просит', 'уйти домой сейчас, вернуться завтра'],
        ],
        sign: nm(e),
        correct: () => (e.trait === 'lazy' && e.sanity > 55 ? 'reject' : e.sanity < 55 ? 'approve' : null),
        approve() {
          if (Sim.goHomeFromDesk(e)) return R(U.fill('{name} уходит отдыхать. Завтра вернётся {бодрым|бодрой}.', e), 'good');
          return R('Сотрудник сейчас не за столом — отгул не оформлен.', 'info');
        },
        reject() { Sim.hurt(e, 18); return R(U.fill('{name} остаётся на работе. У {него|неё} дёргается глаз.', e), 'warn'); },
      };
    },

    overtime() {
      return {
        title: 'Приказ о сверхурочных', from: 'Директор по производству (копия вам)', kind: 'memo',
        body: 'Чтобы выполнить план, предлагаю ввести до конца дня ускоренный режим: работать быстрее и без перерывов.',
        rows: [['Плюс', '+15% к выработке'], ['Минус', 'сотрудники сходят с ума на 30% быстрее'], ['Стоимость', 'бесплатно (переработки не оплачиваются)']],
        sign: 'Б. Конвейеров', correct: null,
        approve() { G.overtime = true; return R('Ускоренный режим введён. Конвейер ускорился, сотрудники — нервничают.', 'warn'); },
        reject() { Sim.present().forEach(e => Sim.heal(e, 3)); return R('Отклонено. Офис облегчённо выдохнул.', 'good'); },
      };
    },

    raise() {
      const e = emp(x => x.trait === 'star' && !x.raised);
      if (!e) return null;
      const others = live(o => o !== e);
      const avg = others.length ? Math.round(others.reduce((s, o) => s + o.produced, 0) / others.length) : 0;
      return {
        title: 'Заявление о повышении зарплаты', from: `${nm(e)}, ${e.role.toLowerCase()}`, kind: 'letter',
        body: U.fill('Я делаю больше всех в офисе. ГусьКорп предлагает мне на $120 в день больше. Прошу повысить зарплату, иначе мне придётся уйти. С уважением, {name}.', e),
        rows: [['Текущая зарплата', `$${e.salary}/день`], ['Просит', '+$120/день'], ['Выработка сегодня', `${Math.round(e.produced)} уток`], ['Средняя по офису', `${avg} уток`]],
        sign: nm(e), correct: 'approve',
        approve() { e.salary += 120; e.salaryPaid += 120; e.raised = true; Sim.heal(e, 25); return R(U.fill('{name} счастлив{|а} и работает ещё усерднее.', e), 'good'); },
        reject() {
          if (U.chance(0.6)) { Sim.queue({ t: G.time + 25, type: 'quit', eid: e.id }); return R(U.fill('{name} молча открывает сайт ГусьКорп с вакансиями…', e), 'warn'); }
          Sim.hurt(e, 20); return R(U.fill('{name} обидел{ся|ась}, но остал{ся|ась}.', e), 'warn');
        },
      };
    },

    bonds() {
      const b = emp(e => e.role === 'Бухгалтер') || emp(() => true);
      return {
        title: 'Размещение резервов', from: `Бухгалтер ${nm(b)}`, kind: 'memo',
        body: 'Предлагаю разместить часть резервов в государственные облигации. Скучно, зато надёжно: в 18:00 деньги вернутся с процентами.',
        rows: [['Инструмент', 'гособлигации казначейства'], ['Сумма', '$5 000'], ['Доход', '+3% к 18:00 (гарантировано)'], ['Риск', 'минимальный']],
        sign: nm(b), correct: () => (G.cash >= 7000 ? 'approve' : null),
        approve() { if (!Market.buyBonds(5000)) return noCash(); return R('Куплено облигаций на $5 000. Вечером вернутся с процентами.', 'good'); },
        reject: () => R('Отклонено. Резервы лежат в сейфе.', 'info'),
      };
    },

    charity() {
      return {
        title: 'Благотворительность', from: 'PR-отдел', kind: 'letter',
        body: 'Детский дом №7 просит подарить детям 200 резиновых уток. Журналисты «Утреннего Кряка» уже готовят фотоаппараты.',
        rows: [['Подарить', '200 уток (≈$800 выручки)'], ['Эффект', 'репутация компании растёт'], ['Уток выпущено сегодня', `${Math.floor(G.ducks)} шт.`]],
        sign: 'PR-менеджер', correct: 'approve',
        approve() {
          const n = Math.min(200, Math.floor(G.ducks));
          G.ducks -= n; Sim.money(-n * G.price, 'charity'); G.rep += 8; Market.jump('QUAK', 2);
          Sim.addNews('charity');
          return R('Дети счастливы! «Утренний Кряк» пишет о вас статью. Репутация +8.', 'good');
        },
        reject() { G.rep -= 3; return R('Пресса написала: «Кря Индастриз пожалела уток для детей». Репутация −3.', 'warn'); },
      };
    },

    /* ---- последствия вчерашнего дня ---- */
    commission() {
      return {
        title: 'Предписание Комиссии по ценным бумагам', from: 'Комиссия по ценным бумагам (заказное письмо)', kind: 'letter',
        body: 'По итогам вчерашней проверки в офисе «Кря Индастриз» выявлены нарушения: горны, летающие наличные и обезьяна без пропуска. Предписываем оплатить штраф до 12:00.',
        rows: [['Штраф', '$2 000'], ['Срок', 'до 12:00 сегодня'], ['Если не оплатить', 'штраф удваивается, репутация −6'], ['Основание', 'протокол обыска № 2001']],
        sign: 'Инспектор Строгов', correct: 'approve',
        approve() { if (G.cash < 2000) return noCash(); Sim.money(-2000, 'chaos'); G.rep += 2; return R('Штраф оплачен. Инспектор Строгов удовлетворённо закрыл папку.', 'good'); },
        reject() {
          Sim.queue({ t: Math.max(G.time + 5, U.T(12, 0)), type: 'effect', cash: -4000, cat: 'chaos', rep: -6, text: 'Комиссия удвоила неоплаченный штраф: −$4 000, репутация −6.', tone: 'bad' });
          return R('Предписание отклонено. Комиссия такого не прощает…', 'warn');
        },
      };
    },
    goose_suit() {
      return {
        title: 'Иск ГусьКорп о защите репутации', from: 'Юристы ГусьКорп «Гогот и партнёры»', kind: 'letter',
        body: 'Наш клиент Г. Гусев глубоко оскорблён публикацией записи разговора. Предлагаем мировое соглашение: вы платите компенсацию и публично извиняетесь.',
        rows: [['Компенсация', '$3 000'], ['Извинения', 'на первой полосе «Утреннего Кряка»'], ['Доказательства клиента', '«честное гусиное слово»'], ['Наша запись разговора', 'подлинная, есть у редакции']],
        sign: 'Адвокат Б. Гогот', correct: 'reject',
        approve() { if (G.cash < 3000) return noCash(); Sim.money(-3000, 'office'); G.rep -= 5; Market.jump('GOOS', 3); return R('Вы заплатили Гусеву и извинились. Пресса недоумевает, ГусьКорп ликует.', 'bad'); },
        reject() { G.rep += 3; Market.jump('GOOS', -3); return R('Иск отклонён. Суд не принял «честное гусиное слово» как доказательство.', 'good'); },
      };
    },
    severance() {
      const who = (G.memory && G.memory.innocent) || 'бывший сотрудник';
      return {
        title: 'Претензия уволенного сотрудника', from: `${who} (через профсоюз)`, kind: 'letter',
        body: `Меня уволили без причины, хотя я честно работал(а). Требую компенсацию, иначе обращаюсь в суд и в газеты.`,
        rows: [['Заявитель', who], ['Требование', 'компенсация $700'], ['Если отказать', 'суд и статья в газете: ≈ −$1 500 и репутация −5'], ['Проверка HR', 'нарушений за сотрудником не найдено']],
        sign: who, correct: 'approve',
        approve() { if (G.cash < 700) return noCash(); Sim.money(-700, 'staff'); Sim.present().forEach(e => Sim.heal(e, 4)); return R('Компенсация выплачена. В офисе облегчённо выдохнули: босс умеет признавать ошибки.', 'good'); },
        reject() {
          Sim.queue({ t: G.time + 90, type: 'effect', cash: -1500, cat: 'staff', rep: -5, text: 'Суд встал на сторону уволенного сотрудника: −$1 500, репутация −5.', tone: 'bad' });
          return R('Претензия отклонена. Юристы говорят, суд будет через пару часов.', 'warn');
        },
      };
    },
    audit() {
      return {
        title: 'Служебная проверка: «конверт»', from: 'Служба безопасности, п-к Шпионов', kind: 'memo',
        body: 'Поступили сведения, что вчера менеджер получил от ГусьКорп конверт с наличными. Предлагаем добровольно сдать деньги в кассу компании и закрыть вопрос.',
        rows: [['Сдать в кассу', '$5 000 (уже в балансе компании — просто фиксируем)'], ['Если признаться', 'репутация +2, совет оценит честность'], ['Если отрицать', 'проверка продолжится — риск скандала']],
        sign: 'П-к Шпионов', correct: 'approve',
        approve() { G.rep += 2; G.career.strikes = Math.max(0, G.career.strikes); return R('Вы признались. Полковник кивнул: «Честность — редкость. Но больше так не делайте».', 'good'); },
        reject() {
          if (U.chance(0.55)) { G.rep -= 10; Market.jump('QUAK', -4); Sim.addNews('bribe_rumor'); return R('Проверка нашла свидетелей. Скандал! Репутация −10.', 'bad'); }
          return R('Проверка зашла в тупик. Пока что.', 'warn');
        },
      };
    },
    ibn_tip() {
      const k = G.market.t.IBN;
      const ev = G.market.ev.find(x => x.id === 'IBN');
      const a = emp(e => e.role === 'Аналитик') || emp(() => true);
      return {
        title: 'Купить акции Ай-Би-Эн?', from: `Аналитик ${nm(a)}`, kind: 'memo',
        body: 'Предлагаю вложить свободные деньги в Ай-Би-Эн. Компания скучная, но сегодня о ней говорят. Прежде чем решать, загляните во вкладку «Новости» — там пишут, чего ждать.',
        rows: [['Бумага', 'IBN — Ай-Би-Эн'], ['Цена сейчас', `$${k.price.toFixed(2)}`], ['Сумма', '$5 000'], ['Подсказка', 'ищите в газете слухи про Ай-Би-Эн']],
        sign: nm(a),
        correct: () => (!ev ? null : ev.kind === 'spike' ? (G.time < ev.start + ev.len ? 'approve' : null) : 'reject'),
        approve() { const n = Market.buy('IBN', 5000); return n ? R(`Куплено ${n} акций Ай-Би-Эн. Следите за курсом в терминале.`, 'info') : noCash(); },
        reject: () => R('Отклонено. Деньги остались в кассе.', 'info'),
      };
    },
    insurance() {
      return {
        title: 'Страховка конвейера на сегодня', from: 'Страховая компания «Тихая заводь»', kind: 'invoice',
        body: 'Застрахуйте конвейер на один день. Если он сломается, наши мастера починят его за 15 минут вместо 50.',
        rows: [['Стоимость', '$350'], ['Действует', 'до 18:00 сегодня'], ['Ремонт при поломке', '15 минут вместо 50'], ['Мастер цеха говорит', G.flags.bearing ? '«подшипник сыплется, лучше застраховать»' : '«вроде всё крутится»']],
        sign: 'Агент В. Тиховодов', correct: () => (G.flags.bearing ? 'approve' : null),
        approve() { if (G.cash < 350) return noCash(); Sim.money(-350, 'office'); G.flags.insured = true; return R('Конвейер застрахован до вечера.', 'good'); },
        reject: () => R('Отклонено. Михалыч крестится на пресс.', 'info'),
      };
    },
  };

  function paceNow() {
    const el = Math.max(30, G.time - CFG.DAY_START);
    return G.ducks / el * 60;
  }

  function makeDoc(key) {
    const f = DOCS[key];
    if (!f) return null;
    const d = f();
    if (!d) return null;
    d.key = key;
    return d;
  }

  function planDocs() {
    const P = [], day = G.day, mem = G.memory || {};
    const add = (h, m, key) => P.push({ t: U.T(h, m) + U.randi(-5, 5), key });
    const maybe = (p, h, m, key) => { if (day === 1 || U.chance(p)) add(h, m, key); };
    const live = fn => G.emps.some(e => !e.gone && fn(e));
    add(9, 10, 'rubber_legit');
    const ups = ['printer'];
    if (!G.owned.massage) ups.push('massage');
    if (!G.owned.coffee) ups.push('coffee_machine');
    maybe(0.8, 9, 40, U.pick(ups));
    if (G.market.t.ENGN.state === 'aaa') add(10, 5, 'enron');
    const adEarly = U.chance(0.55);
    if (adEarly) add(10, 25, 'ad');
    maybe(0.75, 10, 45, 'denounce');
    if (G.market.t.UTKA.state === 'bubble') add(11, 10, 'dotcom');
    maybe(0.8, 11, 35, 'rubber_fake');
    if (day === 1 || live(e => e.trait === 'spy' && !e.doubleAgent) || U.chance(0.35)) add(12, 10, 'it_spy');
    maybe(0.85, 12, 45, 'contract_legit');
    maybe(0.8, 13, 15, 'vacation');
    add(13, 45, 'rubber_legit');
    maybe(0.7, 14, 20, 'overtime');
    maybe(0.75, 14, 55, 'contract_fake');
    if (live(e => e.trait === 'star' && !e.raised)) maybe(0.7, 15, 30, 'raise');
    add(16, 5, 'bonds');
    maybe(0.7, 16, 35, 'charity');
    if (!adEarly) add(17, 0, 'ad');
    /* вчерашние поступки возвращаются бумагами */
    if (mem.raid) add(9, 25, 'commission');
    if (mem.exposedGoose) add(10, 15, 'goose_suit');
    if (mem.innocent) add(9, 55, 'severance');
    if (mem.bribe) add(11, 0, 'audit');
    if (day > 1) {
      if (G.market.ev.some(e => e.id === 'IBN')) add(11, 20, 'ibn_tip');
      if (U.chance(0.5)) add(12, 25, 'insurance');
    }
    return P;
  }

  function planCalls() {
    const C = [], day = G.day, mem = G.memory || {};
    const add = (h, m, key) => C.push({ t: U.T(h, m), key });
    if (!mem.exposedGoose) add(10, U.randi(35, 55), 'goose');
    if (day === 1 || U.chance(0.5)) add(12, U.randi(15, 35), 'mom');
    if (day === 1 || !mem.foremanFixed || U.chance(0.4)) add(13, U.randi(30, 50), 'foreman');
    add(14, U.randi(40, 55), 'press');
    if (day === 1 || U.chance(0.5)) add(15, U.randi(10, 25), 'broker');
    add(16, U.randi(30, 45), 'founder');
    if (Hire.vacancies().length) add(11, U.randi(25, 45), 'agency');
    return C;
  }

  /* ---------- Собеседники по телефону ---------- */
  const SP = {
    founder: { name: 'Аркадий Кряков', title: 'Председатель совета директоров', look: { skin: '#f1c9a5', hair: '#e8e8e8', hairStyle: 'bald', shirt: '#ffffff', tie: '#d4a017', pants: '#222', jacket: '#2b2f3a', glasses: true } },
    goose: { name: 'Г. Гусев', title: 'Гендиректор ГусьКорп', look: { skin: '#f6d2b0', hair: '#e8e8e8', hairStyle: 'slick', shirt: '#ffffff', tie: '#ff8a1c', pants: '#555', jacket: '#c8c8d0' } },
    mom: { name: 'Мама', title: 'Звонит на рабочий', look: { female: true, skin: '#eec39a', hair: '#8a8a8a', hairStyle: 'bun', shirt: '#c9b8e8', pants: '#555', glasses: true } },
    foreman: { name: 'Михалыч', title: 'Мастер цеха', look: { skin: '#d9a47a', hair: '#4a2f1c', hairStyle: 'bald', shirt: '#3a6ea5', pants: '#2a3550' } },
    broker: { name: 'Джордан', title: 'Брокер «Стрэттон-Дак»', look: { skin: '#f6d2b0', hair: '#c9a14a', hairStyle: 'slick', shirt: '#ffffff', tie: '#d4a017', pants: '#222', jacket: '#1b1b22' } },
    press: { name: 'Журналистка', title: 'Газета «Утренний Кряк»', look: { female: true, skin: '#f1c9a5', hair: '#a8432a', hairStyle: 'bob', shirt: '#f3e2a0', pants: '#555', glasses: true } },
    agency: { name: 'Жанна Подборова', title: 'Агентство «Утиные кадры»', look: { female: true, skin: '#eec39a', hair: '#c9a14a', hairStyle: 'long', shirt: '#f0b9c4', pants: '#4a3a4a' } },
  };

  const reply = (speaker, text) => UI.dialog({ speaker, text });

  const CALLS = {
    goose: {
      who: () => SP.goose,
      open() {
        const again = (G.memory && G.memory.bribesTotal) || 0;
        const sum = again ? 8000 : G.day > 1 ? 6000 : 5000;
        const text = again
          ? `Партнёр! Гусев. Наше прошлое сотрудничество было таким плодотворным… Теперь $${U.num(sum)} за список ваших клиентов. Вы же уже в деле, га-га!`
          : G.day > 1
            ? `Снова Гусев. Вы тогда отказались — уважаю. Но я поднимаю ставку: $${U.num(sum)} за чертежи «Пищалки 3.0». Последнее предложение. Ну, почти.`
            : 'Алло, коллега! Гусев, ГусьКорп. Давайте без формальностей: $5 000 наличными за формулу вашей новой пищалки. Никто не узнает. Ну, почти никто. Га-га!';
        UI.dialog({
          speaker: SP.goose,
          text,
          options: [
            { label: `Взять конверт (+$${U.num(sum)})`, fn: () => { Sim.money(sum, 'bribe'); G.flags.bribe = true; Market.jump('GOOS', 6); G.rep -= again ? 8 : 6; reply(SP.goose, 'Приятно иметь с вами дело! Конверт уже у вашей секретарши. Га-га-га!'); } },
            { label: 'Отказаться', fn: () => { G.rep += 2; reply(SP.goose, 'Жаль, жаль… Но у меня есть и другие способы узнать ваши секреты. Га-га.'); } },
            { label: 'Записать разговор и отдать прессе', fn: () => { G.rep += 6; Market.jump('GOOS', -6); G.flags.exposedGoose = true; Sim.addNews('goose_exposed'); reply(SP.goose, '…Алло? Вы что, записываете?! Это возмути… *гудки*'); } },
          ],
        });
      },
      missed: () => 'Кто-то из ГусьКорп не дозвонился. Наверное, к лучшему.',
    },
    mom: {
      who: () => SP.mom,
      open() {
        const t = G.day === 1 ? 'Алло, сынок! Это мама. Ты сегодня покушал? Голос у тебя какой-то уставший. Ты там не перерабатываешь?'
          : U.pick(['Сынок, я видела тебя в газете! Ну, не тебя, а твоих уток. Ты там не перерабатываешь?', 'Алло! Ты опять не позавтракал, я по голосу слышу. Как там твои утки?', 'Сынок, тётя Люба спрашивает, нет ли у вас работы для её племянника. Он, правда, любит поспать…']);
        UI.dialog({
          speaker: SP.mom,
          text: t,
          options: [
            { label: 'Да, мам, всё хорошо', fn: () => reply(SP.mom, 'Вот и молодец. Шапку не забудь! Целую!') },
            { label: 'Мам, я на совещании!', fn: () => reply(SP.mom, 'Ой, всё. Я просто спросить. Ну работай, работай…') },
          ],
        });
      },
      missed: () => 'Звонила мама. Перезвоните ей потом.',
    },
    foreman: {
      who: () => SP.foreman,
      open() {
        UI.dialog({
          speaker: SP.foreman,
          text: G.day > 1 && G.memory && G.memory.foremanFixed
            ? 'Начальник, вчерашний ремонт держится, но теперь ремень пищит. $700 — и до конца недели спокойно. Иначе через час-полтора может встать.'
            : 'Начальник, конвейер стучит. Подшипник сыпется. Надо $700 на ремонт, иначе через час-полтора встанем.',
          options: [
            { label: 'Оплатить ремонт ($700)', fn: () => { if (G.cash < 700) { reply(SP.foreman, 'Денег-то нет, начальник… Ну, будем молиться.'); maybeBreak(); return; } Sim.money(-700, 'office'); G.flags.foremanFixed = true; reply(SP.foreman, 'Понял, чиню. Будет как новенький.'); } },
            { label: 'Потерпит до завтра', fn: () => { maybeBreak(); reply(SP.foreman, 'Ну, как скажете… Я предупредил.'); } },
          ],
        });
      },
      missed: () => { maybeBreak(); return 'Звонил мастер цеха — что-то про подшипник.'; },
    },
    broker: {
      who: () => SP.broker,
      open() {
        UI.dialog({
          speaker: SP.broker,
          text: G.day === 1 ? 'Слушай сюда, друг! Акции «ПенниДак» — это ракета! Вложи $3 000 — к вечеру утроим! Мне всего лишь комиссия 50%. Ну что, по рукам?'
            : U.pick(['Друг! Это снова Джордан! Забудь «ПенниДак» — сегодня «ДакНет», интернет для уток! $3 000 — к вечеру втрое!', 'Джордан на связи! Есть закрытое IPO «Кряк-Онлайн». Только для своих: $3 000, к вечеру утроим. Ты же свой?']),
          options: [
            { label: 'Вложить $3 000', fn: () => { if (G.cash < 3000) { reply(SP.broker, 'Нет денег? Тогда не трать моё время!'); return; } Sim.money(-3000, 'invest'); G.market.penny += 3000; reply(SP.broker, 'Вот это я понимаю! Ты настоящий волк! Результат узнаешь вечером.'); } },
            { label: 'Нет, спасибо', fn: () => reply(SP.broker, 'Ну и сиди со своими утками! *бросил трубку*') },
          ],
        });
      },
      missed: () => 'Звонил какой-то брокер. Голос очень бодрый.',
    },
    press: {
      who: () => SP.press,
      cond: () => G.chaos >= 35,
      open() {
        UI.dialog({
          speaker: SP.press,
          text: '«Утренний Кряк», здравствуйте! Нам сообщают, что в вашем офисе бегают с горнами и кидаются деньгами. Прокомментируете?',
          options: [
            { label: 'Без комментариев', fn: () => { G.rep -= 2; reply(SP.press, 'Так и напишем: «Менеджер уклонился от ответа». Спасибо!'); } },
            { label: '«Это тимбилдинг!»', fn: () => { if (G.chaos < 55 && U.chance(0.6)) { G.rep += 3; reply(SP.press, 'Как прогрессивно! Напишем про современный менеджмент.'); } else { G.rep -= 6; reply(SP.press, 'Интересно… А нам как раз прислали фото, где ваш сотрудник стоит на столе с галстуком на голове.'); } } },
          ],
        });
      },
      missed: () => { G.rep -= 2; return 'Звонили из газеты. Напишут без вашего комментария.'; },
    },
    founder: {
      who: () => SP.founder,
      open() {
        const el = Math.max(30, G.time - CFG.DAY_START);
        const pace = G.ducks / (G.plan * el / (CFG.DAY_END - CFG.DAY_START));
        const t1 = pace >= 1 ? 'Слышал, конвейер работает отлично!' : pace >= 0.8 ? 'Конвейер идёт, но до плана далековато.' : 'Утки еле ползут по конвейеру. Совет будет недоволен.';
        const t2 = G.chaos >= 60 ? ' И что за вопли у вас на этаже? Мне отсюда слышно!' : G.chaos >= 35 ? ' Говорят, сотрудники нервничают. Присмотри за ними.' : ' В офисе, говорят, спокойно. Так держать.';
        const t3 = G.leaks ? ' И найди уже, кто сливает наши секреты ГусьКорп!' : '';
        UI.dialog({
          speaker: SP.founder,
          text: 'Кряков на связи. ' + t1 + t2 + t3,
          options: [
            { label: 'Всё под контролем!', fn: () => reply(SP.founder, 'Надеюсь. До встречи на совете в 18:00.') },
            { label: 'Есть сложности…', fn: () => { G.rep += 1; reply(SP.founder, 'Ценю честность. Совет тоже её ценит. Иногда.'); } },
          ],
        });
      },
      missed: () => { G.rep -= 2; return 'Председатель не дозвонился. Репутация −2.'; },
    },
  };

  /* кадровое агентство: проверенные кандидаты за деньги */
  CALLS.agency = {
    who: () => SP.agency,
    cond: () => Hire.vacancies().length > 0 && !G.flags.agency,
    open() {
      G.flags.agency = true;
      const v = Hire.vacancies();
      if (!v.length) { reply(SP.agency, 'Ой, у вас уже нет вакансий? Тогда до встречи!'); return; }
      UI.dialog({
        speaker: SP.agency,
        text: `Агентство «Утиные кадры», здравствуйте! Слышали, у вас ${v.length === 1 ? 'освободилось место' : 'освободились места'}. Пришлём два резюме проверенных кандидатов — без лентяев и без шпионов, гарантия. Всего $250.`,
        options: [
          { label: 'Присылайте ($250)', fn: () => {
            if (G.cash < 250) { reply(SP.agency, 'Ой, у вас с деньгами туго… Перезвоните, когда разбогатеете!'); return; }
            Sim.money(-250, 'staff');
            Sim.queue({ t: G.time + 15, type: 'resume', role: v[0].role, trait: U.chance(0.4) ? 'star' : 'normal' });
            Sim.queue({ t: G.time + 25, type: 'resume', role: (v[1] || v[0]).role, trait: 'normal' });
            reply(SP.agency, 'Чудесно! Резюме будут у вас через 15–25 минут.');
          } },
          { label: 'Спасибо, сами справимся', fn: () => reply(SP.agency, 'Как скажете! Только осторожнее: ГусьКорп любит подсылать своих «кандидатов».') },
        ],
      });
    },
    missed: () => 'Звонили из кадрового агентства.',
  };

  function maybeBreak() {
    G.flags.bearing = true;
    if (G.flags.breakScheduled) return;
    G.flags.breakScheduled = true;
    if (U.chance(0.7)) Sim.queue({ t: G.time + U.randi(55, 90), type: 'breakdown' });
  }

  function intro(done) {
    if (G.day > 1) { morning(done); return; }
    UI.dialog({
      speaker: SP.founder,
      pages: [
        'Алло! Это Аркадий Кряков, председатель совета директоров «Кря Индастриз». Поздравляю с первым днём на посту менеджера!',
        'План на сегодня — 3 000 уток. Резины на складе мало, так что следи за закупками. Деньги, акции, облигации — всё в терминале на твоём столе.',
        'Документы будут падать в лоток. Читай внимательно и ставь штамп: «СОГЛАСОВАНО» или «ОТКАЗАНО». Мошенников вокруг полно.',
        'Говорят, ГусьКорп заслала к нам шпионов. Да и лентяев хватает. Присматривай за сотрудниками через стекло и вызывай подозрительных на ковёр.',
        'И главное — не дай офису сойти с ума. В прошлый раз к вечеру тут была настоящая Уолл-стрит: горны, деньги из окон, обезьяна в галстуке…',
        'В 18:00 жду тебя на совете директоров. Удачи. Она тебе понадобится!',
      ],
      onDone: done,
    });
  }

  /* Утро второго и следующих дней: председатель напоминает, чем закончился вчерашний */
  function morning(done) {
    const C = G.career, mem = G.memory || {};
    const rank = Sim.RANKS[C.rank];
    const wd = Sim.WEEK_FULL[Sim.weekday()];
    const hello = Sim.weekday() === 0 ? `Доброе утро! ${wd}, день ${G.day}. Надеюсь, выходные прошли спокойно.` : `Доброе утро! ${wd}, день ${G.day}.`;
    const v = {
      promo: `${hello} Ещё раз поздравляю с повышением: теперь вы — ${rank.toLowerCase()}. Но и спрос больше: план на сегодня — ${U.num(G.plan)} уток.`,
      stay: `${hello} Вчера совет оставил вас на должности. Давайте сегодня без сюрпризов. План — ${U.num(G.plan)} уток.`,
      fine: `${hello} Вчерашний штраф — это жёлтая карточка. Ещё один провальный день — и красная. План — ${U.num(G.plan)} уток.`,
    }[mem.verdict] || `${hello} План на сегодня — ${U.num(G.plan)} уток.`;
    const pages = [v];
    const brief = (G.brief || []).slice();
    while (brief.length) pages.push(brief.splice(0, 2).join(' '));
    const stocks = Market.stocksValue();
    pages.push(`Касса: ${U.money(G.cash)}${stocks > 1 ? `, акции в портфеле: ${U.money(stocks)}` : ''}. Резины на складе: ${Math.round(G.rubber)} кг. Репутация: ${Math.round(G.rep)} из 100. В 18:00 жду вас на совете.`);
    UI.dialog({ speaker: SP.founder, pages, onDone: done });
  }

  /* ---------- Сотрудники сами приходят к менеджеру ---------- */
  const V = (text, how) => ({ text, how: how || 'back' });
  const VISITS = {
    complain: {
      w: 4,
      find(e) {
        const n = G.emps.find(o => o !== e && !o.gone && !o.exiting && Math.abs(o.col - e.col) <= 1 && Math.abs(o.row - e.row) <= 1 && Sim.stage(o) >= 2);
        return Sim.stage(e) <= 1 && n ? { n } : null;
      },
      make(e, { n }) {
        return {
          short: 'жалоба на соседа',
          text: U.fill(`Босс, ${n.name} уже час орёт «ПРОДАВАЙ!» мне прямо в ухо. Я так работать не могу!`, e),
          options: [
            { label: 'Купить беруши ($40)', fn: () => { Sim.money(-40, 'office'); Sim.heal(e, 12); return V('Спасибо! Тишина… Прекрасная тишина.'); } },
            { label: U.fill('Позову {name} на разговор', n), fn: () => { Sim.heal(e, 5); Sim.queue({ t: G.time + 2, type: 'fn', fn: () => { if (!G.visitor && NPC.canCall(n)) Sim.callIn(n); } }); return V('Спасибо, босс. Надеюсь, поможет.'); } },
            { label: 'Терпи, все терпят', fn: () => { Sim.hurt(e, 12); return V(U.fill('…Понял{|а}. Пойду терпеть.', e)); } },
          ],
        };
      },
    },
    idea: {
      w: 1.5, once: true,
      find: e => (Sim.stage(e) === 0 && (e.trait === 'normal' || e.trait === 'star') && G.cash > 3000 ? {} : null),
      make(e) {
        return {
          short: 'гениальная идея',
          text: 'Босс, у меня идея! Утки-космонавты! В шлеме, с флагом. Дети будут в восторге! Нужно всего $1 500 на прототип.',
          options: [
            { label: 'Финансировать ($1 500)', fn: () => {
              Sim.money(-1500, 'office'); Sim.heal(e, 15);
              const win = U.chance(0.6);
              Sim.queue(win
                ? { t: G.time + 60, type: 'effect', price: 0.6, rep: 4, text: U.fill('Утки-космонавты {name} разлетаются с полок! Цена утки +$0.60.', e), tone: 'good' }
                : { t: G.time + 60, type: 'effect', text: U.fill('Прототип утки-космонавта от {name} утонул в ванне. Деньги потрачены.', e), tone: 'bad' });
              return V('Вы не пожалеете! Через час покажу результат!');
            } },
            { label: 'Похвалить, но отказать', fn: () => { Sim.heal(e, 4); return V('Ну… может, в следующем квартале.'); } },
            { label: 'Не отвлекай меня ерундой', fn: () => { Sim.hurt(e, 10); return V('Ладно. Пойду дальше считать уток.'); } },
          ],
        };
      },
    },
    early: {
      w: 3,
      find: e => (e.sanity < 60 && e.trait !== 'spy' ? {} : null),
      make(e) {
        return {
          short: 'просится домой',
          text: 'Босс… можно я уйду пораньше? Голова раскалывается, перед глазами бегут котировки.',
          options: [
            { label: 'Иди домой, отдохни', fn: () => V(Sim.sendHome(e), 'home') },
            { label: 'Таблетка и кофе ($20)', fn: () => { Sim.money(-20, 'office'); Sim.heal(e, 18); return V('Спасибо… Попробую дотянуть до вечера.'); } },
            { label: 'Нет, работаем до 18:00', fn: () => { Sim.hurt(e, 12); return V('…Как скажете.'); } },
          ],
        };
      },
    },
    whistle: {
      w: 2.5,
      find(e) {
        if (e.trait === 'spy' || e.whistled || (G.flags.whistles || 0) >= 2) return null;
        const s = G.emps.find(o => o.trait === 'spy' && !o.doubleAgent && !o.gone && !o.exiting);
        return s ? { s } : null;
      },
      make(e, { s }) {
        e.whistled = true;
        G.flags.whistles = (G.flags.whistles || 0) + 1;
        const truth = U.chance(0.7);
        const inn = G.emps.filter(o => o !== e && o.trait !== 'spy' && !o.gone);
        const acc = truth || !inn.length ? s : U.pick(inn);
        const deed = U.fill(truth ? 'выносил{|а} дискеты из серверной' : 'шептал{ся|ась} с кем-то по телефону и озирал{ся|ась}', acc);
        return {
          short: 'хочет что-то рассказать',
          text: U.fill(`Босс, не знаю, стоит ли говорить… Я видел{|а}, как ${acc.name} ${deed}.`, e),
          options: [
            { label: 'Спасибо, я проверю', fn: () => { acc.clues.push({ t: G.time, text: `по словам коллеги (${e.name}), ${deed}`, strong: false }); acc.suspicion = U.clamp(acc.suspicion + 22, 0, 100); return V('Только не говорите, что это я!'); } },
            { label: 'Доносить нехорошо', fn: () => { Sim.hurt(e, 5); return V(U.fill('Я же как лучше хотел{|а}…', e)); } },
          ],
        };
      },
    },
    probe: {
      w: 3,
      find: e => (e.trait === 'spy' && !e.doubleAgent && !e.probed ? {} : null),
      make(e) {
        e.probed = true;
        return {
          short: 'вопрос про чертежи',
          text: 'Босс, а где у нас хранятся чертежи новой пищалки? Хочу… изучить. Для работы. Исключительно для работы.',
          options: [
            { label: 'В серверной, у Ахмета', fn: () => { Sim.queue({ t: G.time + 20, type: 'errand', eid: e.id, task: 'server', tries: 0 }); return V('Спасибо! Просто… для общего развития.'); } },
            { label: 'Это коммерческая тайна', fn: () => { e.clues.push({ t: G.time, text: U.fill('выспрашивал{|а} у вас, где лежат чертежи', e), strong: false }); e.suspicion = U.clamp(e.suspicion + 22, 0, 100); return V(U.fill('Да-да, конечно. Я просто спросил{|а}.', e)); } },
            { label: 'Дать «чертежи» (фальшивые)', fn: () => { e.fakeBlueprints = true; return V('О! Спасибо, босс! (Торопливо прячет папку в портфель.)'); } },
          ],
        };
      },
    },
    crazy: {
      w: 6,
      find: e => (Sim.stage(e) >= 3 ? {} : null),
      make(e) {
        return {
          short: 'В БЕЗУМИИ',
          text: 'ПРОДАЙ МНЕ ЭТУ УТКУ, БОСС! ПРОДАЙ! Я ДАМ ЗА НЕЁ ТРИ УТКИ!!!',
          options: [
            { label: 'Сядь. Дыши. Медленно.', fn: () => { Sim.heal(e, 20); return V('…вдох… выдох… Где я? Почему у меня галстук на голове?'); } },
            { label: 'Продать ему утку за $50', fn: () => { Sim.heal(e, 30); Sim.money(50, 'sales'); return V('ДААА! ОНА МОЯ! Спасибо, босс! *нежно прижимает утку*'); } },
            { label: 'Домой. Немедленно.', fn: () => V(Sim.sendHome(e), 'home') },
          ],
        };
      },
    },
    wfh: {
      w: 2.5,
      find: e => (e.trait === 'lazy' && !e.lazyFixed && !e.askedWfh ? {} : null),
      make(e) {
        e.askedWfh = true;
        return {
          short: 'просьба про удалёнку',
          text: U.fill('Босс, можно я буду работать из дома? Тут шумно: кот, кулер, Ахмет… А дома я буду очень продуктивн{ым|ой}. Честно.', e),
          options: [
            { label: 'Ну ладно…', fn: () => { e.home = true; G.sentHome++; G.flags.wfhLazy = true; return V('Ура! То есть… спасибо, приступлю немедленно.', 'home'); } },
            { label: 'Нет. Я слежу за выработкой.', fn: () => { Sim.hurt(e, 6); if (U.chance(0.6)) e.lazyFixed = true; return V(U.fill('Понял{|а}… Пойду работать. Наверное.', e)); } },
          ],
        };
      },
    },
    thanks: {
      w: 5,
      find: e => (e.bonus > 0 && !e.thanked ? {} : null),
      make(e) {
        e.thanked = true;
        return {
          short: 'благодарность',
          text: U.fill('Босс, спасибо за премию! Я вам кофе принес{|ла}. И весь отдел передаёт привет!', e),
          options: [{ label: 'Спасибо! Работаем дальше', fn: () => { Sim.present().forEach(o => Sim.heal(o, 3)); G.rep += 1; return V('Так точно!'); } }],
        };
      },
    },
    birthday: {
      w: 1.5, once: true,
      find: e => (G.time >= U.T(12, 30) && G.time < U.T(16, 30) && G.emps.filter(o => !o.gone && o !== e).length ? {} : null),
      make(e) {
        const o = U.pick(G.emps.filter(q => !q.gone && q !== e));
        return {
          short: 'сбор на торт',
          text: `Босс, сегодня ${o.name} празднует день рождения! Скинемся на торт? Нужно $100.`,
          options: [
            { label: 'Конечно! ($100)', fn: () => { Sim.money(-100, 'office'); Sim.present().forEach(q => Sim.heal(q, 8)); World.confetti(); return V('Ура! Будет торт в форме утки!'); } },
            { label: 'Некогда, работаем', fn: () => { Sim.present().forEach(q => Sim.hurt(q, 3)); return V('Эх… Ладно.'); } },
          ],
        };
      },
    },
    advance: {
      w: 1, once: true,
      find: e => (e.trait !== 'spy' ? {} : null),
      make(e) {
        return {
          short: 'просьба об авансе',
          text: 'Босс, можно аванс $300? У меня кредит за ванну в форме утки…',
          options: [
            { label: 'Выдать $300', fn: () => { Sim.money(-300, 'staff'); Sim.heal(e, 20); return V('Вы спасли мою ванну! Спасибо!'); } },
            { label: 'Отказать', fn: () => { Sim.hurt(e, 8); return V('Понятно. Буду мыться в тазике.'); } },
          ],
        };
      },
    },
  };
  function pickVisit(cands) {
    const opts = [];
    for (const e of cands) {
      for (const k in VISITS) {
        const v = VISITS[k];
        if (v.once && G.flags['visit_' + k]) continue;
        const ctx = v.find(e);
        if (ctx) opts.push({ e, k, ctx, w: v.w });
      }
    }
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o.w, 0);
    let o = opts[0];
    for (const q of opts) { r -= q.w; if (r <= 0) { o = q; break; } }
    if (VISITS[o.k].once) G.flags['visit_' + o.k] = true;
    return { e: o.e, r: VISITS[o.k].make(o.e, o.ctx) };
  }

  return { makeDoc, planDocs, planCalls, CALLS, SP, intro, STAGE_TXT, pickVisit };
})();
