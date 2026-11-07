'use strict';
/* Запуск, игровой цикл, ввод */
const Game = (() => {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let last = performance.now(), ringT = 0;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let s = Math.min(vw / W, vh / H);
    if (s >= 2) s = Math.floor(s * 2) / 2;
    s = Math.max(0.8, s);
    const w = Math.round(W * s), h = Math.round(H * s);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const st = $('stage');
    st.style.width = w + 'px'; st.style.height = h + 'px';
    document.documentElement.style.setProperty('--u', s + 'px');
    document.documentElement.style.fontSize = U.clamp(s * 4.3, 11, 19) + 'px';
    World.setScale(s);
  }

  function toWorld(ev) {
    const r = cv.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  function start() {
    Sfx.init();
    Sfx.startMusic();
    Sfx.play('open');
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    G.phase = 'intro';
    setTimeout(() => {
      Content.intro(() => {
        G.phase = 'day';
        UI.toast('Рабочий день начался! Первый документ уже летит в лоток.', 'good');
        setTimeout(() => UI.toast('Совет: кликните по сотруднику за стеклом, чтобы открыть его досье.', 'info'), 2500);
      });
    }, 500);
  }

  function togglePause() {
    if (G.phase !== 'day') return;
    G.paused = !G.paused;
    $('pause').classList.toggle('hidden', !G.paused);
    Sfx.play('click');
  }
  function toggleSpeed() {
    if (G.phase !== 'day') return;
    G.speed = G.speed === 1 ? 2 : 1;
    $('b-speed').innerHTML = `<img src="${Spr.iconURL(G.speed > 1 ? 'fast' : 'play', 3)}" alt="">`;
    UI.toast(G.speed > 1 ? 'Время ускорено ×2' : 'Обычная скорость времени', 'info');
  }

  function endOfDay() {
    G.phase = 'ending';
    UI.close();
    if (UI.dialogOpen()) UI.closeDialog();
    UI.tooltip(null);
    const f = $('fade');
    f.innerHTML = '<div><b>18:00</b><span>Рабочий день окончен.<br>Совет директоров ждёт вас.</span></div>';
    f.classList.add('show');
    Sfx.play('ring');
    setTimeout(() => {
      $('hud').classList.add('hidden');
      document.querySelectorAll('.bubble').forEach(b => b.classList.remove('show'));
      const report = Sim.endDay();
      Board.start(report);
      setTimeout(() => f.classList.remove('show'), 300);
    }, 2600);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.phase === 'day' && !G.paused) {
      const rate = G.dialog ? 0.25 : (G.panel === 'docs' ? 0.5 : 1) * G.speed;
      G.acc += (dt * rate) / CFG.SEC_PER_MIN;
      while (G.acc >= 1 && G.phase === 'day') {
        G.acc -= 1;
        Sim.minute();
        G.time++;
        if (G.time >= CFG.DAY_END) { endOfDay(); break; }
      }
      if (G.call) {
        ringT -= dt;
        if (ringT <= 0) { Sfx.play('ring'); ringT = 2.4; }
      } else ringT = 0;
    }
    World.update(G.paused ? 0 : dt);
    if (G.phase === 'board' || G.phase === 'verdict') Board.render(ctx, dt);
    else World.render(ctx);
    UI.update(dt);
    Sfx.setChaos(G.phase === 'day' ? G.chaos : 0);
    requestAnimationFrame(loop);
  }

  function boot() {
    ctx.imageSmoothingEnabled = false;
    Sim.newGame();
    World.init();
    UI.init();
    resize();
    window.addEventListener('resize', resize);

    cv.addEventListener('pointermove', ev => {
      if (G.phase !== 'day' || G.paused) { World.setHover(null); UI.tooltip(null); cv.style.cursor = 'default'; return; }
      const p = toWorld(ev);
      const h = World.hitTest(p.x, p.y);
      World.setHover(h);
      cv.style.cursor = h ? 'pointer' : 'default';
      UI.tooltip(h ? h.label : null, ev.clientX, ev.clientY);
    });
    cv.addEventListener('pointerleave', () => { World.setHover(null); UI.tooltip(null); });
    cv.addEventListener('click', ev => {
      if (G.phase !== 'day' || G.paused || G.dialog) return;
      const p = toWorld(ev);
      const h = World.hitTest(p.x, p.y);
      if (h) { Sfx.play('click'); h.cb(); }
    });
    window.addEventListener('keydown', ev => {
      if (UI.onKey(ev)) { ev.preventDefault(); return; }
      const k = ev.key.toLowerCase();
      if (k === ' ' && G.phase === 'day') { ev.preventDefault(); togglePause(); }
      else if ((k === 'f' || k === 'а') && G.phase === 'day') toggleSpeed();
      else if (k === 'm' || k === 'ь') $('b-sound').click();
      else if (k === 'enter' && G.phase === 'title') start();
    });
    $('btn-start').addEventListener('click', start);
    $('btn-how').addEventListener('click', () => { $('how').classList.toggle('hidden'); Sfx.init(); Sfx.play('click'); });
    $('pause').addEventListener('click', togglePause);
    window.dbg = {
      get G() { return G; },
      skip(min) { for (let i = 0; i < min && G.phase === 'day'; i++) { Sim.minute(); G.time++; if (G.time >= CFG.DAY_END) { endOfDay(); break; } } },
      start,
      speed(n) { G.speed = n; },
    };
    requestAnimationFrame(loop);
  }

  boot();
  return { togglePause, toggleSpeed, start };
})();
