'use strict';
/* Жизнь офиса: дела сотрудников, обслуживающий персонал, гости, кот и мусор */
const NPC = (() => {
  const P = Plan.P;
  let staff = [], cat = null, litter = [], srvLog = [], busy = {}, transit = [], vseq = 0;
  const AUTH = ['Инженер пищалок', 'Аналитик'];
  const pt = (o, extra) => Object.assign({}, o, extra || {});

  /* ================= Движение по сценарию ================= */
  function run(a, steps, onEnd) {
    a.script = steps.slice();
    a.scriptEnd = onEnd || null;
    a.waitUntil = null; a.waitReal = null;
    next(a);
  }
  function stop(a) {
    a.script = null; a.scriptEnd = null; a.path = []; a.moving = false;
    a.waitUntil = null; a.waitReal = null; a.act = null; a.hidden = false; a.pose = 'stand';
    release(a);
  }
  function next(a) {
    if (!a.script) return;
    const s = a.script.shift();
    if (!s) {
      const f = a.scriptEnd;
      a.script = null; a.scriptEnd = null; a.moving = false; a.act = null;
      if (f) f(a);
      return;
    }
    if (s.go || s.direct) {
      const t = s.go || s.direct;
      a.pose = 'stand'; a.hidden = false; a.act = s.act || null;
      a.path = s.direct ? [{ x: t.x, y: t.y }] : Plan.path(a.x, a.y, t.x, t.y);
      a.target = t; a.moving = true; a.hop = !!s.direct;
    } else if (s.wait != null || s.until != null || s.secs != null) {
      if (s.secs != null) a.waitReal = s.secs;
      else a.waitUntil = s.until != null ? s.until : G.time + s.wait;
      if (s.pose) a.pose = s.pose;
      if (s.act !== undefined) a.act = s.act;
      if (s.dir) a.dir = s.dir;
      a.hidden = !!s.hidden;
      a.moving = false;
    } else if (s.do) {
      s.do(a);
      next(a);
    } else next(a);
  }
  function arrived(a) {
    a.moving = false;
    const t = a.target || {};
    if (t.dir) a.dir = t.dir;
    if (t.sit) a.pose = 'sit';
    next(a);
  }
  function tick(a, dt) {
    if (a.moving) {
      const tg = a.path[0];
      if (!tg) { arrived(a); return; }
      const dx = tg.x - a.x, dy = tg.y - a.y, dd = Math.hypot(dx, dy);
      const sp = a.speed * (a.hop ? 1.6 : 1);
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        if (a.isCat) { if (Math.abs(dx) > 0.3) a.left = dx < 0; }
        else a.dir = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      }
      if (dd <= sp * dt) {
        a.x = tg.x; a.y = tg.y; a.path.shift();
        if (!a.path.length) arrived(a);
      } else {
        a.x += (dx / dd) * sp * dt; a.y += (dy / dd) * sp * dt;
        a.walkT = (a.walkT || 0) + dt;
        a.stepT = (a.stepT || 0) - dt;
      }
    } else if (a.waitReal != null) {
      a.waitReal -= dt;
      if (a.waitReal <= 0) { a.waitReal = null; next(a); }
    } else if (a.waitUntil != null && G.time >= a.waitUntil) {
      a.waitUntil = null; next(a);
    }
  }
  const idle = a => !a.script && !a.moving;

  /* Занятые точки (одна точка — один человек) */
  function claim(a, key) { if (busy[key] && busy[key] !== a) return false; busy[key] = a; a.spot = key; return true; }
  function release(a) { if (a.spot && busy[a.spot] === a) delete busy[a.spot]; a.spot = null; }
  const freeSpot = (...keys) => keys.find(k => !busy[k]);

  /* ================= Сотрудники ================= */
  const say = (a, t, d) => World.say(a, t, d || 1.8);
  function leaveSeat(e) {
    if (e.state === 'seated') { const s = Plan.seat(e.id); e.x = s.x; e.y = s.y; }
  }
  const available = e => !e.gone && !e.exiting && G.visitor !== e && e.state !== 'visit';
  const canCall = e => available(e) && (e.state === 'seated' || e.state === 'errand' || (e.state === 'walk' && e.purpose === 'desk'));

  function backToDesk(e) {
    release(e);
    e.task = null; e.hidden = false; e.act = null; e.pose = 'stand';
    e.state = 'walk'; e.purpose = 'desk';
    run(e, [{ go: pt(Plan.seat(e.id), { dir: 'down' }) }], () => Sim.arrive(e));
  }
  function goOffice(e) {
    stop(e); leaveSeat(e);
    e.task = null; e.carry = null;
    e.state = 'walk'; e.purpose = 'office';
    run(e, [{ go: P.visitor }], () => Sim.arrive(e));
  }
  function leave(e) {
    stop(e); leaveSeat(e);
    e.task = null;
    e.state = 'walk'; e.purpose = 'leave';
    run(e, [{ go: P.elevator }], () => { World.openElevator(); Sim.arrive(e); });
  }

  function addClue(e, text, icon, susp, strong) {
    e.clues.push({ t: G.time, text, strong: !!strong });
    e.suspicion = U.clamp(e.suspicion + susp, 0, 100);
    e.activeClue = { icon, until: G.time + 20, text };
    Sim.toast(U.fill('{name} ' + text, e), 'clue', () => UI.openDossier(e));
  }

  const TASK_LABEL = {
    coffee: 'пьёт кофе', fridge: 'ищет еду в холодильнике', cooler: 'болтает у кулера', pet: 'гладит кота',
    feed: 'кормит кота', wc: 'в туалете', printer: 'у принтера', sofa: 'отдыхает на диване', lunch: 'обедает',
    server: 'в серверной', rampage: 'бегает по офису с криками', session: 'у психолога', meeting: 'на планёрке', pizza: 'ест пиццу',
  };
  const taskLabel = e => TASK_LABEL[e.task] || 'отошёл от стола';

  const ERR = {
    coffee(e) {
      const st = Sim.stage(e);
      return [
        { go: P.coffee }, { wait: 5, act: 'coffee' },
        { do: () => { Sim.heal(e, 4); e.carry = 'cup'; say(e, st >= 2 ? 'КОФЕ!!! ЕЩЁ!!!' : U.pick(['Ах, кофеёк…', 'Седьмая чашка…', 'Кофе!'])); } },
        ...(st >= 2 && U.chance(0.5) ? [{ go: Plan.randomIn('open') }, { do: () => { addLitter(e.x, e.y, 'coffee'); e.carry = null; say(e, 'Ой!'); } }] : []),
      ];
    },
    fridge(e) {
      return [{ go: P.fridge }, { wait: 3, act: 'fridge' }, { do: () => { Sim.heal(e, 2); say(e, U.pick(['Чей это йогурт?', 'Опять кто-то съел мой бутерброд!', 'Ням.'])); } }];
    },
    pet(e) {
      if (!cat || cat.onDesk || cat.moving) return null;
      const side = Plan.walkable(cat.x + 9, cat.y) ? 9 : -9;
      return [
        { go: { x: cat.x + side, y: cat.y, dir: side > 0 ? 'left' : 'right' } },
        { wait: 4, pose: 'crouch', act: 'pet' },
        { do: () => { Sim.heal(e, 5); World.emit(cat.x, cat.y - 12, 'heart'); Sfx.play('purr'); say(e, U.pick(['Кис-кис!', 'Кто тут хороший?', 'Мурчит!'])); } },
      ];
    },
    feed(e) {
      cat.feeder = e;
      return [
        { go: P.bowl }, { wait: 3, pose: 'crouch', act: 'feed' },
        { do: () => { cat.food = true; cat.feeder = null; Sim.heal(e, 3); say(e, 'Кексик, кушать!'); Sim.log(U.fill('{name} покормил{|а} кота', e)); } },
      ];
    },
    wc(e) {
      const k = freeSpot('wc1', 'wc2');
      if (!k) return null;
      claim(e, k);
      const lazy = e.trait === 'lazy' && !e.lazyFixed;
      const steps = [{ go: P[k] }];
      if (lazy) {
        steps.push({ wait: 26, hidden: true, act: 'wc' },
          { do: () => addClue(e, U.fill('уже полчаса сидит в туалете', e), 'zzz', 12) },
          { wait: U.randi(10, 20), hidden: true, act: 'wc' });
      } else steps.push({ wait: U.randi(4, 7), hidden: true, act: 'wc' });
      steps.push({ do: () => { release(e); Sim.heal(e, 1); Sfx.play('flush'); } });
      return steps;
    },
    printer(e) {
      if (!claim(e, 'printer')) return null;
      return [{ go: P.printer }, { wait: 4, act: 'print' }, { do: () => { release(e); e.carry = 'docs'; if (U.chance(0.3)) say(e, U.pick(['Опять зажевал!', 'Где мои 40 копий?', 'Тонер кончился…'])); } }];
    },
    sofa(e) {
      const k = freeSpot('sofa1', 'sofa2');
      if (!k) return null;
      claim(e, k);
      const lazy = e.trait === 'lazy' && !e.lazyFixed;
      if (lazy) {
        return [{ go: P[k] }, { wait: 14, pose: 'sit', act: 'sleep' },
          { do: () => addClue(e, 'спит на диване в комнате отдыха', 'zzz', 12) },
          { wait: U.randi(12, 22), pose: 'sit', act: 'sleep' }, { do: () => { release(e); Sim.heal(e, 3); } }];
      }
      return [{ go: P[k] }, { wait: 12, pose: 'sit', act: 'rest' }, { do: () => { release(e); Sim.heal(e, Sim.stage(e) >= 1 ? 8 : 3); say(e, 'Фух, полегчало.'); } }];
    },
    lunch(e) {
      const k = freeSpot('table1', 'table2');
      if (!k) return null;
      claim(e, k);
      const pizza = G.time < (G.flags.pizzaUntil || 0);
      return [{ go: P[k] }, { wait: pizza ? 10 : 15, pose: 'sit', act: 'eat' },
        { do: () => { release(e); Sim.heal(e, pizza ? 8 : 5); if (pizza) say(e, 'Пицца — лучшее, что было за день!'); } }];
    },
    server(e) {
      if (!claim(e, 'rack')) return null;
      return [{ go: P.rack }, { wait: e.trait === 'spy' ? 9 : 6, act: 'server' }, { do: () => { release(e); serverVisit(e); } }];
    },
    rampage(e) {
      const pts = [Plan.randomIn('open'), Plan.randomIn('hall'), Plan.randomIn('open')];
      const steps = [];
      pts.forEach(p => steps.push({ go: p }, { wait: 1, act: 'rampage' }, { do: () => { say(e, U.pick(Data.SHOUTS[3]), 1.6); addLitter(e.x, e.y, 'paper'); } }));
      return steps;
    },
  };

  function serverVisit(e) {
    const ok = AUTH.includes(e.role);
    const seen = akhmet() && akhmet().home && idle(akhmet()) && !akhmet().away;
    srvLog.unshift({ t: G.time, name: `${e.name} ${e.surname}`, role: e.role, ok, seen, eid: e.id, uid: e.uid });
    if (!ok && seen) {
      const spy = e.trait === 'spy' && !e.doubleAgent;
      addClue(e, U.fill('копал{ся|ась} в серверной без допуска (заметил Ахмет)', e), spy ? 'disk' : 'alert', spy ? 30 : 15, spy);
      say(akhmet(), 'Эй! Тебе сюда нельзя!', 2.2);
    }
  }

  function errand(e, type) {
    if (e.state !== 'seated' || !available(e)) return false;
    const f = ERR[type];
    if (!f) return false;
    const steps = f(e);
    if (!steps) return false;
    leaveSeat(e);
    e.state = 'errand'; e.task = type; e.carry = null;
    run(e, steps, () => backToDesk(e));
    return true;
  }

  function pickErrand(e) {
    const st = Sim.stage(e);
    const lazy = e.trait === 'lazy' && !e.lazyFixed;
    const t = G.time;
    const w = {
      coffee: 3 + st, fridge: 0.8, cooler: 1.2,
      pet: cat && !cat.onDesk ? 1.6 : 0,
      wc: lazy ? 4 : 1.2, printer: lazy ? 0.4 : 1.4,
      sofa: lazy ? 3 : st >= 1 ? 2 : 0.3,
      lunch: (t >= U.T(12) && t < U.T(14) ? 3 : 0.3) + (t < (G.flags.pizzaUntil || 0) ? 4 : 0),
      server: AUTH.includes(e.role) ? 1 : e.trait === 'spy' ? 0 : 0.15,
      rampage: st >= 3 ? 6 : 0,
    };
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'coffee';
  }

  function coolerChat(e) {
    const mates = G.emps.filter(o => o !== e && o.state === 'seated' && available(o));
    if (!mates.length || busy.cooler1 || busy.cooler2) return false;
    const o = U.pick(mates);
    leaveSeat(e); leaveSeat(o);
    claim(e, 'cooler1'); claim(o, 'cooler2');
    const end = G.time + 14;
    const talk = (a, b) => [
      { go: a === e ? P.cooler1 : P.cooler2 }, { until: end - 8, act: 'chat' },
      { do: () => { const th = U.pick(G.emps.filter(q => q !== a && q !== b)) || b; say(a, U.fill(U.pick(Data.GOSSIP), th), 2.6); } }, { until: end - 4, act: 'chat' },
      { do: () => say(a, U.pick(['Да ладно?!', 'Ха-ха!', 'Не может быть!', 'Тсс, босс смотрит!']), 2) },
      { until: end, act: 'chat' }, { do: () => { release(a); Sim.heal(a, 3); } },
    ];
    for (const [a, b] of [[e, o], [o, e]]) {
      a.state = 'errand'; a.task = 'cooler'; a.carry = null;
      run(a, talk(a, b), () => backToDesk(a));
    }
    return true;
  }

  /* Особые дела (по событиям) */
  function sendTo(e, task, seatPt, until, onDone) {
    if (!available(e) || !(e.state === 'seated' || e.state === 'errand')) return false;
    stop(e); leaveSeat(e);
    e.state = 'errand'; e.task = task; e.carry = null;
    run(e, [{ go: seatPt }, { until, pose: 'sit', act: task }, { do: onDone }], () => backToDesk(e));
    return true;
  }

  /* ================= Мусор и уборщица ================= */
  function addLitter(x, y, type) {
    if (litter.length >= 30) return;
    const r = Plan.roomAt(x, y);
    if (!r || r.id === 'prod' || r.id === 'out') return;
    for (let n = 0; n < 8; n++) {
      const lx = x + U.randi(-10, 10), ly = y + U.randi(-6, 8);
      if (Plan.walkable(lx, ly)) { litter.push({ x: lx, y: ly, type: type || 'paper', r: U.randi(0, 3) }); return; }
    }
  }
  function litterNear(x, y, rad) { return litter.filter(l => Math.abs(l.x - x) < rad && Math.abs(l.y - y) < rad).length; }

  /* ================= Обслуживающий персонал ================= */
  const LOOKS = {
    galya: { female: true, skin: '#f1c9a5', hair: '#c0503a', hairStyle: 'bun', shirt: '#f0b9c4', pants: '#4a3a4a', skirt: '#4a3a4a', glasses: true },
    akhmet: { skin: '#c08a5e', hair: '#1b1b22', hairStyle: 'spiky', shirt: '#3a3a3a', pants: '#2a3550', glasses: true, beard: true },
    zina: { female: true, skin: '#eec39a', hair: '#9a5a8a', hairStyle: 'bun', shirt: '#c9b8e8', pants: '#3a3f4a', skirt: '#3a3f4a', glasses: true },
    mikh: { skin: '#d9a47a', hair: '#4a2f1c', hairStyle: 'bald', shirt: '#3a6ea5', pants: '#2a3550', cap: '#e8c33a', beard: false },
    valya: { female: true, skin: '#e8b88a', hair: '#7a7a7a', hairStyle: 'bob', shirt: '#9fd3d0', pants: '#3a5a5a', skirt: '#3a5a5a', apron: '#5a9a9a' },
    courier: { skin: '#d9a47a', hair: '#2b1d14', hairStyle: 'short', shirt: '#8a5a2a', pants: '#4b3a2e', cap: '#8a5a2a' },
    pizza: { skin: '#f1c9a5', hair: '#a8432a', hairStyle: 'short', shirt: '#d23c3c', pants: '#2b2f3a', cap: '#d23c3c' },
    psy: { skin: '#eec39a', hair: '#8a6a4a', hairStyle: 'short', shirt: '#7a8a5a', pants: '#4b3a2e', glasses: true, beard: true },
  };
  const INFO = {
    galya: ['Галя', 'Секретарь'], akhmet: ['Ахмет', 'Сисадмин'], zina: ['Зинаида Петровна', 'Главный бухгалтер'],
    mikh: ['Михалыч', 'Мастер цеха'], valya: ['Тётя Валя', 'Уборщица'],
    courier: ['Курьер', '«Каучук-Трейд»'], pizza: ['Курьер', 'Пиццерия «Кря-Кря»'], psy: ['Доктор Утешев', 'Психолог'],
  };
  function mk(kind, x, y, extra) {
    const a = Object.assign({
      key: kind === 'courier' || kind === 'pizza' || kind === 'psy' ? kind + (++vseq) : kind,
      kind, look: LOOKS[kind], name: INFO[kind][0], title: INFO[kind][1],
      x, y, dir: 'down', path: [], speed: 40, pose: 'stand', script: null, moving: false, anim: Math.random() * 9,
      nextT: G.time + U.randi(20, 60),
    }, extra || {});
    staff.push(a);
    return a;
  }
  const byKind = k => staff.find(a => a.kind === k);
  const akhmet = () => byKind('akhmet');
  const galya = () => byKind('galya');

  /* --- Галя: разносит документы и кофе --- */
  function deliverDoc(d) {
    transit.push(d);
    G.docsTransit = transit.length;
    const g = galya();
    if (g && idle(g) && g.home) galyaTrip(g);
  }
  function galyaTrip(g) {
    if (!transit.length) return;
    const docs = transit.splice(0, transit.length);
    g.home = false; g.carry = 'docs';
    run(g, [
      { go: P.tray },
      { do: () => { docs.forEach(d => Sim.receiveDoc(d)); G.docsTransit = transit.length; g.carry = null; say(g, docs.length > 1 ? `Вам ${docs.length} документа!` : 'Вам документ!'); } },
      { secs: 0.6 },
      { go: P.galya },
    ], () => { g.home = true; g.dir = 'down'; if (transit.length) galyaTrip(g); });
  }
  function galyaCoffee() {
    const g = galya();
    if (!g || !g.home || !idle(g)) return;
    g.home = false; g.carry = 'tray';
    run(g, [
      { go: { x: 166, y: 176 } }, { secs: 0.4 }, { go: { x: 238, y: 176 } }, { secs: 0.4 },
      { go: { x: 320, y: 176 } }, { secs: 0.4 }, { go: { x: 238, y: 228 } }, { secs: 0.4 },
      { do: () => { g.carry = null; } }, { go: P.galya },
    ], () => { g.home = true; g.dir = 'down'; if (transit.length) galyaTrip(g); });
    G.emps.forEach(e => { if (!e.gone && !e.exiting) e.cupUntil = G.time + 25; });
  }
  function galyaFeed() {
    const g = galya();
    if (!g || !g.home || !idle(g)) return false;
    g.home = false;
    run(g, [{ go: P.bowl }, { wait: 2, pose: 'crouch' }, { do: () => { cat.food = true; say(g, 'Кушай, Кексик!'); } }, { go: P.galya }],
      () => { g.home = true; g.dir = 'down'; if (transit.length) galyaTrip(g); });
    return true;
  }

  /* --- Временные гости из лифта --- */
  function guest(kind, steps, onGone) {
    const a = mk(kind, P.elevator.x, P.elevator.y + 2, { speed: 46 });
    World.openElevator();
    run(a, steps.concat([{ go: P.elevator }]), () => {
      World.openElevator();
      staff = staff.filter(s => s !== a);
      if (onGone) onGone();
    });
    return a;
  }
  function courier(kg) {
    G.flags.truckUntil = G.time + 30;
    const a = guest('courier', [
      { go: P.store }, { wait: 2, act: 'drop' }, { do: () => { a.carry = null; say(a, `${kg} кг резины, распишитесь!`); } },
    ]);
    a.carry = 'crate';
  }
  function pizza() {
    G.flags.truckUntil = G.time + 20;
    const a = guest('pizza', [
      { go: { x: 220, y: 76, dir: 'up' } }, { wait: 2 },
      { do: () => { a.carry = null; G.flags.pizzaUntil = G.time + 120; say(a, 'Пицца «Четыре утки»!'); } },
    ]);
    a.carry = 'pizza';
  }
  function psySession() {
    const end = G.time + 34;
    G.flags.psyUntil = end;
    const doc = guest('psy', [{ go: P.psy }, { until: end, act: 'talk' }, { do: () => say(doc, 'Сеанс окончен. Дышите!') }]);
    doc.carry = 'clip';
    const free = G.emps.filter(e => available(e) && (e.state === 'seated' || e.state === 'errand')).sort((a, b) => a.sanity - b.sanity).slice(0, 3);
    const seats = Plan.MEET_SEATS.filter((s, i) => i % 2 === 0);
    free.forEach((e, i) => sendTo(e, 'session', seats[i], end, () => { Sim.heal(e, 40); say(e, U.fill('Я отпустил{|а} свою внутреннюю утку.', e)); }));
    return free.length;
  }
  function meeting() {
    const end = G.time + 24;
    G.flags.meetUntil = end;
    const free = G.emps.filter(e => available(e) && (e.state === 'seated' || e.state === 'errand'));
    let n = 0;
    free.slice(0, 8).forEach((e, i) => {
      if (sendTo(e, 'meeting', Plan.MEET_SEATS[i], end, () => { Sim.heal(e, 15); })) n++;
    });
    G.mods.motivation = 1.06;
    return n;
  }

  /* ================= Кот Кексик ================= */
  function makeCat() {
    cat = {
      key: 'cat', isCat: true, name: 'Кексик', x: P.catBed.x, y: P.catBed.y, left: false, pose: 'loaf',
      path: [], speed: 30, script: null, moving: false, hunger: G.catHunger != null ? G.catHunger : 42, food: false, onDesk: false, feeder: null, anim: 0,
    };
  }
  const CAT_DESK = { x: 84, y: 198 }, CAT_DESK_TOP = { x: 84, y: 177 };
  function catBrain() {
    const c = cat;
    c.hunger = Math.min(100, c.hunger + 0.33);
    if (!idle(c)) return;
    if (c.onDesk) {
      run(c, [{ direct: CAT_DESK }, { do: () => { c.onDesk = false; } }]);
      return;
    }
    if (c.food) {
      run(c, [{ go: { x: P.bowl.x + 10, y: P.bowl.y } }, { wait: 5, pose: 'eat' },
        { do: () => { c.food = false; c.hunger = 0; World.emit(c.x, c.y - 10, 'heart'); } }]);
      return;
    }
    if (c.hunger > 88 && !G.flags.catDesk) {
      G.flags.catDesk = true;
      run(c, [{ go: CAT_DESK }, { direct: CAT_DESK_TOP }, { do: () => { c.onDesk = true; Sim.toast('Кексик голоден и уселся прямо на ваши бумаги! Кликните по нему.', 'warn', () => clickCat()); Sfx.play('meow'); } },
        { wait: 25, pose: 'sit' }]);
      return;
    }
    if (c.hunger > 60) {
      run(c, [{ go: { x: P.bowl.x + 10, y: P.bowl.y } }, { wait: 12, pose: 'sit', act: 'meow' }]);
      return;
    }
    const r = Math.random();
    if (r < 0.25) run(c, [{ go: P.catBed }, { wait: U.randi(25, 45), pose: 'loaf' }]);
    else if (r < 0.33) run(c, [{ go: CAT_DESK }, { direct: CAT_DESK_TOP }, { do: () => { c.onDesk = true; } }, { wait: U.randi(10, 20), pose: 'sit' }]);
    else if (r < 0.55) {
      const e = U.pick(G.emps.filter(o => o.state === 'seated' && !o.gone));
      if (e) { const s = Plan.seat(e.id); run(c, [{ go: { x: s.x + 10, y: s.y + 32 } }, { wait: U.randi(12, 22), pose: U.chance(0.5) ? 'loaf' : 'sit' }]); }
    } else {
      const room = U.pick(['open', 'open', 'hall', 'boss', 'rec', 'kit', 'acc']);
      run(c, [{ go: Plan.randomIn(room) }, { wait: U.randi(8, 18), pose: U.chance(0.4) ? 'loaf' : 'sit' }]);
    }
  }
  function catHungry() { return cat.hunger > 60 && !cat.food; }
  function clickCat() {
    Sfx.play('purr');
    World.emit(cat.x, cat.y - 12, 'heart');
    if (catHungry() && !cat.feeder) {
      const free = G.emps.filter(e => e.state === 'seated' && available(e));
      if (free.length) {
        free.sort((a, b) => U.dist(a.x, a.y, P.bowl.x, P.bowl.y) - U.dist(b.x, b.y, P.bowl.x, P.bowl.y));
        const e = free[0];
        if (errand(e, 'feed')) { Sim.toast(U.fill('Вы попросили {name} покормить Кексика.', e), 'good'); return; }
      }
      if (galyaFeed()) { Sim.toast('Галя пошла кормить Кексика.', 'good'); return; }
    }
    Sim.toast(catHungry() ? 'Кексик жалобно мяукает: миска пуста.' : U.pick(['Кексик мурлычет и трётся о ногу.', 'Кексик благосклонно разрешил себя погладить.', 'Кексик зевнул. Ему тут хорошо.']), 'info');
  }
  /* Сотрудники рядом с котом сходят с ума медленнее */
  function catNear(e) {
    if (!cat || cat.moving) return false;
    const p = e.state === 'seated' ? Plan.seat(e.id) : e;
    return U.dist(p.x, p.y, cat.x, cat.y) < 44;
  }

  /* ================= Мозги персонала ================= */
  function staffBrain(a) {
    if (a.kind === 'mikh' && G.time < G.breakdownUntil && !a.toPress) {
      stop(a); a.toPress = true;
      run(a, [{ go: P.press }, { until: G.breakdownUntil, act: 'hammer' }, { do: () => say(a, 'Готово! Крутится!') }], () => { a.toPress = false; });
      say(a, 'Опять подшипник!', 2);
      return;
    }
    if (a.kind === 'galya' && a.home && idle(a) && transit.length) { galyaTrip(a); return; }
    if (!idle(a) || G.time < a.nextT) return;
    a.nextT = G.time + U.randi(45, 100);
    const t = G.time;
    if (a.kind === 'akhmet') {
      a.away = true;
      const r = Math.random();
      if (r < 0.4) run(a, [{ go: pt(P.printer, { x: P.printer.x + 10 }) }, { wait: 5, act: 'fix' }, { do: () => say(a, U.pick(['Кто опять засунул скрепку в принтер?!', 'Вы пробовали выключить и включить?'])) }, { go: P.akhmet }], () => { a.away = false; a.pose = 'desk'; });
      else if (r < 0.75) {
        const e = U.pick(G.emps.filter(o => !o.gone));
        const s = Plan.seat(e.id);
        run(a, [{ go: { x: s.x + 14, y: s.y, dir: 'left' } }, { wait: 6, act: 'fix' }, { do: () => say(a, 'Готово. Не трогай больше ничего.') }, { go: P.akhmet }], () => { a.away = false; a.pose = 'desk'; });
      } else run(a, [{ go: P.coffee }, { wait: 4, act: 'coffee' }, { go: P.akhmet }], () => { a.away = false; a.pose = 'desk'; });
    } else if (a.kind === 'zina') {
      if (Math.random() < 0.5) run(a, [{ go: P.coffee }, { wait: 4, act: 'coffee' }, { go: P.zina }], () => { a.pose = 'desk'; });
      else run(a, [{ go: { x: 30, y: 62, dir: 'down' } }, { wait: 4, pose: 'crouch', act: 'safe' }, { do: () => say(a, 'Всё до копейки.') }, { go: P.zina }], () => { a.pose = 'desk'; });
    } else if (a.kind === 'mikh') {
      a.nextT = G.time + U.randi(6, 14);
      if (t < G.breakdownUntil) return;
      if (Math.random() < 0.15) run(a, [{ go: P.store }, { wait: 4, act: 'check' }, { do: () => say(a, G.rubber < 100 ? 'Резины кот наплакал…' : 'Резины пока хватает.') }, { go: P.press }]);
      else run(a, [{ go: { x: U.randi(120, 440), y: 278, dir: 'up' } }, { wait: U.randi(3, 7), act: 'check' }]);
    } else if (a.kind === 'valya') {
      a.nextT = G.time + 3;
      if (litter.length) {
        litter.sort((l1, l2) => U.dist(a.x, a.y, l1.x, l1.y) - U.dist(a.x, a.y, l2.x, l2.y));
        const l = litter[0];
        l.claimed = true;
        run(a, [{ go: { x: l.x + 6, y: l.y, dir: 'left' } }, { wait: 2, act: 'mop' }, { do: () => { litter = litter.filter(q => Math.abs(q.x - l.x) > 8 || Math.abs(q.y - l.y) > 8); } }]);
      } else if (Math.random() < 0.3) {
        run(a, [{ go: U.pick(Plan.HALL_SPOTS) }, { wait: U.randi(3, 8), act: 'mop' }]);
      }
    } else if (a.kind === 'galya') {
      if (!a.home) return;
      a.nextT = G.time + U.randi(30, 70);
      if (catHungry() && !cat.feeder && Math.random() < 0.5) { galyaFeed(); return; }
      run(a, [{ wait: 6, act: 'phone' }], () => {});
    }
  }

  /* ================= Сотрудники сами приходят к менеджеру ================= */
  function selfVisit() {
    if (G.visitor) return false;
    const cands = G.emps.filter(e => e.state === 'seated' && available(e));
    const pick = Content.pickVisit(cands);
    if (!pick) return false;
    const { e, r } = pick;
    G.visitor = e;
    e.visitReason = r;
    goOffice(e);
    say(e, Sim.stage(e) >= 3 ? 'БОСС!!! ИДУ К ВАМ!!!' : 'Пойду-ка к боссу…', 2);
    Sim.toast(U.fill(`{name} идёт к вам в кабинет: ${r.short}`, e), 'visit', () => UI.openDossier(e));
    Sfx.play('knock');
    return true;
  }

  /* Новый сотрудник выходит из лифта и идёт к своему столу */
  function arriveNew(e) {
    e.key = 'e' + e.uid; e.speed = 44; e.pose = 'stand';
    e.x = P.elevator.x; e.y = P.elevator.y + 2;
    e.state = 'walk'; e.purpose = 'desk'; e.newbie = true;
    World.openElevator();
    run(e, [{ secs: 0.4 }, { go: pt(Plan.seat(e.id), { dir: 'down' }) }], () => {
      Sim.arrive(e);
      say(e, U.pick(['Всем привет!', 'Где тут кофе?', 'Это мой стол? Ура!']), 2);
      Sim.toast(U.fill('{name} {вышел|вышла} на работу и сел{|а} за свой стол.', e), 'good', () => UI.openDossier(e));
    });
    say(e, U.fill('Здравствуйте! Я {новенький|новенькая}!', e), 2.5);
  }

  /* ================= Публичное ================= */
  function init() {
    staff = []; litter = []; srvLog = []; busy = {}; transit = []; vseq = 0;
    G.emps.forEach(e => { const s = Plan.seat(e.id); e.x = s.x; e.y = s.y; e.key = 'e' + e.uid; e.speed = 44; e.pose = 'stand'; e.hx = null; e.bubble = null; });
    mk('galya', P.galya.x, P.galya.y, { home: true, speed: 54 });
    mk('akhmet', P.akhmet.x, P.akhmet.y, { pose: 'desk', home: true });
    mk('zina', P.zina.x, P.zina.y, { pose: 'desk' });
    mk('mikh', P.press.x, P.press.y, { dir: 'up' });
    mk('valya', 170, 116, { speed: 34 });
    makeCat();
  }

  function minute() {
    const t = G.time;
    catBrain();
    staff.forEach(staffBrain);
    /* дела сотрудников */
    let away = G.emps.filter(e => e.state === 'errand').length;
    if (t < U.T(17, 40)) {
      for (const e of U.shuffle(G.emps.slice())) {
        if (away >= 3) break;
        if (e.state !== 'seated' || !available(e) || t < e.sleepUntil || e.activeClue) continue;
        const st = Sim.stage(e);
        const lazy = e.trait === 'lazy' && !e.lazyFixed;
        const p = st >= 3 ? 1 / 20 : lazy ? 1 / 38 : st === 2 ? 1 / 50 : 1 / 72;
        if (Math.random() >= p) continue;
        const type = pickErrand(e);
        if ((type === 'cooler' ? coolerChat(e) : errand(e, type))) away += type === 'cooler' ? 2 : 1;
      }
    }
    /* голодный кот: кто-нибудь покормит */
    if (catHungry() && !cat.feeder && Math.random() < 0.06) {
      const e = U.pick(G.emps.filter(o => o.state === 'seated' && available(o) && o.trait !== 'lazy'));
      if (e) errand(e, 'feed');
    }
    /* мусор от безумцев */
    for (const e of G.emps) {
      if (e.state === 'seated' && !e.gone && Sim.stage(e) >= 2 && Math.random() < 0.05) {
        const s = Plan.seat(e.id);
        addLitter(s.x + U.randi(-14, 14), s.y + 30, 'paper');
      }
    }
    /* посетитель устал ждать */
    const v = G.visitor;
    if (v && v.state === 'visit' && v.pendingTalk && t - (v.waitSince || t) > 35) {
      v.pendingTalk = false; v.visitReason = null; G.visitor = null;
      Sim.hurt(v, 8);
      Sim.toast(U.fill('{name} так и не дождал{ся|ась} приёма и {ушёл|ушла} обратно, обиженно сопя.', v), 'warn');
      backToDesk(v);
    }
  }

  function update(dt) {
    for (const e of G.emps) if (!e.gone) tick(e, dt);
    for (const a of staff.slice()) tick(a, dt);
    if (cat) tick(cat, dt);
  }

  return {
    init, minute, update, run, stop, errand, coolerChat, backToDesk, goOffice, leave, canCall, available, taskLabel,
    selfVisit, deliverDoc, arriveNew, galyaCoffee, courier, pizza, psySession, meeting, clickCat, catNear, catHungry, addLitter, litterNear,
    staff: () => staff, cat: () => cat, litter: () => litter, srvLog: () => srvLog, transit: () => transit,
    galya, akhmet, busy: () => busy,
  };
})();
