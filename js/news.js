'use strict';
/* Газета «Утренний Кряк»: заметки, пиксельные иллюстрации и вёрстка полосы */
const News = (() => {
  /* ---------- Иллюстрации 96×56, рисуются кодом ---------- */
  const AW = 96, AH = 56;
  const cache = {};
  let g = null;
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  function disc(cx, cy, rad, c) { for (let y = -rad; y <= rad; y++) { const w = Math.round(Math.sqrt(rad * rad - y * y)); r(cx - w, cy + y, w * 2 + 1, 1, c); } }
  function ring(cx, cy, rad, c) { for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; r(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, 1, 1, c); } }
  function bands(cols, y0 = 0, y1 = AH) { const h = (y1 - y0) / cols.length; cols.forEach((c, i) => r(0, y0 + i * h, AW, Math.ceil(h), c)); }
  function duck(x, y, s = 2, flip) {
    g.save();
    if (flip) { g.translate(x + 10 * s, y); g.scale(-1, 1); g.drawImage(Spr.DUCK, 0, 0, 10 * s, 9 * s); }
    else g.drawImage(Spr.DUCK, x, y, 10 * s, 9 * s);
    g.restore();
  }
  function person(x, y, look, o) { const prev = Spr.ctx(); Spr.use(g); Spr.person(x, y, look, o || {}); Spr.use(prev); }
  function line(pts, c, th = 1) {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) r(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, th, th, c);
    }
  }
  function goose(x, y, s = 1) {
    const W = '#f4f4f0', S = '#c8c8cc', O = '#ff8a1c';
    r(x + 8 * s, y, 4 * s, 4 * s, W); r(x + 12 * s, y + 1 * s, 4 * s, 2 * s, O); r(x + 10 * s, y + 1 * s, 1 * s, 1 * s, '#111');
    r(x + 8 * s, y + 4 * s, 3 * s, 8 * s, W);
    r(x, y + 10 * s, 14 * s, 7 * s, W); r(x + 1 * s, y + 15 * s, 12 * s, 2 * s, S); r(x - 2 * s, y + 9 * s, 4 * s, 3 * s, W);
    r(x + 4 * s, y + 17 * s, 1 * s, 3 * s, O); r(x + 9 * s, y + 17 * s, 1 * s, 3 * s, O);
    r(x + 7 * s, y + 8 * s, 6 * s, 1 * s, '#2a2a30'); r(x + 9 * s, y + 9 * s, 2 * s, 3 * s, '#ff8a1c');
  }
  function bills(x, y, n) { for (let i = 0; i < n; i++) { r(x, y - i * 3, 22, 3, '#5cb85c'); r(x, y - i * 3, 22, 1, '#8ad88a'); r(x + 9, y - i * 3 + 1, 4, 1, '#2e7d32'); } }
  function screen(x, y, w, h) { r(x - 2, y - 2, w + 4, h + 4, '#3a3a40'); r(x, y, w, h, '#071209'); for (let yy = y; yy < y + h; yy += 2) r(x, yy, w, 1, 'rgba(0,0,0,0.25)'); }

  const ART = {
    rocket() {
      bands(['#1f2a5a', '#2c3e7a', '#3b5aa8', '#5a7ac8']);
      for (let i = 0; i < 18; i++) r((i * 37) % AW, (i * 23) % 30, 1, 1, '#ffffff');
      line([[4, 50], [20, 44], [32, 46], [46, 34], [58, 36], [72, 20], [86, 8]], '#5dff7a', 2);
      r(82, 6, 8, 2, '#5dff7a'); r(86, 6, 2, 8, '#5dff7a');
      r(54, 18, 16, 8, '#e8e8f0'); r(70, 19, 4, 6, '#d23c3c'); r(50, 20, 4, 4, '#ff8a1c'); r(46, 21, 4, 2, '#ffd23f');
      duck(56, 8, 1.6);
    },
    pop() {
      bands(['#f6c48a', '#f2a878', '#e08a6a', '#b06a7a']);
      ring(48, 28, 20, '#ffffff'); ring(48, 28, 19, '#d8f2fa');
      [[0, -26], [18, -18], [26, 0], [18, 18], [0, 26], [-18, 18], [-26, 0], [-18, -18]].forEach(([dx, dy]) => { r(48 + dx * 1.1, 28 + dy * 1.0, 3, 3, '#ffffff'); r(48 + dx * 1.35, 28 + dy * 1.2, 2, 2, '#ffe9b8'); });
      duck(38, 18, 2);
      line([[8, 6], [24, 30], [40, 40], [56, 46], [90, 52]], '#c0221a', 2);
    },
    chart_up() { screen(8, 6, 80, 44); line([[10, 44], [24, 40], [34, 42], [46, 30], [56, 32], [68, 18], [84, 10]], '#5dff7a', 2); r(80, 8, 6, 2, '#5dff7a'); },
    chart_down() { screen(8, 6, 80, 44); line([[10, 12], [22, 14], [32, 22], [42, 20], [54, 32], [66, 34], [84, 46]], '#ff5a5a', 2); r(80, 44, 6, 2, '#ff5a5a'); r(82, 40, 2, 6, '#ff5a5a'); },
    tower() {
      bands(['#9aa6b8', '#b0bac8', '#c8ced8']);
      r(0, 44, AW, 12, '#6a7058');
      [[18, 14], [44, 10]].forEach(([x, y]) => { r(x, y, 18, 34, '#d8d8d0'); r(x + 2, y, 14, 34, '#e8e8e0'); r(x - 2, y + 30, 22, 4, '#c8c8c0'); disc(x + 9, y - 4, 7, 'rgba(255,255,255,0.75)'); disc(x + 15, y - 9, 6, 'rgba(255,255,255,0.6)'); });
      r(70, 18, 4, 26, '#555'); line([[72, 18], [62, 28]], '#555'); line([[72, 18], [82, 28]], '#555'); line([[64, 30], [92, 30]], '#333');
      r(76, 4, 14, 8, '#ffd23f'); r(78, 6, 10, 4, '#2c3e7a');
    },
    shredder() {
      bands(['#2a1a20', '#3a2228']);
      r(26, 14, 44, 18, '#4a4e58'); r(26, 14, 44, 3, '#6a707a'); r(30, 30, 36, 3, '#222');
      for (let i = 0; i < 9; i++) { r(31 + i * 4, 33, 2, 10 + (i * 7) % 9, '#f4f0e4'); }
      r(38, 4, 20, 12, '#fff'); r(40, 6, 16, 1, '#999'); r(40, 9, 12, 1, '#999'); r(54, 12, 3, 2, '#d23c3c');
      r(4, 4, 8, 8, '#d23c3c'); r(84, 4, 8, 8, '#d23c3c'); r(6, 6, 4, 4, '#ff8a7a'); r(86, 6, 4, 4, '#ff8a7a');
      for (let i = 0; i < 6; i++) r(8 + i * 15, 48 + (i % 2) * 3, 6, 2, '#f4f0e4');
    },
    goose() {
      bands(['#2f6a6a', '#3a7a78', '#4a8a86']);
      r(0, 46, AW, 10, '#2a4a3a');
      person(68, 50, Content.SP.goose.look, { mood: 'happy' });
      goose(16, 18, 1.4);
      r(44, 8, 8, 8, '#ffd23f'); r(46, 10, 4, 4, '#ff8a1c');
    },
    bank() {
      bands(['#bfe0f0', '#d8eef8']);
      r(14, 14, 68, 6, '#e8e2d0'); line([[14, 14], [48, 4], [82, 14]], '#c8c0aa', 2);
      for (let i = 0; i < 6; i++) { r(18 + i * 11, 20, 6, 24, '#f4f0e4'); r(18 + i * 11, 20, 1, 24, '#fff'); r(23 + i * 11, 20, 1, 24, '#c8c0aa'); }
      r(12, 44, 72, 4, '#c8c0aa'); r(8, 48, 80, 8, '#a8a090');
      r(44, 8, 8, 4, '#d4a017');
    },
    cpu() {
      bands(['#3a4a6a', '#4a5a7a']);
      r(0, 44, AW, 12, '#6b4226');
      r(22, 8, 40, 30, '#d8d0bc'); r(26, 12, 32, 22, '#1a3a7a'); r(28, 14, 20, 2, '#ffffff'); r(28, 18, 26, 1, '#8fd3ff'); r(28, 21, 16, 1, '#8fd3ff');
      r(36, 38, 12, 4, '#b3aa93'); r(18, 44, 50, 6, '#d8d0bc'); r(20, 46, 46, 1, '#b3aa93');
      r(68, 26, 16, 16, '#2a2a30'); r(70, 28, 12, 6, '#8a909a'); r(74, 36, 4, 4, '#555');
      line([[70, 6], [76, 2], [82, 6], [88, 2]], '#5dff7a', 2);
    },
    spy() {
      r(0, 0, AW, AH, '#14161c');
      disc(48, 40, 26, '#2a2e3a'); disc(48, 40, 18, '#343a48');
      person(48, 54, { skin: '#d9a47a', hair: '#1b1b22', hairStyle: 'short', shirt: '#222', tie: '#111', pants: '#111', jacket: '#1b1b22', glasses: true }, { mood: 'normal' });
      r(40, 28, 17, 2, '#111'); r(43, 22, 11, 7, '#111'); r(43, 27, 11, 1, '#5a1a1a');
      r(18, 30, 10, 7, '#3a3a40'); r(20, 32, 6, 3, '#6a8aa8'); r(28, 32, 2, 3, '#3a3a40');
      r(68, 34, 8, 8, '#2a2a30'); r(69, 35, 6, 3, '#e8e8e0');
    },
    raid() {
      r(0, 0, AW, AH, '#1a1e2a');
      r(0, 38, AW, 18, '#3a3a40');
      r(10, 28, 34, 12, '#e8e8f0'); r(14, 24, 22, 6, '#e8e8f0'); r(16, 25, 8, 4, '#8fd3ff'); r(26, 25, 8, 4, '#8fd3ff'); r(14, 38, 6, 4, '#111'); r(34, 38, 6, 4, '#111');
      r(18, 21, 6, 3, '#ff3a3a'); r(26, 21, 6, 3, '#3a6aff');
      disc(21, 22, 6, 'rgba(255,60,60,0.25)'); disc(29, 22, 6, 'rgba(60,100,255,0.25)');
      r(56, 10, 30, 28, '#d4a017'); r(58, 12, 26, 24, '#ffd23f'); disc(71, 24, 8, '#d4a017'); r(68, 21, 6, 6, '#ffd23f');
      bills(58, 50, 2);
    },
    kids() {
      bands(['#a6d8ff', '#bfe4ff']);
      r(10, 30, 76, 20, '#ffffff'); r(10, 30, 76, 3, '#e8e8f0'); r(14, 33, 68, 10, '#6ab8e8'); r(14, 33, 68, 2, '#8fd3ff');
      duck(18, 27, 1.4); duck(38, 26, 1.6, true); duck(60, 27, 1.4);
      [[24, 10], [46, 6], [70, 12]].forEach(([x, y]) => { r(x, y, 3, 3, '#e86a9a'); r(x + 4, y, 3, 3, '#e86a9a'); r(x + 1, y + 3, 5, 2, '#e86a9a'); r(x + 2, y + 5, 3, 1, '#e86a9a'); });
      r(10, 50, 6, 6, '#c8c8d0'); r(80, 50, 6, 6, '#c8c8d0');
    },
    tape() {
      bands(['#5a3a4a', '#6a4a5a']);
      r(16, 12, 64, 34, '#2a2a30'); r(18, 14, 60, 30, '#3a3a44');
      r(24, 18, 48, 16, '#e8e2d0'); disc(36, 26, 5, '#2a2a30'); disc(60, 26, 5, '#2a2a30'); disc(36, 26, 2, '#e8e2d0'); disc(60, 26, 2, '#e8e2d0');
      r(24, 38, 8, 4, '#d23c3c'); r(36, 38, 8, 4, '#555'); r(48, 38, 8, 4, '#555'); r(84, 6, 6, 6, '#d23c3c');
    },
    duck() {
      bands(['#8fc7e8', '#a6d8ff', '#c8e8ff']);
      r(0, 40, AW, 16, '#6b7380');
      r(56, 18, 34, 24, '#8a4a2a'); r(56, 18, 34, 3, '#a85a3a'); r(76, 4, 8, 16, '#6a3a20');
      disc(80, 2, 4, 'rgba(255,255,255,0.8)'); disc(86, -2, 4, 'rgba(255,255,255,0.6)');
      for (let i = 0; i < 3; i++) r(60 + i * 9, 26, 6, 6, '#ffd86a');
      duck(8, 14, 3.4);
    },
    board() {
      r(0, 0, AW, AH, '#3a2418');
      for (let x = 0; x < AW; x += 16) r(x + 2, 2, 12, 30, '#43291b');
      [14, 32, 48, 64, 82].forEach((x, i) => person(x, 44, [Content.SP.founder.look, { skin: '#f1c9a5', hair: '#7a7a7a', hairStyle: 'bun', shirt: '#fff', jacket: '#7a2c3a', pants: '#333', female: true, glasses: true }, { skin: '#eec39a', hair: '#1b1b22', hairStyle: 'short', shirt: '#fff', tie: '#111', pants: '#111', jacket: '#16181c', glasses: true }, { skin: '#d9a47a', hair: '#a8432a', hairStyle: 'spiky', shirt: '#f3e2a0', tie: '#1f6f4a', pants: '#4b3a2e', jacket: '#5a4632' }, { female: true, skin: '#c08a5e', hair: '#2b1d14', hairStyle: 'long', shirt: '#f0b9c4', pants: '#555' }][i], { mood: i === 2 ? 'happy' : 'normal' }));
      r(0, 40, AW, 16, '#6e3a1e'); r(0, 40, AW, 1, '#9a5a30'); duck(43, 33, 1);
    },
    hire() {
      bands(['#e8dcc0', '#f3ead6']);
      r(10, 6, 34, 44, '#fbf6e8'); r(10, 6, 34, 1, '#ddd'); r(14, 10, 12, 14, '#8fc7e8');
      person(20, 38, { skin: '#f1c9a5', hair: '#4a2f1c', hairStyle: 'bob', shirt: '#a9c8e8', pants: '#333', female: true }, { mood: 'happy', noLegs: true });
      for (let i = 0; i < 5; i++) r(14, 28 + i * 4, 26 - (i % 2) * 8, 1, '#a09a88');
      r(30, 10, 10, 2, '#6a5a48'); r(30, 14, 8, 1, '#a09a88');
      r(54, 20, 34, 18, '#3fa34d'); r(56, 22, 30, 14, '#5dc86a'); line([[60, 30], [66, 34], [80, 24]], '#ffffff', 2);
    },
    pond() {
      bands(['#a6d8ff', '#c8e8ff']);
      r(0, 30, AW, 26, '#3a7aa8'); for (let i = 0; i < 8; i++) r(6 + i * 12, 36 + (i % 3) * 5, 6, 1, '#8fd3ff');
      r(0, 26, AW, 4, '#4a9e42');
      duck(30, 6, 4);
      person(84, 30, { skin: '#d9a47a', hair: '#7a7a7a', hairStyle: 'short', shirt: '#7a8a5a', pants: '#4b3a2e', cap: '#4a5a3a' }, { mood: 'normal' });
    },
    money() { bands(['#2a4a2a', '#2f5a30']); bills(12, 46, 9); bills(40, 46, 12); bills(68, 46, 7); r(46, 4, 10, 10, '#ffd23f'); r(50, 6, 2, 6, '#2e7d32'); },
    storm() {
      bands(['#3a3f4a', '#4a505a', '#5a606a']);
      [[20, 10, 12], [40, 6, 14], [64, 10, 12]].forEach(([x, y, s]) => disc(x, y, s, '#2a2e36'));
      line([[50, 16], [44, 28], [52, 28], [44, 44]], '#ffd23f', 2);
      r(10, 40, 18, 16, '#2a2a30'); r(30, 34, 14, 22, '#22222a'); r(62, 38, 20, 18, '#2a2a30');
      for (let i = 0; i < 14; i++) r((i * 29) % AW, 18 + (i * 13) % 30, 1, 4, '#8fd3ff');
    },
    cat() {
      bands(['#f3e2a0', '#f8ecc0']);
      r(0, 40, AW, 16, '#c9a06a');
      const prev = Spr.ctx(); Spr.use(g); g.save(); g.translate(48, 44); g.scale(3, 3); Spr.cat(0, 0, 'sit', false, 0); g.restore(); Spr.use(prev);
      r(70, 40, 14, 6, '#c0392b');
    },
  };
  function art(key) {
    if (!ART[key]) key = 'duck';
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = AW; cv.height = AH;
    g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    try { ART[key](); } catch (e) { r(0, 0, AW, AH, '#888'); }
    cache[key] = cv.toDataURL();
    return cache[key];
  }

  /* ---------- Заметки ---------- */
  /* sig: что эта новость значит для бумаги tick — выводится крупной плашкой */
  const T = {
    utka_hype: () => ({ head: 'Утка.ком: +300% за год', lede: 'Интернет-магазин резиновых уток стоит дороже всей нашей фабрики. Прибыли у него нет. «Это новая экономика!» — кричат брокеры.', img: 'rocket', tag: 'Биржа', tick: 'UTKA', sig: 'hype' }),
    engn_aaa: () => ({ head: 'Энергону дали рейтинг AAA', lede: 'Аудитор «Андерсенко и Ко» хвалит прозрачность отчётов. Правда, понять эти отчёты пока никто не смог.', img: 'tower', tag: 'Биржа', tick: 'ENGN', sig: 'calm' }),
    goos_promise: () => ({ head: 'ГусьКорп обещает «революционную пищалку»', lede: 'Откуда у конкурента технологии — загадка. Наши инженеры подозрительно переглядываются.', img: 'goose', tag: 'Конкуренты', tick: 'GOOS' }),
    utka_warn1: () => ({ head: 'Утка.ком продаёт уток дешевле, чем покупает', lede: 'Каждая проданная утка приносит убыток. Аналитики в недоумении, акционеры — в эйфории. Пока что.', img: 'chart_down', tag: 'Тревога', tick: 'UTKA', sig: 'risk', tone: 'warn' }),
    utka_warn2: () => ({ head: 'Утка.ком спустила годовой бюджет на рекламу', lede: 'Ролик во время Суперкубка стоил больше, чем компания заработала за всю историю. Крупные фонды тихо продают акции.', img: 'storm', tag: 'Тревога', tick: 'UTKA', sig: 'risk', tone: 'warn' }),
    utka_pop: () => ({ head: 'ПУЗЫРЬ ЛОПНУЛ: Утка.ком обвалилась', lede: 'Инвесторы кидаются клавиатурами. Кто не продал утром — держит в руках воздух.', img: 'pop', tag: 'Обвал', tick: 'UTKA', sig: 'crash', tone: 'bad', big: true }),
    utka_ok: () => ({ head: 'Утка.ком снова растёт', lede: 'Скептики посрамлены, сайт сверкает. Сколько продлится праздник — не знает никто.', img: 'rocket', tag: 'Биржа', tick: 'UTKA', sig: 'hype' }),
    utka_bottom: () => ({ head: 'Утка.ком после обвала: дно или подвал?', lede: 'Акции стоят как пачка жвачки. Одни видят шанс, другие — бездну. Курс прыгает в обе стороны.', img: 'chart_down', tag: 'Биржа', tick: 'UTKA', sig: 'risk' }),
    utka_bounce_rumor: () => ({ head: 'Слух: Утку.ком хочет купить телеком-гигант', lede: 'Источники говорят о сделке во второй половине дня. Если слух подтвердится — акции подскочат.', img: 'rocket', tag: 'Слухи', tick: 'UTKA', sig: 'up' }),
    utka_bounce: () => ({ head: 'Утка.ком: сделка подтверждена, акции взлетели', lede: 'Покупатель нашёлся. Те, кто купил на дне, празднуют.', img: 'chart_up', tag: 'Биржа', tick: 'UTKA', sig: 'up', tone: 'good', big: true }),
    engn_warn1: () => ({ head: 'В Энергоне круглосуточно работают шредеры', lede: 'Пресс-служба: «Это для экологии». Соседи жалуются на шум и бумажный снег.', img: 'shredder', tag: 'Тревога', tick: 'ENGN', sig: 'risk', tone: 'warn' }),
    engn_warn2: () => ({ head: 'Финдиректор Энергона продал все свои акции', lede: '«Просто захотелось домик у моря», — объяснил он, садясь в вертолёт с чемоданом.', img: 'money', tag: 'Тревога', tick: 'ENGN', sig: 'risk', tone: 'warn' }),
    engn_crash: () => ({ head: 'СКАНДАЛ: Энергон годами рисовал прибыль', lede: 'Акции рухнули. Аудиторы ищут шредер побольше, прокуратура — аудиторов.', img: 'shredder', tag: 'Обвал', tick: 'ENGN', sig: 'crash', tone: 'bad', big: true }),
    engn_ok: () => ({ head: 'Энергон отчитался о рекордной прибыли', lede: 'Как именно получились эти цифры — никто не понял. Но они очень большие.', img: 'tower', tag: 'Биржа', tick: 'ENGN', sig: 'calm' }),
    engn_bankrupt: () => ({ prio: 2, head: 'Энергон объявил о банкротстве', lede: 'Торги акциями почти остановлены. Сотрудники выносят из офиса фикусы и шредеры.', img: 'shredder', tag: 'Биржа', tick: 'ENGN', sig: 'crash', tone: 'bad' }),
    ibn_rumor_up: () => ({ head: 'Слух: Ай-Би-Эн готовит рекордный отчёт', lede: 'Инсайдеры шепчутся о новом компьютере «Утка-486». Отчёт опубликуют после обеда.', img: 'cpu', tag: 'Слухи', tick: 'IBN', sig: 'up' }),
    ibn_up: () => ({ head: 'Ай-Би-Эн: рекордная прибыль', lede: 'Скучная компания внезапно всех удивила. Акции растут, брокеры жуют галстуки.', img: 'chart_up', tag: 'Биржа', tick: 'IBN', sig: 'up', tone: 'good', big: true }),
    ibn_rumor_down: () => ({ head: 'Слух: на складе Ай-Би-Эн сгорели дискеты', lede: 'Компания молчит. Аналитики ждут плохой квартальный отчёт во второй половине дня.', img: 'storm', tag: 'Слухи', tick: 'IBN', sig: 'down', tone: 'warn' }),
    ibn_down: () => ({ head: 'Ай-Би-Эн разочаровал рынок', lede: 'Отчёт хуже ожиданий. Акции скучной компании впервые за год стали нескучными — вниз.', img: 'chart_down', tag: 'Биржа', tick: 'IBN', sig: 'down', tone: 'bad', big: true }),
    goos_rumor_down: () => ({ head: 'Слух: пищалки ГусьКорп не пищат', lede: 'Покупатели жалуются. Говорят, к вечеру компания объявит отзыв целой партии.', img: 'goose', tag: 'Слухи', tick: 'GOOS', sig: 'down', tone: 'warn' }),
    goos_down: () => ({ head: 'ГусьКорп отзывает партию пищалок', lede: 'Пищалки вместо «пи» говорят «га». Акции конкурента падают.', img: 'goose', tag: 'Конкуренты', tick: 'GOOS', sig: 'down', tone: 'good', big: true }),
    bonds: () => ({ head: 'Облигации: +3% к вечеру, как всегда', lede: 'Государство платит по долгам. Скучно, зато надёжно — деньги вернутся в 18:00 с процентами.', img: 'bank', tag: 'Финансы', tick: 'ОБЛ', sig: 'safe' }),
    leak: () => ({ head: 'ГусьКорп снова опередила «Кря Индастриз»', lede: 'Конкурент выпустил то, что мы только разрабатывали. Совпадение? Аналитики сомневаются: в офисе «Кря» кто-то сливает секреты.', img: 'spy', tag: 'Утечка', tick: 'QUAK', sig: 'bad', tone: 'bad', big: true }),
    fake_blueprint: () => ({ head: 'Пищалка ГусьКорп играет гимн «Кря Индастриз»', lede: 'Конкурент выпустил игрушку по чертежам, которые оказались фальшивыми. Конфуз века.', img: 'goose', tag: 'Конкуренты', tick: 'GOOS', sig: 'down', tone: 'good', big: true }),
    double_agent: () => ({ head: 'Новая пищалка ГусьКорп мычит', lede: 'Покупатели в недоумении, акции конкурента падают. В «Кря Индастриз» загадочно улыбаются.', img: 'goose', tag: 'Конкуренты', tick: 'GOOS', sig: 'down', tone: 'good' }),
    spy_caught: () => ({ head: '«Кря Индастриз» поймала шпиона ГусьКорп', lede: 'Промышленный шпион покинул здание с коробкой. ГусьКорп всё отрицает и нервно крякает.', img: 'spy', tag: 'Компания', tick: 'QUAK', sig: 'good', tone: 'good', big: true }),
    raid: () => ({ head: 'Обыск в «Кря Индастриз»!', lede: 'Комиссия по ценным бумагам нагрянула в офис. Свидетели говорят о горнах, летающих деньгах и обезьянке в пиджаке.', img: 'raid', tag: 'Скандал', tick: 'QUAK', sig: 'bad', tone: 'bad', big: true }),
    charity: () => ({ head: 'Утки для детского дома №7', lede: '«Кря Индастриз» подарила детям 200 резиновых уток. Дети счастливы, утки тоже.', img: 'kids', tag: 'Компания', tick: 'QUAK', sig: 'good', tone: 'good' }),
    goose_exposed: () => ({ head: 'Глава ГусьКорп пытался подкупить менеджера «Кря»', lede: 'Запись разговора уже в редакции. «Га-га» — единственный комментарий Г. Гусева.', img: 'tape', tag: 'Скандал', tick: 'GOOS', sig: 'down', tone: 'good', big: true }),
    /* утренние: последствия вчерашнего дня */
    recap: c => ({ prio: 2, head: c.ok ? `«Кря Индастриз» выпустила ${c.ducks} уток — план выполнен` : `«Кря Индастриз»: ${c.ducks} уток вместо ${c.plan}`, lede: c.ok ? 'Конвейер вчера пел, как соловей. Акции компании чувствуют себя уверенно.' : 'Вчера конвейер больше стоял, чем ехал. Совет директоров хмурится.', img: 'duck', tag: 'Компания', tick: 'QUAK', sig: c.ok ? 'good' : 'bad', tone: c.ok ? 'good' : 'warn' }),
    verdict_promo: c => ({ prio: 1, head: `Менеджер «Кря» повышен до должности «${c.rank}»`, lede: 'Совет директоров единогласен. Но и план у компании теперь больше.', img: 'board', tag: 'Карьера', tick: 'QUAK', sig: 'good', tone: 'good' }),
    verdict_fine: () => ({ prio: 2, head: 'Совет директоров оштрафовал менеджера «Кря»', lede: 'Источники говорят: ещё один провальный день — и в кабинете сменится табличка.', img: 'board', tag: 'Карьера', tone: 'warn' }),
    utka_aftermath: () => ({ prio: 2, head: 'Утка.ком: вчерашний обвал, сегодняшнее похмелье', lede: 'Кто купил на пике, тот теперь держит акции по цене пачки жвачки.', img: 'pop', tag: 'Биржа', tick: 'UTKA', sig: 'risk' }),
    goose_suit: () => ({ prio: 3, head: 'Гусев подал в суд на «Кря Индастриз»', lede: 'Глава ГусьКорп требует компенсацию «за моральный ущерб» после публикации записи. Юристы смеются.', img: 'goose', tag: 'Суд', tick: 'GOOS', tone: 'warn' }),
    raid_followup: () => ({ prio: 3, head: 'Комиссия выписала «Кря» предписание', lede: 'После вчерашнего обыска компания обязана заплатить штраф. Бумага уже едет в офис.', img: 'raid', tag: 'Скандал', tick: 'QUAK', sig: 'bad', tone: 'bad' }),
    bribe_rumor: () => ({ prio: 3, head: 'Слух: менеджер «Кря» берёт конверты?', lede: 'Источник в ГусьКорп хвастается «полезными связями». Служба безопасности «Кря» начала проверку.', img: 'money', tag: 'Скандал', tick: 'QUAK', sig: 'bad', tone: 'bad' }),
    innocent: c => ({ prio: 2, head: `Уволенный сотрудник «Кря» жалуется в газету`, lede: `«Меня уволили ни за что!» — говорит ${c.name}. В офисе шепчутся, моральный дух падает.`, img: 'storm', tag: 'Компания', tick: 'QUAK', tone: 'warn' }),
    hiring: c => ({ prio: 1, head: `«Кря Индастриз» ищет сотрудников: ${c.n} ${c.n === 1 ? 'вакансия' : 'вакансии'}`, lede: 'Резюме кандидатов уже поступают. Говорят, ГусьКорп тоже рассылает своих «кандидатов».', img: 'hire', tag: 'Кадры', tone: 'neutral' }),
    goose_recruit: () => ({ head: 'ГусьКорп ищет «друзей» в «Кря Индастриз»', lede: 'По слухам, конкурент переманивает недовольных сотрудников. Следите, кто фотографирует чертежи.', img: 'spy', tag: 'Конкуренты', tick: 'GOOS', sig: 'risk', tone: 'warn' }),
    leaks_recap: c => ({ head: 'ГусьКорп хвастается новинками', lede: `Вчера у «Кря» утекло секретов: ${c.n}. Конкурент презентует «собственные» разработки.`, img: 'goose', tag: 'Конкуренты', tick: 'GOOS', sig: 'up', tone: 'bad' }),
    filler: () => U.pick([
      { head: 'В городском пруду замечена утка размером с автобус', lede: 'Учёные спорят, рыбаки молчат. Пресс-служба «Кря Индастриз»: «Это не наша».', img: 'pond', tag: 'Город' },
      { head: 'Кот из «Кря Индастриз» признан лучшим офисным котом района', lede: 'Кексик получил почётную миску и отказался от интервью.', img: 'cat', tag: 'Город' },
      { head: 'Рынок резины: цены стабильны', lede: 'Поставщики обещают, что каучука хватит всем. Правда, только тем, кто вовремя оплатит счёт.', img: 'bank', tag: 'Сырьё' },
      { head: 'Новый тренд: утки на рабочем столе снижают стресс', lede: 'Психологи советуют держать резиновую утку под рукой. Продажи растут.', img: 'duck', tag: 'Общество' },
    ]),
  };
  const SIG = {
    hype: ['▲', 'ажиотаж'], risk: ['⚠', 'тревожный знак'], crash: ['▼', 'обвал'], up: ['▲', 'ждут рост'], down: ['▼', 'ждут падение'],
    safe: ['●', 'надёжно'], calm: ['●', 'спокойно'], good: ['★', 'хорошо для нас'], bad: ['✖', 'плохо для нас'],
  };

  function make(key, ctx) {
    const f = T[key];
    if (!f) return null;
    return Object.assign({ key, tone: 'neutral', tag: 'Новости' }, f(ctx || {}));
  }

  /* ---------- Вёрстка ---------- */
  const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
  function chip(n) {
    if (!n.tick) return '';
    const s = SIG[n.sig] || null;
    let px = '';
    const k = G.market && G.market.t[n.tick];
    if (k) {
      const ch = (k.price / k.open - 1) * 100;
      px = ` $${k.price.toFixed(2)} <i class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</i>`;
    }
    return `<span class="np-chip s-${n.sig || 'none'}"><b>${n.tick}</b>${px}${s ? `<em>${s[0]} ${s[1]}</em>` : ''}</span>`;
  }
  function tickerLine() {
    if (!G.market) return '';
    return Object.values(G.market.t).map(k => {
      const ch = (k.price / k.open - 1) * 100;
      return `<span><b>${k.id}</b> ${k.price.toFixed(2)} <i class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</i></span>`;
    }).join('');
  }
  function article(n, cls, fresh) {
    return `<article class="${cls} tone-${n.tone || 'neutral'}">
      <img src="${art(n.img)}" alt="">
      <div class="np-txt">
        <div class="np-meta"><span class="np-tag">${U.esc(n.tag || 'Новости')}</span><time>${n.day && n.day !== G.day ? 'вчера' : U.time(n.t)}</time>${fresh ? '<span class="np-new">новое</span>' : ''}</div>
        <h${cls === 'np-lead' ? 2 : 3}>${U.esc(n.head)}</h${cls === 'np-lead' ? 2 : 3}>
        ${chip(n)}
        <p>${U.esc(n.lede || '')}</p>
      </div>
    </article>`;
  }
  /* list — новости, новые первыми; seen — сколько из них уже прочитано */
  function render(list, seen) {
    const wd = DAYS[(G.day - 1) % 5];
    let html = `<div class="np">
      <div class="np-mast"><span>${wd} · день ${G.day}</span><h1>Утренний Кряк</h1><span>выпуск ${U.time(G.time)} · 5 центов</span></div>
      <div class="np-tick">${tickerLine()}</div>`;
    if (!list.length) return html + '<p class="np-empty">Свежих новостей пока нет. Редакция пьёт кофе.</p></div>';
    const freshN = Math.max(0, list.length - (seen || 0));
    /* главная новость: громкая, потом важная, при равенстве — самая свежая */
    let li = 0, best = -1;
    list.slice(0, Math.max(6, freshN)).forEach((n, i) => { const w = (n.big ? 10 : 0) + (n.prio || 0); if (w > best) { best = w; li = i; } });
    html += article(list[li], 'np-lead', li < freshN);
    const rest = list.filter((_, i) => i !== li);
    if (rest.length) html += `<div class="np-grid">${rest.map(n => article(n, 'np-card', list.indexOf(n) < freshN)).join('')}</div>`;
    return html + '</div>';
  }

  return { make, render, art, T };
})();
