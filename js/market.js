'use strict';
/* Биржа начала 2000-х: пузырь доткомов, скандальная энергетика, облигации */
const Market = (() => {
  const DEFS = [
    { id: 'QUAK', name: 'Кря Индастриз', price: 24.0, vol: 0.0035, drift: 0, own: true, desc: 'Наша компания. Торговать своими акциями нельзя — совет следит.' },
    { id: 'GOOS', name: 'ГусьКорп', price: 31.5, vol: 0.005, drift: 0.0002, desc: 'Главный конкурент. Растёт, когда у нас утечки.' },
    { id: 'UTKA', name: 'Утка.ком', price: 88.0, vol: 0.011, drift: 0.0022, desc: 'Интернет-магазин резиновых уток. «Новая экономика!» Прибыли нет.' },
    { id: 'ENGN', name: 'Энергон', price: 54.0, vol: 0.003, drift: 0.0005, desc: 'Энергетический гигант с рейтингом AAA. Очень сложная отчётность.' },
    { id: 'IBN', name: 'Ай-Би-Эн', price: 112.0, vol: 0.0022, drift: 0.0001, desc: 'Скучные надёжные компьютеры. Ничего интересного.' },
  ];

  function init() {
    const t = {};
    for (const d of DEFS) {
      t[d.id] = Object.assign({}, d, { open: d.price, hist: [d.price], shares: 0, cost: 0, crash: null });
    }
    if (U.chance(0.72)) t.UTKA.crash = { start: U.randi(U.T(13, 0), U.T(16, 20)), len: 26, rate: -0.07 };
    if (U.chance(0.8)) t.ENGN.crash = { start: U.randi(U.T(12, 10), U.T(15, 30)), len: 22, rate: -0.095 };
    G.market = { t, bonds: 0, bondRate: 0.03, penny: 0, pennyWin: U.chance(0.15) };
  }

  function tick(min) {
    const M = G.market;
    for (const id in M.t) {
      const k = M.t[id];
      let d = k.drift + k.vol * U.gauss();
      if (k.crash && min >= k.crash.start && min < k.crash.start + k.crash.len) {
        d = k.crash.rate + k.vol * 0.6 * U.gauss();
      }
      if (k.boost) { d += k.boost; k.boost *= 0.9; if (Math.abs(k.boost) < 0.0002) k.boost = 0; }
      k.price = Math.max(0.05, k.price * Math.exp(d));
      k.hist.push(k.price);
      if (k.hist.length > 240) k.hist.shift();
    }
  }

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

  return { init, tick, jump, drift, buy, sell, buyBonds, stocksValue, invested, value };
})();
