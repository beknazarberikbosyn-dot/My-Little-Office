'use strict';
/* Биржа начала 2000-х: пузырь доткомов, скандальная энергетика, облигации.
   Курсы и портфель переходят из дня в день, каждый день — свой сценарий с подсказками в газете */
const Market = (() => {
  const DEFS = [
    { id: 'QUAK', name: 'Кря Индастриз', price: 24.0, vol: 0.0035, drift: 0, own: true, desc: 'Наша компания. Торговать своими акциями нельзя — совет следит.' },
    { id: 'GOOS', name: 'ГусьКорп', price: 31.5, vol: 0.005, drift: 0.0002, desc: 'Главный конкурент. Растёт, когда у нас утечки.' },
    { id: 'UTKA', name: 'Утка.ком', price: 88.0, vol: 0.011, drift: 0.0022, desc: 'Интернет-магазин резиновых уток. «Новая экономика!» Прибыли нет.' },
    { id: 'ENGN', name: 'Энергон', price: 54.0, vol: 0.003, drift: 0.0005, desc: 'Энергетический гигант с рейтингом AAA. Очень сложная отчётность.' },
    { id: 'IBN', name: 'Ай-Би-Эн', price: 112.0, vol: 0.0022, drift: 0.0001, desc: 'Скучные надёжные компьютеры. Ничего интересного.' },
  ];
  const STATE_DESC = {
    burst: 'После краха: стоит копейки и бешено скачет. Иногда — слухи о покупателе.',
    bankrupt: 'Банкрот. Торги почти остановлены, курс — пыль.',
  };

  function init() {
    const t = {};
    for (const d of DEFS) t[d.id] = Object.assign({}, d, { open: d.price, hist: [d.price], shares: 0, cost: 0, state: 'normal' });
    t.UTKA.state = 'bubble'; t.ENGN.state = 'aaa';
    G.market = { t, bonds: 0, bondRate: 0.03, penny: 0, pennyWin: false, ev: [] };
  }

  /* Сценарий дня: обвалы, скачки и слухи, о которых заранее пишет газета */
  function plan() {
    const M = G.market, day = G.day, ev = [];
    const ut = M.t.UTKA, en = M.t.ENGN;
    if (ut.state === 'bubble') {
      if (U.chance(day === 1 ? 0.72 : 0.82)) ev.push({ id: 'UTKA', kind: 'crash', start: U.randi(U.T(13, 0), U.T(16, 20)), len: 26, rate: -0.07, warn: ['utka_warn1', 'utka_warn2'], hit: 'utka_pop' });
      else ev.push({ id: 'UTKA', kind: 'calm', start: U.T(14, 10), len: 0, rate: 0, hit: 'utka_ok' });
    } else if (ut.state === 'burst' && U.chance(0.4)) {
      ev.push({ id: 'UTKA', kind: 'spike', start: U.randi(U.T(13, 0), U.T(15, 40)), len: 16, rate: 0.032, warn: ['utka_bounce_rumor'], hit: 'utka_bounce' });
    }
    if (en.state === 'aaa') {
      if (U.chance(day === 1 ? 0.8 : 0.85)) ev.push({ id: 'ENGN', kind: 'crash', start: U.randi(U.T(12, 10), U.T(15, 30)), len: 22, rate: -0.095, warn: ['engn_warn1', 'engn_warn2'], hit: 'engn_crash' });
      else ev.push({ id: 'ENGN', kind: 'calm', start: U.T(13, 30), len: 0, rate: 0, hit: 'engn_ok' });
    }
    if (U.chance(0.55)) {
      const up = U.chance(0.55);
      ev.push({ id: 'IBN', kind: up ? 'spike' : 'slump', start: U.randi(U.T(13, 20), U.T(16, 10)), len: 18, rate: up ? 0.006 : -0.006, warn: [up ? 'ibn_rumor_up' : 'ibn_rumor_down'], hit: up ? 'ibn_up' : 'ibn_down' });
    }
    if (day > 1 && U.chance(0.3)) ev.push({ id: 'GOOS', kind: 'slump', start: U.randi(U.T(13, 0), U.T(16, 30)), len: 16, rate: -0.009, warn: ['goos_rumor_down'], hit: 'goos_down' });
    return ev;
  }

  /* Утро нового дня: вчерашние события меняют судьбу бумаг */
  function newDay() {
    const M = G.market;
    for (const ev of M.ev || []) {
      const k = M.t[ev.id];
      if (ev.kind === 'crash' && ev.id === 'UTKA') { k.state = 'burst'; k.drift = 0; k.vol = 0.016; k.desc = STATE_DESC.burst; }
      if (ev.kind === 'crash' && ev.id === 'ENGN') { k.state = 'bankrupt'; k.price = Math.max(0.05, k.price * 0.18); k.drift = -0.0004; k.vol = 0.004; k.desc = STATE_DESC.bankrupt; }
    }
    if (M.t.UTKA.state === 'bubble') M.t.UTKA.drift = 0.0015;
    for (const id in M.t) {
      const k = M.t[id];
      /* ночные торги: небольшой гэп */
      if (id !== 'QUAK') k.price = Math.max(0.05, k.price * Math.exp(k.vol * 3 * U.gauss()));
      k.open = k.price;
      k.hist = k.hist.slice(-120); k.hist.push(k.price);
      k.boost = 0;
    }
    M.bonds = 0; M.penny = 0; M.pennyWin = U.chance(0.15);
    M.bondsDone = 0; M.pennyDone = 0; M.pennyResult = 0;
    M.ev = plan();
  }

  function tick(min) {
    const M = G.market;
    for (const id in M.t) {
      const k = M.t[id];
      let d = k.drift + k.vol * U.gauss();
      for (const ev of M.ev) {
        if (ev.id === id && ev.len && min >= ev.start && min < ev.start + ev.len) d = ev.rate + k.vol * 0.6 * U.gauss();
      }
      if (k.boost) { d += k.boost; k.boost *= 0.9; if (Math.abs(k.boost) < 0.0002) k.boost = 0; }
      k.price = Math.max(0.05, k.price * Math.exp(d));
      k.hist.push(k.price);
      if (k.hist.length > 240) k.hist.shift();
    }
  }
  const happened = (id, kind) => (G.market.ev || []).some(e => e.id === id && e.kind === kind);

  /* Мгновенный скачок цены в процентах */
  function jump(id, pct) {
    const k = G.market.t[id];
    if (!k) return;
    k.price = Math.max(0.05, k.price * (1 + pct / 100));
    k.hist.push(k.price);
  }
  function drift(id, d) { const k = G.market.t[id]; if (k) k.boost = (k.boost || 0) + d; }

  function buy(id, dollars) {
    const k = G.market.t[id];
    if (!k || k.own) return 0;
    const n = Math.floor(Math.min(dollars, G.cash) / k.price);
    if (n <= 0) return 0;
    const cost = n * k.price;
    Sim.money(-cost, 'invest');
    k.shares += n; k.cost += cost;
    G.flags['bought_' + id] = true;
    return n;
  }
  function sell(id, frac = 1) {
    const k = G.market.t[id];
    if (!k || !k.shares) return 0;
    const n = frac >= 1 ? k.shares : Math.max(1, Math.floor(k.shares * frac));
    const got = n * k.price;
    k.cost -= k.cost * (n / k.shares);
    k.shares -= n;
    Sim.money(got, 'invest');
    return got;
  }
  function buyBonds(amount) {
    if (G.cash < amount) return false;
    Sim.money(-amount, 'invest');
    G.market.bonds += amount;
    return true;
  }
  function stocksValue() {
    let v = 0;
    for (const id in G.market.t) v += G.market.t[id].shares * G.market.t[id].price;
    return v;
  }
  function invested() {
    let v = 0;
    for (const id in G.market.t) v += G.market.t[id].cost;
    return v;
  }
  const value = () => stocksValue() + G.market.bonds + G.market.penny;

  /* Сохранение между сессиями */
  function save() {
    const t = {};
    for (const id in G.market.t) {
      const k = G.market.t[id];
      t[id] = { price: k.price, open: k.open, hist: k.hist.slice(-120), shares: k.shares, cost: k.cost, state: k.state, drift: k.drift, vol: k.vol, desc: k.desc };
    }
    const M = G.market;
    return { t, ev: M.ev, bonds: M.bonds, penny: M.penny, pennyWin: M.pennyWin, bondRate: M.bondRate, bondsDone: M.bondsDone, pennyDone: M.pennyDone, pennyResult: M.pennyResult };
  }
  function load(o) {
    init();
    for (const id in o.t) if (G.market.t[id]) Object.assign(G.market.t[id], o.t[id]);
    G.market.ev = o.ev || [];
    ['bonds', 'penny', 'pennyWin', 'bondRate', 'bondsDone', 'pennyDone', 'pennyResult'].forEach(k => { if (o[k] !== undefined) G.market[k] = o[k]; });
  }

  return { init, newDay, plan, tick, jump, drift, buy, sell, buyBonds, stocksValue, invested, value, happened, save, load };
})();
