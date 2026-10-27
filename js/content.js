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
        correct: 'approve',
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
          Sim.queue({ t: G.time + 41, type: 'fn', fn: () => Sim.toast('«Гусиный Пух» оказался подставной фирмой ГусьКорп! Пришло всего 200 кг, и те пахнут гусём.', 'bad') });
          return R(`Отправлено ${U.money(total)} предоплатой на Каймановы острова. Ждём резину…`, 'warn');
        },
        reject() { G.rep += 1; return R('Отклонено. Позже выяснилось: «Гусиный Пух» — подставная фирма ГусьКорп.', 'good'); },
      };
    },

    massage() {
      return {
        title: 'Заявка: массажное кресло', from: 'HR-отдел', kind: 'memo',
        body: 'Сотрудники всё чаще смотрят в одну точку. Предлагаем поставить массажное кресло в комнату отдыха. Говорят, помогает не сойти с ума.',
        rows: [['Стоимость', '$900'], ['Эффект', 'безумие растёт на 15% медленнее до конца дня']],
        sign: 'HR-менеджер', correct: 'approve',
        approve() { if (G.cash < 900) return noCash(); Sim.money(-900, 'office'); G.mods.decay *= 0.85; return R('Кресло установлено. Очередь к нему — уже на час вперёд.', 'good'); },
        reject: () => R('Отклонено. Сотрудники продолжают смотреть в одну точку.', 'info'),
      };
    },
    coffee_machine() {
      return {
        title: 'Заявка: новая кофемашина', from: 'Хозяйственный отдел', kind: 'memo',
        body: 'Старая кофемашина варит нечто, похожее на мазут. Предлагаем купить новую — эспрессо, капучино и даже латте!',
        rows: [['Стоимость', '$600'], ['Эффект', '«Кофе всем» по телефону станет вдвое дешевле и полезнее'], ['Бонус', '+5 рассудка всем сразу']],
        sign: 'Завхоз', correct: 'approve',
        approve() { if (G.cash < 600) return noCash(); Sim.money(-600, 'office'); G.mods.coffee = true; Sim.present().forEach(e => Sim.heal(e, 5)); return R('Новая кофемашина шипит и радует. Офис пахнет латте.', 'good'); },
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
      const e = emp(x => x.trait === 'star');
      if (!e) return null;
      const others = live(o => o !== e);
      const avg = others.length ? Math.round(others.reduce((s, o) => s + o.produced, 0) / others.length) : 0;
      return {
        title: 'Заявление о повышении зарплаты', from: `${nm(e)}, ${e.role.toLowerCase()}`, kind: 'letter',
        body: U.fill('Я делаю больше всех в офисе. ГусьКорп предлагает мне на $120 в день больше. Прошу повысить зарплату, иначе мне придётся уйти. С уважением, {name}.', e),
        rows: [['Текущая зарплата', `$${e.salary}/день`], ['Просит', '+$120/день'], ['Выработка сегодня', `${Math.round(e.produced)} уток`], ['Средняя по офису', `${avg} уток`]],
        sign: nm(e), correct: 'approve',
        approve() { e.salary += 120; e.salaryPaid += 120; Sim.heal(e, 25); return R(U.fill('{name} счастлив{|а} и работает ещё усерднее.', e), 'good'); },
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
          Sim.addNews('«Кря Индастриз» подарила уток детскому дому. Дети счастливы, утки тоже.');
          return R('Дети счастливы! «Утренний Кряк» пишет о вас статью. Репутация +8.', 'good');
        },
        reject() { G.rep -= 3; return R('Пресса написала: «Кря Индастриз пожалела уток для детей». Репутация −3.', 'warn'); },
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
    const P = [];
    const add = (h, m, key) => P.push({ t: U.T(h, m) + U.randi(-5, 5), key });
    add(9, 10, 'rubber_legit');
    add(9, 40, U.pick(['massage', 'coffee_machine', 'printer']));
    add(10, 5, 'enron');
    const adEarly = U.chance(0.55);
    if (adEarly) add(10, 25, 'ad');
    add(10, 45, 'denounce');
    add(11, 10, 'dotcom');
    add(11, 35, 'rubber_fake');
    add(12, 10, 'it_spy');
    add(12, 45, 'contract_legit');
    add(13, 15, 'vacation');
    add(13, 45, 'rubber_legit');
    add(14, 20, 'overtime');
    add(14, 55, 'contract_fake');
    add(15, 30, 'raise');
    add(16, 5, 'bonds');
    add(16, 35, 'charity');
    if (!adEarly) add(17, 0, 'ad');
    return P;
  }

  /* ---------- Собеседники по телефону ---------- */
  const SP = {
    founder: { name: 'Аркадий Кряков', title: 'Председатель совета директоров', look: { skin: '#f1c9a5', hair: '#e8e8e8', hairStyle: 'bald', shirt: '#ffffff', tie: '#d4a017', pants: '#222', jacket: '#2b2f3a', glasses: true } },
    goose: { name: 'Г. Гусев', title: 'Гендиректор ГусьКорп', look: { skin: '#f6d2b0', hair: '#e8e8e8', hairStyle: 'slick', shirt: '#ffffff', tie: '#ff8a1c', pants: '#555', jacket: '#c8c8d0' } },
    mom: { name: 'Мама', title: 'Звонит на рабочий', look: { female: true, skin: '#eec39a', hair: '#8a8a8a', hairStyle: 'bun', shirt: '#c9b8e8', pants: '#555', glasses: true } },
    foreman: { name: 'Михалыч', title: 'Мастер цеха', look: { skin: '#d9a47a', hair: '#4a2f1c', hairStyle: 'bald', shirt: '#3a6ea5', pants: '#2a3550' } },
    broker: { name: 'Джордан', title: 'Брокер «Стрэттон-Дак»', look: { skin: '#f6d2b0', hair: '#c9a14a', hairStyle: 'slick', shirt: '#ffffff', tie: '#d4a017', pants: '#222', jacket: '#1b1b22' } },
    press: { name: 'Журналистка', title: 'Газета «Утренний Кряк»', look: { female: true, skin: '#f1c9a5', hair: '#a8432a', hairStyle: 'bob', shirt: '#f3e2a0', pants: '#555', glasses: true } },
  };

  const reply = (speaker, text) => UI.dialog({ speaker, text });

  const CALLS = {
    goose: {
      who: () => SP.goose,
      open() {
        UI.dialog({
          speaker: SP.goose,
          text: 'Алло, коллега! Гусев, ГусьКорп. Давайте без формальностей: $5 000 наличными за формулу вашей новой пищалки. Никто не узнает. Ну, почти никто. Га-га!',
          options: [
            { label: 'Взять конверт (+$5 000)', fn: () => { Sim.money(5000, 'bribe'); G.flags.bribe = true; Market.jump('GOOS', 6); G.rep -= 6; reply(SP.goose, 'Приятно иметь с вами дело! Конверт уже у вашей секретарши. Га-га-га!'); } },
            { label: 'Отказаться', fn: () => { G.rep += 2; reply(SP.goose, 'Жаль, жаль… Но у меня есть и другие способы узнать ваши секреты. Га-га.'); } },
            { label: 'Записать разговор и отдать прессе', fn: () => { G.rep += 6; Market.jump('GOOS', -6); G.flags.exposedGoose = true; Sim.addNews('Скандал: глава ГусьКорп пытался подкупить менеджера «Кря Индастриз». Запись у редакции.', true); reply(SP.goose, '…Алло? Вы что, записываете?! Это возмути… *гудки*'); } },
          ],
        });
      },
      missed: () => 'Кто-то из ГусьКорп не дозвонился. Наверное, к лучшему.',
    },
    mom: {
      who: () => SP.mom,
      open() {
        UI.dialog({
          speaker: SP.mom,
          text: 'Алло, сынок! Это мама. Ты сегодня покушал? Голос у тебя какой-то уставший. Ты там не перерабатываешь?',
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
          text: 'Начальник, конвейер стучит. Подшипник сыпется. Надо $700 на ремонт, иначе через час-полтора встанем.',
          options: [
            { label: 'Оплатить ремонт ($700)', fn: () => { if (G.cash < 700) { reply(SP.foreman, 'Денег-то нет, начальник… Ну, будем молиться.'); maybeBreak(); return; } Sim.money(-700, 'office'); reply(SP.foreman, 'Понял, чиню. Будет как новенький.'); } },
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
          text: 'Слушай сюда, друг! Акции «ПенниДак» — это ракета! Вложи $3 000 — к вечеру утроим! Мне всего лишь комиссия 50%. Ну что, по рукам?',
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
        const pace = G.ducks / (CFG.PLAN * el / (CFG.DAY_END - CFG.DAY_START));
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

  function maybeBreak() {
    if (G.flags.breakScheduled) return;
    G.flags.breakScheduled = true;
    if (U.chance(0.7)) Sim.queue({ t: G.time + U.randi(55, 90), type: 'breakdown' });
  }

  function intro(done) {
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

  return { makeDoc, planDocs, CALLS, SP, intro, STAGE_TXT };
})();
