'use strict';
/* Состояние игры и симуляция одного рабочего дня */
let G = null;

const CFG = {
  DAY_START: 9 * 60,
  DAY_END: 18 * 60,
  SEC_PER_MIN: 0.62,       // реальных секунд на одну игровую минуту (день ≈ 5,5 мин)
  DUCK_PRICE: 4,
  KG_PER_DUCK: 0.25,
  START_CASH: 20000,
  START_RUBBER: 380,
  PLAN: 3000,
  OVERHEAD: 1200,
  BASE_DECAY: 0.115,
  PROD_MULT: 1.12,
};

const Sim = (() => {
  const stage = e => (e.sanity > 70 ? 0 : e.sanity > 40 ? 1 : e.sanity > 15 ? 2 : 3);
  const SF = [1, 0.85, 0.55, 0.3];
  const traitF = e => (e.trait === 'lazy' ? (e.lazyFixed ? 0.85 : 0.35) : e.trait === 'spy' ? (e.doubleAgent ? 0.9 : 0.8) : 1);
  const present = () => G.emps.filter(e => !e.gone && !e.exiting);
  const heal = (e, n) => { if (!e.gone) e.sanity = U.clamp(e.sanity + n, 0, 100); };
  const hurt = (e, n) => { if (!e.gone) e.sanity = U.clamp(e.sanity - n, 0, 100); };

  function money(v, cat) {
    G.cash += v;
    G.ledger[cat] = (G.ledger[cat] || 0) + v;
  }

  function log(text, type) {
    G.log.unshift({ t: G.time, text, type: type || 'info' });
    if (G.log.length > 120) G.log.pop();
  }
  function toast(text, type, onClick) {
    log(text, type);
    UI.toast(text, type, onClick);
  }
  /* Новость в газету: key — шаблон из News.T (или готовый объект) */
  function addNews(key, ctx) {
    const n = typeof key === 'string' ? News.make(key, ctx) : key;
    if (!n) return;
    n.t = G.time; n.day = G.day;
    G.news.unshift(n);
    if (G.news.length > 40) G.news.pop();
    if (n.big) {
      UI.toast('«Утренний Кряк»: ' + n.head, 'news', () => UI.openPanel('docs', 'news'));
      Sfx.play('paper');
    }
  }

  /* ---------- Сотрудники ---------- */
  function look(female) {
    return {
      female,
      skin: U.pick(Data.LOOK.skin),
      hair: U.pick(Data.LOOK.hair),
      hairStyle: female ? U.pick(['long', 'bob', 'bun', 'long', 'bob']) : U.pick(['short', 'short', 'bald', 'spiky', 'slick']),
      shirt: U.pick(Data.LOOK.shirt),
      tie: female ? null : (U.chance(0.75) ? U.pick(Data.LOOK.tie) : null),
      pants: U.pick(Data.LOOK.pants),
      jacket: female ? null : U.pick(Data.LOOK.jacket),
      skirt: female && U.chance(0.6) ? U.pick(['#3a3f4a', '#5a2a3a', '#2a3550', '#4b3a2e']) : null,
      glasses: U.chance(0.25),
    };
  }
  /* Имя, которого сейчас нет в офисе */
  function freshName(female) {
    const used = new Set(G ? G.emps.concat(G.alumni || []).map(e => e.name) : []);
    const pool = (female ? Data.NAMES_F : Data.NAMES_M).filter(n => !used.has(n));
    return U.pick(pool.length ? pool : (female ? Data.NAMES_F : Data.NAMES_M));
  }
  /* Поля, которые живут только один день */
  function dayFields(e) {
    Object.assign(e, {
      state: 'seated', x: 0, y: 0, dir: 'down', path: [], purpose: null, walkT: 0,
      produced: 0, searched: false, asked: false, soul: false, fined: false, bonus: 0, salaryPaid: e.salary,
      sleepUntil: 0, activeClue: null, anim: Math.random() * 10, bubbleCD: U.rand(3, 12),
      exiting: false, home: false, fired: false, quit: false, fled: false, carryBox: false,
      visitReason: null, pendingTalk: false, task: null, carry: null, hidden: false, script: null, moving: false,
      probed: false, whistled: false, askedWfh: false, thanked: false, fakeBlueprints: false, newbie: false, cupUntil: 0,
    });
    e.maxStage = stage(e);
    return e;
  }
  function makeEmployee(i, o = {}) {
    const female = Math.random() < 0.5;
    const r = o.role || U.pick(Data.ROLES);
    const trait = o.trait || 'normal';
    const pers = U.pick(Data.PERSONALITIES);
    let skill = U.randi(r.skill[0], r.skill[1]);
    if (trait === 'star') skill = Math.round(skill * 1.3);
    const e = {
      uid: G ? ++G.uidSeq : i + 1, id: i, female, look: look(female), trait, pers,
      name: freshName(female),
      surname: U.pick(female ? Data.SURNAMES_F : Data.SURNAMES_M),
      role: r.role, salary: r.salary, skill,
      stress: pers.stress * (trait === 'star' ? 1.15 : 1),
      col: i % 4, row: Math.floor(i / 4),
      sanity: U.randi(80, 98),
      clues: [], suspicion: 0, evidence: false, lazyFixed: false, doubleAgent: false, herring: null,
      gone: null, days: 0, hiredDay: G ? G.day : 1,
    };
    return dayFields(e);
  }
  function makeStaff() {
    const roles = U.shuffle(Data.ROLES.slice());
    const traits = ['spy', 'lazy', 'lazy', 'star', 'normal', 'normal', 'normal', 'normal'];
    if (U.chance(0.45)) traits[7] = 'spy';
    U.shuffle(traits);
    const emps = [];
    for (let i = 0; i < 8; i++) { const e = makeEmployee(i, { role: roles[i], trait: traits[i] }); G.emps.push(e); emps.push(e); }
    return emps;
  }
  const byUid = uid => (G.emps.find(e => e.uid === uid) || G.alumni.find(e => e.uid === uid) || null);

  /* ---------- Карьера ---------- */
  const RANKS = ['Менеджер', 'Старший менеджер', 'Директор офиса', 'Вице-президент', 'Президент компании'];
  const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
  const WEEK_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
  const weekday = (d = G.day) => (d - 1) % 5;
  const planFor = () => Math.min(4200, CFG.PLAN + 250 * G.career.rank);

  function newGame() {
    G = {
      phase: 'title', day: 1, uidSeq: 0, emps: [], alumni: [],
      cash: CFG.START_CASH, rep: 50, rubber: CFG.START_RUBBER, priceBase: CFG.DUCK_PRICE,
      career: { rank: 0, strikes: 0, wallet: 0, history: [] },
      owned: {}, memory: {}, catHunger: 42, carryDocs: [], docSeq: 410, brief: null,
    };
    makeStaff();
    Market.init();
    G.market.ev = Market.plan();
    beginDay();
  }

  /* ---------- Начало рабочего дня ---------- */
  function beginDay() {
    Object.assign(G, {
      time: CFG.DAY_START, acc: 0, speed: 1, paused: false, ledger: {}, price: G.priceBase,
      rubberOutMin: 0, producing: true, ducks: 0,
      chaos: 0, chaosSum: 0, chaosN: 0, chaosMax: 0, highChaosMin: 0, chaosCD: 0,
      visitor: null, inbox: [], docLog: [], docStats: { correct: 0, wrong: 0, neutral: 0 },
      sched: [], call: null, news: [], newsSeen: 0, log: [], cd: {},
      musicUntil: 0, overtime: false, breakdownUntil: 0,
      mods: { decay: G.owned.massage ? 0.85 : 1, coffee: !!G.owned.coffee, motivation: 1 }, contracts: {}, flags: {}, docsTransit: 0,
      leaks: 0, spiesCaught: 0, innocentFired: 0, firedCount: 0, sentHome: 0, bonuses: 0, hired: 0,
      chaosEvents: 0, speakerUses: 0, dialog: false, dialogKind: null, panel: null,
      plan: planFor(),
    });
    G.dayStartHoldings = Market.stocksValue();
    G.dayStart = G.cash + G.dayStartHoldings;
    /* вчерашние документы, до которых не дошли руки */
    for (const key of G.carryDocs || []) {
      const d = Content.makeDoc(key);
      if (!d) continue;
      d.old = true; d.no = ++G.docSeq; d.arrived = G.time;
      G.inbox.push(d);
    }
    G.carryDocs = [];
    NPC.init();
    buildSchedule();
    updateChaos();
  }

  function queue(ev) {
    if (ev.eid != null && ev.uid == null && G.emps[ev.eid]) ev.uid = G.emps[ev.eid].uid;
    let i = G.sched.length;
    while (i > 0 && G.sched[i - 1].t > ev.t) i--;
    G.sched.splice(i, 0, ev);
  }

  function spread(n, from, to) {
    const span = (to - from) / n;
    return Array.from({ length: n }, (_, i) => Math.round(from + span * i + U.rand(span * 0.15, span * 0.85)));
  }

  /* Улики, утечки и походы в серверную для шпионов и лентяев (с момента from) */
  function scheduleTraitEvents(e, from) {
    const add = (t, type, data) => { if (t < CFG.DAY_END - 10) queue(Object.assign({ t: Math.max(CFG.DAY_START + 2, t), type, eid: e.id, uid: e.uid }, data || {})); };
    from = Math.max(from, U.T(9, 30));
    const span = U.T(16, 40) - from;
    if (span < 30) return;
    if (e.trait === 'spy' && !e.doubleAgent) {
      const strong = U.shuffle(Data.CLUES.spy.filter(c => c.strong));
      const weak = U.shuffle(Data.CLUES.spy.filter(c => !c.strong));
      const seq = [weak[0], strong[0], U.chance(0.5) ? strong[1] : weak[1]];
      const n = Math.max(1, Math.round(3 * span / 420));
      spread(n, from, U.T(16, 30)).forEach((t, i) => add(t, 'clue', { clue: seq[i % 3] }));
      [[11, 10], [13, 40], [16, 5]].forEach(([h, m]) => {
        const t = U.T(h, m) + U.randi(-15, 15);
        if (t > from + 20 && U.chance(0.85)) add(t, 'leak');
      });
      spread(2, Math.max(from, U.T(10)), U.T(16)).forEach(t => add(t, 'errand', { task: 'server', tries: 0 }));
    } else if (e.trait === 'lazy' && !e.lazyFixed) {
      const seq = U.shuffle(Data.CLUES.lazy.slice()).slice(0, 3);
      const n = Math.max(1, Math.round(3 * span / 420));
      spread(n, from + 10, U.T(16, 40)).forEach((t, i) => add(t, 'clue', { clue: seq[i % 3] }));
    }
  }

  function buildSchedule() {
    const add = (t, type, data) => queue(Object.assign({ t: Math.max(CFG.DAY_START + 2, t), type }, data || {}));
    const news = (t, key, ctx) => add(t, 'news', { key, ctx });
    const mem = G.memory || {};

    Content.planDocs().forEach(d => add(d.t, 'doc', { key: d.key }));
    Content.planCalls().forEach(c => add(c.t, 'call', { key: c.key }));

    for (const e of G.emps) if (!e.gone) scheduleTraitEvents(e, CFG.DAY_START);
    const herr = U.shuffle(Data.CLUES.herring.slice());
    U.shuffle(G.emps.filter(e => !e.gone && (e.trait === 'normal' || e.trait === 'star'))).slice(0, 2)
      .forEach((e, i) => add(U.randi(U.T(10, 0), U.T(16, 0)), 'clue', { eid: e.id, clue: herr[i] }));

    /* утренний выпуск газеты */
    const m = CFG.DAY_START + 1;
    const n0 = G.sched.length;
    if (G.day === 1) ['utka_hype', 'engn_aaa', 'goos_promise'].forEach(k => news(m, k));
    else {
      const y = mem.report || {};
      if (y.ducks != null) news(m, 'recap', { ducks: y.ducks, plan: y.plan, ok: y.ducks >= y.plan });
      if (mem.verdict === 'promo') news(m, 'verdict_promo', { rank: RANKS[G.career.rank] });
      if (mem.verdict === 'fine') news(m, 'verdict_fine');
      if (mem.utkaCrashed) news(m, 'utka_aftermath');
      else if (G.market.t.UTKA.state === 'burst') news(m, 'utka_bottom');
      if (mem.engnCrashed) news(m, 'engn_bankrupt');
      if (mem.leaks) news(m, 'leaks_recap', { n: mem.leaks });
      if (mem.raid) news(m, 'raid_followup');
      if (mem.exposedGoose) news(m, 'goose_suit');
      if (mem.bribeRumor) news(m, 'bribe_rumor');
      if (mem.innocent) news(m, 'innocent', { name: mem.innocent });
      if (mem.recruited) news(m, 'goose_recruit');
      const vac = Hire.vacancies().length;
      if (vac) news(m, 'hiring', { n: vac });
      if (G.sched.length - n0 < 3) news(m, 'filler');
    }
    /* сценарий биржи: слухи заранее, развязка в момент события */
    for (const ev of G.market.ev) {
      if (ev.kind === 'calm') { news(ev.start, ev.hit); continue; }
      (ev.warn || []).forEach((k, i, arr) => news(ev.start - (arr.length === 1 ? U.randi(60, 90) : (i === 0 ? 100 : 45)), k));
      news(ev.start + (ev.kind === 'crash' ? 4 : 6), ev.hit);
    }
    news(U.T(12, 0), 'bonds');
    if (G.day > 1) news(U.T(U.randi(10, 15), U.randi(0, 50)), 'filler');
    Hire.morning();
    /* сотрудники сами приходят к менеджеру */
    spread(7, U.T(9, 40), U.T(17, 10)).forEach(t => add(t, 'selfvisit'));
    add(U.T(17, 30), 'effect', { text: 'До совета директоров 30 минут. Разберите документы и успокойте офис!', tone: 'warn' });
    add(U.T(17, 50), 'effect', { text: '10 минут до совета директоров!', tone: 'warn', alarm: true });
  }

  /* ---------- События расписания ---------- */
  function fireEvent(ev) {
    let e = ev.eid != null ? G.emps[ev.eid] : null;
    if (e && ev.uid != null && e.uid !== ev.uid) e = null;
    switch (ev.type) {
      case 'doc': {
        const d = Content.makeDoc(ev.key);
        if (d) NPC.deliverDoc(d);
        break;
      }
      case 'call': {
        if (G.call || G.dialog) { ev.t = G.time + 8; if (ev.t < CFG.DAY_END - 5) queue(ev); break; }
        const c = Content.CALLS[ev.key];
        if (c.cond && !c.cond()) break;
        ring(ev.key);
        break;
      }
      case 'clue': showClue(e, ev); break;
      case 'leak': leak(e); break;
      case 'news': addNews(ev.key, ev.ctx); break;
      case 'effect':
        if (ev.cash) money(ev.cash, ev.cat || 'other');
        if (ev.rep) G.rep += ev.rep;
        if (ev.price) G.price += ev.price;
        if (ev.text) toast(ev.text, ev.tone || 'info');
        if (ev.alarm) Sfx.play('alarm');
        break;
      case 'resume': {
        if (!Hire.vacancies().length) break;
        NPC.deliverDoc(Hire.resumeDoc(Hire.candidate(ev.role, ev.trait)));
        break;
      }
      case 'deliver':
        G.rubber += ev.kg;
        G.flags.rubberOut = false; G.flags.rubberLow = false;
        toast(`Привезли резину: +${ev.kg} кг. Конвейер снова крутится.`, 'good');
        NPC.courier(ev.kg);
        Sfx.play('coin');
        break;
      case 'breakdown':
        G.breakdownUntil = G.time + (G.flags.insured ? 15 : 50);
        toast(G.flags.insured ? 'Конвейер сломался, но страховщики уже здесь: ремонт 15 минут.' : 'Конвейер сломался! Михалыч чинит его 50 минут. Производство стоит.', 'bad');
        Sfx.play('alarm'); World.shake(0.6);
        break;
      case 'quit': quit(e); break;
      case 'selfvisit':
        if (!NPC.selfVisit() && G.time < U.T(17, 20)) { ev.t = G.time + 12; queue(ev); }
        break;
      case 'errand':
        if (!e || e.gone || e.exiting) break;
        if (!NPC.errand(e, ev.task) && ev.tries < 5) { ev.tries++; ev.t = G.time + 10; queue(ev); }
        break;
      case 'fn': ev.fn(); break;
    }
  }

  function receiveDoc(d) {
    d.no = ++G.docSeq;
    d.arrived = G.time;
    G.inbox.push(d);
    Sfx.play('paper');
    toast(`Новый документ: «${d.title}»`, 'doc', () => UI.openPanel('docs'));
  }

  function decideDoc(d, approve) {
    const i = G.inbox.indexOf(d);
    if (i < 0) return;
    const corr = typeof d.correct === 'function' ? d.correct() : d.correct;
    if (corr == null) G.docStats.neutral++;
    else if ((corr === 'approve') === approve) G.docStats.correct++;
    else G.docStats.wrong++;
    G.inbox.splice(i, 1);
    const res = approve ? d.approve() : d.reject();
    G.docLog.push({ title: d.title, approve, corr });
    if (res) toast(res.text || res, res.type || 'info');
  }

  /* ---------- Телефон ---------- */
  function ring(key) {
    G.call = { key, until: G.time + 40, nextRing: 0 };
    const c = Content.CALLS[key];
    toast(`Звонит телефон: ${c.who().name}`, 'call', () => UI.answerCall());
  }
  function missCall() {
    const c = Content.CALLS[G.call.key];
    G.call = null;
    const txt = c.missed ? c.missed() : null;
    toast('Пропущенный звонок. ' + (txt || ''), 'warn');
  }

  const PHONE = [
    {
      id: 'coffee', name: 'Кофе всем', cd: 60,
      cost: () => (G.mods.coffee ? 60 : 120),
      desc: () => `+${G.mods.coffee ? 14 : 10} рассудка каждому в офисе`,
      run() { present().forEach(e => heal(e, G.mods.coffee ? 14 : 10)); NPC.galyaCoffee(); return 'Галя разносит кофе. Все немного выдохнули.'; },
    },
    {
      id: 'pizza', name: 'Пицца в офис', cd: 150, cost: () => 450,
      desc: () => '+16 рассудка каждому, и ещё два часа обеды на кухне лечат сильнее',
      run() { present().forEach(e => heal(e, 16)); NPC.pizza(); return 'Курьер уже везёт пиццу! Офис ликует.'; },
    },
    {
      id: 'music', name: 'Спокойная музыка', cd: 100, cost: () => 0,
      desc: () => '45 минут безумие растёт в 2,5 раза медленнее',
      run() { G.musicUntil = G.time + 45; return 'Из колонок льётся джаз. Даже стажёр перестал дёргаться.'; },
    },
    {
      id: 'psy', name: 'Вызвать психолога', cd: 120, cost: () => 700,
      desc: () => 'Сеанс в переговорной: трое самых нервных получат +40 рассудка (~35 мин)',
      run() {
        const n = NPC.psySession();
        return n ? `Доктор Утешев поднимается на лифте. На сеанс идут: ${n} чел.` : 'Психолог приехал, но все заняты. Он грустно пьёт кофе.';
      },
    },
    {
      id: 'speaker', name: 'Громкая связь: «Вы лучшие!»', cd: 45, cost: () => 0,
      desc: () => (G.speakerUses >= 2 ? 'Уже приелось… может и разозлить' : '+5 рассудка каждому'),
      run() {
        G.speakerUses++;
        if (G.speakerUses > 2) { present().forEach(e => hurt(e, 4)); return { text: 'Все закатили глаза: «Опять он со своим "вы лучшие"…»', type: 'bad' }; }
        present().forEach(e => heal(e, 5));
        return 'Офис аплодирует. Кто-то даже прослезился.';
      },
    },
    {
      id: 'rubber', name: 'Срочная резина, 250 кг', cd: 60, cost: () => 1500,
      desc: () => 'Втридорога ($6/кг), зато через 20 минут',
      run() { queue({ t: G.time + 20, type: 'deliver', kg: 250 }); return 'Курьер выехал. Резина будет через 20 минут.'; },
    },
  ];
  function phoneAction(id) {
    const a = PHONE.find(p => p.id === id);
    if (!a || G.time < (G.cd[id] || 0)) return;
    const cost = a.cost();
    if (cost > G.cash) { toast('Не хватает денег.', 'bad'); Sfx.play('bad'); return; }
    if (cost) money(-cost, id === 'rubber' ? 'materials' : 'office');
    G.cd[id] = G.time + a.cd;
    const r = a.run();
    toast(r.text || r, r.type || 'good');
    Sfx.play(r.type === 'bad' ? 'bad' : 'coin');
  }

  /* ---------- Улики, утечки, хаос ---------- */
  function showClue(e, ev) {
    if (!e || e.gone || e.exiting) return;
    if (e.state !== 'seated') {
      ev.retry = (ev.retry || 0) + 1;
      if (ev.retry < 5) { ev.t = G.time + 8; queue(ev); }
      return;
    }
    const cl = ev.clue;
    e.activeClue = { icon: cl.icon, until: G.time + 35, screen: cl.screen, text: cl.t };
    if (cl.sleep) e.sleepUntil = G.time + 45;
    e.clues.push({ t: G.time, text: cl.t, strong: !!cl.strong });
    if (cl.explain) e.herring = cl.explain;
    e.suspicion = U.clamp(e.suspicion + (cl.strong ? 45 : e.trait === 'lazy' ? 5 : 20), 0, 100);
    toast(`${e.name} ${cl.t}`, 'clue', () => UI.openDossier(e));
  }

  const LEAKS = [
    'Утечка! ГусьКорп анонсировала «Пищалку 3.0» — копию нашей секретной разработки.',
    'Утечка! ГусьКорп переманила нашего поставщика краски — они знали наши цены.',
    'Утечка! Газета «Утренний Кряк» напечатала наш внутренний отчёт о браке.',
  ];
  function leak(e) {
    if (!e || e.trait !== 'spy' || e.fled) return;
    if (e.gone || e.exiting) return;
    if (e.fakeBlueprints) {
      e.fakeBlueprints = false; e.evidence = true; e.suspicion = 100;
      Market.jump('GOOS', -8);
      e.clues.push({ t: G.time, text: U.fill('слил{|а} ГусьКорп ваши фальшивые чертежи — попал{ся|ась}!', e), strong: true });
      toast(U.fill('ГусьКорп выпустила пищалку по фальшивым чертежам, которые вы дали {name}. Шпион раскрыт!', e), 'good', () => UI.openDossier(e));
      addNews('fake_blueprint');
      return;
    }
    if (e.doubleAgent) {
      Market.jump('GOOS', -12); G.rep += 4;
      toast(U.fill('Двойной агент {name} слил{|а} ГусьКорп фальшивые чертежи! Их акции падают.', e), 'good');
      addNews('double_agent');
      return;
    }
    G.leaks++; G.rep -= 6;
    Market.jump('QUAK', -5); Market.jump('GOOS', 7);
    toast(LEAKS[(G.leaks - 1) % LEAKS.length] + ' Кто-то в офисе работает на конкурента…', 'bad');
    addNews('leak');
    Sfx.play('alarm');
  }

  function updateChaos() {
    const P = G.emps.filter(e => !e.gone && !e.exiting && e.state !== 'visit');
    if (!P.length) { G.chaos = 0; return; }
    let s = 0, s2 = 0, s3 = 0;
    for (const e of P) {
      s += 100 - e.sanity;
      const st = stage(e);
      if (st === 2) s2++;
      if (st === 3) s3++;
    }
    G.chaos = U.clamp((s / P.length) * 1.2 - 12 + s2 * 2 + s3 * 5, 0, 100);
    G.chaosMax = Math.max(G.chaosMax, G.chaos);
  }

  function chaosTick() {
    if (G.chaos >= 85) G.highChaosMin++;
    else G.highChaosMin = Math.max(0, G.highChaosMin - 1);
    if (G.highChaosMin >= 20 && !G.flags.raid) {
      G.flags.raid = true;
      money(-3000, 'chaos'); G.rep -= 12;
      toast('ОБЛАВА! Комиссия по ценным бумагам нагрянула в офис, где творится Уолл-стрит. Штраф $3 000, репутация −12.', 'bad');
      addNews('raid');
      Sfx.play('alarm'); World.shake(1.2);
      present().forEach(e => heal(e, 12));
      return;
    }
    if (G.chaos < 50 || G.time < G.chaosCD) return;
    if (Math.random() < ((G.chaos - 45) / 100) * 0.05) {
      const P = present().filter(e => e.state === 'seated');
      const mad = P.filter(e => stage(e) >= 2);
      const e = mad.length ? U.pick(mad) : U.pick(P);
      if (!e) return;
      const ev = U.pick(Data.CHAOS_EVENTS);
      const parts = [];
      if (ev.cash) { money(ev.cash, 'chaos'); parts.push(U.money(ev.cash)); }
      if (ev.ducks) {
        const lost = Math.min(G.ducks, -ev.ducks);
        G.ducks -= lost; money(-lost * G.price, 'chaos');
        parts.push(`−${lost} уток`);
      }
      if (ev.rep) { G.rep += ev.rep; parts.push(`репутация −${Math.abs(ev.rep)}`); }
      if (ev.leak) Market.jump('GOOS', 4);
      G.chaosEvents++;
      G.chaosCD = G.time + 22;
      toast(U.fill(ev.t, e) + (parts.length ? ` (${parts.join(', ')})` : ''), 'bad', () => UI.openDossier(e));
      World.say(e, U.pick(Data.SHOUTS[3]), 3);
      World.shake(0.5);
      Sfx.play('bad');
    }
  }

  /* ---------- Минута игрового времени ---------- */
  function minute() {
    const t = G.time;
    while (G.sched.length && G.sched[0].t <= t) fireEvent(G.sched.shift());
    if (G.call && t >= G.call.until) missCall();
    for (const e of G.emps) if (e.activeClue && t >= e.activeClue.until) e.activeClue = null;

    const P = present();
    const tf = t < U.T(12) ? 0.8 : t < U.T(14) ? 1 : t < U.T(16) ? 1.25 : 1.5;
    const mult = tf * G.mods.decay * (t < G.musicUntil ? 0.4 : 1) * (G.inbox.length > 4 ? 1.25 : 1) * (G.overtime ? 1.3 : 1);
    for (const e of P) {
      if (e.state === 'visit') continue;
      let d = CFG.BASE_DECAY * e.stress * mult;
      if (NPC.catNear(e)) d *= 0.8;
      const pe = e.state === 'seated' ? Plan.seat(e.id) : e;
      if (Plan.roomAt(pe.x, pe.y + 20) && Plan.roomAt(pe.x, pe.y + 20).id === 'open') d *= 1 + Math.min(0.25, NPC.litter().length * 0.01);
      for (const o of P) {
        if (o === e || o.state !== 'seated') continue;
        const so = stage(o);
        if (so >= 2 && Math.abs(o.col - e.col) <= 1 && Math.abs(o.row - e.row) <= 1) d += 0.035 * (so - 1);
      }
      e.sanity = U.clamp(e.sanity - d, 0, 100);
    }

    /* производство */
    let raw = 0;
    const outs = G.emps.map(e => {
      let p = 0;
      if (!e.gone && !e.exiting && e.state === 'seated' && t >= e.sleepUntil) {
        p = (e.skill / 60) * SF[stage(e)] * traitF(e) * (G.overtime ? 1.15 : 1) * CFG.PROD_MULT * (G.mods.motivation || 1);
      }
      raw += p;
      return p;
    });
    let factor = t < G.breakdownUntil ? 0 : 1;
    const need = raw * factor * CFG.KG_PER_DUCK;
    if (need > G.rubber + 1e-6) {
      factor *= need > 0 ? G.rubber / need : 0;
      G.rubberOutMin++;
      if (!G.flags.rubberOut) {
        G.flags.rubberOut = true;
        toast('Конвейер встал: закончилась резина! Согласуйте закупку или закажите срочную по телефону.', 'bad');
        Sfx.play('alarm');
      }
    } else if (G.rubber < 90 && !G.flags.rubberLow && raw > 0) {
      G.flags.rubberLow = true;
      toast(`Резины осталось ~${Math.round(G.rubber)} кг — примерно на полчаса.`, 'warn');
    }
    const made = raw * factor;
    G.rubber = Math.max(0, G.rubber - made * CFG.KG_PER_DUCK);
    G.emps.forEach((e, i) => { e.produced += outs[i] * factor; });
    G.ducks += made;
    money(made * G.price, 'sales');
    G.producing = made > 0.05;
    World.feedDucks(made);

    for (const e of P) {
      const st = stage(e);
      if (st > e.maxStage) {
        e.maxStage = st;
        if (st === 2) toast(`${e.name} теряет рассудок…`, 'warn', () => UI.openDossier(e));
        if (st === 3) { toast(U.fill('{name} превратил{ся|ась} в брокера с Уолл-стрит!', e), 'bad', () => UI.openDossier(e)); Sfx.play('shout'); }
      }
    }

    updateChaos();
    G.chaosSum += G.chaos; G.chaosN++;
    chaosTick();

    for (const th of [40, 60, 80]) {
      if (G.chaos >= th && !G.flags['ch' + th]) {
        G.flags['ch' + th] = true;
        const msg = { 40: 'В офисе нервно. Сотрудники всё чаще смотрят в пустоту.', 60: 'Офис сходит с ума! Ещё немного — и тут будет Уолл-стрит.', 80: 'Добро пожаловать на Уолл-стрит, 2001! Летают деньги, орут брокеры.' }[th];
        toast(msg, th >= 60 ? 'bad' : 'warn');
      }
    }

    if (t >= U.T(10)) {
      const elapsed = t - CFG.DAY_START;
      const pace = G.ducks / (G.plan * elapsed / (CFG.DAY_END - CFG.DAY_START));
      G.market.t.QUAK.drift = U.clamp((pace - 1) * 0.0006 + (G.rep - 50) * 0.00002 - G.chaos * 0.000004, -0.0008, 0.0008);
    }
    Market.tick(t);
    G.rep = U.clamp(G.rep, 0, 100);
    NPC.minute();
  }

  /* ---------- Разговоры в кабинете ---------- */
  function callIn(e) {
    if (G.visitor) { toast(G.visitor === e ? U.fill('{name} уже идёт к вам.', e) : 'К вам уже кто-то идёт или сидит в кабинете. Сначала закончите разговор.', 'warn'); return false; }
    if (!NPC.canCall(e)) { toast(`${e.name} сейчас не может подойти.`, 'warn'); return false; }
    G.visitor = e;
    e.visitReason = null;
    NPC.goOffice(e);
    World.say(e, stage(e) >= 3 ? 'ИДУ, БОСС! АУУУ!' : stage(e) >= 2 ? 'ЧТО?! ИДУ!' : 'Иду, босс!', 2);
    Sfx.play('click');
    log(`Вызван в кабинет: ${e.name}`);
    return true;
  }

  function endVisit(e, how) {
    G.visitor = null;
    e.visitReason = null; e.pendingTalk = false;
    if (how === 'back') NPC.backToDesk(e);
    else {
      e.exiting = true;
      e.carryBox = how === 'fire';
      NPC.leave(e);
    }
  }

  function askWork(e) {
    e.asked = true;
    const st = stage(e);
    let s;
    if (st >= 2) s = U.pick(Data.TALK.mad[st]);
    else if (st === 1 && U.chance(0.5)) s = U.pick(Data.TALK.mad[1]);
    else s = U.pick(Data.TALK.work[e.trait] || Data.TALK.work.normal);
    const others = G.emps.filter(o => !o.gone && o !== e);
    const avg = others.length ? others.reduce((a, o) => a + o.produced, 0) / others.length : e.produced;
    return U.fill(s, e) + `\n(Выработка сегодня: ${Math.round(e.produced)} уток. В среднем по офису: ${Math.round(avg)}.)`;
  }

  function search(e) {
    e.searched = true;
    if (e.trait === 'spy') {
      if (e.clues.some(c => c.strong) || e.evidence || U.chance(0.7)) {
        e.evidence = true; e.suspicion = 100;
        return 'В портфеле — дискеты с чертежами «Пищалки 3.0» и визитка: «ГусьКорп. Отдел особых поручений». Попал{ся|ась}!';
      }
      hurt(e, 8);
      return '{name} подозрительно быстро захлопнул{|а} портфель. Внутри только бутерброды… кажется.';
    }
    if (e.trait === 'lazy') {
      e.suspicion = Math.max(e.suspicion, 30);
      return 'В портфеле — подушка для сна, распечатка рекордов «Косынки» и ни одного рабочего документа.';
    }
    hurt(e, 15);
    present().forEach(o => { if (o !== e) hurt(o, 3); });
    G.rep -= 1;
    return (e.herring || 'Ничего подозрительного: бутерброды, фото кота и квитанция за свет.') +
      ' {name} обидел{ся|ась}. По офису поползли слухи о «проверках».';
  }

  function soul(e) {
    e.soul = true;
    const st = stage(e);
    heal(e, 22);
    const pool = st >= 2 ? Data.TALK.soul.mad : (Data.TALK.soul[e.trait] || Data.TALK.soul.normal);
    return U.pick(pool);
  }

  function bonus(e) {
    if (G.cash < 200) return 'Не хватает денег на премию.';
    money(-200, 'staff'); heal(e, 35); G.bonuses++; e.bonus += 200;
    if (e.trait === 'lazy') return 'О, премия! Спасибо, босс! (Кажется, работать {он|она} всё равно не собирается.)';
    if (e.trait === 'spy') return 'Спасибо, босс… Вы так добры. (Отводит глаза.)';
    return 'Спасибо, босс! Я горы сверну! Ну, или хотя бы пару тонн уток.';
  }

  function fine(e) {
    e.fined = true;
    e.salaryPaid = Math.max(0, e.salaryPaid - 100);
    money(0, 'staff');
    hurt(e, 20);
    if (e.trait === 'lazy') { e.lazyFixed = true; return 'Понял{|а}, понял{|а}… Иду работать по-настоящему. (Выработка вырастет.)'; }
    if (e.trait === 'spy') return 'Как скажете. (Злобно что-то записывает в блокнот.)';
    return 'За что?! Я же… ладно. (Уходит, сжав кулаки.)';
  }

  function fire(e) {
    e.fired = true;
    G.firedCount++;
    Hire.opened(e);
    e.salaryPaid = Math.round(e.salary * 0.5);
    if (e.trait === 'spy') {
      if (!e.doubleAgent) G.spiesCaught++;
      G.rep += 8;
      Market.jump('GOOS', -5); Market.jump('QUAK', 3);
      toast(U.fill('Шпион ГусьКорп разоблачён! {name} покидает здание с коробкой.', e), 'good');
      addNews('spy_caught');
      Sfx.play('good');
      return 'Вы ещё пожалеете! Гусев обещал мне кабинет с видом на пруд… *уходит с коробкой*';
    }
    if (e.trait === 'lazy') {
      toast(U.fill('Лентяй {name} уволен{|а}. Зарплата сэкономлена.', e), 'good');
      Sfx.play('coin');
      return 'Ну и ладно. Пойду спать домой — там подушка удобнее.';
    }
    G.innocentFired++;
    G.flags.innocent = `${e.name} ${e.surname}`;
    G.rep -= e.trait === 'star' ? 7 : 4;
    present().forEach(o => { if (o !== e) hurt(o, 8); });
    toast(U.fill('Вы уволили {name}. Офис в шоке: за что?', e), 'bad');
    Sfx.play('bad');
    return 'Но… за что? Я же хорошо работал{|а}… *уходит, всхлипывая*';
  }

  function sendHome(e) {
    e.home = true; G.sentHome++;
    e.sanity = 100;
    return 'Правда можно? Спасибо, босс! Завтра буду как {новенький|новенькая}!';
  }

  function turn(e) {
    if (U.chance(0.65)) {
      e.doubleAgent = true; G.spiesCaught++; G.flags.turned = true; heal(e, 10);
      toast(U.fill('{name} теперь двойной агент и будет сливать ГусьКорп фальшивки!', e), 'good');
      Sfx.play('good');
      return 'Ладно… Я буду передавать им то, что вы скажете. Только не увольняйте!';
    }
    e.fled = true; G.leaks++; G.rep -= 6;
    Hire.opened(e);
    Market.jump('GOOS', 6); Market.jump('QUAK', -3);
    toast(U.fill('{name} сбежал{|а} к ГусьКорп прямо с чертежами!', e), 'bad');
    Sfx.play('alarm');
    return 'Ха! Никогда! Передайте Гусеву, что я уже еду! *выбегает из кабинета*';
  }

  function quit(e) {
    if (!e || e.gone || e.exiting) return;
    if (G.visitor === e || e.state === 'visit') { queue({ t: G.time + 10, type: 'quit', eid: e.id }); return; }
    e.quit = true; e.exiting = true; e.carryBox = true;
    NPC.leave(e);
    Hire.opened(e);
    G.rep -= 2; Market.jump('GOOS', 2);
    e.salaryPaid = Math.round(e.salary * 0.7);
    toast(U.fill('{name} собрал{|а} вещи и уш{ёл|ла} в ГусьКорп.', e), 'bad');
  }

  function goHomeFromDesk(e) {
    if (!e || e.gone || e.exiting || G.visitor === e || !(e.state === 'seated' || e.state === 'errand')) return false;
    e.home = true; e.exiting = true; G.sentHome++;
    e.sanity = 100;
    NPC.leave(e);
    return true;
  }

  /* Сотрудник дошёл до цели */
  function arrive(e) {
    if (e.purpose === 'office') {
      e.state = 'visit'; e.dir = 'up'; e.pose = 'stand';
      e.waitSince = G.time;
      if (G.dialog || UI.isOpen()) {
        e.pendingTalk = true;
        toast(U.fill('{name} ждёт вас в кабинете.', e), 'visit', () => UI.openTalk(e));
      } else UI.openTalk(e);
    } else if (e.purpose === 'desk') {
      e.state = 'seated'; e.dir = 'down'; e.pose = 'stand'; e.carry = null; e.task = null;
    } else if (e.purpose === 'leave') {
      e.state = 'gone';
      e.gone = e.fired ? 'fired' : e.fled ? 'fled' : e.quit ? 'quit' : 'home';
      World.openElevator();
    }
    e.purpose = null;
  }

  /* Зарплаты к выплате: все за столами плюс те, кто ушёл сегодня */
  function payrollNow() {
    const left = G.alumni.filter(a => a.leftDay === G.day && !G.emps.includes(a));
    return G.emps.concat(left).reduce((s, e) => s + (e.fled || e.vacant ? 0 : e.salaryPaid), 0);
  }

  /* ---------- Конец дня ---------- */
  function endDay() {
    G.phase = 'ending';
    const L = G.ledger;
    const payroll = payrollNow();
    money(-payroll, 'payroll');
    money(-CFG.OVERHEAD, 'overhead');
    const notes = [];
    if (G.market.bonds) {
      const b = G.market.bonds;
      money(b * (1 + G.market.bondRate), 'invest');
      notes.push(`Облигации погашены с доходом ${U.money(b * G.market.bondRate)}.`);
      G.market.bondsDone = b; G.market.bonds = 0;
    }
    if (G.market.penny) {
      const v = G.market.pennyWin ? G.market.penny * 3 : G.market.penny * 0.06;
      money(v, 'invest');
      G.market.pennyResult = v;
      notes.push(G.market.pennyWin ? '«ПенниДак» внезапно взлетела! Втрое!' : '«ПенниДак» оказалась пустышкой. Брокер Джордан не берёт трубку.');
      G.market.pennyDone = G.market.penny; G.market.penny = 0;
    }
    if (G.contracts.legit) {
      if (G.ducks >= 600) { money(720, 'contracts'); G.rep += 4; notes.push('«Пена Плаза» получила уток и доплатила $720.'); }
      else notes.push('Не хватило уток для «Пена Плаза».');
    }
    if (G.contracts.fake) { money(-4000, 'contracts'); G.rep -= 4; notes.push('Goose & Partners выставила неустойку $4 000 за «сорванный» заказ.'); }
    G.rep = U.clamp(G.rep, 0, 100);
    const holdings = Market.stocksValue();
    const profit = G.cash + holdings - G.dayStart;
    const investPnL = (L.invest || 0) + holdings - G.dayStartHoldings;
    const todays = G.emps.concat(G.alumni.filter(a => a.leftDay === G.day && !G.emps.includes(a)));
    const spies = todays.filter(e => e.trait === 'spy').length;
    const decided = G.docStats.correct + G.docStats.wrong;
    const ignored = G.inbox.filter(d => (typeof d.correct === 'function' ? d.correct() : d.correct) != null).length;
    const report = {
      day: G.day, ducks: Math.floor(G.ducks), plan: G.plan, hired: G.hired,
      revenue: L.sales || 0, payroll, overhead: CFG.OVERHEAD,
      materials: -(L.materials || 0),
      other: -((L.office || 0) + (L.staff || 0) + (L.chaos || 0) + (L.charity || 0)),
      contracts: L.contracts || 0, bribe: L.bribe || 0,
      investPnL, holdings, profit,
      docsCorrect: G.docStats.correct, docsWrong: G.docStats.wrong, docsIgnored: ignored, decided,
      spies, spiesCaught: G.spiesCaught, leaks: G.leaks, innocentFired: G.innocentFired,
      chaosAvg: G.chaosN ? G.chaosSum / G.chaosN : 0, chaosEnd: G.chaos, chaosMax: G.chaosMax,
      rep: G.rep, raid: !!G.flags.raid, bribeTaken: !!G.flags.bribe, notes,
      rubberOutMin: G.rubberOutMin, sentHome: G.sentHome, bonuses: G.bonuses,
      boughtUTKA: !!G.flags.bought_UTKA, boughtENGN: !!G.flags.bought_ENGN,
      utkaCrashed: Market.happened('UTKA', 'crash'), engnCrashed: Market.happened('ENGN', 'crash'),
      bonds: G.market.bondsDone || 0, penny: G.market.pennyDone || 0, pennyWin: G.market.pennyWin,
      bankrupt: G.cash + holdings < 0,
      cash: G.cash, wallet: G.career.wallet,
    };
    G.lastReport = report;
    return report;
  }

  /* ---------- Переход к следующему дню ---------- */
  /* Решение совета меняет карьеру; fired — конец игры */
  function applyVerdict(verdict, score) {
    const C = G.career, r = G.lastReport || {};
    C.history.push({ day: G.day, verdict, score, profit: Math.round(r.profit || 0), ducks: r.ducks || 0, plan: r.plan || G.plan });
    if (verdict === 'promo') { C.rank = Math.min(RANKS.length - 1, C.rank + 1); C.strikes = 0; C.wallet += 800 + 400 * C.rank; }
    else if (verdict === 'stay') C.wallet += 400;
    else if (verdict === 'fine') { C.strikes++; C.wallet -= 1500; }
    C.last = verdict;
  }

  /* Ночь: всё, что случилось сегодня, переходит в завтра */
  function nextDay() {
    const r = G.lastReport || {};
    const brief = [];
    const mem = {
      report: { ducks: r.ducks, plan: r.plan }, verdict: G.career.last,
      leaks: G.leaks, raid: !!G.flags.raid, exposedGoose: !!G.flags.exposedGoose,
      bribe: !!G.flags.bribe, bribeRumor: !!G.flags.bribe && U.chance(0.6),
      innocent: G.flags.innocent || null, utkaCrashed: r.utkaCrashed, engnCrashed: r.engnCrashed,
      goosePaid: (G.memory || {}).goosePaid, bribesTotal: ((G.memory || {}).bribesTotal || 0) + (G.flags.bribe ? 1 : 0),
      foremanFixed: !!G.flags.foremanFixed, chaosEnd: r.chaosEnd || 0,
    };

    /* сотрудники за ночь */
    const morale = (mem.innocent ? -8 : 0) + (mem.raid ? -6 : 0) + (r.chaosEnd > 70 ? -5 : 0);
    let returned = 0, tired = 0;
    for (let i = 0; i < G.emps.length; i++) {
      const e = G.emps[i];
      /* кто к 18:00 ещё шёл к лифту — всё равно ушёл */
      if (!e.gone && (e.exiting || e.fired || e.quit || e.fled)) e.gone = e.fired ? 'fired' : e.fled ? 'fled' : e.quit ? 'quit' : 'home';
      if (e.gone && e.gone !== 'home') { e.vacant = true; e.salaryPaid = 0; e.exiting = false; e.state = 'gone'; continue; }
      const wasHome = e.gone === 'home' || e.home;
      const gotBonus = e.bonus > 0;
      e.gone = null;
      e.days = (e.days || 0) + 1;
      let s = wasHome ? U.randi(94, 100) : U.clamp(e.sanity + U.randi(46, 56), 40, 96);
      s += morale + (gotBonus ? 8 : 0) - (e.fined ? 6 : 0);
      e.sanity = U.clamp(s, 20, 100);
      if (wasHome) returned++;
      if (e.sanity < 60) tired++;
      if (!e.evidence) e.suspicion = Math.round(e.suspicion * 0.6);
      if (e.trait === 'lazy' && e.lazyFixed && U.chance(0.5)) e.lazyFixed = false;
      e.clues.forEach(c => { if (c.day == null) c.day = G.day; });
      if (e.clues.length > 12) e.clues = e.clues.slice(-12);
      dayFields(e);
    }
    /* кто-то не выдержал и уволился за ночь — стол освобождается */
    const stayers = G.emps.filter(e => !e.vacant && !e.gone);
    const burnt = stayers.filter(e => e.sanity < 45 && e.trait !== 'spy');
    let leaver = null;
    if (burnt.length && U.chance(0.45)) leaver = U.pick(burnt);
    else if (G.day >= 2 && U.chance(0.18)) leaver = U.pick(stayers.filter(e => e.trait === 'normal' || (e.trait === 'star' && !e.raised)));
    if (leaver && stayers.length > 5) {
      leaver.gone = 'quit'; leaver.vacant = true; leaver.leftDay = G.day; leaver.salaryPaid = 0; leaver.state = 'gone';
      const why = leaver.sanity < 45 ? 'не выдержал{|а} вчерашнего безумия' : leaver.trait === 'star' ? 'ушёл{|ла} в ГусьКорп — там платят больше' : U.pick(['переезжает к маме в другой город', 'решил{|а} открыть свою пекарню', 'уходит выращивать утят на ферме']);
      brief.unshift(U.fill(`Плохие новости: {name} ${leaver.surname} ${why} и уволил{ся|ась}. Заявление лежало на столе.`, leaver));
    }
    /* ГусьКорп вербует, если своих людей в офисе не осталось */
    const spies = G.emps.filter(e => !e.gone && !e.vacant && e.trait === 'spy' && !e.doubleAgent);
    if (!spies.length && U.chance(0.55)) {
      const c = G.emps.filter(e => !e.vacant && e.trait === 'normal').sort((a, b) => a.sanity - b.sanity)[0];
      if (c) { c.trait = 'spy'; c.recruited = true; mem.recruited = true; }
    }

    /* документы, которые можно разобрать и завтра */
    const KEEP = ['rubber_legit', 'massage', 'coffee_machine', 'printer', 'enron', 'dotcom', 'denounce', 'it_spy', 'raise', 'bonds', 'charity', 'commission', 'goose_suit', 'severance', 'audit'];
    G.carryDocs = G.inbox.filter(d => !d.old && KEEP.includes(d.key)).map(d => d.key);

    /* кот: ночью тётя Валя насыпает корм, но к утру он снова не прочь поесть */
    const cat = NPC.cat();
    G.catHunger = cat ? U.clamp(cat.hunger * 0.3 + 25, 20, 55) : 40;

    /* утренняя сводка для председателя */
    const vac = G.emps.filter(e => e.vacant);
    const pending = G.carryDocs.length;
    const spyLeft = G.emps.some(e => !e.vacant && e.trait === 'spy' && !e.doubleAgent && e.evidence);
    if (vac.length) brief.push(`Пустых столов: ${vac.length} (${vac.map(v => v.role.toLowerCase()).join(', ')}). Резюме кандидатов уже несут — нанимайте внимательно, ГусьКорп любит подсылать «кандидатов».`);
    if (returned) brief.push(`Те, кого вы вчера отпустили домой (${returned}), вернулись отдохнувшими.`);
    if (tired >= 3) brief.push('Многие пришли невыспавшимися: вчерашний бардак не прошёл даром. Начинаем день на нервах.');
    if (mem.innocent) brief.push(`Офис до сих пор обсуждает увольнение ${mem.innocent}. Моральный дух упал.`);
    if (spyLeft) brief.push('И кстати: тот, кого вы вчера поймали на шпионаже, до сих пор сидит за своим столом. Утечки продолжатся.');
    if (mem.raid) brief.push('Комиссия по ценным бумагам прислала предписание. Посмотрите в лотке.');
    if (mem.exposedGoose) brief.push('Гусев после вчерашнего скандала подал на нас в суд. Иск — в документах.');
    if (G.rubber < 120) brief.push(`Резины на складе осталось ${Math.round(G.rubber)} кг — первым делом согласуйте закупку, иначе конвейер встанет.`);
    if (pending) brief.push(`Вчерашние документы, до которых не дошли руки: ${pending}. Они уже в лотке.`);
    if (G.owned.massage || G.owned.coffee) brief.push(`Вчерашние покупки работают: ${[G.owned.massage && 'массажное кресло', G.owned.coffee && 'новая кофемашина'].filter(Boolean).join(' и ')}.`);

    G.memory = mem;
    G.day++;
    Market.newDay();
    beginDay();
    G.brief = brief;
    save();
  }

  /* ---------- Сохранение: полный снимок дня в текущий слот (см. saves.js) ---------- */
  const EMP_KEEP = ['uid', 'id', 'female', 'look', 'trait', 'pers', 'name', 'surname', 'role', 'salary', 'skill', 'stress', 'col', 'row', 'sanity',
    'clues', 'suspicion', 'evidence', 'lazyFixed', 'doubleAgent', 'herring', 'gone', 'vacant', 'days', 'hiredDay', 'recruited', 'raised', 'age', 'leftDay'];
  /* поля текущего дня — чтобы продолжить с того же места */
  const DAY_KEEP = ['produced', 'searched', 'asked', 'soul', 'fined', 'bonus', 'salaryPaid', 'sleepUntil', 'fired', 'quit', 'fled', 'home', 'exiting',
    'maxStage', 'probed', 'whistled', 'askedWfh', 'thanked', 'fakeBlueprints'];
  const pick = (e, keys) => { const o = {}; keys.forEach(k => { if (e[k] !== undefined) o[k] = e[k]; }); return o; };
  const pickEmp = e => pick(e, EMP_KEEP.concat(DAY_KEEP));
  const MID_KEEP = ['time', 'ducks', 'price', 'rubberOutMin', 'producing', 'chaosSum', 'chaosN', 'chaosMax', 'highChaosMin', 'chaosCD', 'ledger',
    'docLog', 'docStats', 'news', 'newsSeen', 'log', 'cd', 'musicUntil', 'overtime', 'breakdownUntil', 'mods', 'contracts', 'flags', 'leaks',
    'spiesCaught', 'innocentFired', 'firedCount', 'sentHome', 'bonuses', 'hired', 'chaosEvents', 'speakerUses', 'plan', 'dayStart', 'dayStartHoldings', 'lastReport'];

  function snapshot() {
    const cat = NPC.cat();
    const docs = G.inbox.concat(NPC.transit());
    return {
      v: 3, saved: Date.now(), day: G.day, uidSeq: G.uidSeq, cash: G.cash, rep: G.rep, rubber: G.rubber, priceBase: G.priceBase,
      career: G.career, owned: G.owned, memory: G.memory, catHunger: cat ? cat.hunger : G.catHunger, docSeq: G.docSeq, brief: G.brief,
      emps: G.emps.map(pickEmp), alumni: G.alumni.slice(-20).map(pickEmp), market: Market.save(),
      mid: Object.assign(pick(G, MID_KEEP), { ended: G.phase === 'verdict' }),
      inbox: docs.filter(d => d.key).map(d => ({ key: d.key, no: d.no, arrived: d.arrived, old: !!d.old, cand: d.cand ? pickEmp(d.cand) : null })),
      /* звонок, который звенел в момент сохранения, раздастся снова */
      sched: (G.call && !G.dialog ? [{ t: G.time + 1, type: 'call', key: G.call.key }] : []).concat(G.sched.filter(ev => ev.type !== 'fn')),
      srvLog: NPC.srvLog().slice(0, 40),
    };
  }
  /* сохранить в текущий слот; true — получилось */
  function save() {
    if (!G || G.phase === 'title') return false;
    if (G.phase === 'verdict' && G.career.last === 'fired') return false;
    try { return Saves.write(snapshot(), meta()); } catch (err) { return false; }
  }
  function meta() {
    return { day: G.day, time: G.time, rank: RANKS[G.career.rank], cash: Math.round(G.cash), ended: G.phase === 'verdict', strikes: G.career.strikes };
  }
  const reviveEmp = x => {
    const e = dayFields(Object.assign({ clues: [], suspicion: 0 }, x));
    DAY_KEEP.forEach(k => { if (x[k] !== undefined) e[k] = x[k]; });
    if (!e.gone && (e.exiting || e.fired || e.quit || e.fled)) e.gone = e.fired ? 'fired' : e.fled ? 'fled' : e.quit ? 'quit' : 'home';
    if (e.gone) e.exiting = false;
    if (x.vacant) { e.salaryPaid = 0; e.state = 'gone'; }
    return e;
  };
  /* Загрузка снимка (v3) или старого сохранения начала дня (v2) */
  function restore(o) {
    G = {
      phase: 'title', day: o.day, uidSeq: o.uidSeq, emps: [], alumni: [],
      cash: o.cash, rep: o.rep, rubber: o.rubber, priceBase: o.priceBase || CFG.DUCK_PRICE,
      career: o.career, owned: o.owned || {}, memory: o.memory || {}, catHunger: o.catHunger != null ? o.catHunger : 40,
      carryDocs: o.v === 2 ? (o.carryDocs || []) : [], docSeq: o.docSeq || 410, brief: o.brief || [],
    };
    G.emps = o.emps.map(reviveEmp);
    G.alumni = (o.alumni || []).map(reviveEmp);
    Market.load(o.market);
    beginDay();
    G.brief = o.brief || [];
    if (o.v !== 3 || !o.mid) return;
    Object.assign(G, o.mid);
    G.ended = !!o.mid.ended;
    G.sched = o.sched || [];
    G.inbox = [];
    for (const x of o.inbox || []) {
      const d = x.key === 'resume' && x.cand ? Hire.resumeDoc(reviveEmp(x.cand)) : Content.makeDoc(x.key);
      if (!d) continue;
      d.no = x.no || ++G.docSeq; d.arrived = x.arrived != null ? x.arrived : G.time; d.old = x.old;
      G.inbox.push(d);
    }
    G.docSeq = Math.max(o.docSeq || 410, ...G.inbox.map(d => d.no));
    NPC.srvLog().push(...(o.srvLog || []));
    updateChaos();
  }

  return {
    stage, present, heal, hurt, money, log, toast, addNews, newGame, queue, minute, makeEmployee, byUid, scheduleTraitEvents, payrollNow,
    applyVerdict, nextDay, save, snapshot, restore, RANKS, WEEK, WEEK_FULL, weekday,
    receiveDoc, decideDoc, ring, PHONE, phoneAction,
    callIn, endVisit, askWork, search, soul, bonus, fine, fire, sendHome, turn, quit, goHomeFromDesk, arrive, endDay,
  };
})();
