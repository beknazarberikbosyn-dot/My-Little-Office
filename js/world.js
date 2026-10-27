'use strict';
/* Отрисовка офиса и всё, что в нём движется */
const W = 384, H = 224;
const PLAYER_LOOK = { skin: '#e8b88a', hair: '#1b1b22', hairStyle: 'slick', shirt: '#ffffff', tie: '#c0392b', pants: '#222222', jacket: '#23324a' };

const World = (() => {
  const LY = {
    partX: 136,
    desks: [],
    pDesk: { x: 30, y: 108, w: 84 },
    visitor: { x: 72, y: 162 },
  };
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    LY.desks.push({ x: 152 + col * 56, y: row ? 142 : 86, w: 40 });
  }

  let bg = null, t = 0, shakeT = 0, elevT = 0, elevOpen = 0;
  let hits = [], parts = [], hover = null;
  const belt = { pos: 0, ducks: [], acc: 0, spawnT: 0, piston: 0 };
  const bubEls = {};
  let scale = 3, lastShout = 0;
  const R = (...a) => Spr.R(...a);

  /* ---------- Пути ---------- */
  const lane = e => (e.row ? 178 : 120);
  const standPos = e => ({ x: LY.desks[e.id].x + 12, y: LY.desks[e.id].y });
  function pathToOffice(e) {
    const d = LY.desks[e.id], gx = d.x - 7, ln = lane(e);
    return [{ x: gx, y: d.y }, { x: gx, y: ln }, { x: 146, y: ln }, { x: 146, y: 178 }, { x: 124, y: 178 }, { x: 98, y: 172 }, { x: LY.visitor.x, y: LY.visitor.y }];
  }
  function pathToDesk(e) {
    const d = LY.desks[e.id], gx = d.x - 7, ln = lane(e);
    return [{ x: 98, y: 172 }, { x: 124, y: 178 }, { x: 146, y: 178 }, { x: 146, y: ln }, { x: gx, y: ln }, { x: gx, y: d.y }, { x: d.x + 12, y: d.y }];
  }
  function pathLeave(e, fromDesk) {
    if (fromDesk) {
      const d = LY.desks[e.id], gx = d.x - 7, ln = lane(e);
      return [{ x: gx, y: d.y }, { x: gx, y: ln }, { x: 146, y: ln }, { x: 146, y: 58 }, { x: 163, y: 50 }];
    }
    return [{ x: 98, y: 172 }, { x: 124, y: 178 }, { x: 146, y: 178 }, { x: 146, y: 58 }, { x: 163, y: 50 }];
  }

  /* ---------- Цвета ---------- */
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
    for (let n = 0; n < 200; n++) {
      R(x0, y0, 1, 1, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* ---------- Статичный фон ---------- */
  function buildBg() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    Spr.use(cv.getContext('2d'));

    /* стены */
    R(0, 0, W, 44, '#ecdcb6');
    for (let x = 0; x < W; x += 6) R(x, 4, 1, 26, '#e2cfa4');
    R(0, 0, W, 3, '#5a3a22'); R(0, 3, W, 1, '#7a5132');
    R(0, 30, W, 14, '#9b6a3c'); R(0, 30, W, 1, '#c99460'); R(0, 31, W, 1, '#b07a45');
    for (let x = 3; x < W; x += 14) { R(x, 33, 10, 8, '#8d5e33'); R(x, 33, 10, 1, '#a8703a'); R(x, 40, 10, 1, '#7a4f29'); }
    R(0, 42, W, 2, '#5e3d1f');

    /* паркет кабинета */
    for (let y = 44, r = 0; y < H; y += 6, r++) {
      for (let x = -((r % 3) * 8); x < 136; x += 24) {
        const c = (((x + 64) / 8 + r) % 2) ? '#b98450' : '#ad7845';
        R(x, y, 24, 6, c); R(x, y, 24, 1, '#c79361'); R(x + 23, y, 1, 6, '#8e5e33');
      }
    }
    /* ковёр */
    R(12, 88, 120, 106, '#5e1e1e'); R(14, 90, 116, 102, '#9e3b3b'); R(18, 94, 108, 94, '#7a2a2a');
    for (let x = 22; x < 122; x += 8) { R(x, 96, 4, 2, '#c9a14a'); R(x, 184, 4, 2, '#c9a14a'); }
    for (let y = 100; y < 182; y += 8) { R(20, y, 2, 4, '#c9a14a'); R(122, y, 2, 4, '#c9a14a'); }

    /* ковролин open space */
    for (let y = 44; y < 186; y += 16) {
      for (let x = 140; x < W; x += 16) {
        const odd = ((x - 140) / 16 + (y - 44) / 16) & 1;
        R(x, y, 16, 16, odd ? '#7d8da0' : '#76869a');
        R(x + 3, y + 5, 1, 1, '#8a9aae'); R(x + 11, y + 12, 1, 1, '#6c7c90'); R(x + 8, y + 2, 1, 1, '#6c7c90');
      }
    }
    R(0, 44, W, 2, 'rgba(0,0,0,0.12)');

    /* книжный шкаф */
    R(3, 5, 30, 46, '#4a2e18'); R(4, 6, 28, 44, '#6b4226'); R(6, 8, 24, 40, '#3e2614');
    const bookC = ['#c0392b', '#2c3e7a', '#1f6f4a', '#d4a017', '#7a2c6f', '#e8e2d0', '#a8432a', '#3b6ea8'];
    [8, 21, 34].forEach((sy, si) => {
      let bx = 7;
      while (bx < 28) {
        const w = 2 + ((bx * 7 + si) % 2), h = 8 + ((bx + si * 3) % 3);
        R(bx, sy + 11 - h, w, h, bookC[(bx + si * 5) % bookC.length]);
        R(bx, sy + 11 - h, w, 1, 'rgba(255,255,255,0.25)');
        bx += w + ((bx % 5) === 0 ? 1 : 0);
      }
      R(6, sy + 11, 24, 2, '#6e4628');
    });
    Spr.duck(20, 1);

    /* рама окна (стекло рисуется динамически) */
    R(38, 5, 50, 27, '#f3ead6'); R(38, 31, 50, 2, '#c8b894');

    /* портрет основателя */
    R(110, 6, 22, 24, '#a8832e'); R(111, 7, 20, 22, '#d4a24c'); R(113, 9, 16, 18, '#2f4a3c');
    Spr.duck(116, 15);
    R(118, 11, 6, 4, '#111'); R(117, 14, 8, 1, '#111');
    R(121, 18, 2, 2, '#c9a14a');
    R(116, 26, 10, 1, '#c9a14a');

    /* кулер */
    R(120, 50, 12, 16, '#e8e8e8'); R(120, 50, 12, 1, '#fff'); R(130, 50, 2, 16, '#c8c8c8');
    R(122, 36, 8, 14, '#7fc6ef'); R(123, 37, 2, 11, '#c8ecff'); R(121, 35, 10, 2, '#5a9ac0');
    R(122, 55, 3, 2, '#3b6ea8'); R(127, 55, 3, 2, '#d23c3c');
    /* фикус */
    R(5, 74, 14, 12, '#b5652f'); R(5, 74, 14, 2, '#d07a40'); R(6, 85, 12, 2, '#7a4520');
    [[6, 62], [12, 58], [3, 66], [14, 64], [9, 54], [10, 66]].forEach(([x, y]) => { R(x, y, 6, 6, '#3f8f3a'); R(x + 1, y, 3, 2, '#5cb85c'); });
    /* сейф */
    R(6, 150, 20, 22, '#4a4f58'); R(6, 150, 20, 2, '#6a707a'); R(8, 153, 16, 16, '#3a3f48');
    R(14, 158, 5, 5, '#c9a14a'); R(16, 160, 1, 1, '#3a3f48'); R(21, 158, 2, 6, '#888');
    /* урна */
    R(118, 128, 8, 9, '#6a6f78'); R(118, 128, 8, 1, '#8a8f98');

    /* перегородка */
    R(136, 40, 4, 110, '#4a3a2e'); R(137, 40, 2, 110, '#9fd0e0'); R(137, 40, 1, 110, '#d8f2fa');
    R(136, 188, 4, 36, '#4a3a2e'); R(137, 188, 2, 36, '#9fd0e0');
    R(135, 147, 6, 3, '#3a2a20'); R(135, 186, 6, 3, '#3a2a20');

    /* лифт (двери динамические) */
    R(143, 6, 38, 38, '#7a808a'); R(144, 7, 36, 37, '#9aa0aa');
    R(155, 8, 14, 3, '#1c1c1c');
    /* табло-рама */
    R(186, 5, 124, 18, '#3a2a20'); R(187, 6, 122, 16, '#111');

    /* кофемашина и принтер в open space */
    R(366, 96, 16, 22, '#3a3a3a'); R(366, 96, 16, 2, '#555'); R(368, 100, 12, 5, '#8fd3ff');
    R(370, 108, 8, 5, '#222'); R(372, 110, 4, 3, '#fff'); R(366, 117, 16, 3, '#2a2a2a');
    R(362, 154, 20, 14, '#d8d8d0'); R(362, 154, 20, 2, '#f0f0e8'); R(364, 150, 16, 4, '#fff');
    R(366, 160, 12, 2, '#444'); R(377, 157, 3, 2, '#5dff7a'); R(362, 167, 20, 3, '#aaa');
    /* кадки */
    [[370, 64], [370, 130]].forEach(([x, y]) => {
      R(x, y + 10, 10, 8, '#b5652f'); R(x, y + 10, 10, 1, '#d07a40');
      R(x - 2, y, 6, 6, '#3f8f3a'); R(x + 5, y - 2, 6, 7, '#3f8f3a'); R(x + 1, y + 4, 8, 6, '#5cb85c');
    });
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
      default:
        R(x, y, 11, 8, '#14161c');
        R(x + ((f * 3 + seed) % 11), y + ((f + seed) % 8), 1, 1, '#556');
    }
  }

  /* ---------- Столы сотрудников ---------- */
  function drawDesk(i) {
    const d = LY.desks[i], x = d.x, y = d.y;
    const e = G.emps[i];
    R(x + 1, y + 22, 40, 2, 'rgba(0,0,0,0.22)');
    R(x, y, 40, 12, '#c48a4f'); R(x, y, 40, 1, '#dba56b'); R(x, y + 11, 40, 1, '#a8703a');
    R(x, y + 12, 40, 10, '#8e5a2e'); R(x, y + 12, 40, 1, '#a86e3a');
    R(x + 27, y + 14, 11, 6, '#7a4c26'); R(x + 31, y + 16, 3, 1, '#d4a24c');
    /* клавиатура и бумаги */
    R(x + 5, y + 6, 14, 4, '#e8e2d0'); R(x + 5, y + 9, 14, 1, '#b8b2a0');
    for (let k = 0; k < 6; k++) R(x + 6 + k * 2, y + 7, 1, 1, '#a09a88');
    R(x + 1, y + 3, 4, 6, '#fff'); R(x + 1, y + 4, 3, 1, '#bbb'); R(x + 1, y + 6, 3, 1, '#bbb');
    /* чашки кофе по уровню нервов */
    const cups = e && !e.gone ? Math.min(3, Sim.stage(e) + (e.id % 2)) : 0;
    for (let c = 0; c < cups; c++) { R(x + 18 - c * 4, y + 1, 3, 3, '#f4f4f4'); R(x + 18 - c * 4, y + 1, 3, 1, '#5a3a22'); }
    /* монитор */
    R(x + 22, y - 8, 16, 14, '#d8d0bc'); R(x + 22, y - 8, 16, 1, '#ece6d6'); R(x + 36, y - 8, 2, 14, '#b3aa93');
    R(x + 26, y + 6, 8, 3, '#b3aa93');
    drawScreen(x + 24, y - 6, e ? screenMode(e) : 'off', i * 3);
  }

  /* ---------- Рабочее место игрока ---------- */
  function drawPlayerDesk() {
    const { x, y, w } = LY.pDesk;
    R(x + 2, y + 24, w - 4, 3, 'rgba(0,0,0,0.25)');
    R(x, y, w, 14, '#8a3f2a'); R(x, y, w, 1, '#a85a40'); R(x, y + 13, w, 1, '#6e3020');
    R(x + 22, y + 3, 40, 9, '#2f5a3a'); R(x + 22, y + 3, 40, 1, '#3f7a4a');
    R(x, y + 14, w, 10, '#5e2a1c'); R(x, y + 14, w, 1, '#d4a24c');
    R(x + 4, y + 16, 18, 6, '#4e2216'); R(x + 12, y + 18, 3, 1, '#d4a24c');
    R(x + 62, y + 16, 18, 6, '#4e2216'); R(x + 70, y + 18, 3, 1, '#d4a24c');
    R(x + 31, y + 15, 22, 8, '#a8832e'); R(x + 32, y + 16, 20, 6, '#d4a24c');
    Font.draw(Spr.ctx(), 'BOSS', x + 35, y + 16, '#5a3a10');

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
      Font.draw(Spr.ctx(), String(Math.min(9, G.inbox.length)), x + 69, by - 5 + 0.5, '#fff');
    }

    /* телефон */
    const ring = G.call && Math.floor(t * 10) % 2;
    R(x + 72, y + 4, 11, 7, '#c0392b'); R(x + 72, y + 4, 11, 1, '#e05a4a'); R(x + 75, y + 6, 5, 3, '#f3e2a0');
    if (G.call) {
      R(x + 71 + (ring ? 1 : -1), y - 1, 13, 3, '#8e2a20');
      Spr.mark('phone', x + 74, y - 12 - (ring ? 1 : 0));
    } else {
      R(x + 71, y + 2, 13, 3, '#8e2a20');
    }
  }

  /* ---------- Динамика стены ---------- */
  function drawWallDynamic() {
    /* окно кабинета */
    const sk = sky(G.time);
    R(40, 7, 46, 23, sk);
    const bc = mix(sk, '#203048', 0.55), lit = G.time > U.T(16, 40);
    [[40, 16, 8], [49, 12, 6], [56, 18, 9], [66, 10, 7], [74, 15, 6], [81, 19, 5]].forEach(([bx, by, bw], i) => {
      R(bx, by, bw, 30 - by, bc);
      for (let wy = by + 2; wy < 28; wy += 3) for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) {
        if (((wx * 3 + wy * 7 + i) % 5) < 2) R(wx, wy, 1, 1, lit ? '#ffd86a' : mix(bc, '#ffffff', 0.18));
      }
    });
    R(62, 7, 2, 23, '#f3ead6'); R(40, 18, 46, 1, '#f3ead6');
    R(42, 9, 1, 6, 'rgba(255,255,255,0.5)'); R(44, 9, 1, 3, 'rgba(255,255,255,0.4)');

    /* настенные часы */
    const cx = 99, cy = 15;
    R(cx - 6, cy - 4, 13, 9, '#5a3a22'); R(cx - 4, cy - 6, 9, 13, '#5a3a22'); R(cx - 5, cy - 5, 11, 11, '#5a3a22');
    R(cx - 5, cy - 3, 11, 7, '#f8f4e8'); R(cx - 3, cy - 5, 7, 11, '#f8f4e8'); R(cx - 4, cy - 4, 9, 9, '#f8f4e8');
    R(cx, cy - 5, 1, 1, '#999'); R(cx, cy + 5, 1, 1, '#999'); R(cx - 5, cy, 1, 1, '#999'); R(cx + 5, cy, 1, 1, '#999');
    const m = G.time % 60, h = (G.time / 60) % 12;
    const am = (m / 60) * Math.PI * 2 - Math.PI / 2, ah = (h / 12) * Math.PI * 2 - Math.PI / 2;
    line(cx, cy, cx + Math.cos(ah) * 2.6, cy + Math.sin(ah) * 2.6, '#222');
    line(cx, cy, cx + Math.cos(am) * 4.2, cy + Math.sin(am) * 4.2, '#c0392b');

    /* лифт */
    elevOpen = U.lerp(elevOpen, elevT > 0 ? 1 : 0, 0.15);
    R(148, 12, 28, 32, '#2a2a30');
    const dw = Math.round(14 * (1 - elevOpen));
    R(148, 12, dw, 32, '#b8bec8'); R(176 - dw, 12, dw, 32, '#b8bec8');
    if (dw > 1) { R(148 + dw - 1, 12, 1, 32, '#8a909a'); R(176 - dw, 12, 1, 32, '#8a909a'); }
    R(156, 9, 12, 1, elevT > 0 ? '#ffb43a' : '#553');
    Font.draw(Spr.ctx(), 'EXIT', 155, 1, '#5dff7a');

    /* бегущая строка с котировками */
    const ctx = Spr.ctx();
    ctx.save();
    ctx.beginPath(); ctx.rect(188, 7, 120, 14); ctx.clip();
    const segs = [];
    for (const id in G.market.t) {
      const k = G.market.t[id];
      const ch = (k.price / k.open - 1) * 100;
      segs.push([id + ' ', '#ffb43a'], [k.price.toFixed(2) + ' ', '#e8e8e8'], [(ch >= 0 ? '^' : 'v') + Math.abs(ch).toFixed(1) + '%   ', ch >= 0 ? '#5dff7a' : '#ff5a5a']);
    }
    const totalW = segs.reduce((s, sg) => s + sg[0].length * 4, 0);
    let ox = 308 - ((t * 16) % (totalW + 120));
    for (let rep = 0; rep < 2; rep++) {
      let xx = ox + rep * (totalW + 40);
      for (const [txt, col] of segs) { Font.draw(ctx, txt, xx, 8, col); xx += txt.length * 4; }
    }
    const ln2 = `DUCKS ${Math.floor(G.ducks)}/${CFG.PLAN}  RUBBER ${Math.round(G.rubber)}KG`;
    Font.draw(ctx, ln2, 248 - Font.width(ln2) / 2, 15, G.flags.rubberOut ? (Math.floor(t * 4) % 2 ? '#ff5a5a' : '#552') : '#8fd3ff');
    ctx.restore();
  }

  /* ---------- Цех за стеклом ---------- */
  function drawConveyor() {
    const run = G.producing && G.phase === 'day';
    R(140, 186, 244, 38, '#262a33');
    for (let x = 150; x < W; x += 40) R(x, 188, 3, 36, '#30353f');
    for (let x = 160; x < W; x += 40) { R(x, 188, 6, 2, '#ffd86a'); R(x + 1, 190, 4, 1, 'rgba(255,216,106,0.4)'); }
    /* пресс */
    R(144, 188, 24, 20, '#6b7380'); R(144, 188, 24, 2, '#8a929e'); R(146, 192, 20, 3, '#ffd23f');
    for (let k = 0; k < 5; k++) R(147 + k * 4, 192, 2, 3, '#222');
    const pst = run ? Math.abs(Math.sin(t * 6)) * 4 : 0;
    R(154, 196, 4, 2 + Math.round(pst), '#c0c6d0');
    /* лента */
    R(140, 200, 244, 6, '#3a3a3a');
    const off = Math.floor(belt.pos % 8);
    for (let x = 140 + off - 8; x < W; x += 8) R(x, 201, 3, 4, '#4a4a4a');
    R(140, 200, 244, 1, '#555');
    for (let x = 144; x < W; x += 16) { R(x, 206, 5, 4, '#555'); R(x + 1, 207, 3, 2, '#777'); R(x + 2, 210, 1, 14, '#333'); }
    /* утки */
    for (const d of belt.ducks) Spr.duck(d.x, 191, false, d.evil);
    /* приёмный ящик */
    R(364, 194, 20, 14, '#c49a6c'); R(364, 194, 20, 2, '#d9b384'); R(364, 207, 20, 1, '#9b764d');
    Font.draw(Spr.ctx(), 'QUAK', 366, 199, '#6b4a2e');
    /* лампа состояния */
    const lampOn = Math.floor(t * 3) % 2;
    R(174, 189, 5, 5, '#222'); R(175, 190, 3, 3, run ? '#5dff7a' : (lampOn ? '#ff3a3a' : '#5a1a1a'));
    if (!run && G.phase === 'day') {
      const msg = G.time < G.breakdownUntil ? 'BREAKDOWN' : (G.flags.rubberOut ? 'NO RUBBER' : 'STOP');
      if (lampOn) Font.draw(Spr.ctx(), msg, 186, 189, '#ff5a5a');
    }
    /* отражение стекла и рама */
    for (let i = 0; i < 4; i++) { const sx = 180 + i * 60; line(sx, 222, sx + 18, 188, 'rgba(255,255,255,0.05)'); }
    R(140, 186, 244, 2, '#4a3a2e'); R(140, 188, 244, 1, '#9fd0e0');
  }

  /* ---------- Люди ---------- */
  function moodOf(e) {
    const st = Sim.stage(e);
    if (G.time < e.sleepUntil && e.state === 'seated' && st < 2) return 'sleep';
    if (e.state === 'visit' && e.bonus && st < 2) return 'happy';
    return ['normal', 'stress', 'mad', 'crazy'][st];
  }

  function pushEmployee(e, D) {
    if (e.gone) return;
    const st = Sim.stage(e);
    const d = LY.desks[e.id];
    const sx = d.x + 12;
    const fr = Math.floor(t * (st >= 2 ? 6 : 2) + e.anim);
    if (e.state === 'seated') {
      const sleeping = G.time < e.sleepUntil;
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
      hits.push({ x: sx - 8, y: d.y - 20, w: 16, h: 26, id: 'emp' + e.id, emp: e, label: `${e.name} · ${e.role}`, cb: () => UI.openDossier(e) });
    } else {
      const walking = e.state === 'walk';
      D.push({
        y: e.y, f: () => {
          const fr2 = Math.floor(e.walkT * 8);
          Spr.person(e.x, e.y, e.look, {
            walking, frame: walking ? fr2 : fr, dir: e.dir, mood: moodOf(e),
            arms: e.carryBox ? 'box' : (st === 3 && !walking ? 'thump' : 'down'), tieOnHead: st === 3, flush: st >= 2,
          });
          e.hx = e.x; e.hy = e.y - 25;
        },
      });
      hits.push({
        x: e.x - 7, y: e.y - 25, w: 14, h: 26, id: 'emp' + e.id, emp: e, label: `${e.name} · ${e.role}`,
        cb: () => { if (e.state === 'visit' && !G.dialog) UI.openTalk(e); else UI.openDossier(e); },
      });
    }
  }

  function drawOverheads() {
    for (const e of G.emps) {
      if (e.gone || e.hx == null) continue;
      const hx = e.hx, hy = e.hy;
      const s = e.sanity;
      R(hx - 6, hy - 4, 12, 3, '#2b1d14');
      const col = s > 70 ? '#5cc85c' : s > 40 ? '#e8c33a' : s > 15 ? '#e8853a' : '#e04040';
      R(hx - 5, hy - 3, Math.max(1, Math.round(10 * s / 100)), 1, col);
      const bob = Math.floor(t * 3) % 2;
      if (e.activeClue) Spr.mark(e.activeClue.icon, hx - 3, hy - 13 - bob);
      else if (e.doubleAgent) Spr.mark('star', hx - 3, hy - 12);
      else if (e.evidence && !e.exiting) Spr.mark('bang', hx - 3, hy - 13 - bob);
      if (hover && hover.emp === e) {
        R(hx - 2, hy - 18 - bob, 5, 1, '#ffd23f'); R(hx - 1, hy - 17 - bob, 3, 1, '#ffd23f'); R(hx, hy - 16 - bob, 1, 1, '#ffd23f');
      }
    }
  }

  /* ---------- Частицы ---------- */
  function emit(x, y, type, n = 1) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, type, age: 0 };
      if (type === 'paper') Object.assign(p, { vx: U.rand(-22, 22), vy: U.rand(-45, -18), g: 38, life: 1.7, c: U.chance(0.2) ? '#f3e2a0' : '#ffffff' });
      else if (type === 'money') Object.assign(p, { vx: U.rand(-26, 26), vy: U.rand(-50, -22), g: 34, life: 2.2, c: '#5cb85c' });
      else if (type === 'rain') Object.assign(p, { vx: U.rand(-6, 6), vy: U.rand(18, 32), g: 4, life: 5, c: '#5cb85c' });
      else if (type === 'sweat') Object.assign(p, { vx: U.rand(-4, 4), vy: -8, g: 30, life: 0.7, c: '#8fd3ff' });
      else if (type === 'z') Object.assign(p, { vx: 5, vy: -9, g: 0, life: 1.8, c: '#cfe6ff' });
      else if (type === 'flash') Object.assign(p, { vx: 0, vy: 0, g: 0, life: 0.18, c: '#ffffff' });
      else if (type === 'confetti') Object.assign(p, { vx: U.rand(-30, 30), vy: U.rand(-60, -20), g: 45, life: 2, c: U.pick(['#ffd23f', '#e86a9a', '#5dff7a', '#8fd3ff', '#ff8a1c']) });
      parts.push(p);
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  function drawParts() {
    for (const p of parts) {
      const a = 1 - p.age / p.life;
      if (p.type === 'z') { Font.draw(Spr.ctx(), 'Z', p.x, p.y, p.c); continue; }
      if (p.type === 'flash') { R(p.x - 2, p.y - 2, 5, 5, '#ffffff'); continue; }
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
      if (a > 0.1) R(p.x, p.y, p.type === 'sweat' ? 1 : 2, 2, p.c);
    }
  }

  /* ---------- Публичное ---------- */
  function init() { bg = buildBg(); }

  function update(dt) {
    t += dt;
    if (shakeT > 0) shakeT -= dt;
    if (elevT > 0) elevT -= dt;
    const active = G.phase === 'day' && !G.paused;
    if (active) {
      /* ходьба */
      for (const e of G.emps) {
        if (e.state !== 'walk') continue;
        const tg = e.path[0];
        if (!tg) { Sim.arrive(e); continue; }
        const dx = tg.x - e.x, dy = tg.y - e.y, dd = Math.hypot(dx, dy);
        const sp = 44 * (e.carryBox ? 0.8 : 1) * (Sim.stage(e) >= 3 ? 1.35 : 1);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        if (dd <= sp * dt) {
          e.x = tg.x; e.y = tg.y; e.path.shift();
          if (e.path.length && e.path.length <= 1 && e.purpose === 'leave') elevT = 2.2;
          if (!e.path.length) Sim.arrive(e);
        } else {
          e.x += (dx / dd) * sp * dt; e.y += (dy / dd) * sp * dt; e.walkT += dt;
        }
      }
      /* конвейер */
      if (G.producing) {
        belt.pos += 20 * dt;
        for (const d of belt.ducks) d.x += 20 * dt;
        belt.ducks = belt.ducks.filter(d => d.x < 366);
        belt.spawnT -= dt;
        if (belt.acc >= 5 && belt.spawnT <= 0) {
          belt.acc -= 5; belt.spawnT = 0.5;
          belt.ducks.push({ x: 168, evil: false });
        }
        belt.acc = Math.min(belt.acc, 40);
      }
      /* эффекты людей */
      for (const e of G.emps) {
        if (e.gone || e.state !== 'seated' || e.hx == null) continue;
        const st = Sim.stage(e);
        e.fxT = (e.fxT || 0) - dt;
        if (e.fxT <= 0) {
          if (G.time < e.sleepUntil && st < 2) { emit(e.hx + 4, e.hy + 2, 'z'); e.fxT = 1.3; }
          else if (st === 1) { emit(e.hx + 5, e.hy + 6, 'sweat'); e.fxT = U.rand(1.6, 3); }
          else if (st === 2) { emit(e.hx, e.hy + 10, 'paper', 2); e.fxT = U.rand(0.4, 0.9); }
          else if (st === 3) { emit(e.hx, e.hy + 6, 'money', 2); emit(e.hx, e.hy + 8, 'paper'); e.fxT = U.rand(0.25, 0.5); }
          else e.fxT = 1;
          if (e.activeClue && e.activeClue.icon === 'cam' && U.chance(0.5)) emit(e.hx + 6, e.hy + 9, 'flash');
        }
        e.bubbleCD -= dt;
        if (e.bubbleCD <= 0) {
          if (st >= 2) {
            say(e, U.pick(Data.SHOUTS[st]), 1.8);
            if (t - lastShout > 0.9) { Sfx.play('shout'); lastShout = t; }
            e.bubbleCD = U.rand(3, 7) / (st - 1);
          } else if (st === 1 && U.chance(0.4)) { say(e, U.pick(Data.SHOUTS[1]), 1.6); e.bubbleCD = U.rand(8, 16); }
          else if (U.chance(0.12) && G.time >= e.sleepUntil) { say(e, U.fill(U.pick(Data.SPEAK_WORK), e), 1.5); e.bubbleCD = U.rand(14, 26); }
          else e.bubbleCD = U.rand(6, 12);
        }
      }
      /* денежный дождь при безумии */
      if (G.chaos >= 70 && Math.random() < dt * (G.chaos - 60) / 6) emit(U.rand(142, 380), 44, 'rain');
    }
    for (const p of parts) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt + (p.type === 'paper' || p.type === 'rain' ? Math.sin(p.age * 6 + p.x) * 0.3 : 0);
      p.y += p.vy * dt;
    }
    parts = parts.filter(p => p.age < p.life && p.y < 186);
  }

  function render(ctx) {
    Spr.use(ctx);
    ctx.save();
    if (shakeT > 0) ctx.translate(Math.round(U.rand(-2, 2) * Math.min(1, shakeT)), Math.round(U.rand(-1, 1) * Math.min(1, shakeT)));
    hits = [];
    ctx.drawImage(bg, 0, 0);
    drawWallDynamic();
    drawConveyor();

    const D = [];
    for (let i = 0; i < 8; i++) D.push({ y: LY.desks[i].y + 22, f: () => drawDesk(i) });
    for (const e of G.emps) pushEmployee(e, D);
    D.push({ y: 112, f: () => { R(62, 88, 20, 20, '#3a2218'); R(63, 89, 18, 2, '#5a3828'); R(61, 100, 22, 8, '#2e1a12'); } });
    D.push({
      y: 113, f: () => {
        const fr = Math.floor(t * 2);
        const talking = G.dialog && G.dialogKind === 'call';
        Spr.person(72, 116, PLAYER_LOOK, {
          mood: G.chaos > 70 ? 'stress' : 'normal', frame: fr,
          arms: talking ? 'phone' : 'down', sweat: G.chaos > 75 && fr % 3 === 0,
          dir: G.visitor && G.visitor.state === 'visit' ? 'down' : 'down',
        });
      },
    });
    D.push({ y: 132, f: drawPlayerDesk });
    D.sort((a, b) => a.y - b.y);
    for (const d of D) d.f();

    drawOverheads();
    drawParts();

    const { x, y } = LY.pDesk;
    hits.push({ x: x + 2, y: y - 10, w: 18, h: 18, id: 'pc', label: 'Терминал: финансы и биржа', cb: () => UI.openPanel('terminal') });
    hits.push({ x: x + 21, y: y - 1, w: 12, h: 10, id: 'stamps', label: 'Штампы: разобрать документы', cb: () => UI.openPanel('docs') });
    hits.push({ x: x + 55, y: y - 12, w: 18, h: 24, id: 'tray', label: `Входящие документы (${G.inbox.length})`, cb: () => UI.openPanel('docs') });
    hits.push({ x: x + 70, y: y - 12, w: 15, h: 24, id: 'phone', label: G.call ? 'Звонит телефон! Ответить' : 'Телефон', cb: () => (G.call ? UI.answerCall() : UI.openPanel('phone')) });
    hits.push({ x: 64, y: 90, w: 16, h: 20, id: 'me', label: 'Это вы, менеджер', cb: () => UI.openPanel('journal') });
    hits.push({ x: 110, y: 6, w: 22, h: 24, id: 'portrait', label: 'Основатель компании, Утка Крякович', cb: () => UI.say('Основатель компании. Говорят, он начинал с одной утки и мечты.') });
    hits.push({ x: 3, y: 5, w: 30, h: 46, id: 'books', label: 'Книжный шкаф', cb: () => UI.say(U.pick(['«Как перестать беспокоиться и начать крякать»', '«Утка, которая стоила миллиард»', '«Менеджмент для чайников. Том 7»', '«Искусство войны с гусями»'])) });
    hits.push({ x: 6, y: 150, w: 20, h: 22, id: 'safe', label: `Сейф: ${U.money(G.cash)}`, cb: () => UI.openPanel('terminal', 'balance') });
    hits.push({ x: 140, y: 186, w: 244, h: 38, id: 'conv', label: G.producing ? 'Цех: конвейер работает' : 'Цех: конвейер стоит!', cb: () => UI.openPanel('terminal', 'balance') });
    hits.push({ x: 186, y: 5, w: 124, h: 18, id: 'ticker', label: 'Котировки — открыть биржу', cb: () => UI.openPanel('terminal', 'market') });
    hits.push({ x: 366, y: 96, w: 16, h: 24, id: 'coffee', label: 'Кофемашина — «Кофе всем» по телефону', cb: () => UI.openPanel('phone') });
    for (let i = 0; i < 8; i++) {
      const e = G.emps[i];
      if (e.gone) {
        const d = LY.desks[i];
        hits.push({ x: d.x, y: d.y - 8, w: 40, h: 30, id: 'empty' + i, label: `Пустой стол — ${e.name} (${{ fired: 'уволен', home: 'ушёл домой', quit: 'уволился', fled: 'сбежал' }[e.gone]})`, cb: () => UI.openDossier(e) });
      }
    }

    /* освещение */
    const k = U.clamp((G.time - U.T(16, 0)) / 120, 0, 1);
    if (k > 0) { ctx.fillStyle = `rgba(255,120,40,${k * 0.12})`; ctx.fillRect(0, 0, W, H); }
    if (G.time < G.musicUntil) {
      ctx.fillStyle = 'rgba(120,180,255,0.05)'; ctx.fillRect(140, 44, 244, 142);
    }
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

  /* ---------- Реплики (DOM) ---------- */
  function say(e, text, dur) { e.bubble = { text, until: t + dur }; }
  function updateBubbles() {
    const layer = document.getElementById('bubbles');
    for (const e of G.emps) {
      let el = bubEls[e.id];
      const show = e.bubble && t < e.bubble.until && !e.gone && e.hx != null && G.phase === 'day';
      if (!el) {
        if (!show) continue;
        el = document.createElement('div');
        el.className = 'bubble';
        layer.appendChild(el);
        bubEls[e.id] = el;
      }
      if (show) {
        if (el.textContent !== e.bubble.text) el.textContent = e.bubble.text;
        el.style.left = (e.hx * scale) + 'px';
        el.style.top = ((e.hy - 6) * scale) + 'px';
        el.classList.add('show');
        el.classList.toggle('shout', Sim.stage(e) >= 2);
      } else el.classList.remove('show');
    }
  }

  function hitTest(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
    }
    return null;
  }

  return {
    LY, init, update, render, hitTest, say, emit, standPos, pathToOffice, pathToDesk, pathLeave,
    setScale: s => { scale = s; },
    setHover: h => { hover = h; },
    feedDucks: n => { belt.acc += n; },
    shake: s => { shakeT = Math.max(shakeT, s); },
    openElevator: () => { elevT = 2; },
    confetti: () => { for (let i = 0; i < 6; i++) emit(U.rand(160, 360), U.rand(60, 160), 'confetti', 6); },
    time: () => t,
  };
})();
