'use strict';
/* Отрисовка офиса: план этажа, мебель, люди, кот, частицы */
const PLAYER_LOOK = { skin: '#e8b88a', hair: '#1b1b22', hairStyle: 'slick', shirt: '#ffffff', tie: '#c0392b', pants: '#222222', jacket: '#23324a' };

const World = (() => {
  const R = (...a) => Spr.R(...a);
  const DESKS = Plan.DESKS;
  const BOSS = { x: 22, y: 166, w: 84 };
  const ZINA_DESK = { x: 14, y: 44, w: 40 };
  const AKH_DESK = { x: 90, y: 56, w: 26 };
  const CAP = '#3d3448', CAP_L = '#5d5068';

  let bg = null, t = 0, shakeT = 0, elevT = 0, elevOpen = 0;
  let hits = [], parts = [], hover = null, scale = 3, lastShout = 0, noteT = 0;
  const belt = { pos: 0, ducks: [], acc: 0, spawnT: 0 };
  const bubEls = {};

  /* ---------- Цвета и примитивы ---------- */
  function mix(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(U.lerp(pa >> 16, pb >> 16, k));
    const g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, k));
    const bl = Math.round(U.lerp(pa & 255, pb & 255, k));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  const SKY = [[540, '#a6d8ff'], [720, '#7cc4ff'], [900, '#8fbfe8'], [990, '#f2b880'], [1050, '#e0866a'], [1080, '#8a5a8a']];
  function sky(min) {
    for (let i = 0; i < SKY.length - 1; i++) {
      if (min <= SKY[i + 1][0]) return mix(SKY[i][1], SKY[i + 1][1], U.clamp((min - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]), 0, 1));
    }
    return SKY[SKY.length - 1][1];
  }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 300; n++) {
      R(x0, y0, 1, 1, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  const txt = (s, x, y, c) => Font.draw(Spr.ctx(), s, x, y, c);
  const txtC = (s, cx, y, c) => Font.draw(Spr.ctx(), s, Math.round(cx - Font.width(s) / 2), y, c);

  /* ---------- Полы ---------- */
  function floor(x, y, w, h, kind) {
    const ctx = Spr.ctx();
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (kind === 'wood') {
      for (let yy = y, r = 0; yy < y + h; yy += 5, r++) {
        R(x, yy, w, 5, r % 2 ? '#c8945a' : '#bf8a52'); R(x, yy, w, 1, '#d4a36a');
        for (let xx = x + ((r * 13) % 28); xx < x + w; xx += 28) R(xx, yy, 1, 5, '#9e6c3a');
      }
    } else if (kind === 'parquet') {
      for (let yy = y, r = 0; yy < y + h; yy += 6, r++) {
        for (let xx = x - ((r % 3) * 8); xx < x + w; xx += 24) {
          R(xx, yy, 24, 6, ((((xx - x) / 8) + r) & 1) ? '#b98450' : '#ad7845');
          R(xx, yy, 24, 1, '#c79361'); R(xx + 23, yy, 1, 6, '#8e5e33');
        }
      }
    } else if (kind === 'dark') {
      for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) {
        R(xx, yy, 8, 8, '#4a525e'); R(xx, yy, 8, 1, '#5a6370'); R(xx, yy, 1, 8, '#5a6370');
        if (((xx + yy) / 8) % 3 === 0) { R(xx + 2, yy + 3, 4, 1, '#3a4049'); R(xx + 2, yy + 5, 4, 1, '#3a4049'); }
      }
    } else if (kind === 'white') {
      R(x, y, w, h, '#e8eef0');
      for (let yy = y; yy < y + h; yy += 6) R(x, yy, w, 1, '#cfd8dc');
      for (let xx = x; xx < x + w; xx += 6) R(xx, y, 1, h, '#cfd8dc');
    } else if (kind === 'check') {
      for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) R(xx, yy, 8, 8, ((xx + yy) / 8) & 1 ? '#efe4cc' : '#cdb894');
    } else if (kind === 'marble') {
      R(x, y, w, h, '#ebe6dc');
      for (let yy = y; yy < y + h; yy += 16) for (let xx = x; xx < x + w; xx += 16) {
        R(xx, yy, 16, 1, '#d8d2c6'); R(xx, yy, 1, 16, '#d8d2c6');
        R(xx + 4, yy + 6, 5, 1, '#dcd6ca'); R(xx + 8, yy + 7, 4, 1, '#dcd6ca'); R(xx + 11, yy + 11, 3, 1, '#e0dad0');
      }
    } else if (kind === 'stone') {
      for (let yy = y, r = 0; yy < y + h; yy += 9, r++) for (let xx = x - (r % 2) * 8; xx < x + w; xx += 16) {
        R(xx, yy, 16, 9, '#d8d2c8'); R(xx, yy, 16, 1, '#c6c0b4'); R(xx, yy, 1, 9, '#c6c0b4'); R(xx + 1, yy + 1, 14, 1, '#e2ddd4');
      }
    } else if (kind === 'carpet') {
      for (let yy = y; yy < y + h; yy += 16) for (let xx = x; xx < x + w; xx += 16) {
        const odd = (((xx - x) / 16) + ((yy - y) / 16)) & 1;
        R(xx, yy, 16, 16, odd ? '#7d8da0' : '#76869a');
        R(xx + 3, yy + 5, 1, 1, '#8a9aae'); R(xx + 11, yy + 12, 1, 1, '#6c7c90'); R(xx + 8, yy + 2, 1, 1, '#6c7c90');
      }
    } else if (kind === 'meet') {
      R(x, y, w, h, '#4e4266');
      for (let yy = y; yy < y + h; yy += 4) for (let xx = x + (yy % 8 ? 2 : 0); xx < x + w; xx += 4) R(xx, yy, 1, 1, '#5a4e74');
    } else if (kind === 'concrete') {
      R(x, y, w, h, '#8e8e88');
      for (let n = 0; n < w * h / 40; n++) R(x + ((n * 37) % w), y + ((n * 53) % h), 1, 1, n % 2 ? '#9a9a94' : '#82827c');
    } else if (kind === 'factory') {
      R(x, y, w, h, '#3a3e46');
      for (let yy = y; yy < y + h; yy += 12) for (let xx = x; xx < x + w; xx += 12) { R(xx, yy, 12, 1, '#43474f'); R(xx, yy, 1, 12, '#43474f'); }
    }
    ctx.restore();
  }

  /* ---------- Стены ---------- */
  function face(x, y, w, h, col, trim) {
    R(x, y, w, h, col);
    R(x, y, w, 1, U.shade(col, 22));
    if (trim) { R(x, y + Math.floor(h * 0.55), w, 1, U.shade(col, -30)); R(x, y + Math.floor(h * 0.55) + 1, w, 1, U.shade(col, 12)); }
    R(x, y + h - 2, w, 2, U.shade(col, -48));
  }
  const capH = (x, y, w) => { R(x, y, w, 4, CAP); R(x, y, w, 1, CAP_L); };
  const capV = (x, y, h) => { R(x, y, 4, h, CAP); R(x + 1, y, 1, h, CAP_L); };
  function doorH(x, w, floorCol, leaf) {
    R(x, 84, w, 22, floorCol);
    R(x, 84, w, 3, 'rgba(0,0,0,0.25)');
    R(x - 1, 84, 2, 22, '#2a2230'); R(x + w - 1, 84, 2, 22, '#2a2230');
    R(x, 104, w, 2, 'rgba(0,0,0,0.18)');
    if (leaf) { R(x + 1, 86, 3, 18, '#8a5a32'); R(x + 1, 86, 1, 18, '#a8784a'); R(x + 3, 95, 1, 2, '#d4a24c'); }
  }
  function glassV(x, y, h) {
    R(x, y, 4, h, '#9fd0e0'); R(x, y, 1, h, '#3d3448'); R(x + 3, y, 1, h, '#3d3448'); R(x + 1, y, 1, h, '#d8f2fa');
    for (let yy = y + 14; yy < y + h; yy += 26) R(x, yy, 4, 2, '#3d3448');
  }
  function glassH(x, y, w) {
    R(x, y, w, 4, '#9fd0e0'); R(x, y, w, 1, '#3d3448'); R(x, y + 3, w, 1, '#3d3448'); R(x, y + 1, w, 1, '#d8f2fa');
    for (let xx = x + 20; xx < x + w; xx += 40) R(xx, y, 2, 4, '#3d3448');
  }
  function plaque(s, x, y, bgc, fg) {
    const w = Font.width(s) + 4;
    R(x, y, w, 9, U.shade(bgc, -40)); R(x + 1, y + 1, w - 2, 7, bgc);
    txt(s, x + 2, y + 2, fg);
  }
  function plant(x, y, big) {
    const h = big ? 18 : 12;
    R(x, y - 8, 10, 8, '#b5652f'); R(x, y - 8, 10, 1, '#d07a40'); R(x + 1, y - 1, 8, 1, '#7a4520');
    [[-2, -h], [4, -h - 3], [1, -h + 5], [6, -h + 4], [-1, -h + 9], [5, -h + 9]].forEach(([dx, dy], i) => {
      R(x + dx, y + dy, 6, 6, i % 2 ? '#3f8f3a' : '#4a9e42'); R(x + dx + 1, y + dy, 3, 2, '#6cc45c');
    });
  }
  function chair(x, y, col) {
    R(x - 5, y - 9, 10, 7, col); R(x - 5, y - 9, 10, 1, U.shade(col, 25));
    R(x - 5, y - 3, 10, 3, U.shade(col, -25)); R(x - 4, y, 1, 2, '#333'); R(x + 3, y, 1, 2, '#333');
  }

  /* ---------- Статичный фон ---------- */
  function buildBg() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    Spr.use(cv.getContext('2d'));
    R(0, 0, W, H, '#2a2230');

    /* полы */
    floor(4, 22, 80, 62, 'wood');
    floor(88, 22, 52, 62, 'dark');
    floor(144, 22, 40, 62, 'white');
    floor(188, 22, 112, 62, 'check');
    floor(304, 22, 96, 62, 'marble');
    floor(4, 106, 472, 18, 'stone');
    floor(4, 142, 120, 94, 'parquet');
    floor(128, 124, 220, 112, 'carpet');
    floor(352, 140, 124, 36, 'meet');
    floor(352, 190, 124, 46, 'concrete');
    floor(4, 240, 472, 48, 'factory');

    /* дальняя стена верхнего ряда */
    face(4, 0, 80, 22, '#e8dcc0', true);
    face(88, 0, 52, 22, '#aebccb');
    face(144, 0, 40, 22, '#cfe6ee');
    for (let y = 3; y < 20; y += 4) R(144, y, 40, 1, '#b8d2dc');
    face(188, 0, 112, 22, '#cfe8d2', true);
    face(304, 0, 96, 22, '#efe4d0');
    R(304, 12, 96, 8, '#8a5a32'); R(304, 12, 96, 1, '#a8784a');
    R(4, 0, 396, 2, CAP);

    /* коридорная стена */
    capH(0, 84, W);
    face(4, 88, 472, 18, '#e6e0d6', true);
    /* стены кабинета, переговорной и склада */
    capH(4, 124, 120); face(4, 128, 120, 14, '#8d5e33');
    for (let x = 6; x < 124; x += 14) { R(x, 130, 10, 9, '#7d5029'); R(x, 130, 10, 1, '#a8703a'); }
    capH(348, 124, 128); face(352, 128, 124, 12, '#2f5a4a');
    capH(352, 176, 124); face(352, 180, 124, 10, '#a09e94');
    for (let x = 356; x < 476; x += 12) R(x, 182, 1, 6, '#8a887e');

    /* вертикальные стены */
    [84, 140, 184, 300, 400].forEach(x => capV(x, 0, 84));
    capV(0, 0, H);
    capV(476, 84, H - 84);
    capV(348, 124, 26); capV(348, 168, 38); capV(348, 224, 12);
    R(348, 150, 4, 18, '#b8a088'); R(348, 206, 4, 18, '#9e9e94');
    R(349, 150, 2, 3, '#7a5a3a'); R(349, 206, 2, 3, '#6a6a60');

    /* двери в коридор */
    doorH(58, 18, '#bf8a52', true);
    doorH(118, 18, '#4a525e', true);
    doorH(155, 18, '#e8eef0', true);
    doorH(236, 18, '#d8c8a8', true);
    R(342, 84, 56, 22, '#ebe6dc'); R(342, 84, 56, 3, 'rgba(0,0,0,0.2)');
    R(340, 84, 3, 22, '#c8b894'); R(397, 84, 3, 22, '#c8b894'); R(340, 84, 3, 2, '#fff'); R(397, 84, 3, 2, '#fff');

    /* стеклянные стены */
    glassV(124, 124, 78); glassV(124, 226, 10);
    R(124, 202, 4, 24, '#b8a088'); R(118, 202, 6, 2, '#9fd0e0');
    glassH(4, 236, 452); glassH(472, 236, 4);
    R(456, 236, 16, 4, '#5a5e66');

    /* таблички на коридорной стене */
    plaque('БУХГАЛТЕРИЯ', 8, 92, '#d4a24c', '#3b2414');
    plaque('СЕРВЕР', 89, 92, '#5a6370', '#cfe6ff');
    plaque('WC', 142, 92, '#3b6ea8', '#ffffff');
    plaque('КУХНЯ', 212, 92, '#3f8f3a', '#ffffff');
    /* огнетушитель и доска объявлений */
    R(184, 92, 5, 10, '#d23c3c'); R(185, 90, 3, 2, '#333'); R(184, 92, 5, 1, '#f06a6a');
    R(410, 90, 30, 14, '#a8784a'); R(411, 91, 28, 12, '#c9a06a');
    [[413, 92, '#fff'], [421, 93, '#f3e2a0'], [429, 92, '#a9c8e8'], [415, 98, '#f0b9c4'], [426, 98, '#fff']].forEach(([x, y, c]) => { R(x, y, 7, 5, c); R(x + 3, y, 1, 1, '#d23c3c'); });
    R(448, 90, 20, 14, '#2a2a2a'); R(449, 91, 18, 12, '#ffd23f'); txt('QUAK', 450, 94, '#3b2414');

    /* ---- Бухгалтерия ---- */
    R(10, 3, 30, 16, '#f3ead6');
    R(56, 6, 12, 34, '#6a707a'); R(68, 6, 12, 34, '#5e646e');
    for (let y = 9; y < 38; y += 8) { R(57, y, 10, 6, '#8a909a'); R(60, y + 2, 4, 1, '#c9a14a'); R(69, y, 10, 6, '#7e848e'); R(72, y + 2, 4, 1, '#c9a14a'); }
    R(22, 64, 16, 16, '#4a4f58'); R(22, 64, 16, 2, '#6a707a'); R(24, 67, 12, 11, '#3a3f48');
    R(28, 70, 4, 4, '#c9a14a'); R(29, 71, 2, 2, '#3a3f48'); R(33, 69, 2, 5, '#888');
    plant(8, 80);
    R(44, 6, 8, 10, '#fff'); R(45, 7, 6, 1, '#999'); R(45, 9, 6, 1, '#999'); txt('$', 46, 10, '#3f8f3a');

    /* ---- Серверная ---- */
    [92, 107, 122].forEach(x => {
      R(x, 4, 14, 36, '#22262e'); R(x, 4, 14, 1, '#3a404a'); R(x + 13, 4, 1, 36, '#15181e');
      for (let y = 7; y < 38; y += 4) R(x + 2, y, 10, 3, '#2e333c');
    });
    R(90, 74, 46, 2, '#2a6a8a');

    /* ---- Туалет ---- */
    R(146, 4, 36, 26, '#a9c8e0');
    R(146, 4, 1, 42, '#7a9ab8'); R(164, 4, 2, 42, '#7a9ab8'); R(181, 4, 1, 42, '#7a9ab8');
    [[149, 10], [168, 10]].forEach(([x, y]) => { R(x, y, 10, 6, '#fff'); R(x + 1, y + 6, 8, 8, '#f4f4f4'); R(x + 2, y + 7, 6, 5, '#dfe8ec'); });
    R(150, 60, 10, 6, '#fff'); R(152, 61, 6, 3, '#cfe6ee');
    plaque('М', 151, 22, '#3b6ea8', '#fff'); plaque('Ж', 168, 22, '#d23c6a', '#fff');

    /* ---- Кухня ---- */
    R(190, 3, 46, 11, '#c9b08a'); R(190, 3, 46, 1, '#e0c8a0'); R(212, 3, 1, 11, '#a88a66'); R(205, 8, 3, 1, '#7a5a3a'); R(218, 8, 3, 1, '#7a5a3a');
    R(190, 26, 46, 4, '#e8e4dc'); R(190, 26, 46, 1, '#fff');
    R(190, 30, 46, 12, '#b89870'); R(190, 30, 46, 1, '#d4b48a');
    for (let x = 192; x < 234; x += 11) { R(x, 32, 9, 8, '#a8885e'); R(x + 4, 35, 2, 1, '#7a5a3a'); }
    R(214, 26, 12, 3, '#9aa8b4'); R(219, 22, 2, 4, '#b0bcc8');
    R(196, 14, 12, 14, '#3a3a3a'); R(196, 14, 12, 2, '#555'); R(198, 17, 8, 4, '#8fd3ff'); R(199, 23, 6, 4, '#222'); R(200, 25, 4, 2, '#fff');
    R(228, 20, 6, 6, '#c0392b'); R(229, 21, 4, 2, '#333');
    R(238, 8, 14, 34, '#e8ecef'); R(238, 8, 14, 1, '#fff'); R(238, 20, 14, 1, '#b8c0c8'); R(250, 11, 1, 6, '#888'); R(250, 24, 1, 10, '#888');
    R(240, 12, 4, 4, '#ffd23f'); R(245, 26, 3, 3, '#f0b9c4');
    R(256, 26, 9, 14, '#e8e8e8'); R(256, 26, 9, 1, '#fff'); R(263, 26, 2, 14, '#c8c8c8');
    R(257, 14, 7, 12, '#7fc6ef'); R(258, 15, 2, 9, '#c8ecff'); R(256, 13, 9, 2, '#5a9ac0');
    R(258, 31, 2, 2, '#3b6ea8'); R(261, 31, 2, 2, '#d23c3c');
    R(268, 22, 30, 10, '#a8432a'); R(268, 22, 30, 1, '#c8634a'); R(268, 32, 30, 8, '#c0533a'); R(268, 32, 30, 1, '#d87358');
    R(268, 22, 4, 18, '#8e3420'); R(294, 22, 4, 18, '#8e3420'); R(283, 32, 1, 8, '#a8432a');
    R(270, 64, 18, 11, '#7a4a8a'); R(271, 65, 16, 9, '#a87ab8'); R(273, 67, 12, 5, '#c8a0d8');
    plant(190, 80, true);
    [[213, 50], [228, 50]].forEach(([x, y]) => chair(x, y, '#c9a06a'));
    R(256, 4, 40, 15, '#f3ead6');

    /* ---- Ресепшен ---- */
    R(308, 2, 38, 10, '#3b2414'); R(309, 3, 36, 8, '#ffd23f');
    Spr.duck(310, 3); txt('КРЯ', 324, 5, '#3b2414');
    R(350, 0, 40, 23, '#7a808a'); R(351, 1, 38, 22, '#9aa0aa');
    plant(384, 40, true);
    [366, 378, 390].forEach(x => chair(x, 72, '#3b6ea8'));

    /* ---- Кабинет ---- */
    R(14, 150, 100, 82, '#5e1e1e'); R(16, 152, 96, 78, '#9e3b3b'); R(20, 156, 88, 70, '#7a2a2a');
    for (let x = 24; x < 106; x += 8) { R(x, 158, 4, 2, '#c9a14a'); R(x, 222, 4, 2, '#c9a14a'); }
    R(8, 126, 30, 30, '#4a2e18'); R(9, 127, 28, 28, '#6b4226'); R(11, 129, 24, 24, '#3e2614');
    const bookC = ['#c0392b', '#2c3e7a', '#1f6f4a', '#d4a017', '#7a2c6f', '#e8e2d0', '#a8432a', '#3b6ea8'];
    [129, 141].forEach((sy, si) => {
      let bx = 12;
      while (bx < 34) {
        const w = 2 + ((bx * 7 + si) % 2), h = 8 + ((bx + si * 3) % 3);
        R(bx, sy + 10 - h, w, h, bookC[(bx + si * 5) % bookC.length]);
        bx += w + ((bx % 5) === 0 ? 1 : 0);
      }
      R(11, sy + 10, 24, 2, '#6e4628');
    });
    plant(108, 160, true);
    R(8, 212, 26, 20, '#2f4a6a'); R(8, 212, 26, 6, '#3f5a7a'); R(8, 212, 4, 20, '#243a56'); R(30, 212, 4, 20, '#243a56');
    R(58, 129, 16, 12, '#a8832e'); R(59, 130, 14, 10, '#2f4a3c'); Spr.duck(61, 130);
    R(80, 130, 10, 8, '#f3ead6'); R(81, 131, 8, 1, '#999'); R(83, 134, 4, 2, '#d23c3c');
    R(54, 146, 20, 18, '#3a2218'); R(55, 147, 18, 2, '#5a3828'); R(53, 156, 22, 8, '#2e1a12');

    /* ---- Опен-спейс ---- */
    R(226, 126, 24, 14, '#d8d8d0'); R(226, 126, 24, 2, '#f0f0e8'); R(228, 122, 20, 4, '#fff');
    R(230, 132, 16, 2, '#444'); R(243, 129, 3, 2, '#5dff7a'); R(226, 138, 24, 2, '#aaa');
    plant(334, 138);
    R(220, 125, 4, 3, '#555'); R(320, 125, 4, 3, '#555');

    /* ---- Переговорная ---- */
    R(360, 129, 40, 10, '#fff'); R(360, 129, 40, 1, '#ccc');
    line(362, 137, 370, 134, '#3f8f3a'); line(370, 134, 378, 135, '#3f8f3a'); line(378, 135, 386, 131, '#3f8f3a'); line(386, 131, 396, 130, '#d23c3c');
    txt('ПЕРЕГОВОРНАЯ', 410, 132, '#d8f0e0');
    Plan.MEET_SEATS.filter(s => !s.back).forEach(s => chair(s.x, s.y + 4, '#2a2a2a'));

    /* ---- Склад ---- */
    txt('СКЛАД', 456, 182, '#3a3a34');
    R(358, 222, 12, 8, '#d4a017'); R(358, 222, 12, 1, '#f0c040'); R(360, 216, 2, 6, '#555'); R(364, 230, 3, 2, '#222');
    for (let x = 352; x < 476; x += 10) { R(x, 232, 5, 2, '#e8c33a'); R(x + 5, 232, 5, 2, '#2a2a2a'); }

    /* ---- Цех ---- */
    R(98, 246, 24, 18, '#c49a6c'); R(98, 246, 24, 2, '#d9b384'); R(98, 263, 24, 1, '#9b764d'); txt('QUAK', 102, 252, '#6b4a2e');
    for (let x = 130; x < 412; x += 24) R(x, 262, 2, 8, '#2a2a30');
    R(444, 244, 14, 18, '#4a4e58'); R(445, 245, 12, 6, '#1a1e24'); R(447, 253, 2, 2, '#e04040'); R(451, 253, 2, 2, '#5dff7a'); R(455, 253, 2, 2, '#ffd23f');
    txt('ЦЕХ', 445, 264, '#8a8e98');
    return cv;
  }

  /* ---------- Мониторы ---------- */
  function screenMode(e) {
    if (e.gone || e.state !== 'seated') return 'off';
    if (G.time < e.sleepUntil) return 'off';
    if (e.activeClue && e.activeClue.screen) return e.activeClue.screen;
    const st = Sim.stage(e);
    if (st >= 3) return 'crazy';
    if (st === 2) return 'chart';
    if (e.trait === 'lazy' && !e.lazyFixed && Math.sin(G.time / 17 + e.id * 2) > 0.15) return 'solitaire';
    return e.id % 2 ? 'excel' : 'text';
  }
  function drawScreen(x, y, mode, seed) {
    const f = Math.floor(t * 4 + seed);
    switch (mode) {
      case 'excel':
        R(x, y, 11, 8, '#f4f4f4');
        for (let i = 1; i < 8; i += 2) R(x, y + i, 11, 1, '#c8d0d8');
        R(x + 1, y + 2, 3, 1, '#3b6ea8'); R(x + 5, y + 4, 4, 1, '#3fa34d'); R(x + 2, y + 6, 2, 1, '#d23c3c');
        break;
      case 'text':
        R(x, y, 11, 8, '#fbfbf6');
        R(x + 1, y + 1, 8, 1, '#999'); R(x + 1, y + 3, 9, 1, '#bbb'); R(x + 1, y + 5, 6, 1, '#bbb');
        if (f % 2) R(x + 7, y + 5, 1, 1, '#000');
        break;
      case 'solitaire':
        R(x, y, 11, 8, '#1f7a3a');
        R(x + 1, y + 1, 2, 3, '#fff'); R(x + 4, y + 1, 2, 3, '#fff'); R(x + 7, y + 1, 2, 3, '#fff');
        R(x + 4, y + 4, 2, 3, '#fff'); R(x + 5, y + 2, 1, 1, '#d23c3c'); R(x + 1 + (f % 3) * 3, y + 5, 2, 2, '#fff');
        break;
      case 'icq':
        R(x, y, 11, 8, '#fff');
        R(x + 1, y + 1, 3, 3, '#5bd16a'); R(x + 2, y + 2, 1, 1, '#d23c3c');
        R(x + 5, y + 1, 5, 1, '#999'); R(x + 5, y + 3, 4, 1, '#999'); R(x + 1, y + 5, 7 - (f % 3), 1, '#3b6ea8');
        break;
      case 'blueprint':
        R(x, y, 11, 8, '#2b4f8a');
        R(x + 1, y + 1, 9, 1, '#cfe6ff'); R(x + 2, y + 2, 1, 5, '#cfe6ff'); R(x + 5, y + 3, 4, 3, '#cfe6ff'); R(x + 6, y + 4, 2, 1, '#2b4f8a');
        break;
      case 'copy':
        R(x, y, 11, 8, '#000080');
        R(x + 1, y + 1, 9, 2, '#c0c0c0'); R(x + 1, y + 5, 9, 2, '#c0c0c0'); R(x + 1, y + 5, 1 + (f % 9), 2, '#3b6ea8');
        break;
      case 'hide':
        R(x, y, 11, 8, '#3a8f8f');
        R(x + 1, y + 1, 2, 2, '#ffd23f'); R(x + 1, y + 4, 2, 2, '#fff'); R(x, y + 7, 11, 1, '#c0c0c0');
        break;
      case 'movie':
        R(x, y, 11, 8, '#000');
        R(x + 1 + (f % 8), y + 3, 2, 3, '#ffd23f'); R(x + 8 - (f % 6), y + 4, 2, 2, '#d23c3c');
        break;
      case 'chart': {
        R(x, y, 11, 8, '#0b0b0b');
        let py = y + 5;
        for (let i = 0; i < 11; i++) { py = U.clamp(py + (((i * 7 + f) % 5) - 2), y + 1, y + 7); R(x + i, py, 1, 1, '#5dff7a'); }
        break;
      }
      case 'crazy':
        R(x, y, 11, 8, f % 2 ? '#e04040' : '#2ecc40');
        R(x + 2, y + 2, 7, 4, f % 2 ? '#2ecc40' : '#e04040');
        break;
      case 'code':
        R(x, y, 11, 8, '#101418');
        for (let i = 0; i < 4; i++) R(x + 1 + (i % 2) * 2, y + 1 + i * 2, 3 + ((f + i * 3) % 6), 1, i % 2 ? '#5dff7a' : '#8fd3ff');
        break;
      default:
        R(x, y, 11, 8, '#14161c');
        R(x + ((f * 3 + seed) % 11), y + ((f + seed) % 8), 1, 1, '#556');
    }
  }

  /* ---------- Мебель ---------- */
  function monitor(x, y, mode, seed) {
    R(x, y, 16, 14, '#d8d0bc'); R(x, y, 16, 1, '#ece6d6'); R(x + 14, y, 2, 14, '#b3aa93');
    R(x + 4, y + 14, 8, 3, '#b3aa93');
    drawScreen(x + 2, y + 2, mode, seed);
  }
  function deskBody(x, y, w, top, front) {
    R(x + 1, y + 22, w, 2, 'rgba(0,0,0,0.22)');
    R(x, y, w, 12, top); R(x, y, w, 1, U.shade(top, 22)); R(x, y + 11, w, 1, U.shade(top, -22));
    R(x, y + 12, w, 10, front); R(x, y + 12, w, 1, U.shade(front, 18));
  }
  function drawDesk(i) {
    const d = DESKS[i], x = d.x, y = d.y;
    const e = G.emps[i];
    deskBody(x, y, 40, '#c48a4f', '#8e5a2e');
    R(x + 27, y + 14, 11, 6, '#7a4c26'); R(x + 31, y + 16, 3, 1, '#d4a24c');
    R(x + 5, y + 6, 14, 4, '#e8e2d0'); R(x + 5, y + 9, 14, 1, '#b8b2a0');
    for (let k = 0; k < 6; k++) R(x + 6 + k * 2, y + 7, 1, 1, '#a09a88');
    R(x + 1, y + 3, 4, 6, '#fff'); R(x + 1, y + 4, 3, 1, '#bbb'); R(x + 1, y + 6, 3, 1, '#bbb');
    const cups = e && !e.gone ? Math.min(3, Sim.stage(e) + (e.id % 2)) : 0;
    for (let c = 0; c < cups; c++) { R(x + 18 - c * 4, y + 1, 3, 3, '#f4f4f4'); R(x + 18 - c * 4, y + 1, 3, 1, '#5a3a22'); }
    if (i === 3 || i === 4) Spr.duck(x + 7, y - 2);
    monitor(x + 22, y - 8, e ? screenMode(e) : 'off', i * 3);
  }
  function drawDivider(x, y) {
    R(x - 2, y - 14, 4, 30, '#8a94a8'); R(x - 2, y - 14, 4, 1, '#b0b8c8'); R(x + 1, y - 14, 1, 30, '#6a7488');
  }
  function drawSmallDesk(d, mode, seed) {
    deskBody(d.x, d.y, d.w, '#a87a4a', '#7a5230');
    monitor(d.x + d.w - 17, d.y - 8, mode, seed);
    R(d.x + 2, d.y + 5, 10, 3, '#e8e2d0');
  }
  function drawPlayerDesk() {
    const { x, y, w } = BOSS;
    R(x + 2, y + 24, w - 4, 3, 'rgba(0,0,0,0.25)');
    R(x, y, w, 14, '#8a3f2a'); R(x, y, w, 1, '#a85a40'); R(x, y + 13, w, 1, '#6e3020');
    R(x + 22, y + 3, 40, 9, '#2f5a3a'); R(x + 22, y + 3, 40, 1, '#3f7a4a');
    R(x, y + 14, w, 10, '#5e2a1c'); R(x, y + 14, w, 1, '#d4a24c');
    R(x + 4, y + 16, 18, 6, '#4e2216'); R(x + 12, y + 18, 3, 1, '#d4a24c');
    R(x + 62, y + 16, 18, 6, '#4e2216'); R(x + 70, y + 18, 3, 1, '#d4a24c');
    R(x + 29, y + 15, 26, 8, '#a8832e'); R(x + 30, y + 16, 24, 6, '#d4a24c');
    txtC('БОСС', x + 42, y + 16.5, '#5a3a10');
    /* монитор с графиком QUAK */
    R(x + 2, y - 10, 18, 16, '#d8d0bc'); R(x + 2, y - 10, 18, 1, '#ece6d6'); R(x + 18, y - 10, 2, 16, '#b3aa93');
    R(x + 4, y - 8, 13, 10, '#06140a');
    const h = G.market ? G.market.t.QUAK.hist : [];
    if (h.length > 1) {
      const pts = h.slice(-13);
      const mn = Math.min(...pts), mx = Math.max(...pts);
      pts.forEach((p, i) => R(x + 4 + i, y - 8 + 8 - Math.round(((p - mn) / Math.max(0.01, mx - mn)) * 7), 1, 1, '#5dff7a'));
    }
    R(x + 7, y + 6, 8, 3, '#b3aa93');
    R(x + 34, y + 8, 16, 3, '#e8e2d0');
    /* штампы */
    R(x + 23, y + 1, 3, 5, '#5a3a20'); R(x + 22, y, 5, 2, '#7a5a30'); R(x + 22, y + 6, 5, 2, '#3fa34d');
    R(x + 28, y + 1, 3, 5, '#5a3a20'); R(x + 27, y, 5, 2, '#7a5a30'); R(x + 27, y + 6, 5, 2, '#d23c3c');
    /* лоток входящих */
    const n = Math.min(G.inbox.length, 7);
    R(x + 56, y + 3, 14, 8, '#6b4a2e'); R(x + 57, y + 4, 12, 6, '#4a3020');
    for (let i = 0; i < n; i++) R(x + 57, y + 7 - i * 2, 12, 2, i % 2 ? '#fff' : '#e8e2d0');
    if (G.inbox.length) {
      const by = y - 2 - n * 2 + (Math.floor(t * 3) % 2);
      R(x + 66, by - 6, 8, 8, '#3b0f0f'); R(x + 67, by - 5, 6, 6, '#d23c3c');
      txt(String(Math.min(9, G.inbox.length)), x + 69, by - 4.5, '#fff');
    }
    /* телефон */
    const ring = G.call && Math.floor(t * 10) % 2;
    R(x + 72, y + 4, 11, 7, '#c0392b'); R(x + 72, y + 4, 11, 1, '#e05a4a'); R(x + 75, y + 6, 5, 3, '#f3e2a0');
    if (G.call) { R(x + 71 + (ring ? 1 : -1), y - 1, 13, 3, '#8e2a20'); Spr.mark('phone', x + 74, y - 12 - (ring ? 1 : 0)); }
    else R(x + 71, y + 2, 13, 3, '#8e2a20');
  }
  function drawCounter() {
    const x = 308, y = 40;
    R(x, y, 40, 8, '#e8dcc8'); R(x, y, 40, 1, '#fff');
    R(x, y + 8, 40, 12, '#8a5a32'); R(x, y + 8, 40, 1, '#a8784a'); R(x + 4, y + 11, 32, 6, '#7a4a28');
    Spr.duck(x + 15, y + 9);
    R(x + 28, y - 4, 10, 8, '#d8d0bc'); R(x + 29, y - 3, 8, 5, '#3b6ea8');
    R(x + 3, y + 2, 8, 4, '#c0392b');
    const tr = NPC.transit().length;
    for (let i = 0; i < Math.min(tr, 4); i++) R(x + 14, y + 4 - i * 2, 9, 2, i % 2 ? '#fff' : '#e8e2d0');
  }
  function drawKitTable() {
    const x = 206, y = 56;
    R(x + 1, y + 13, 28, 2, 'rgba(0,0,0,0.2)');
    R(x, y, 30, 8, '#d8b080'); R(x, y, 30, 1, '#f0d0a0'); R(x, y + 8, 30, 3, '#a8784a');
    R(x + 2, y + 11, 2, 4, '#7a5230'); R(x + 26, y + 11, 2, 4, '#7a5230');
    if (G.time < (G.flags.pizzaUntil || 0)) {
      R(x + 8, y + 1, 14, 6, '#e8c07a'); R(x + 9, y + 2, 12, 4, '#d8a050');
      [[11, 3], [15, 2], [18, 4], [13, 5]].forEach(([dx, dy]) => R(x + dx, y + dy, 2, 1, '#c0392b'));
    } else { R(x + 12, y + 2, 6, 3, '#fff'); R(x + 14, y + 1, 2, 1, '#f0b9c4'); }
  }
  function drawMeetTable() {
    const x = 368, y = 150;
    R(x + 2, y + 18, 84, 2, 'rgba(0,0,0,0.25)');
    R(x, y, 88, 14, '#5a3420'); R(x, y, 88, 1, '#7a4a30'); R(x + 4, y + 3, 80, 1, 'rgba(255,255,255,0.08)');
    R(x, y + 14, 88, 4, '#3e2214');
    for (let i = 0; i < 4; i++) { R(x + 9 + i * 20, y + 4, 6, 4, '#fff'); R(x + 10 + i * 20, y + 5, 4, 1, '#999'); }
    R(x + 40, y + 5, 8, 4, '#2a2a2a'); R(x + 42, y + 4, 4, 1, '#5dff7a');
  }
  function drawMeetChairBack(s) { R(s.x - 5, s.y - 4, 10, 8, '#2a2a2a'); R(s.x - 5, s.y - 4, 10, 1, '#4a4a4a'); }
  function drawCrates() {
    const n = U.clamp(Math.ceil(G.rubber / 45), 0, 16);
    for (let i = 0; i < n; i++) {
      const back = i < 8, k = back ? i : i - 8;
      const x = 368 + k * 13, y = back ? 190 : 198;
      R(x, y, 12, 11, '#8a6a3a'); R(x, y, 12, 1, '#b08a50'); R(x, y + 4, 12, 1, '#6a4a22'); R(x, y + 8, 12, 1, '#6a4a22');
      R(x + 3, y + 1, 6, 3, '#1e1e1e'); R(x + 4, y + 1, 2, 1, '#3a3a3a');
    }
    if (!n) txtC('ПУСТО', 418, 196, '#d23c3c');
  }

  /* ---------- Динамика стен ---------- */
  function windowPane(x, y, w, h) {
    const sk = sky(G.time);
    R(x, y, w, h, sk);
    const bc = mix(sk, '#203048', 0.55), lit = G.time > U.T(16, 40);
    for (let bx = x, i = 0; bx < x + w; i++) {
      const bw = 5 + ((i * 7) % 5), bh = 5 + ((i * 11) % Math.max(2, h - 4));
      R(bx, y + h - bh, Math.min(bw, x + w - bx), bh, bc);
      for (let wy = y + h - bh + 2; wy < y + h - 1; wy += 3) for (let wx = bx + 1; wx < Math.min(bx + bw - 1, x + w); wx += 2) {
        if (((wx * 3 + wy * 7 + i) % 5) < 2) R(wx, wy, 1, 1, lit ? '#ffd86a' : mix(bc, '#ffffff', 0.18));
      }
      bx += bw + 1;
    }
    R(x + 2, y + 2, 1, Math.min(6, h - 3), 'rgba(255,255,255,0.45)');
    R(x + Math.floor(w / 2), y, 1, h, '#f3ead6'); R(x, y + Math.floor(h / 2), w, 1, '#f3ead6');
  }
  function drawExterior() {
    const sk = sky(G.time);
    R(404, 0, 72, 84, sk);
    const bc = mix(sk, '#203048', 0.5);
    [[404, 28, 12], [417, 18, 10], [428, 34, 14], [443, 12, 12], [456, 26, 10], [467, 20, 9]].forEach(([x, y, w], i) => {
      R(x, y, w, 60 - y, bc);
      for (let wy = y + 3; wy < 56; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3) if ((wx + wy + i) % 3 === 0) R(wx, wy, 1, 2, G.time > U.T(16, 40) ? '#ffd86a' : mix(bc, '#fff', 0.2));
    });
    R(404, 56, 72, 16, '#4a4a52'); for (let x = 408; x < 476; x += 14) R(x, 63, 7, 1, '#d8d8d0');
    R(404, 72, 72, 12, '#b8b0a4'); R(404, 72, 72, 1, '#d8d0c4');
    R(462, 66, 3, 18, '#4a3a2a'); R(456, 58, 14, 10, '#3f8f3a'); R(458, 56, 10, 4, '#5cb85c');
    if (G.time < (G.flags.truckUntil || 0)) {
      const tx = 410, ty = 52;
      R(tx, ty, 34, 14, '#e8e8e0'); R(tx, ty, 34, 1, '#fff'); txt('КРЯ', tx + 6, ty + 4, '#c0392b');
      R(tx + 34, ty + 4, 12, 10, '#3b6ea8'); R(tx + 36, ty + 6, 6, 4, '#a6d8ff');
      R(tx + 4, ty + 13, 6, 6, '#222'); R(tx + 6, ty + 15, 2, 2, '#888'); R(tx + 36, ty + 13, 6, 6, '#222'); R(tx + 38, ty + 15, 2, 2, '#888');
    }
  }
  function drawWallDynamic() {
    windowPane(10, 3, 30, 16);
    windowPane(256, 4, 40, 15);
    drawExterior();
    /* часы в кабинете */
    const cx = 104, cy = 135;
    R(cx - 5, cy - 5, 11, 11, '#5a3a22'); R(cx - 4, cy - 4, 9, 9, '#f8f4e8');
    const m = G.time % 60, h = (G.time / 60) % 12;
    const am = (m / 60) * Math.PI * 2 - Math.PI / 2, ah = (h / 12) * Math.PI * 2 - Math.PI / 2;
    line(cx, cy, cx + Math.cos(ah) * 2.4, cy + Math.sin(ah) * 2.4, '#222');
    line(cx, cy, cx + Math.cos(am) * 3.6, cy + Math.sin(am) * 3.6, '#c0392b');
    /* серверные огоньки */
    for (let k = 0; k < 18; k++) {
      const x = 94 + (k % 3) * 15 + ((k * 5) % 7), y = 8 + Math.floor(k / 3) * 5;
      R(x, y, 1, 1, Math.sin(t * 6 + k * 1.7) > 0 ? (k % 4 ? '#5dff7a' : '#ffb43a') : '#1a3a1a');
    }
    /* лифт */
    elevOpen = U.lerp(elevOpen, elevT > 0 ? 1 : 0, 0.15);
    R(354, 3, 32, 20, '#2a2a30');
    const dw = Math.round(16 * (1 - elevOpen));
    R(354, 3, dw, 20, '#b8bec8'); R(386 - dw, 3, dw, 20, '#b8bec8');
    if (dw > 1) { R(354 + dw - 1, 3, 1, 20, '#8a909a'); R(386 - dw, 3, 1, 20, '#8a909a'); }
    R(366, 1, 8, 1, elevT > 0 ? '#ffb43a' : '#553');
    /* табло котировок на стене коридора */
    const ctx = Spr.ctx();
    R(262, 89, 76, 16, '#3a2a20'); R(263, 90, 74, 14, '#111');
    ctx.save(); ctx.beginPath(); ctx.rect(264, 90, 72, 14); ctx.clip();
    const segs = [];
    for (const id in G.market.t) {
      const k = G.market.t[id];
      const ch = (k.price / k.open - 1) * 100;
      segs.push([id + ' ', '#ffb43a'], [k.price.toFixed(2) + ' ', '#e8e8e8'], [(ch >= 0 ? '^' : 'v') + Math.abs(ch).toFixed(1) + '%   ', ch >= 0 ? '#5dff7a' : '#ff5a5a']);
    }
    const totalW = segs.reduce((s, sg) => s + Font.width(sg[0]) + 1, 0);
    const ox = 336 - ((t * 14) % (totalW + 72));
    for (let rep = 0; rep < 2; rep++) {
      let xx = ox + rep * (totalW + 30);
      for (const [s, col] of segs) { txt(s, xx, 91, col); xx += Font.width(s) + 1; }
    }
    const l2 = `УТКИ ${Math.floor(G.ducks)}/${CFG.PLAN}`;
    txtC(l2, 300, 98, '#8fd3ff');
    ctx.restore();
    /* туалетные двери */
    [['wc1', 147], ['wc2', 166]].forEach(([k, x]) => {
      const occ = NPC.busy()[k] && NPC.busy()[k].hidden;
      if (occ) { R(x, 30, 15, 15, '#7a9ab8'); R(x, 30, 15, 1, '#9ab8d0'); R(x + 11, 37, 2, 2, '#d23c3c'); }
      else { R(x, 30, 3, 15, '#7a9ab8'); R(x + 11, 37, 2, 2, '#3fa34d'); }
    });
    /* миска */
    const c = NPC.cat();
    R(258, 72, 8, 4, '#c0392b'); R(259, 72, 6, 1, '#e05a4a');
    if (c && c.food) R(259, 71, 6, 2, '#8a5a2a');
    /* радио на кухне */
    R(228, 20, 6, 6, G.time < G.musicUntil && Math.floor(t * 4) % 2 ? '#e05a4a' : '#c0392b');
  }

  /* ---------- Цех ---------- */
  function drawConveyor() {
    const run = G.producing && G.phase === 'day';
    R(120, 252, 292, 6, '#3a3a3a');
    const off = Math.floor(belt.pos % 8);
    for (let x = 412 - off; x > 120; x -= 8) R(x - 3, 253, 3, 4, '#4a4a4a');
    R(120, 252, 292, 1, '#555'); R(120, 258, 292, 2, '#2a2a2a');
    for (const d of belt.ducks) Spr.duck(d.x, 243, true);
    /* пресс */
    R(412, 238, 30, 24, '#6b7380'); R(412, 238, 30, 2, '#8a929e'); R(414, 242, 26, 3, '#ffd23f');
    for (let k = 0; k < 6; k++) R(415 + k * 4, 242, 2, 3, '#222');
    const pst = run ? Math.abs(Math.sin(t * 6)) * 4 : 0;
    R(422, 246, 6, 2 + Math.round(pst), '#c0c6d0');
    R(412, 262, 30, 6, '#4a505a');
    const lampOn = Math.floor(t * 3) % 2;
    R(404, 240, 5, 5, '#222'); R(405, 241, 3, 3, run ? '#5dff7a' : (lampOn ? '#ff3a3a' : '#5a1a1a'));
    if (!run && G.phase === 'day') {
      const msg = G.time < G.breakdownUntil ? 'ПОЛОМКА' : (G.flags.rubberOut ? 'НЕТ РЕЗИНЫ' : 'СТОП');
      if (lampOn) txtC(msg, 260, 244, '#ff5a5a');
    }
    if (G.time < G.breakdownUntil && Math.random() < 0.3) emit(U.rand(416, 440), U.rand(246, 260), 'spark');
  }

  /* ---------- Люди ---------- */
  function moodOf(e) {
    const st = Sim.stage(e);
    if (e.act === 'sleep') return 'sleep';
    if (G.time < e.sleepUntil && e.state === 'seated' && st < 2) return 'sleep';
    if (e.state === 'visit' && e.bonus && st < 2) return 'happy';
    if (e.act === 'chat' || e.act === 'pet' || e.act === 'eat' || e.act === 'rest') return st >= 2 ? 'mad' : 'happy';
    return ['normal', 'stress', 'mad', 'crazy'][st];
  }
  const CARRY_ARMS = { cup: 'cup', docs: 'docs', tray: 'tray', pizza: 'pizza', crate: 'crate', clip: 'clip' };
  const ACT_ARMS = { phone: 'phone', mop: 'mop', hammer: 'hammer', fix: 'hammer', talk: 'clip', rampage: 'up', coffee: 'cup' };

  function drawAgent(a, isEmp) {
    if (a.hidden) { a.hx = null; return; }
    const st = isEmp ? Sim.stage(a) : 0;
    const walking = a.moving;
    const fr = Math.floor((walking ? (a.walkT || 0) * 8 : t * (st >= 2 ? 6 : 2)) + (a.anim || 0));
    let arms = (a.carry && CARRY_ARMS[a.carry]) || (a.act && ACT_ARMS[a.act]) || 'down';
    if (isEmp && a.carryBox) arms = 'box';
    if (isEmp && st >= 3 && arms === 'down') arms = walking ? 'up' : 'thump';
    const o = {
      walking, frame: fr, dir: a.dir, mood: isEmp ? moodOf(a) : (a.act === 'sleep' ? 'sleep' : 'normal'),
      arms, tieOnHead: isEmp && st >= 3, flush: isEmp && st >= 2,
    };
    if (a.pose === 'sit') o.sit = true;
    else if (a.pose === 'crouch') o.crouch = true;
    Spr.person(a.x, a.y, a.look, o);
    a.hx = a.x; a.hy = a.y - (o.sit ? 19 : o.crouch ? 22 : 25);
  }

  function pushEmployee(e, D) {
    if (e.gone) return;
    const st = Sim.stage(e);
    if (e.state === 'seated') {
      const d = DESKS[e.id], sx = d.x + 12;
      const fr = Math.floor(t * (st >= 2 ? 6 : 2) + e.anim);
      const sleeping = G.time < e.sleepUntil && st < 2;
      D.push({
        y: d.y + 1, f: () => {
          R(sx - 6, d.y - 12, 12, 13, '#3b3f4a'); R(sx - 6, d.y - 12, 12, 2, '#555b66');
          if (st === 3) return;
          if (st === 2) {
            Spr.person(sx, d.y + 2 - (fr % 2), e.look, { mood: 'mad', frame: fr, arms: 'up', flush: true });
            e.hx = sx; e.hy = d.y + 2 - 25;
          } else {
            const arms = e.activeClue && e.activeClue.icon === 'phone' ? 'phone' : 'down';
            const bob = !sleeping && fr % 2 && st === 1 ? 1 : 0;
            Spr.person(sx, d.y + 8 + bob, e.look, { mood: moodOf(e), frame: fr, arms, sweat: st === 1 && fr % 3 === 0 });
            e.hx = sx; e.hy = d.y + 8 - 25;
          }
        },
      });
      if (st === 3) {
        D.push({
          y: d.y + 23, f: () => {
            const jy = fr % 2;
            Spr.person(sx - 2, d.y + 9 - jy, e.look, { mood: 'crazy', frame: fr, arms: fr % 4 < 2 ? 'thump' : 'up', tieOnHead: true, flush: true });
            e.hx = sx - 2; e.hy = d.y + 9 - jy - 25;
          },
        });
      }
      hits.push({ x: sx - 8, y: d.y - 20, w: 16, h: 26, emp: e, label: `${e.name} · ${e.role}`, cb: () => UI.openDossier(e) });
    } else {
      if (e.hidden) {
        e.hx = null;
        const k = e.spot === 'wc1' ? 147 : 166;
        hits.push({ x: k, y: 28, w: 16, h: 18, emp: e, label: `${e.name} в туалете (${G.time - e.taskStart} мин)`, cb: () => UI.openDossier(e) });
        return;
      }
      const sortY = e.pose === 'sit' && e.spot && e.spot.startsWith('sofa') ? e.y + 1 : e.y;
      D.push({ y: sortY, f: () => drawAgent(e, true) });
      hits.push({
        x: e.x - 7, y: e.y - 25, w: 14, h: 26, emp: e,
        label: `${e.name} · ${e.state === 'errand' ? NPC.taskLabel(e) : e.role}`,
        cb: () => { if (e.state === 'visit' && !G.dialog) UI.openTalk(e); else UI.openDossier(e); },
      });
    }
  }

  function drawOverheads() {
    for (const e of G.emps) {
      if (e.gone || e.hx == null || e.hidden) continue;
      const hx = e.hx, hy = e.hy;
      const s = e.sanity;
      R(hx - 6, hy - 4, 12, 3, '#2b1d14');
      const col = s > 70 ? '#5cc85c' : s > 40 ? '#e8c33a' : s > 15 ? '#e8853a' : '#e04040';
      R(hx - 5, hy - 3, Math.max(1, Math.round(10 * s / 100)), 1, col);
      const bob = Math.floor(t * 3) % 2;
      if (e.activeClue) Spr.mark(e.activeClue.icon, hx - 3, hy - 13 - bob);
      else if (e.state === 'visit' && e.pendingTalk) Spr.mark('excl', hx - 3, hy - 13 - bob);
      else if (e.doubleAgent) Spr.mark('star', hx - 3, hy - 12);
      else if (e.evidence && !e.exiting) Spr.mark('bang', hx - 3, hy - 13 - bob);
      else if (e.act === 'server') Spr.mark('disk', hx - 3, hy - 12 - bob);
    }
    const h = hover && (hover.emp || hover.agent);
    if (h && h.hx != null) {
      const bob = Math.floor(t * 3) % 2, hx = h.hx, hy = h.hy - (hover.emp ? 0 : -4);
      R(hx - 2, hy - 18 - bob, 5, 1, '#ffd23f'); R(hx - 1, hy - 17 - bob, 3, 1, '#ffd23f'); R(hx, hy - 16 - bob, 1, 1, '#ffd23f');
    }
  }

  /* ---------- Частицы ---------- */
  function emit(x, y, type, n = 1) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, type, age: 0 };
      if (type === 'paper') Object.assign(p, { vx: U.rand(-22, 22), vy: U.rand(-45, -18), g: 38, life: 1.7, c: U.chance(0.2) ? '#f3e2a0' : '#ffffff' });
      else if (type === 'money') Object.assign(p, { vx: U.rand(-26, 26), vy: U.rand(-50, -22), g: 34, life: 2.2 });
      else if (type === 'rain') Object.assign(p, { vx: U.rand(-6, 6), vy: U.rand(18, 32), g: 4, life: 5 });
      else if (type === 'sweat') Object.assign(p, { vx: U.rand(-4, 4), vy: -8, g: 30, life: 0.7, c: '#8fd3ff' });
      else if (type === 'z') Object.assign(p, { vx: 5, vy: -9, g: 0, life: 1.8, c: '#cfe6ff' });
      else if (type === 'flash') Object.assign(p, { vx: 0, vy: 0, g: 0, life: 0.18 });
      else if (type === 'heart') Object.assign(p, { vx: U.rand(-3, 3), vy: -12, g: 0, life: 1.4 });
      else if (type === 'note') Object.assign(p, { vx: U.rand(-6, 6), vy: -10, g: 0, life: 2 });
      else if (type === 'spark') Object.assign(p, { vx: U.rand(-30, 30), vy: U.rand(-40, -10), g: 80, life: 0.5, c: U.pick(['#ffd23f', '#ff8a1c', '#fff']) });
      else if (type === 'confetti') Object.assign(p, { vx: U.rand(-30, 30), vy: U.rand(-60, -20), g: 45, life: 2, c: U.pick(['#ffd23f', '#e86a9a', '#5dff7a', '#8fd3ff', '#ff8a1c']) });
      parts.push(p);
    }
    if (parts.length > 450) parts.splice(0, parts.length - 450);
  }
  function drawParts() {
    for (const p of parts) {
      const a = 1 - p.age / p.life;
      if (p.type === 'z') { txt('Z', p.x, p.y, p.c); continue; }
      if (p.type === 'flash') { R(p.x - 2, p.y - 2, 5, 5, '#ffffff'); continue; }
      if (p.type === 'heart') { Spr.mark('heart', p.x - 3, p.y - 3); continue; }
      if (p.type === 'note') { Spr.mark('note', p.x - 3, p.y - 3); continue; }
      if (p.type === 'money' || p.type === 'rain') {
        const fl = Math.floor((p.age * 8 + p.x) % 2);
        R(p.x, p.y, fl ? 4 : 2, fl ? 2 : 3, '#5cb85c'); R(p.x + (fl ? 1 : 0), p.y, 1, 1, '#2e7d32');
        continue;
      }
      if (p.type === 'paper') {
        const fl = Math.floor((p.age * 10 + p.x) % 2);
        R(p.x, p.y, fl ? 3 : 2, fl ? 2 : 3, p.c);
        continue;
      }
      if (a > 0.1) R(p.x, p.y, p.type === 'sweat' ? 1 : p.type === 'spark' ? 1 : 2, p.type === 'spark' ? 1 : 2, p.c);
    }
  }
  function drawLitter() {
    for (const l of NPC.litter()) {
      if (l.type === 'coffee') { R(l.x - 4, l.y - 1, 8, 3, '#6a4020'); R(l.x - 2, l.y - 2, 5, 1, '#7a4a28'); R(l.x - 3, l.y + 2, 3, 1, '#6a4020'); }
      else { R(l.x - 2, l.y - 1, 5, 3, '#f4f0e4'); R(l.x - 2, l.y - 1, 5, 1, '#fff'); R(l.x + 1 - l.r, l.y, 2, 1, '#bbb'); }
    }
  }

  /* ---------- Публичное ---------- */
  function init() { bg = buildBg(); }

  function update(dt) {
    t += dt;
    if (shakeT > 0) shakeT -= dt;
    if (elevT > 0) elevT -= dt;
    const active = G.phase === 'day' && !G.paused;
    if (!active) return;
    NPC.update(dt * G.speed);
    /* конвейер */
    if (G.producing) {
      belt.pos += 20 * dt * G.speed;
      for (const d of belt.ducks) d.x -= 20 * dt * G.speed;
      belt.ducks = belt.ducks.filter(d => d.x > 114);
      belt.spawnT -= dt;
      if (belt.acc >= 5 && belt.spawnT <= 0) { belt.acc -= 5; belt.spawnT = 0.5; belt.ducks.push({ x: 400 }); }
      belt.acc = Math.min(belt.acc, 40);
    }
    /* эффекты сотрудников */
    for (const e of G.emps) {
      if (e.gone || e.hx == null || e.hidden) continue;
      const st = Sim.stage(e);
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) {
        e.fxT = 1;
        if (e.state === 'seated') {
          if (G.time < e.sleepUntil && st < 2) { emit(e.hx + 4, e.hy + 2, 'z'); e.fxT = 1.3; }
          else if (st === 1) { emit(e.hx + 5, e.hy + 6, 'sweat'); e.fxT = U.rand(1.6, 3); }
          else if (st === 2) { emit(e.hx, e.hy + 10, 'paper', 2); e.fxT = U.rand(0.4, 0.9); }
          else if (st === 3) { emit(e.hx, e.hy + 6, 'money', 2); emit(e.hx, e.hy + 8, 'paper'); e.fxT = U.rand(0.25, 0.5); }
          if (e.activeClue && e.activeClue.icon === 'cam' && U.chance(0.5)) emit(e.hx + 6, e.hy + 9, 'flash');
        } else if (e.act === 'sleep') { emit(e.hx + 4, e.hy + 2, 'z'); e.fxT = 1.3; }
        else if (e.act === 'print') { emit(238, 124, 'paper'); e.fxT = 0.5; }
        else if (e.act === 'rampage' || (st >= 3 && e.moving)) { emit(e.hx, e.hy + 8, 'money', 2); e.fxT = 0.3; }
        else if (e.act === 'pet' || e.act === 'feed') { const c = NPC.cat(); if (c) emit(c.x, c.y - 12, 'heart'); e.fxT = 1.2; }
      }
      e.bubbleCD -= dt;
      if (e.bubbleCD <= 0) {
        if (st >= 2) {
          say(e, U.pick(Data.SHOUTS[st]), 1.8);
          if (t - lastShout > 0.9) { Sfx.play('shout'); lastShout = t; }
          e.bubbleCD = U.rand(3, 7) / (st - 1);
        } else if (st === 1 && U.chance(0.4)) { say(e, U.pick(Data.SHOUTS[1]), 1.6); e.bubbleCD = U.rand(8, 16); }
        else if (e.state === 'seated' && U.chance(0.12) && G.time >= e.sleepUntil) { say(e, U.fill(U.pick(Data.SPEAK_WORK), e), 1.5); e.bubbleCD = U.rand(14, 26); }
        else e.bubbleCD = U.rand(6, 12);
      }
    }
    /* кот мяукает у пустой миски */
    const c = NPC.cat();
    if (c) {
      c.fxT = (c.fxT || 0) - dt;
      if (c.fxT <= 0) {
        c.fxT = U.rand(2.5, 4);
        if (c.act === 'meow' || c.onDesk && NPC.catHungry()) { say(c, U.pick(['Мяу!', 'МЯЯУ!', 'Мрр-мяу?']), 1.2); Sfx.play('meow'); }
        else if (c.pose === 'loaf' && !c.moving) emit(c.x + 3, c.y - 8, 'z');
      }
    }
    for (const a of NPC.staff()) {
      if (a.act === 'mop' && Math.random() < dt * 2) emit(a.x + 6, a.y, 'sweat');
    }
    if (G.time < G.musicUntil) {
      noteT -= dt;
      if (noteT <= 0) { noteT = 0.5; emit(U.pick([231, 222, 322]), U.pick([20, 126, 126]), 'note'); }
    }
    if (G.chaos >= 70 && Math.random() < dt * (G.chaos - 60) / 6) emit(U.rand(132, 344), 120, 'rain');
    for (const p of parts) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt + (p.type === 'paper' || p.type === 'rain' || p.type === 'note' ? Math.sin(p.age * 6 + p.x) * 0.3 : 0);
      p.y += p.vy * dt;
    }
    parts = parts.filter(p => p.age < p.life && p.y < 288);
  }

  function addHit(x, y, w, h, label, cb, extra) { hits.push(Object.assign({ x, y, w, h, label, cb }, extra || {})); }

  function render(ctx) {
    Spr.use(ctx);
    ctx.save();
    if (shakeT > 0) ctx.translate(Math.round(U.rand(-2, 2) * Math.min(1, shakeT)), Math.round(U.rand(-1, 1) * Math.min(1, shakeT)));
    hits = [];
    ctx.drawImage(bg, 0, 0);
    drawWallDynamic();
    drawConveyor();
    drawCrates();
    drawLitter();

    /* комнаты — самый нижний слой кликов */
    const roomCb = {
      acc: () => UI.openPanel('terminal', 'balance'), srv: () => UI.openPanel('room', 'srv'), wc: () => UI.openPanel('room', 'wc'),
      kit: () => UI.openPanel('room', 'kit'), rec: () => UI.openPanel('phone'), meet: () => UI.openPanel('room', 'meet'),
      store: () => UI.openPanel('room', 'store'), prod: () => UI.openPanel('room', 'store'),
      out: () => UI.say(G.time < (G.flags.truckUntil || 0) ? 'У входа стоит грузовик. Курьер разгружается.' : 'За окном — город. Где-то там сидит Гусев и строит козни.'),
    };
    for (const r of Plan.ROOMS) if (roomCb[r.id]) addHit(r.x, r.y, r.w, r.h, r.tip, roomCb[r.id]);

    const D = [];
    for (let i = 0; i < 8; i++) D.push({ y: DESKS[i].y + 22, f: () => drawDesk(i) });
    [184, 292].forEach(x => [142, 196].forEach(y => D.push({ y: y + 22.5, f: () => drawDivider(x, y) })));
    for (const e of G.emps) pushEmployee(e, D);
    D.push({ y: ZINA_DESK.y + 22, f: () => drawSmallDesk(ZINA_DESK, 'excel', 2) });
    D.push({ y: AKH_DESK.y + 22, f: () => drawSmallDesk(AKH_DESK, 'code', 5) });
    D.push({ y: 60, f: drawCounter });
    D.push({ y: 70, f: drawKitTable });
    D.push({ y: 168, f: drawMeetTable });
    Plan.MEET_SEATS.filter(s => s.back).forEach(s => D.push({ y: s.y + 3, f: () => drawMeetChairBack(s) }));
    D.push({
      y: 167, f: () => {
        const fr = Math.floor(t * 2);
        const talking = G.dialog && (G.dialogKind === 'call');
        Spr.person(64, 174, PLAYER_LOOK, { mood: G.chaos > 70 ? 'stress' : 'normal', frame: fr, arms: talking ? 'phone' : 'down', sweat: G.chaos > 75 && fr % 3 === 0 });
      },
    });
    D.push({ y: 190, f: drawPlayerDesk });
    for (const a of NPC.staff()) {
      if (a.pose === 'desk' && !a.moving && !a.script) {
        const dk = a.kind === 'zina' ? ZINA_DESK : AKH_DESK;
        const sx = a.kind === 'zina' ? dk.x + 12 : dk.x + 10;
        D.push({ y: dk.y + 1, f: () => { R(sx - 6, dk.y - 12, 12, 13, '#3b3f4a'); Spr.person(sx, dk.y + 8, a.look, { frame: Math.floor(t * 2 + a.anim), mood: 'normal' }); a.hx = sx; a.hy = dk.y - 17; } });
      } else D.push({ y: a.y, f: () => drawAgent(a, false) });
      addHit(a.x - 7, (a.pose === 'desk' ? a.y + 4 : a.y) - 25, 14, 26, `${a.name} · ${a.title}`, () => clickStaff(a), { agent: a });
    }
    const c = NPC.cat();
    if (c) {
      D.push({
        y: c.onDesk ? 191 : c.y, f: () => {
          const pose = c.moving ? 'walk' : (c.pose === 'eat' ? 'eat' : c.pose === 'loaf' ? 'loaf' : 'sit');
          Spr.cat(c.x, c.y, pose, c.left, Math.floor(t * (c.moving ? 8 : 1.5)));
          c.hx = c.x; c.hy = c.y - 4;
        },
      });
      addHit(c.x - 7, c.y - 12, 14, 13, `Кот Кексик · ${NPC.catHungry() ? 'голоден!' : 'сыт и доволен'}`, () => NPC.clickCat(), { agent: c });
    }
    D.sort((a, b) => a.y - b.y);
    for (const d of D) d.f();

    drawOverheads();
    drawParts();

    /* предметы на столе */
    const { x, y } = BOSS;
    addHit(x + 2, y - 10, 18, 18, 'Терминал: финансы и биржа', () => UI.openPanel('terminal'));
    addHit(x + 21, y - 1, 12, 10, 'Штампы: разобрать документы', () => UI.openPanel('docs'));
    addHit(x + 55, y - 12, 18, 24, `Входящие документы (${G.inbox.length})`, () => UI.openPanel('docs'));
    addHit(x + 70, y - 12, 15, 24, G.call ? 'Звонит телефон! Ответить' : 'Телефон', () => (G.call ? UI.answerCall() : UI.openPanel('phone')));
    addHit(56, 150, 16, 22, 'Это вы, менеджер · журнал дня', () => UI.openPanel('journal'));
    addHit(58, 129, 16, 12, 'Основатель компании, Утка Крякович', () => UI.say('Основатель компании. Говорят, он начинал с одной утки и мечты.'));
    addHit(8, 126, 30, 30, 'Книжный шкаф', () => UI.say(U.pick(['«Как перестать беспокоиться и начать крякать»', '«Утка, которая стоила миллиард»', '«Менеджмент для чайников. Том 7»', '«Искусство войны с гусями»'])));
    addHit(22, 64, 16, 16, `Сейф: ${U.money(G.cash)}`, () => UI.openPanel('terminal', 'balance'));
    addHit(262, 89, 76, 16, 'Котировки — открыть биржу', () => UI.openPanel('terminal', 'market'));
    addHit(196, 14, 12, 16, 'Кофемашина — «Кофе всем»', () => UI.openPanel('room', 'kit'));
    addHit(256, 66, 34, 12, `Миска и лежанка Кексика${NPC.cat().food ? ' (есть еда)' : ''}`, () => NPC.clickCat());
    addHit(226, 122, 24, 18, 'Принтер. Ахмет его ненавидит', () => UI.say('Принтер жуёт бумагу с 1998 года.'));
    for (let i = 0; i < 8; i++) {
      const e = G.emps[i];
      if (e.gone || e.state !== 'seated') {
        const d = DESKS[i];
        const why = e.gone ? { fired: 'уволен(а)', home: 'ушёл(ла) домой', quit: 'уволился(ась)', fled: 'сбежал(а)' }[e.gone] : NPC.taskLabel(e);
        addHit(d.x, d.y - 8, 40, 30, `Стол: ${e.name} — ${e.state === 'visit' ? 'у вас в кабинете' : e.state === 'walk' ? 'идёт' : why}`, () => UI.openDossier(e));
      }
    }

    /* освещение */
    const k = U.clamp((G.time - U.T(16, 0)) / 120, 0, 1);
    if (k > 0) { ctx.fillStyle = `rgba(255,120,40,${k * 0.12})`; ctx.fillRect(0, 0, W, H); }
    if (G.time < G.musicUntil) { ctx.fillStyle = 'rgba(120,180,255,0.05)'; ctx.fillRect(128, 106, 220, 130); }
    if (G.chaos > 55) {
      const a = ((G.chaos - 55) / 45) * (0.16 + 0.08 * Math.sin(t * 6));
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(210,20,20,${a * (1 - i / 4)})`;
        ctx.fillRect(i * 3, i * 3, W - i * 6, 3); ctx.fillRect(i * 3, H - 3 - i * 3, W - i * 6, 3);
        ctx.fillRect(i * 3, i * 3, 3, H - i * 6); ctx.fillRect(W - 3 - i * 3, i * 3, 3, H - i * 6);
      }
    }
    ctx.restore();
    updateBubbles();
  }

  function clickStaff(a) {
    if (a.kind === 'galya') UI.openPanel('phone');
    else if (a.kind === 'akhmet') UI.openPanel('room', 'srv');
    else if (a.kind === 'zina') UI.openPanel('terminal', 'balance');
    else if (a.kind === 'mikh') UI.openPanel('room', 'store');
    else if (a.kind === 'valya') { UI.say('Тётя Валя: «Ноги! Я только помыла!»'); say(a, 'Ноги!!!', 1.5); }
    else if (a.kind === 'psy') UI.openPanel('room', 'meet');
    else UI.say(`${a.name}: «Я тут по делу, не отвлекайте».`);
  }

  /* ---------- Реплики (DOM) ---------- */
  function say(a, text, dur) { if (a) a.bubble = { text, until: t + (dur || 1.8) }; }
  function updateBubbles() {
    const layer = document.getElementById('bubbles');
    const all = G.emps.concat(NPC.staff(), NPC.cat() ? [NPC.cat()] : []);
    const live = new Set();
    for (const a of all) {
      const key = a.key;
      live.add(key);
      let el = bubEls[key];
      const show = a.bubble && t < a.bubble.until && !a.gone && !a.hidden && a.hx != null && G.phase === 'day';
      if (!el) {
        if (!show) continue;
        el = document.createElement('div');
        el.className = 'bubble';
        layer.appendChild(el);
        bubEls[key] = el;
      }
      if (show) {
        if (el.textContent !== a.bubble.text) el.textContent = a.bubble.text;
        el.style.left = (a.hx * scale) + 'px';
        el.style.top = ((a.hy - 6) * scale) + 'px';
        el.classList.add('show');
        el.classList.toggle('shout', !!(a.sanity != null && a.sanity <= 40));
      } else el.classList.remove('show');
    }
    for (const k in bubEls) if (!live.has(k)) { bubEls[k].remove(); delete bubEls[k]; }
  }

  function hitTest(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
    }
    return null;
  }

  return {
    init, update, render, hitTest, say, emit,
    setScale: s => { scale = s; },
    setHover: h => { hover = h; },
    feedDucks: n => { belt.acc += n; },
    shake: s => { shakeT = Math.max(shakeT, s); },
    openElevator: () => { elevT = 2; },
    confetti: () => { for (let i = 0; i < 6; i++) emit(U.rand(150, 340), U.rand(120, 220), 'confetti', 6); },
    time: () => t,
  };
})();
