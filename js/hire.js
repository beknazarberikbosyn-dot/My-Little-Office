'use strict';
/* Найм: вакансии, кандидаты со скрытым характером и их резюме */
const Hire = (() => {
  const EMPLOYERS = ['Молокозавод «Бурёнка»', 'Типография «Пресс-Папье»', 'Магазин «Всё для ванной»', 'Банк «Копейка»', 'НИИ резиновых изделий', 'Фабрика игрушек «Мишутка»', 'Пекарня «Пышка»', 'Агентство «Реклама-Плюс»', 'Завод «Красный каучук»', 'Почта России… то есть «Почта Утки»'];
  const GOOSE_FIRMS = ['ООО «Гусиный Пух»', 'ЗАО «Га-Га Консалтинг»', 'ИП Гусев Г. Г.', '«Перо и Клюв Лтд.» (о-в Мэн)'];
  const SCHOOLS = ['Политех, факультет пластмасс', 'Экономический колледж', 'Курсы бухгалтеров «Дебет-Кредит»', 'Институт игрушки и упаковки', 'Университет, мехмат', 'Художественное училище'];
  const HOBBY = ['рыбалка', 'вышивка крестиком', 'шахматы', 'волейбол', 'кулинария', 'пение в хоре', 'аквариумные рыбки', 'походы в горы', 'настольные игры', 'садоводство'];
  const COVER = {
    normal: ['Ответственн{ый|ая}, пунктуальн{ый|ая}, люблю резиновых уток с детства. Готов{|а} учиться и работать в команде.', 'Ищу стабильную работу в крепкой компании. На прошлом месте ни разу не опоздал{|а}.', 'Хочу делать уток, которые радуют людей. Умею работать с документами и не боюсь факса.'],
    star: ['Умею работать на результат. На прошлом месте вывел{|а} отдел на рекорд и хочу расти вместе с «Кря Индастриз».', 'Мне скучно, когда план выполнен — хочется перевыполнить. Рекомендации прилагаю.'],
    lazy: ['Ищу спокойное место без авралов, планёрок и лишней суеты. Готов{|а} приступить после обеда.', 'Считаю, что лучшая работа — та, которую не пришлось делать. Шучу. Наверное.', 'Хочу работать в дружном коллективе, где ценят отдых сотрудника.'],
    spy: ['Давно мечтаю работать именно в «Кря Индастриз». Особенно интересуюсь новыми разработками. Исключительно из любви к уткам.', 'Готов{|а} выйти хоть сегодня. Хотелось бы сразу посмотреть, где у вас лежат чертежи… то есть рабочее место.', 'Восхищаюсь вашей пищалкой. Хочу знать о ней всё. Абсолютно всё.'],
  };

  const vacancies = () => G.emps.filter(e => e.gone && e.gone !== 'home');
  const vacantSlot = role => {
    const v = vacancies();
    return (v.find(e => e.role === role) || v[0] || null);
  };
  const pendingResumes = () => G.inbox.filter(d => d.kind === 'resume').length + NPC.transit().filter(d => d.kind === 'resume').length
    + G.sched.filter(ev => ev.type === 'resume').length;

  /* Кандидат на роль; trait — скрытый характер */
  function candidate(role, trait) {
    const R = Data.ROLES.find(r => r.role === role) || U.pick(Data.ROLES);
    const e = Sim.makeEmployee(-1, { role: R, trait });
    e.age = U.randi(22, 49);
    if (trait === 'star') e.salary = R.salary + 60;
    if (trait === 'spy') e.salary = Math.max(100, R.salary - 40);
    return e;
  }

  function resumeRows(c) {
    const emp = U.pick(EMPLOYERS), yrs = U.randi(2, 9);
    const base = {
      age: ['Возраст', `${c.age} ${c.age % 10 >= 1 && c.age % 10 <= 4 && (c.age < 10 || c.age > 20) ? (c.age % 10 === 1 ? 'год' : 'года') : 'лет'}`],
      exp: ['Опыт', `${yrs} ${yrs < 5 ? 'года' : 'лет'}, ${emp}`],
      edu: ['Образование', U.pick(SCHOOLS)],
      hobby: ['Хобби', U.pick(HOBBY)],
      refs: ['Рекомендации', U.pick(['есть, положительные', 'с прошлого места: «надёжный работник»', 'от бывшего начальника, тёплые'])],
      pay: ['Ожидаемая зарплата', `$${c.salary}/день`],
    };
    const T = {
      spy: {
        exp: ['Опыт', `${yrs} ${yrs < 5 ? 'года' : 'лет'}, ${U.pick(GOOSE_FIRMS)}`],
        refs: ['Рекомендации', U.pick(['Г. Гусев: «рекомендую от всего сердца, га-га»', 'подписаны неразборчиво, печать в форме гусиной лапы'])],
        hobby: ['Хобби', U.pick(['фотографировать чертежи… то есть архитектуру', 'коллекционирую дискеты', 'кормлю гусей в парке каждый день'])],
        pay: ['Ожидаемая зарплата', `$${c.salary}/день — «готов{|а} почти даром»`],
        wish: ['Пожелания', U.pick(['доступ в серверную с первого дня', 'стол поближе к сейфу с чертежами', 'ключ от всех кабинетов'])],
      },
      lazy: {
        exp: ['Опыт', `${U.randi(6, 9)} мест работы за ${U.randi(2, 3)} года`],
        hobby: ['Хобби', U.pick(['сон, диван, сериалы, снова сон', 'рекорд по «Косынке» — 4 минуты', 'лежать'])],
        refs: ['Рекомендации', '«не предоставлены»'],
        wish: ['Пожелания', U.pick(['обед три часа и свободный график', 'диван в офисе и тишина', 'не звонить до 11:00'])],
        why: ['Причина ухода', U.pick(['«не сошлись с будильником»', '«слишком много работы»', '«начальник требовал результат»'])],
      },
      star: {
        exp: ['Опыт', `${U.randi(7, 12)} лет, дважды «лучший сотрудник года»`],
        refs: ['Рекомендации', 'бывший директор: «отпускаем со слезами»'],
        ach: ['Достижения', U.pick(['увеличил{|а} выпуск продукции на 40%', 'наладил{|а} конвейер, который не могли починить три года', 'привёл{|а} 12 крупных клиентов'])],
        pay: ['Ожидаемая зарплата', `$${c.salary}/день — дороже рынка`],
      },
      normal: {},
    };
    const t = T[c.trait];
    /* у шпиона и лентяя — две-три улики из возможных, иногда одна; у хороших — изредка безобидная странность */
    const hintKeys = Object.keys(t);
    const nHints = c.trait === 'spy' || c.trait === 'lazy' ? (U.chance(0.25) ? 1 : U.randi(2, 3)) : hintKeys.length;
    const use = U.shuffle(hintKeys.slice()).slice(0, nHints);
    const rows = Object.assign({}, base);
    for (const k of use) rows[k] = t[k];
    if (c.trait === 'normal' && U.chance(0.35)) rows.hobby = ['Хобби', U.pick(['кормить уток в парке', 'разведение хомяков', 'собираю марки с гусями', 'игра на тубе'])];
    const order = ['age', 'exp', 'ach', 'edu', 'why', 'hobby', 'wish', 'refs', 'pay'];
    return order.filter(k => rows[k]).map(k => [rows[k][0], U.fill(rows[k][1], c)]);
  }

  function resumeDoc(c) {
    const good = c.trait === 'normal' || c.trait === 'star';
    return {
      key: 'resume', title: `Резюме: ${c.name} ${c.surname}`, from: `Кандидат на должность «${c.role}»`, kind: 'resume', cand: c,
      body: U.fill(U.pick(COVER[c.trait]), c),
      rows: resumeRows(c),
      sign: `${c.name} ${c.surname}`,
      correct: () => (vacantSlot(c.role) ? (good ? 'approve' : 'reject') : null),
      approve() {
        const slot = vacantSlot(c.role);
        if (!slot) return { text: 'Свободных мест нет — резюме отправлено в архив.', type: 'info' };
        hire(c, slot);
        return { text: U.fill(`${c.name} ${c.surname} принят{|а} на должность «${slot.role}». Уже поднимается на лифте!`, c), type: 'good' };
      },
      reject: () => ({ text: U.fill(`${c.name} получил{|а} вежливый отказ.`, c), type: 'info' }),
    };
  }

  /* Нанять: новый человек занимает пустой стол */
  function hire(c, slot) {
    const i = slot.id;
    G.alumni.push(slot);
    c.id = i; c.col = i % 4; c.row = Math.floor(i / 4);
    if (c.role !== slot.role) {
      const R = Data.ROLES.find(r => r.role === slot.role);
      if (R) { c.role = R.role; c.salary = Math.max(c.salary, R.salary - 20); }
    }
    c.hiredDay = G.day; c.days = 0; c.newbie = true;
    const left = U.clamp((CFG.DAY_END - G.time) / (CFG.DAY_END - CFG.DAY_START), 0, 1);
    c.salaryPaid = Math.round(c.salary * left);
    G.emps[i] = c;
    G.hired++;
    NPC.arriveNew(c);
    Sim.scheduleTraitEvents(c, G.time + 20);
    Sim.log(`Нанят${c.female ? 'а' : ''}: ${c.name} ${c.surname}, ${c.role.toLowerCase()}`, 'good');
  }

  /* Пачка резюме на вакансию: один хороший кандидат точно, остальные — как повезёт */
  function batch(slot, n, from, gap) {
    const traits = ['normal'];
    for (let k = 1; k < n; k++) traits.push(U.pick(['spy', 'lazy', 'normal', 'star', 'spy', 'lazy']));
    if (U.chance(0.3)) traits[0] = 'star';
    U.shuffle(traits);
    traits.forEach((tr, k) => Sim.queue({ t: from + k * gap + U.randi(0, 6), type: 'resume', role: slot.role, trait: tr }));
  }
  /* Сотрудник ушёл насовсем — HR начинает поиск */
  function opened(e) {
    e.leftDay = G.day;
    if (G.time > U.T(16, 50)) return;
    batch(e, U.chance(0.5) ? 3 : 2, G.time + U.randi(25, 40), U.randi(18, 30));
    /* кадровое агентство узнаёт о вакансии и звонит само */
    if (!G.flags.agency && !G.flags.agencyQueued && G.time < U.T(16, 30)) {
      G.flags.agencyQueued = true;
      Sim.queue({ t: G.time + U.randi(45, 70), type: 'call', key: 'agency' });
    }
  }
  function morning() {
    vacancies().forEach((v, i) => batch(v, 3, U.T(9, 15) + i * 12, 22));
  }

  return { vacancies, vacantSlot, candidate, resumeDoc, hire, opened, morning, pendingResumes };
})();
