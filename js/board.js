'use strict';
/* Совет директоров в конце рабочего дня */
const Board = (() => {
  const $ = id => document.getElementById(id);
  let t = 0, rep = null, sc = null, verdict = null, speaking = -1, moodAll = 'normal';

  const DIRS = [
    { key: 'sec', name: 'Полковник Шпионов', title: 'Директор по безопасности', look: { skin: '#eec39a', hair: '#1b1b22', hairStyle: 'short', shirt: '#ffffff', tie: '#111111', pants: '#111', jacket: '#16181c', glasses: true } },
    { key: 'cfo', name: 'Маргарита Счётова', title: 'Финансовый директор', look: { female: true, skin: '#f1c9a5', hair: '#7a7a7a', hairStyle: 'bun', shirt: '#ffffff', jacket: '#7a2c3a', pants: '#333', glasses: true } },
    { key: 'chair', name: 'Аркадий Кряков', title: 'Председатель совета', look: null },
    { key: 'prod', name: 'Борис Конвейеров', title: 'Директор по производству', look: { skin: '#d9a47a', hair: '#a8432a', hairStyle: 'spiky', shirt: '#f3e2a0', tie: '#1f6f4a', pants: '#4b3a2e', jacket: '#5a4632' } },
    { key: 'hr', name: 'Лейла Добрая', title: 'HR-директор', look: { female: true, skin: '#c08a5e', hair: '#2b1d14', hairStyle: 'long', shirt: '#f0b9c4', pants: '#555' } },
  ];

  /* ---------- Оценка ---------- */
  function score(r) {
    const prod = (Math.min(r.ducks / r.plan, 1.1) / 1.1) * 25;
    const profit = U.clamp((r.profit + 2000) / 9000, 0, 1) * 25;
    const totalDocs = r.decided + r.docsIgnored;
    const docs = totalDocs ? (r.docsCorrect / totalDocs) * 15 : 6;
    let sec = r.spies ? (r.spiesCaught / r.spies) * 15 : 15;
    sec = Math.max(0, sec - r.leaks * 1.5 - r.innocentFired * 4);
    const calm = (1 - r.chaosAvg / 100) * 10;
    const repu = (r.rep / 100) * 10;
    let total = prod + profit + docs + sec + calm + repu;
    if (r.bribeTaken) total -= 12;
    if (r.raid) total -= 8;
    total = U.clamp(Math.round(total), 0, 100);
    return { total, prod, profit, docs, sec, calm, repu };
  }
  function getVerdict(r, s) {
    if (r.bankrupt) return 'fired';
    if (s.total >= 75) return 'promo';
    if (s.total >= 52) return 'stay';
    if (s.total >= 32) return 'fine';
    return 'fired';
  }

  /* ---------- Реплики ---------- */
  function lines(r) {
    const L = {};
    const p = U.money(r.profit);
    L.chair1 = 'Итак, ваш первый день позади. Совет изучил отчёт. Давайте послушаем коллег.';
    let cfo = r.profit >= 5000 ? `Прибыль ${p}. Я пересчитала трижды — и трижды улыбнулась. Для понедельника это рекорд.`
      : r.profit >= 2000 ? `Прибыль ${p}. Неплохо, но утки любят счёт, а счёт любит больше нулей.`
        : r.profit >= 0 ? `Прибыль ${p}. Мы почти ничего не заработали. «Почти» — ключевое слово.`
          : `Убыток ${U.money(-r.profit)}. Я посчитала трижды. Это не ошибка калькулятора — это ошибка менеджера.`;
    if (r.boughtENGN && r.engnCrashed) cfo += ' И зачем вы купили Энергон? Вы что, не читаете газет?';
    else if (r.boughtUTKA && r.utkaCrashed) cfo += ' Утка.ком? Серьёзно? Пузыри лопаются, знаете ли.';
    else if (r.investPnL > 300) cfo += ` Инвестиции принесли ${U.money(r.investPnL)}. Похвально.`;
    if (r.bonds) cfo += ' Облигации — разумно. Скучно, но разумно.';
    if (r.penny) cfo += r.pennyWin ? ' «ПенниДак» взлетела… Вам повезло. Больше так не делайте.' : ' «ПенниДак»?! Брокер Джордан уже в розыске.';
    L.cfo = cfo;

    let prod = r.ducks >= r.plan ? `План выполнен: ${r.ducks} уток! Конвейер пел, как соловей. Утиный соловей.`
      : r.ducks >= r.plan * 0.8 ? `${r.ducks} уток из ${r.plan}. Близко, но утка, которой нет, не пищит.`
        : `Всего ${r.ducks} уток из ${r.plan}. Конвейер больше стоял, чем ехал.`;
    if (r.rubberOutMin > 30) prod += ` И почему он ${r.rubberOutMin} минут простоял без резины?!`;
    L.prod = prod;

    let sec;
    if (!r.spies) sec = 'Шпионов сегодня не было. Подозрительно… Но ладно.';
    else if (r.spiesCaught >= r.spies && r.leaks === 0) sec = 'Шпионы ГусьКорп обезврежены, утечек нет. Я бы взял вас в разведку.';
    else if (r.spiesCaught > 0) sec = `Шпиона вы поймали, но утечек было ${r.leaks}. ГусьКорп всё ещё ухмыляется.`;
    else sec = `Шпион ГусьКорп весь день сидел у вас под носом. Утечек: ${r.leaks}. Позор.`;
    if (r.innocentFired) sec += ` И вы уволили невиновных: ${r.innocentFired}. Паранойя — тоже не метод.`;
    if (r.bribeTaken) sec += ' А ещё мы знаем про конверт от Гусева. У меня везде уши.';
    if (G.flags.exposedGoose) sec += ' За запись разговора с Гусевым — отдельное спасибо.';
    L.sec = sec;

    let hr = r.chaosAvg < 25 && r.chaosEnd < 40 ? 'В офисе спокойно, люди улыбаются. Даже стажёр не плакал. Браво!'
      : r.chaosEnd < 60 ? 'Сотрудники нервничали, но держались. Пара седых волос — нормальная цена понедельника.'
        : 'К вечеру офис превратился в Уолл-стрит: деньги из окон, вопли, галстуки на головах. Мне до сих пор снится горн.';
    if (r.raid) hr += ' И к нам приходила Комиссия по ценным бумагам! КОМИССИЯ!';
    if (r.bonuses >= 2 || r.sentHome >= 1) hr += ' Спасибо, что заботились о людях.';
    L.hr = hr;

    L.verdict = {
      promo: 'Совет единогласно решил: вы ПОВЫШЕНЫ до старшего менеджера! Завтра — кабинет побольше и утка позолоченная.',
      stay: 'Совет решил: вы остаётесь на должности. Работайте лучше — мы следим.',
      fine: 'Совет недоволен. Вы ОШТРАФОВАНЫ на $1 500. Ещё один такой день — и попрощаемся.',
      fired: r.bankrupt ? 'Компания ушла в минус. Совет решил… вы УВОЛЕНЫ. Сдайте штампы и пропуск.' : 'Совет решил… вы УВОЛЕНЫ. Сдайте штампы и пропуск. Утку можете оставить себе.',
    }[verdict];
    return L;
  }

  /* ---------- Отчёт ---------- */
  function reportRows(r, s) {
    const pts = v => `<em>${Math.round(v)}</em>`;
    return [
      ['Произведено уток', `${r.ducks} / ${r.plan}`, pts(s.prod), r.ducks >= r.plan ? 'up' : 'down'],
      ['Выручка от продаж', U.money(r.revenue, true), '', 'up'],
      ['Зарплаты и аренда', U.money(-(r.payroll + r.overhead)), '', 'down'],
      ['Сырьё', U.money(-r.materials), '', 'down'],
      ['Офис, премии, хаос', U.money(-r.other), '', 'down'],
      ...(r.contracts ? [['Контракты', U.money(r.contracts, true), '', r.contracts > 0 ? 'up' : 'down']] : []),
      ...(r.bribe ? [['«Конверт» от Гусева', U.money(r.bribe, true), '', 'down']] : []),
      ['Инвестиции', U.money(r.investPnL, true), '', r.investPnL >= 0 ? 'up' : 'down'],
      ['ПРИБЫЛЬ ДНЯ', U.money(r.profit, true), pts(s.profit), r.profit >= 0 ? 'up big' : 'down big'],
      ['Документы', `верно ${r.docsCorrect} · ошибок ${r.docsWrong} · брошено ${r.docsIgnored}`, pts(s.docs), ''],
      ['Шпионы ГусьКорп', `пойман${r.spiesCaught === 1 ? '' : 'о'} ${r.spiesCaught} из ${r.spies} · утечек ${r.leaks}`, pts(s.sec), r.spiesCaught >= r.spies ? 'up' : 'down'],
      ...(r.innocentFired ? [['Уволено невиновных', String(r.innocentFired), '', 'down']] : []),
      ['Хаос в офисе', `в среднем ${Math.round(r.chaosAvg)}% · к вечеру ${Math.round(r.chaosEnd)}%`, pts(s.calm), r.chaosEnd < 50 ? 'up' : 'down'],
      ['Репутация', `${Math.round(r.rep)} / 100`, pts(s.repu), r.rep >= 50 ? 'up' : 'down'],
    ];
  }

  function start(report) {
    rep = report;
    sc = score(rep);
    verdict = getVerdict(rep, sc);
    G.phase = 'board';
    t = 0; speaking = -1; moodAll = 'normal';
    const box = $('board');
    const rows = reportRows(rep, sc);
    box.innerHTML = `<div class="report wood">
      <h2>Итоги дня · отчёт для совета</h2>
      ${rep.notes.length ? `<p class="notes">${rep.notes.map(U.esc).join(' ')}</p>` : ''}
      <table class="rep">${rows.map(([k, v, p, cls], i) => `<tr class="${cls}" style="--d:${i * 0.22}s"><td>${k}</td><td>${v}</td><td>${p}</td></tr>`).join('')}</table>
      <button class="btn big" id="b-hear" style="--d:${rows.length * 0.22 + 0.2}s">Войти в зал совета →</button>
    </div>`;
    box.classList.remove('hidden');
    rows.forEach((_, i) => setTimeout(() => Sfx.play('tally'), 300 + i * 220));
    $('b-hear').onclick = () => { Sfx.play('open'); box.classList.add('hidden'); talk(); };
  }

  function talk() {
    const L = lines(rep);
    const chair = DIRS[2];
    chair.look = Content.SP.founder.look;
    const seq = [
      [2, L.chair1], [1, L.cfo], [3, L.prod], [0, L.sec], [4, L.hr],
    ];
    let i = 0;
    const next = () => {
      if (i >= seq.length) { final(L); return; }
      const [di, text] = seq[i++];
      speaking = di;
      const d = DIRS[di];
      UI.dialog({ speaker: { name: d.name, title: d.title, look: d.look }, text, kind: 'board', onDone: next });
    };
    next();
  }

  function final(L) {
    speaking = 2;
    moodAll = verdict === 'promo' ? 'happy' : verdict === 'stay' ? 'normal' : verdict === 'fine' ? 'stress' : 'mad';
    const chair = DIRS[2];
    UI.dialog({
      speaker: { name: chair.name, title: chair.title, look: chair.look, mood: moodAll },
      text: L.verdict, kind: 'board',
      onDone: showVerdict,
    });
  }

  function showVerdict() {
    speaking = -1;
    G.phase = 'verdict';
    const V = {
      promo: ['ПОВЫШЕН', 'Старший менеджер «Кря Индастриз»', 'ok'],
      stay: ['ОСТАВЛЕН', 'Остаётесь менеджером. Пока что.', 'mid'],
      fine: ['ШТРАФ', 'Минус $1 500 из вашей зарплаты', 'warn'],
      fired: ['УВОЛЕН', 'Сдайте пропуск на выходе', 'no'],
    }[verdict];
    let best = 0;
    try {
      best = +localStorage.getItem('mlo_best') || 0;
      if (sc.total > best) localStorage.setItem('mlo_best', String(sc.total));
    } catch (e) { /* хранилище недоступно — не страшно */ }
    const box = $('board');
    box.innerHTML = `<div class="verdict wood">
      <p class="v-pre">Решение совета директоров</p>
      <div class="v-stamp ${V[2]}">${V[0]}</div>
      <p class="v-sub">${V[1]}</p>
      <div class="v-score"><span>Оценка дня</span><b>${sc.total}</b><span>/ 100</span></div>
      <p class="muted">${sc.total > best && best ? 'Новый рекорд!' : best ? `Лучший результат: ${Math.max(best, sc.total)}` : ''}</p>
      <div class="v-btns">
        <button class="btn big" id="b-again">Новый рабочий день</button>
        <button class="btn" id="b-report">Отчёт ещё раз</button>
      </div>
      <p class="muted small">Каждый день сотрудники, шпионы и биржа другие. День 2 — в разработке.</p>
    </div>`;
    box.classList.remove('hidden');
    Sfx.play(verdict === 'promo' || verdict === 'stay' ? 'fanfare' : 'doom');
    setTimeout(() => Sfx.play('stamp'), 350);
    $('b-again').onclick = () => location.reload();
    $('b-report').onclick = () => {
      const rows = reportRows(rep, sc);
      box.innerHTML = `<div class="report wood static"><h2>Итоги дня</h2>
        <table class="rep">${rows.map(([k, v, p, cls]) => `<tr class="${cls}"><td>${k}</td><td>${v}</td><td>${p}</td></tr>`).join('')}</table>
        <button class="btn big" id="b-back">← К решению совета</button></div>`;
      $('b-back').onclick = showVerdict;
    };
  }

  /* ---------- Зал совета ---------- */
  function render(ctx, dt) {
    t += dt;
    Spr.use(ctx);
    const R = Spr.R;
    ctx.save();
    ctx.translate(48, 32);
    R(-48, -32, 480, 288, '#2a1a12');
    for (let x = -48; x < 432; x += 32) { R(x, -32, 30, 144, '#3a2418'); R(x + 3, -28, 24, 134, '#43291b'); R(x + 3, -28, 24, 1, '#55351f'); }
    R(-48, -32, 480, 3, '#1a100a');
    /* окно на закат */
    R(130, 8, 124, 72, '#1a100a');
    const bands = ['#f6c48a', '#f2a878', '#e08a6a', '#b06a7a', '#7a4a7a'];
    bands.forEach((c, i) => R(132, 10 + i * 14, 120, 14, c));
    R(170, 52, 20, 20, '#ffd27a'); R(166, 56, 28, 12, '#ffd27a');
    [[132, 50, 12], [146, 40, 10], [158, 56, 14], [176, 44, 8], [186, 34, 12], [200, 48, 10], [212, 38, 14], [228, 52, 10], [240, 44, 12]].forEach(([x, y, w], i) => {
      R(x, y, w, 80 - y, '#2a1c2a');
      for (let wy = y + 3; wy < 78; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3) if ((wx + wy + i) % 3 === 0) R(wx, wy, 1, 2, '#ffd86a');
    });
    R(191, 8, 2, 72, '#1a100a'); R(130, 43, 124, 2, '#1a100a');
    /* портреты */
    [[40, 18], [312, 18]].forEach(([x, y]) => {
      R(x, y, 34, 40, '#a8832e'); R(x + 2, y + 2, 30, 36, '#d4a24c'); R(x + 4, y + 4, 26, 32, '#2f4a3c');
      ctx.drawImage(Spr.DUCK, x + 6, y + 10, 22, 20);
      R(x + 10, y + 6, 12, 6, '#111'); R(x + 8, y + 11, 16, 2, '#111');
    });
    /* люстра */
    R(190, 0, 4, 6, '#d4a24c'); R(176, 6, 32, 3, '#d4a24c');
    for (let i = 0; i < 5; i++) { R(178 + i * 7, 9, 2, 3, '#fff3b0'); R(177 + i * 7, 12, 4, 2, 'rgba(255,240,170,0.5)'); }
    /* пол */
    R(-48, 112, 480, 144, '#4a1e18');
    for (let y = 116; y < 256; y += 8) for (let x = (y / 8) % 2 ? -48 : -40; x < 432; x += 16) R(x, y, 8, 4, '#55241c');

    /* директора */
    const xs = [96, 144, 192, 240, 288];
    DIRS.forEach((d, i) => {
      const x = xs[i];
      R(x - 10, 90, 20, 30, '#3a1a10'); R(x - 9, 91, 18, 3, '#5a2a18');
      const look = d.look || Content.SP.founder.look;
      const talking = speaking === i;
      const mood = moodAll !== 'normal' ? moodAll : (talking ? 'normal' : 'normal');
      Spr.person(x, 136 - (talking && Math.floor(t * 6) % 2 ? 1 : 0), look, { mood: talking && Math.floor(t * 5) % 2 ? 'happy' : mood, frame: Math.floor(t * 4) });
      if (talking) { R(x - 1, 96, 3, 1, '#ffd23f'); R(x, 97, 1, 1, '#ffd23f'); }
    });
    /* стол */
    R(44, 128, 296, 2, '#8a4a26');
    R(40, 130, 304, 22, '#6e3a1e'); R(40, 130, 304, 1, '#9a5a30'); R(60, 133, 264, 1, 'rgba(255,255,255,0.12)');
    R(40, 152, 304, 12, '#4a2414'); R(40, 152, 304, 1, '#d4a24c');
    R(46, 164, 6, 20, '#3a1a10'); R(332, 164, 6, 20, '#3a1a10');
    xs.forEach((x, i) => {
      R(x - 10, 142, 20, 6, '#d4a24c'); R(x - 9, 143, 18, 4, '#e8c06a');
      R(x + 10, 136, 3, 6, 'rgba(200,230,255,0.6)'); R(x - 14, 138, 6, 4, '#fff');
      if (i === 2) Spr.duck(x - 5, 130);
    });
    /* игрок спиной к нам */
    const bob = Math.floor(t * 2) % 2;
    Spr.person(192, 206 + bob * 0, PLAYER_LOOK, { dir: 'up', frame: Math.floor(t * 2) });
    /* полумрак по краям */
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 40, H); ctx.fillRect(W - 40, 0, 40, H);
  }

  return { start, render, score };
})();
