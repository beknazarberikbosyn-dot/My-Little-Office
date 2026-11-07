'use strict';
/* План этажа: комнаты, двери, препятствия, точки интереса и поиск пути */
const W = 480, H = 288;

const Plan = (() => {
  /* Комнаты: прямоугольники пола (для подсказок, кликов и отрисовки) */
  const ROOMS = [
    { id: 'acc', name: 'Бухгалтерия', x: 4, y: 0, w: 80, h: 84, tip: 'Бухгалтерия — баланс и финансы' },
    { id: 'srv', name: 'Серверная', x: 88, y: 0, w: 52, h: 84, tip: 'Серверная — журнал доступа' },
    { id: 'wc', name: 'Туалет', x: 144, y: 0, w: 40, h: 84, tip: 'Туалет — кто там засел?' },
    { id: 'kit', name: 'Комната отдыха', x: 188, y: 0, w: 112, h: 84, tip: 'Комната отдыха — кофе, диван и кот' },
    { id: 'rec', name: 'Ресепшен', x: 304, y: 0, w: 96, h: 84, tip: 'Ресепшен и лифт — секретарь Галя' },
    { id: 'out', name: 'Улица', x: 404, y: 0, w: 76, h: 84, tip: 'Улица. Сюда приезжает грузовик с резиной' },
    { id: 'hall', name: 'Коридор', x: 4, y: 106, w: 472, h: 18, tip: 'Коридор' },
    { id: 'boss', name: 'Ваш кабинет', x: 4, y: 128, w: 120, h: 108, tip: 'Ваш кабинет' },
    { id: 'open', name: 'Опен-спейс', x: 128, y: 124, w: 220, h: 112, tip: 'Опен-спейс — отдел продаж и производства' },
    { id: 'meet', name: 'Переговорная', x: 352, y: 128, w: 124, h: 48, tip: 'Переговорная — планёрки и психолог' },
    { id: 'store', name: 'Склад резины', x: 352, y: 180, w: 124, h: 56, tip: 'Склад резины' },
    { id: 'prod', name: 'Цех', x: 4, y: 240, w: 472, h: 48, tip: 'Цех: конвейер резиновых уток' },
  ];

  /* Столы сотрудников: два ряда кабинок по 2+2 */
  const DESKS = [];
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    DESKS.push({ x: [144, 184, 252, 292][col], y: row ? 196 : 142, w: 40 });
  }
  const seat = i => ({ x: DESKS[i].x + 12, y: DESKS[i].y - 4 });

  /* Где можно ходить (ступни персонажа) */
  const WALK = [
    [8, 26, 72, 56], [92, 26, 44, 56], [148, 26, 32, 56], [192, 26, 104, 56], [308, 26, 88, 56],
    [60, 78, 14, 32], [120, 78, 14, 32], [157, 78, 14, 32], [238, 78, 14, 32], [344, 78, 52, 32],
    [8, 108, 464, 16],
    [132, 108, 212, 124],
    [8, 146, 112, 86], [116, 202, 20, 22],
    [340, 152, 20, 14], [356, 142, 116, 32],
    [340, 208, 20, 14], [356, 194, 116, 38],
    [458, 226, 12, 52], [96, 272, 376, 12],
  ];
  /* Мебель, через которую нельзя пройти */
  const BLOCK = [
    // бухгалтерия
    [12, 44, 42, 24], [56, 24, 24, 16], [22, 66, 16, 14], [8, 68, 12, 12],
    // серверная
    [90, 24, 50, 16], [90, 56, 26, 18],
    // туалет
    [146, 24, 36, 22],
    // кухня
    [190, 24, 46, 18], [238, 24, 14, 18], [256, 26, 10, 14], [268, 24, 30, 14], [204, 54, 32, 16],
    [270, 64, 18, 12], [190, 68, 10, 12], [258, 70, 8, 6],
    // ресепшен
    [308, 40, 40, 20], [384, 26, 12, 12], [360, 62, 36, 10],
    // кабинет
    [8, 142, 30, 14], [50, 146, 28, 18], [20, 164, 88, 28], [106, 146, 14, 12], [8, 210, 26, 22],
    // опен-спейс
    [226, 124, 24, 16], [334, 126, 10, 10],
    [182, 128, 4, 14], [290, 128, 4, 14], [182, 182, 4, 14], [290, 182, 4, 14],
    // переговорная и склад
    [368, 148, 88, 22], [366, 190, 106, 18],
  ];
  DESKS.forEach(d => BLOCK.push([d.x - 2, d.y, 44, 24]));

  /* Точки интереса */
  const P = {
    visitor: { x: 64, y: 214, dir: 'up' },
    tray: { x: 98, y: 198, dir: 'up' },
    bossDoor: { x: 140, y: 214, dir: 'left' },
    elevator: { x: 370, y: 28, dir: 'up' },
    galya: { x: 326, y: 36, dir: 'down' },
    zina: { x: 26, y: 40, dir: 'down' },
    akhmet: { x: 100, y: 52, dir: 'down' },
    rack: { x: 130, y: 46, dir: 'up' },
    coffee: { x: 202, y: 46, dir: 'up' },
    fridge: { x: 245, y: 46, dir: 'up' },
    cooler1: { x: 263, y: 48, dir: 'left' },
    cooler2: { x: 249, y: 52, dir: 'right' },
    sofa1: { x: 277, y: 40, dir: 'down', sit: true },
    sofa2: { x: 291, y: 40, dir: 'down', sit: true },
    table1: { x: 213, y: 51, dir: 'down', sit: true },
    table2: { x: 228, y: 51, dir: 'down', sit: true },
    bowl: { x: 253, y: 73, dir: 'right' },
    catBed: { x: 279, y: 71 },
    wc1: { x: 155, y: 50, dir: 'up' },
    wc2: { x: 174, y: 50, dir: 'up' },
    printer: { x: 238, y: 146, dir: 'up' },
    store: { x: 418, y: 214, dir: 'up' },
    press: { x: 428, y: 274, dir: 'up' },
    psy: { x: 361, y: 158, dir: 'right' },
    safe: { x: 30, y: 60 },
  };
  const MEET_SEATS = [];
  [380, 400, 420, 444].forEach(x => {
    MEET_SEATS.push({ x, y: 145, dir: 'down', sit: true });
    MEET_SEATS.push({ x, y: 174, dir: 'up', sit: true, back: true });
  });
  const HALL_SPOTS = [{ x: 40, y: 116 }, { x: 150, y: 116 }, { x: 290, y: 116 }, { x: 420, y: 116 }, { x: 460, y: 116 }];

  /* ---------- Навигационная сетка 4×4 ---------- */
  const C = 4, GW = W / C, GH = H / C;
  const grid = new Uint8Array(GW * GH);
  const inR = (x, y, r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
  for (let cy = 0; cy < GH; cy++) {
    for (let cx = 0; cx < GW; cx++) {
      const x = cx * C + 2, y = cy * C + 2;
      if (WALK.some(r => inR(x, y, r)) && !BLOCK.some(r => inR(x, y, r))) grid[cy * GW + cx] = 1;
    }
  }
  const ok = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && grid[cy * GW + cx] === 1;
  const walkable = (x, y) => ok(Math.floor(x / C), Math.floor(y / C));

  function nearest(x, y) {
    let cx = U.clamp(Math.floor(x / C), 0, GW - 1), cy = U.clamp(Math.floor(y / C), 0, GH - 1);
    if (ok(cx, cy)) return [cx, cy];
    for (let r = 1; r < 14; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (ok(cx + dx, cy + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [cx + dx, cy + dy]; } }
      }
      if (best) return best;
    }
    return null;
  }

  function los(ax, ay, bx, by) {
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy, x = ax, y = ay;
    for (let n = 0; n < 400; n++) {
      if (!ok(x, y)) return false;
      if (x === bx && y === by) return true;
      const e2 = 2 * err;
      let mx = false, my = false;
      if (e2 >= dy) { err += dy; x += sx; mx = true; }
      if (e2 <= dx) { err += dx; y += sy; my = true; }
      if (mx && my && (!ok(x - sx, y) || !ok(x, y - sy))) return false;
    }
    return false;
  }

  const prev = new Int32Array(GW * GH);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function path(x0, y0, x1, y1) {
    const a = nearest(x0, y0), b = nearest(x1, y1);
    if (!a || !b) return [{ x: x1, y: y1 }];
    const si = a[1] * GW + a[0], ti = b[1] * GW + b[0];
    prev.fill(-1);
    prev[si] = si;
    const q = [si];
    let found = si === ti;
    for (let h = 0; h < q.length && !found; h++) {
      const i = q[h], cx = i % GW, cy = (i / GW) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
        const ni = ny * GW + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i;
        if (ni === ti) { found = true; break; }
        q.push(ni);
      }
    }
    if (!found) return [{ x: x1, y: y1 }];
    const cells = [];
    for (let i = ti; ; i = prev[i]) { cells.push(i); if (i === si) break; }
    cells.reverse();
    /* натягиваем путь по прямой видимости */
    const pts = [];
    let k = 0;
    while (k < cells.length - 1) {
      let j = cells.length - 1;
      const ax = cells[k] % GW, ay = (cells[k] / GW) | 0;
      while (j > k + 1 && !los(ax, ay, cells[j] % GW, (cells[j] / GW) | 0)) j--;
      pts.push({ x: (cells[j] % GW) * C + 2, y: ((cells[j] / GW) | 0) * C + 2 });
      k = j;
    }
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - x1, last.y - y1) > 0.5) pts.push({ x: x1, y: y1 });
    return pts;
  }

  function randomIn(roomId) {
    const r = ROOMS.find(q => q.id === roomId);
    for (let n = 0; n < 60; n++) {
      const x = U.rand(r.x + 4, r.x + r.w - 4), y = U.rand(r.y + 4, r.y + r.h - 4);
      if (walkable(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  function roomAt(x, y) {
    for (const r of ROOMS) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    return null;
  }

  return { ROOMS, DESKS, seat, P, MEET_SEATS, HALL_SPOTS, path, walkable, randomIn, roomAt, WALK, BLOCK };
})();
