'use strict';
/* Запуск, игровой цикл, ввод */
const Game = (() => {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let last = performance.now(), ringT = 0, DS = 1;

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
    document.documentElement.style.fontSize = U.clamp(s * 4.7, 12, 21) + 'px';
    /* холст рисуем в разрешении экрана: пиксель-арт масштабируется целым числом, текст остаётся чётким */
    const ds = U.clamp(Math.round(s * (window.devicePixelRatio || 1)), 1, 5);
    if (ds !== DS || cv.width !== W * ds) { DS = ds; cv.width = W * DS; cv.height = H * DS; }
    World.setScale(s, DS);
  }

  function toWorld(ev) {
    const r = cv.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  let musicOn = false;
  function start() {
    Sfx.init();
    if (!musicOn) { Sfx.startMusic(); musicOn = true; }
    Sfx.play('open');
    $('title').classList.add('hidden');
    $('board').classList.add('hidden');
    $('hud').classList.remove('hidden');
    G.phase = 'intro';
    setTimeout(() => {
      Content.intro(() => {
        G.phase = 'day';
        if (G.day === 1) {
          UI.toast('Рабочий день начался! Первый документ уже летит в лоток.', 'good');
          setTimeout(() => UI.toast('Совет: кликните по сотруднику за стеклом, чтобы открыть его досье.', 'info'), 2500);
        } else {
          UI.toast(`День ${G.day} начался. Свежая газета — на рабочем столе, вкладка «Новости» (N).`, 'good', () => UI.openPanel('docs', 'news'));
          const v = Hire.vacancies().length;
          if (v) setTimeout(() => UI.toast(`Пустых столов: ${v}. Резюме кандидатов придут во вкладку «Резюме».`, 'info', () => UI.openPanel('docs', 'cv')), 2500);
        }
      });
    }, 500);
  }
  function freshDay() {
    World.resetDay();
    UI.resetDay();
    G.paused = false;
    $('pause').classList.add('hidden');
  }
  /* Продолжить сохранённую карьеру (id — из архива) */
  function continueGame(id) {
    if (id) Saves.setCurrent(id);
    const o = Saves.read();
    if (!o) { titleState(); return; }
    Sim.restore(o);
    freshDay();
    if (G.ended) {               /* сохранились на вердикте совета — сразу утро */
      $('title').classList.add('hidden');
      Sfx.init();
      if (!musicOn) { Sfx.startMusic(); musicOn = true; }
      nextDay();
    } else if (G.time <= CFG.DAY_START) start();
    else resume();
  }
  /* Вернуться в середину дня без утреннего вступления */
  function resume() {
    Sfx.init();
    if (!musicOn) { Sfx.startMusic(); musicOn = true; }
    Sfx.play('open');
    $('title').classList.add('hidden');
    $('board').classList.add('hidden');
    $('hud').classList.remove('hidden');
    G.phase = 'day';
    UI.toast(`Игра загружена: ${Sim.WEEK_FULL[Sim.weekday()].toLowerCase()}, день ${G.day}, ${U.time(G.time)}.`, 'good');
  }
  /* С чистого листа: новый офис, новые люди. Прошлая карьера остаётся в архиве */
  function newCareer() {
    Saves.create();
    Sim.newGame();
    freshDay();
    start();
    setTimeout(save, 1200);
  }
  /* Автосохранение */
  let lastSave = 0;
  function save(manual) {
    if (!['day', 'intro', 'verdict'].includes(G.phase)) return false;
    const ok = Sim.save();
    lastSave = performance.now();
    if (manual) UI.toast(ok ? 'Игра сохранена.' : 'Не удалось сохранить: хранилище браузера недоступно или переполнено.', ok ? 'good' : 'bad');
    return ok;
  }
  function toMenu() {
    save();
    location.reload();
  }
  /* Вечер → утро: всё сегодняшнее переходит в завтра */
  function nextDay() {
    const f = $('fade');
    const d = G.day + 1;
    f.innerHTML = `<div><b>${Sim.WEEK_FULL[Sim.weekday(d)]}</b><span>День ${d}. 9:00.<br>Кофе, лифт, лоток с документами…</span></div>`;
    f.classList.add('show');
    Sfx.play('open');
    setTimeout(() => {
      Sim.nextDay();
      freshDay();
      start();
      setTimeout(() => f.classList.remove('show'), 350);
    }, 1500);
  }
  function titleState() {
    Saves.migrate();
    const cur = Saves.active();
    const all = Saves.index();
    const c = $('btn-continue');
    c.classList.toggle('hidden', !cur);
    $('btn-archive').classList.toggle('hidden', !all.length);
    $('btn-start').textContent = cur ? 'Новая игра' : 'Начать рабочий день';
    $('btn-start').classList.toggle('big', !cur);
    if (cur) {
      c.textContent = cur.ended ? `Продолжить · утро дня ${cur.day + 1}` : `Продолжить · день ${cur.day}, ${U.time(cur.time || CFG.DAY_START)}`;
      $('title-note').textContent = `${cur.name}: ${Sim.WEEK_FULL[Sim.weekday(cur.day)].toLowerCase()}, день ${cur.day} · ${(cur.rank || 'Менеджер').toLowerCase()} · касса ${U.money(cur.cash || 0)}. Новая игра не сотрёт её — она останется в архиве.`;
    } else {
      $('title-note').textContent = 'Понедельник · День 1 · В 18:00 — совет директоров. Игра сохраняется сама.';
    }
    renderArchive();
  }
  function renderArchive() {
    const box = $('archive');
    const all = Saves.index().slice().sort((a, b) => b.updated - a.updated);
    const cur = Saves.current();
    const date = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    box.innerHTML = `<h3>Архив карьер</h3>` + (all.length ? `<ul>${all.map(s => {
      const fired = s.status === 'fired';
      const where = fired ? `уволен на ${s.day}-й день` : s.ended ? `день ${s.day}, вечер после совета` : `день ${s.day}, ${U.time(s.time || 540)}`;
      return `<li class="${fired ? 'fired' : ''} ${s.id === cur && !fired ? 'cur' : ''}">
        <div><b>${U.esc(s.name)}</b>${s.id === cur && !fired ? '<em>текущая</em>' : ''}${fired ? '<em class="x">уволен</em>' : ''}
        <small>${where} · ${U.esc((s.rank || 'Менеджер').toLowerCase())} · ${U.money(s.cash || 0)} · ${date(s.updated)}</small></div>
        <span>${fired ? '' : `<button class="btn" data-play="${s.id}">Играть</button>`}<button class="btn del" data-del="${s.id}">Удалить</button></span>
      </li>`;
    }).join('')}</ul>` : '<p>Пока пусто.</p>');
  }
  function onArchiveClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    Sfx.init(); Sfx.play('click');
    if (b.dataset.play) continueGame(b.dataset.play);
    else if (b.dataset.del) {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Точно удалить?'; return; }
      Saves.remove(b.dataset.del);
      titleState();
    }
  }


  function togglePause() {
    if (G.phase !== 'day') return;
    G.paused = !G.paused;
    $('pause').classList.toggle('hidden', !G.paused);
    if (G.paused) save();
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
    ctx.setTransform(DS, 0, 0, DS, 0, 0);
    ctx.imageSmoothingEnabled = false;
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
    Font.ready().then(() => World.rebuild());
    titleState();
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
      else if (k === 'enter' && G.phase === 'title') { if (Saves.active()) continueGame(); else newCareer(); }
    });
    $('btn-start').addEventListener('click', () => newCareer());
    $('btn-continue').addEventListener('click', () => continueGame());
    $('btn-how').addEventListener('click', () => { $('how').classList.toggle('hidden'); $('archive').classList.add('hidden'); Sfx.init(); Sfx.play('click'); });
    $('btn-archive').addEventListener('click', () => { renderArchive(); $('archive').classList.toggle('hidden'); $('how').classList.add('hidden'); Sfx.init(); Sfx.play('click'); });
    $('archive').addEventListener('click', onArchiveClick);
    $('pause').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) { togglePause(); return; }
      ev.stopPropagation();
      if (b.id === 'p-resume') togglePause();
      else if (b.id === 'p-save') save(true);
      else if (b.id === 'p-menu') toMenu();
    });
    /* сохраняемся раз в 10 секунд и при уходе со страницы */
    setInterval(() => { if (performance.now() - lastSave > 9500) save(); }, 2500);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('pagehide', () => save());
    window.dbg = {
      get G() { return G; },
      skip(min) { for (let i = 0; i < min && G.phase === 'day'; i++) { Sim.minute(); G.time++; if (G.time >= CFG.DAY_END) { endOfDay(); break; } } },
      start, nextDay, newCareer, continueGame, save,
      speed(n) { G.speed = n; },
    };
    requestAnimationFrame(loop);
  }

  boot();
  return { togglePause, toggleSpeed, start, nextDay, newCareer, save };
})();
