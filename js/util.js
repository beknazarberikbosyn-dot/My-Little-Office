'use strict';
/* Общие утилиты */
const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: p => Math.random() < p,
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
  num(v) {
    return Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  },
  money(v, plus) {
    const s = U.num(v);
    if (v < -0.5) return '−$' + s;
    return (plus && v > 0.5 ? '+$' : '$') + s;
  },
  time(min) {
    min = Math.floor(min);
    const h = Math.floor(min / 60), m = min % 60;
    return h + ':' + String(m).padStart(2, '0');
  },
  T: (h, m) => h * 60 + (m || 0),
  esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = U.clamp((n >> 16) + amt, 0, 255);
    const g = U.clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = U.clamp((n & 255) + amt, 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },
  /* Шаблоны: {name} — имя, {м|ж} — окончание по роду */
  fill(str, e) {
    if (!e) return str;
    return str
      .replace(/\{name\}/g, e.name)
      .replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m, f) => (e.female ? f : m));
  },
  dist: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
};
