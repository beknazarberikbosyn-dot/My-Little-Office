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
  BASE_DECAY: 0.085,
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
  function addNews(text, big) {
    G.news.unshift({ t: G.time, text, big: !!big });
    if (big) UI.toast('НОВОСТИ: ' + text, 'news', () => UI.openPanel('terminal', 'news'));
  }

  /* ---------- Сотрудники ---------- */
  function makeEmployees() {
    const roles = U.shuffle(Data.ROLES.slice());
    const namesM = U.shuffle(Data.NAMES_M.slice());
    const namesF = U.shuffle(Data.NAMES_F.slice());
    const traits = ['spy', 'lazy', 'lazy', 'star', 'normal', 'normal', 'normal', 'normal'];
    if (U.chance(0.45)) traits[7] = 'spy';
    U.shuffle(traits);
    const emps = [];
    for (let i = 0; i < 8; i++) {
      const female = Math.random() < 0.5;
      const r = roles[i];
      const trait = traits[i];
      const pers = U.pick(Data.PERSONALITIES);
      let skill = U.randi(r.skill[0], r.skill[1]);
      if (trait === 'star') skill = Math.round(skill * 1.3);
      const look = {
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
      emps.push({
        id: i, female, look, trait, pers,
        name: female ? namesF.pop() : namesM.pop(),
        surname: U.pick(female ? Data.SURNAMES_F : Data.SURNAMES_M),
        role: r.role, salary: r.salary, salaryPaid: r.salary, skill,
        stress: pers.stress * (trait === 'star' ? 1.15 : 1),
        col: i % 4, row: Math.floor(i / 4),
        sanity: U.randi(80, 98),
        state: 'seated', x: 0, y: 0, dir: 'down', path: [], purpose: null, walkT: 0,
        produced: 0, clues: [], suspicion: 0, evidence: false,
        searched: false, asked: false, soul: false, fined: false, bonus: 0,
        lazyFixed: false, doubleAgent: false, sleepUntil: 0, activeClue: null,
        maxStage: 0, anim: Math.random() * 10, bubbleCD: U.rand(3, 12),
        gone: null, exiting: false, herring: null,
      });
    }
    return emps;
  }

  /* ---------- Новый день ---------- */
  function newGame() {
    G = {
      phase: 'title', time: CFG.DAY_START, acc: 0, speed: 1, paused: false,
      cash: CFG.START_CASH, ledger: {}, price: CFG.DUCK_PRICE,
      rubber: CFG.START_RUBBER, rubberOutMin: 0, producing: true,
      ducks: 0, rep: 50, chaos: 0, chaosSum: 0, chaosN: 0, chaosMax: 0, highChaosMin: 0, chaosCD: 0,
      emps: makeEmployees(), visitor: null,
      inbox: [], docLog: [], docStats: { correct: 0, wrong: 0, neutral: 0 }, docSeq: 410,
      sched: [], call: null, news: [], log: [], cd: {},
      musicUntil: 0, overtime: false, breakdownUntil: 0,
      mods: { decay: 1, coffee: false }, contracts: {}, flags: {},
      leaks: 0, spiesCaught: 0, innocentFired: 0, firedCount: 0, sentHome: 0, bonuses: 0,
      chaosEvents: 0, speakerUses: 0, dialog: false, panel: null,
    };
    Market.init();
    buildSchedule();
  }

  function queue(ev) {
    let i = G.sched.length;
    while (i > 0 && G.sched[i - 1].t > ev.t) i--;
    G.sched.splice(i, 0, ev);
  }

  function spread(n, from, to) {
    const span = (to - from) / n;
    return Array.from({ length: n }, (_, i) => Math.round(from + span * i + U.rand(span * 0.15, span * 0.85)));
  }

  function buildSchedule() {
    const add = (t, type, data) => queue(Object.assign({ t: Math.max(CFG.DAY_START + 2, t), type }, data || {}));

    Content.planDocs().forEach(d => add(d.t, 'doc', { key: d.key }));

    add(U.T(10, U.randi(35, 55)), 'call', { key: 'goose' });
    add(U.T(12, U.randi(15, 35)), 'call', { key: 'mom' });
    add(U.T(13, U.randi(30, 50)), 'call', { key: 'foreman' });
    add(U.T(14, U.randi(40, 55)), 'call', { key: 'press' });
    add(U.T(15, U.randi(10, 25)), 'call', { key: 'broker' });
    add(U.T(16, U.randi(30, 45)), 'call', { key: 'founder' });

    for (const e of G.emps) {
      if (e.trait === 'spy') {
        const strong = U.shuffle(Data.CLUES.spy.filter(c => c.strong));
        const weak = U.shuffle(Data.CLUES.spy.filter(c => !c.strong));
        const seq = [weak[0], strong[0], U.chance(0.5) ? strong[1] : weak[1]];
        spread(3, U.T(9, 35), U.T(16, 30)).forEach((t, i) => add(t, 'clue', { eid: e.id, clue: seq[i] }));
        [[11, 10], [13, 40], [16, 5]].forEach(([h, m]) => {
          if (U.chance(0.85)) add(U.T(h, m) + U.randi(-15, 15), 'leak', { eid: e.id });
        });
      } else if (e.trait === 'lazy') {
        const seq = U.shuffle(Data.CLUES.lazy.slice()).slice(0, 3);
        spread(3, U.T(9, 45), U.T(16, 40)).forEach((t, i) => add(t, 'clue', { eid: e.id, clue: seq[i] }));
      }
    }
    const herr = U.shuffle(Data.CLUES.herring.slice());
    U.shuffle(G.emps.filter(e => e.trait === 'normal' || e.trait === 'star')).slice(0, 2)
      .forEach((e, i) => add(U.randi(U.T(10, 0), U.T(16, 0)), 'clue', { eid: e.id, clue: herr[i] }));

    Data.NEWS_START.forEach(text => add(CFG.DAY_START + 1, 'news', { text }));
    const ut = G.market.t.UTKA, en = G.market.t.ENGN;
    if (ut.crash) {
      add(ut.crash.start - 100, 'news', { text: Data.NEWS_UTKA_WARN[0] });
      add(ut.crash.start - 45, 'news', { text: Data.NEWS_UTKA_WARN[1] });
      add(ut.crash.start + 4, 'news', { text: 'ПУЗЫРЬ ЛОПНУЛ! Акции Утка.ком рухнули. Инвесторы кидаются клавиатурами.', big: true });
    } else {
      add(U.T(14, 10), 'news', { text: 'Утка.ком снова растёт. Скептики посрамлены. Пока что.' });
    }
    if (en.crash) {
      add(en.crash.start - 90, 'news', { text: Data.NEWS_ENGN_WARN[0] });
      add(en.crash.start - 40, 'news', { text: Data.NEWS_ENGN_WARN[1] });
      add(en.crash.start + 3, 'news', { text: 'СКАНДАЛ: Энергон годами рисовал прибыль. Акции обвалились, аудиторы ищут шредер побольше.', big: true });
    } else {
      add(U.T(13, 30), 'news', { text: 'Энергон отчитался о рекордной прибыли. Как именно — никто не понял.' });
    }
    add(U.T(12, 0), 'news', { text: 'Облигации казначейства: доходность стабильна. Скучно, как всегда.' });
    add(U.T(17, 30), 'fn', { fn: () => toast('До совета директоров 30 минут. Разберите документы и успокойте офис!', 'warn') });
    add(U.T(17, 50), 'fn', { fn: () => { toast('10 минут до совета директоров!', 'warn'); Sfx.play('alarm'); } });
  }

  /* ---------- События расписания ---------- */
  function fireEvent(ev) {
    const e = ev.eid != null ? G.emps[ev.eid] : null;
    switch (ev.type) {
      case 'doc': {
        const d = Content.makeDoc(ev.key);
        if (d) receiveDoc(d);
        break;
      }
      case 'call': {
        if (G.call || G.visitor) { ev.t = G.time + 8; if (ev.t < CFG.DAY_END - 5) queue(ev); break; }
        const c = Content.CALLS[ev.key];
        if (c.cond && !c.cond()) break;
        ring(ev.key);
        break;
      }
      case 'clue': showClue(e, ev); break;
      case 'leak': leak(e); break;
      case 'news': addNews(ev.text, ev.big); break;
      case 'deliver':
        G.rubber += ev.kg;
        G.flags.rubberOut = false; G.flags.rubberLow = false;
        toast(`Привезли резину: +${ev.kg} кг. Конвейер снова крутится.`, 'good');
        Sfx.play('coin');
        break;
      case 'breakdown':
        G.breakdownUntil = G.time + 50;
        toast('Конвейер сломался! Михалыч чинит его 50 минут. Производство стоит.', 'bad');
        Sfx.play('alarm'); World.shake(0.6);
        break;
      case 'quit': quit(e); break;
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
      run() { present().forEach(e => heal(e, G.mods.coffee ? 14 : 10)); return 'Секретарша разносит кофе. Все немного выдохнули.'; },
    },
    {
      id: 'pizza', name: 'Пицца в офис', cd: 150, cost: () => 450,
      desc: () => '+22 рассудка каждому',
      run() { present().forEach(e => heal(e, 22)); World.confetti(); return 'Пицца приехала! Офис ликует.'; },
    },
    {
      id: 'music', name: 'Спокойная музыка', cd: 100, cost: () => 0,
      desc: () => '45 минут безумие растёт в 2,5 раза медленнее',
      run() { G.musicUntil = G.time + 45; return 'Из колонок льётся джаз. Даже стажёр перестал дёргаться.'; },
    },
    {
      id: 'psy', name: 'Вызвать психолога', cd: 120, cost: () => 700,
      desc: () => '+40 рассудка трём самым безумным',
      run() {
        present().sort((a, b) => a.sanity - b.sanity).slice(0, 3).forEach(e => heal(e, 40));
        return 'Психолог провёл сеанс «Отпусти свою внутреннюю утку». Помогло.';
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
      if (!ev.retry) { ev.retry = 1; ev.t = G.time + 15; queue(ev); }
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
    if (e.doubleAgent) {
      Market.jump('GOOS', -12); G.rep += 4;
      toast(U.fill('Двойной агент {name} слил{|а} ГусьКорп фальшивые чертежи! Их акции падают.', e), 'good');
      addNews('ГусьКорп выпустила пищалку, которая мычит. Акции компании падают.');
      return;
    }
    G.leaks++; G.rep -= 6;
    Market.jump('QUAK', -5); Market.jump('GOOS', 7);
    toast(LEAKS[(G.leaks - 1) % LEAKS.length] + ' Кто-то в офисе работает на конкурента…', 'bad');
    addNews('ГусьКорп снова опередила «Кря Индастриз». Совпадение? Аналитики сомневаются.');
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
      addNews('Комиссия по ценным бумагам провела обыск в «Кря Индастриз». Свидетели говорят о горнах и летающих деньгах.', false);
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
        p = (e.skill / 60) * SF[stage(e)] * traitF(e) * (G.overtime ? 1.15 : 1);
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
      const pace = G.ducks / (CFG.PLAN * elapsed / (CFG.DAY_END - CFG.DAY_START));
      G.market.t.QUAK.drift = U.clamp((pace - 1) * 0.0006 + (G.rep - 50) * 0.00002 - G.chaos * 0.000004, -0.0008, 0.0008);
    }
    Market.tick(t);
    G.rep = U.clamp(G.rep, 0, 100);
  }

  /* ---------- Разговоры в кабинете ---------- */
  function callIn(e) {
    if (G.visitor) { toast('В кабинете уже кто-то есть. Сначала закончите разговор.', 'warn'); return false; }
    if (e.gone || e.exiting || e.state !== 'seated') { toast(`${e.name} сейчас не за рабочим местом.`, 'warn'); return false; }
    G.visitor = e;
    const p = World.standPos(e);
    e.x = p.x; e.y = p.y;
    e.state = 'walk'; e.purpose = 'office';
    e.path = World.pathToOffice(e);
    World.say(e, stage(e) >= 3 ? 'ИДУ, БОСС! АУУУ!' : stage(e) >= 2 ? 'ЧТО?! ИДУ!' : 'Иду, босс!', 2);
    Sfx.play('click');
    log(`Вызван в кабинет: ${e.name}`);
    return true;
  }

  function endVisit(e, how) {
    G.visitor = null;
    e.state = 'walk';
    if (how === 'back') {
      e.purpose = 'desk';
      e.path = World.pathToDesk(e);
    } else {
      e.purpose = 'leave';
      e.exiting = true;
      e.carryBox = how === 'fire';
      e.path = World.pathLeave(e);
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
    e.salaryPaid = Math.round(e.salary * 0.5);
    if (e.trait === 'spy') {
      if (!e.doubleAgent) G.spiesCaught++;
      G.rep += 8;
      Market.jump('GOOS', -5); Market.jump('QUAK', 3);
      toast(U.fill('Шпион ГусьКорп разоблачён! {name} покидает здание с коробкой.', e), 'good');
      addNews('«Кря Индастриз» поймала промышленного шпиона. ГусьКорп всё отрицает и нервно крякает.');
      Sfx.play('good');
      return 'Вы ещё пожалеете! Гусев обещал мне кабинет с видом на пруд… *уходит с коробкой*';
    }
    if (e.trait === 'lazy') {
      toast(U.fill('Лентяй {name} уволен{|а}. Зарплата сэкономлена.', e), 'good');
      Sfx.play('coin');
      return 'Ну и ладно. Пойду спать домой — там подушка удобнее.';
    }
    G.innocentFired++;
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
    Market.jump('GOOS', 6); Market.jump('QUAK', -3);
    toast(U.fill('{name} сбежал{|а} к ГусьКорп прямо с чертежами!', e), 'bad');
    Sfx.play('alarm');
    return 'Ха! Никогда! Передайте Гусеву, что я уже еду! *выбегает из кабинета*';
  }

  function quit(e) {
    if (!e || e.gone || e.exiting) return;
    if (e.state !== 'seated') { queue({ t: G.time + 10, type: 'quit', eid: e.id }); return; }
    e.quit = true; e.exiting = true; e.carryBox = true;
    const p = World.standPos(e); e.x = p.x; e.y = p.y;
    e.state = 'walk'; e.purpose = 'leave';
    e.path = World.pathLeave(e, true);
    G.rep -= 2; Market.jump('GOOS', 2);
    e.salaryPaid = Math.round(e.salary * 0.7);
    toast(U.fill('{name} собрал{|а} вещи и уш{ёл|ла} в ГусьКорп.', e), 'bad');
  }

  function goHomeFromDesk(e) {
    if (!e || e.gone || e.exiting || e.state !== 'seated') return false;
    e.home = true; e.exiting = true; G.sentHome++;
    e.sanity = 100;
    const p = World.standPos(e); e.x = p.x; e.y = p.y;
    e.state = 'walk'; e.purpose = 'leave';
    e.path = World.pathLeave(e, true);
    return true;
  }

  /* Сотрудник дошёл до цели */
  function arrive(e) {
    if (e.purpose === 'office') {
      e.state = 'visit'; e.dir = 'up';
      if (G.dialog) e.pendingTalk = true;
      else UI.openTalk(e);
    } else if (e.purpose === 'desk') {
      e.state = 'seated'; e.dir = 'down';
    } else if (e.purpose === 'leave') {
      e.state = 'gone';
      e.gone = e.fired ? 'fired' : e.fled ? 'fled' : e.quit ? 'quit' : 'home';
      World.openElevator();
    }
    e.purpose = null;
  }

  /* ---------- Конец дня ---------- */
  function endDay() {
    G.phase = 'ending';
    const L = G.ledger;
    const payroll = G.emps.reduce((s, e) => s + (e.fled ? 0 : e.salaryPaid), 0);
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
    const profit = G.cash - CFG.START_CASH + holdings;
    const investPnL = (L.invest || 0) + holdings;
    const spies = G.emps.filter(e => e.trait === 'spy').length;
    const decided = G.docStats.correct + G.docStats.wrong;
    const ignored = G.inbox.filter(d => (typeof d.correct === 'function' ? d.correct() : d.correct) != null).length;
    const report = {
      ducks: Math.floor(G.ducks), plan: CFG.PLAN,
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
      utkaCrashed: !!G.market.t.UTKA.crash, engnCrashed: !!G.market.t.ENGN.crash,
      bonds: G.market.bondsDone || 0, penny: G.market.pennyDone || 0, pennyWin: G.market.pennyWin,
      bankrupt: G.cash + holdings < 0,
    };
    return report;
  }

  return {
    stage, present, heal, hurt, money, log, toast, addNews, newGame, queue, minute,
    receiveDoc, decideDoc, ring, PHONE, phoneAction,
    callIn, endVisit, askWork, search, soul, bonus, fine, fire, sendHome, turn, quit, goHomeFromDesk, arrive, endDay,
  };
})();
