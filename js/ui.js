'use strict';
/* Интерфейс в духе фермерских пиксельных игр: часы, хотбар, окна, диалоги */
const UI = (() => {
  const $ = id => document.getElementById(id);
  let cur = null, curArg = null, refreshT = 0, cashShown = 0;
  let held = null, stamping = false, docSel = 0, lastInboxLen = -1, lastNewsLen = -1, docTab = 'docs', newsMark = 0;
  const portraitCache = new Map();
  let duckURL = '';

  const HOTBAR = [
    { id: 'docs', icon: 'docs', label: 'Документы', key: '1' },
    { id: 'terminal', icon: 'terminal', label: 'Терминал', key: '2' },
    { id: 'phone', icon: 'phone', label: 'Телефон', key: '3' },
    { id: 'staff', icon: 'staff', label: 'Сотрудники', key: '4' },
    { id: 'journal', icon: 'news', label: 'Журнал', key: '5' },
    { id: 'help', icon: 'help', label: 'Справка', key: '6' },
  ];

  function portrait(look, mood) {
    let m = portraitCache.get(look);
    if (!m) { m = {}; portraitCache.set(look, m); }
    const k = mood || 'normal';
    if (!m[k]) m[k] = Spr.portraitURL(look, { mood: k }, 6);
    return m[k];
  }
  const empMood = e => (e.gone ? 'normal' : ['normal', 'stress', 'mad', 'crazy'][Sim.stage(e)]);

  /* ---------- Инициализация ---------- */
  function init() {
    const dc = document.createElement('canvas');
    dc.width = 40; dc.height = 36;
    const g = dc.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(Spr.DUCK, 0, 0, 40, 36);
    duckURL = dc.toDataURL();
    document.querySelectorAll('.duck-img').forEach(img => { img.src = duckURL; });

    const hb = $('hotbar');
    for (const s of HOTBAR) {
      const b = document.createElement('button');
      b.className = 'slot';
      b.id = 'slot-' + s.id;
      b.innerHTML = `<img src="${Spr.iconURL(s.icon, 4)}" alt=""><span class="key">${s.key}</span><span class="badge"></span>`;
      b.addEventListener('mouseenter', ev => { tooltip(`${s.label} [${s.key}]`, ev.clientX, ev.clientY); Sfx.play('hover'); });
      b.addEventListener('mouseleave', () => tooltip(null));
      b.addEventListener('click', () => toggle(s.id));
      hb.appendChild(b);
    }
    $('b-pause').innerHTML = `<img src="${Spr.iconURL('pause', 3)}" alt="">`;
    $('b-speed').innerHTML = `<img src="${Spr.iconURL('play', 3)}" alt="">`;
    $('b-sound').innerHTML = `<img src="${Spr.iconURL('sound', 3)}" alt="">`;
    $('b-pause').onclick = () => Game.togglePause();
    $('b-speed').onclick = () => Game.toggleSpeed();
    $('b-sound').onclick = () => { const m = Sfx.toggleMute(); $('b-sound').innerHTML = `<img src="${Spr.iconURL(m ? 'mute' : 'sound', 3)}" alt="">`; };

    $('modal').addEventListener('pointerdown', ev => { if (ev.target.id === 'modal') close(); });
    $('panel').addEventListener('click', onPanelClick);
    $('panel').addEventListener('pointerdown', onPanelDown);
    $('dlg-box').addEventListener('click', onDialogClick);
    document.addEventListener('pointermove', ev => {
      if (held) { const h = $('held-stamp'); h.style.left = ev.clientX + 'px'; h.style.top = ev.clientY + 'px'; }
    });
    document.addEventListener('contextmenu', ev => { if (held) { ev.preventDefault(); dropStamp(); } });
    cashShown = G.cash;
  }

  /* ---------- Подсказка у курсора ---------- */
  function tooltip(text, x, y) {
    const tt = $('tooltip');
    if (!text) { tt.classList.remove('show'); return; }
    tt.textContent = text;
    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
    tt.classList.add('show');
  }

  /* ---------- Уведомления ---------- */
  const TOAST_ICON = {
    doc: () => Spr.iconURL('docs', 2), call: () => Spr.iconURL('phone', 2), news: () => Spr.iconURL('news', 2),
    clue: () => Spr.markURL('alert', 3), visit: () => Spr.markURL('excl', 3), bad: () => Spr.markURL('bang', 3), warn: () => Spr.markURL('alert', 3),
    good: () => Spr.markURL('star', 3), info: () => Spr.markURL('chat', 3),
  };
  function toast(text, type = 'info', onClick) {
    const box = $('toasts');
    const d = document.createElement('div');
    d.className = 'toast t-' + type + (onClick ? ' click' : '');
    const ic = TOAST_ICON[type] ? TOAST_ICON[type]() : '';
    d.innerHTML = `${ic ? `<img src="${ic}" alt="">` : ''}<span><b>${U.time(G.time)}</b> ${U.esc(text)}</span>`;
    if (onClick) d.addEventListener('click', () => { onClick(); kill(d); });
    else d.addEventListener('click', () => kill(d));
    box.prepend(d);
    while (box.children.length > 3) box.lastChild.remove();
    const dur = Math.min(9500, 4200 + text.length * 45);
    setTimeout(() => kill(d), dur);
  }
  function kill(d) {
    if (!d.isConnected || d.classList.contains('out')) return;
    d.classList.add('out');
    setTimeout(() => d.remove(), 350);
  }
  const say = text => toast(text, 'info');

  /* ---------- Окна ---------- */
  function toggle(id) {
    if (cur === id) close();
    else openPanel(id);
  }
  function openPanel(id, arg) {
    if (G.phase !== 'day') return;
    if (G.dialog) { toast('Сначала закончите разговор.', 'warn'); return; }
    if (G.paused) Game.togglePause();
    if (cur !== id) Sfx.play('open');
    cur = id; curArg = arg;
    G.panel = id;
    if (id === 'docs') { docSel = 0; lastInboxLen = -1; lastNewsLen = -1; docTab = arg || (cur === 'docs' ? docTab : pickTab()); }
    if ((id === 'docs' && docTab === 'news') || (id === 'terminal' && arg === 'news')) newsMark = G.newsSeen || 0;
    $('modal').classList.remove('hidden');
    $('panel').className = 'wood panel-' + id;
    render(true);
    tooltip(null);
  }
  function openDossier(e) { openPanel('dossier', e); }
  function close() {
    if (!cur) return;
    Sfx.play('close');
    cur = null; curArg = null; G.panel = null;
    dropStamp();
    $('modal').classList.add('hidden');
  }

  function head(title, sub) {
    return `<div class="p-head"><h2>${title}</h2>${sub ? `<span class="p-sub">${sub}</span>` : ''}<button class="p-x" data-act="close" title="Закрыть (Esc)">×</button></div>`;
  }

  function render(force) {
    const p = $('panel');
    if (!cur) return;
    if (cur === 'docs') {
      if (!force && (stamping || (G.inbox.length === lastInboxLen && G.news.length === lastNewsLen))) return;
      const sc = p.querySelector('.p-body');
      const st = sc ? sc.scrollTop : 0;
      lastInboxLen = G.inbox.length; lastNewsLen = G.news.length;
      p.innerHTML = renderDocs();
      const sc2 = p.querySelector('.p-body');
      if (sc2 && !force) sc2.scrollTop = st;
      if (docTab === 'news') G.newsSeen = G.news.length;
      return;
    }
    const sc = p.querySelector('.p-body');
    const st = sc ? sc.scrollTop : 0;
    if (cur === 'terminal') p.innerHTML = renderTerminal();
    else if (cur === 'phone') p.innerHTML = renderPhone();
    else if (cur === 'staff') p.innerHTML = renderStaff();
    else if (cur === 'dossier') p.innerHTML = renderDossier(curArg);
    else if (cur === 'journal') p.innerHTML = renderJournal();
    else if (cur === 'help') p.innerHTML = renderHelp();
    else if (cur === 'room') p.innerHTML = renderRoom(curArg);
    const sc2 = p.querySelector('.p-body');
    if (sc2 && !force) sc2.scrollTop = st;
    if (cur === 'terminal') drawSparks();
  }

  /* ---------- Документы, резюме и газета в одном окне ---------- */
  const isCv = d => d.kind === 'resume';
  const tabDocs = () => G.inbox.filter(d => (docTab === 'cv') === isCv(d));
  function pickTab() {
    if (G.inbox.some(d => !isCv(d))) return 'docs';
    if (G.inbox.some(isCv)) return 'cv';
    return 'docs';
  }
  function docTabs() {
    const nd = G.inbox.filter(d => !isCv(d)).length, nc = G.inbox.filter(isCv).length;
    const unread = Math.max(0, G.news.length - (G.newsSeen || 0));
    const vac = Hire.vacancies().length;
    return `<div class="dtabs">
      <button class="dtab ${docTab === 'docs' ? 'on' : ''}" data-act="dtab" data-t="docs">Документы${nd ? `<i>${nd}</i>` : ''}</button>
      <button class="dtab ${docTab === 'cv' ? 'on' : ''}" data-act="dtab" data-t="cv">Резюме${nc ? `<i>${nc}</i>` : ''}${vac ? `<small>вакансий: ${vac}</small>` : ''}</button>
      <button class="dtab ${docTab === 'news' ? 'on' : ''}" data-act="dtab" data-t="news">Новости${unread ? `<i class="hot">${unread}</i>` : ''}</button>
    </div>`;
  }
  function headlineStrip() {
    const n = G.news[0];
    if (!n) return '';
    const fresh = G.news.length > (G.newsSeen || 0);
    return `<button class="np-strip ${fresh ? 'fresh' : ''} tone-${n.tone || 'neutral'}" data-act="dtab" data-t="news"><b>${fresh ? 'Свежий выпуск' : 'Газета'}</b><span>${U.esc(n.head)}</span><em>читать →</em></button>`;
  }
  function vacancyNote() {
    const v = Hire.vacancies();
    if (!v.length) return '<p class="cv-note">Свободных столов нет. Новые резюме можно только отклонить или отложить.</p>';
    return `<p class="cv-note"><b>Свободных столов: ${v.length}</b> — ${v.map(e => U.esc(e.role.toLowerCase())).join(', ')}. «Согласовано» на резюме — значит нанять. Читайте внимательно: лентяи и шпионы ГусьКорп тоже рассылают резюме.</p>`;
  }
  function paperHtml(d) {
    const rows = (d.rows || []).map(([k, v]) => `<tr><td>${U.esc(k)}</td><td>${U.esc(v)}</td></tr>`).join('');
    if (isCv(d)) {
      const c = d.cand;
      return `<div class="paper k-resume" id="paper">
        <div class="lh lh-cv">РЕЗЮМЕ · вх. № ${d.no}<span>${U.time(d.arrived)}</span></div>
        <div class="cv-top"><img class="cv-photo" src="${portrait(c.look, 'normal')}" alt=""><div>
          <h3>${U.esc(c.name)} ${U.esc(c.surname)}</h3>
          <div class="from">${U.esc(d.from)}</div>
          <p class="cv-letter">«${U.esc(d.body)}»</p>
        </div></div>
        <table class="rows">${rows}</table>
        <div class="sign">Подпись: <i>${U.esc(d.sign || '')}</i></div>
      </div>`;
    }
    const lh = d.kind === 'letter'
      ? `<div class="lh lh-ext">ВХОДЯЩЕЕ · вх. № ${d.no} от ${U.time(d.arrived)}</div>`
      : d.kind === 'note'
        ? `<div class="lh lh-note">записка · вх. № ${d.no}</div>`
        : `<div class="lh"><img src="${duckURL}" alt="">КРЯ ИНДАСТРИЗ<span>вх. № ${d.no} · ${U.time(d.arrived)}</span></div>`;
    return `<div class="paper k-${d.kind || 'memo'}" id="paper">
      ${d.old ? '<div class="old-tag">со вчера</div>' : ''}
      ${lh}
      <h3>${U.esc(d.title)}</h3>
      <div class="from">От: ${U.esc(d.from)}</div>
      <p>${U.esc(d.body)}</p>
      <table class="rows">${rows}</table>
      <div class="sign">Подпись: <i>${U.esc(d.sign || '')}</i></div>
    </div>`;
  }
  function renderDocs() {
    const vac = Hire.vacancies().length;
    let html = head('Рабочий стол', `${G.inbox.length} в лотке${vac ? ` · вакансий: ${vac}` : ''}`) + docTabs();
    if (docTab === 'news') {
      return html + `<div class="p-body news-body">${News.render(G.news, newsMark)}</div>`;
    }
    const list = tabDocs();
    const cv = docTab === 'cv';
    if (!list.length) {
      return html + `<div class="p-body">${cv ? vacancyNote() : headlineStrip()}<div class="docs-empty"><img src="${duckURL}" class="duck-big" alt="">
        <p>${cv ? 'Резюме пока нет.' : 'Лоток пуст. Можно выдохнуть… пока.'}</p>
        <p class="muted">${cv ? (vac ? 'Отдел кадров ищет кандидатов — резюме придут в течение дня.' : 'Резюме приходят, когда в офисе освобождается стол.') : 'Новые документы приходят в течение дня — вы услышите шелест бумаги.'}</p></div></div>`;
    }
    if (docSel >= list.length) docSel = 0;
    const d = list[docSel];
    const tabs = list.map((x, i) => `<button class="doc-tab ${i === docSel ? 'on' : ''} ${x.old ? 'old' : ''}" data-act="doc" data-i="${i}">№${x.no}<small>${U.esc(cv ? x.cand.name + ' ' + x.cand.surname : x.title)}</small></button>`).join('');
    html += `<div class="p-body docs">
      ${cv ? vacancyNote() : headlineStrip()}
      <div class="doc-tabs">${tabs}</div>
      <div class="doc-area">
        ${paperHtml(d)}
        <div class="stamps">
          <button class="stamp-tool ok ${held === 'approve' ? 'held' : ''}" data-act="stamp" data-s="approve"><i class="st-handle"></i><i class="st-base"></i><span>${cv ? 'НАНЯТЬ' : 'СОГЛАСОВАНО'}</span><kbd>A</kbd></button>
          <button class="stamp-tool no ${held === 'reject' ? 'held' : ''}" data-act="stamp" data-s="reject"><i class="st-handle"></i><i class="st-base"></i><span>ОТКАЗАНО</span><kbd>D</kbd></button>
          <p class="hint">${cv ? 'Штамп «согласовано» на резюме — кандидат выходит на работу за свободный стол.' : 'Возьмите штамп и поставьте его на документ. Нужна подсказка — загляните во вкладку «Новости».'}</p>
        </div>
      </div>
    </div>`;
    return html;
  }

  function setDocTab(t) {
    if (stamping) return;
    if (t === 'news' && docTab !== 'news') newsMark = G.newsSeen || 0;
    docTab = t; docSel = 0;
    dropStamp();
    Sfx.play('paper');
    render(true);
  }

  function pickStamp(s) {
    if (stamping) return;
    held = held === s ? null : s;
    const h = $('held-stamp');
    h.className = held ? 'show ' + (held === 'approve' ? 'ok' : 'no') : '';
    document.body.classList.toggle('holding', !!held);
    Sfx.play('pickup');
    document.querySelectorAll('.stamp-tool').forEach(b => b.classList.toggle('held', b.dataset.s === held));
  }
  function dropStamp() {
    held = null;
    $('held-stamp').className = '';
    document.body.classList.remove('holding');
    document.querySelectorAll('.stamp-tool').forEach(b => b.classList.remove('held'));
  }

  function stampAt(kind, cx, cy) {
    const paper = $('paper');
    const d = tabDocs()[docSel];
    if (!paper || !d || stamping || docTab === 'news') return;
    stamping = true;
    const r = paper.getBoundingClientRect();
    const x = cx == null ? r.width * U.rand(0.3, 0.7) : cx - r.left;
    const y = cy == null ? r.height * U.rand(0.45, 0.75) : cy - r.top;
    const im = document.createElement('div');
    im.className = 'imprint ' + (kind === 'approve' ? 'ok' : 'no');
    im.textContent = kind === 'approve' ? (isCv(d) ? 'ПРИНЯТ' : 'СОГЛАСОВАНО') : 'ОТКАЗАНО';
    im.style.left = x + 'px'; im.style.top = y + 'px';
    im.style.setProperty('--rot', U.rand(-14, 10).toFixed(1) + 'deg');
    paper.appendChild(im);
    Sfx.play('stamp');
    World.shake(0.15);
    dropStamp();
    setTimeout(() => { paper.classList.add('fly-' + (kind === 'approve' ? 'ok' : 'no')); Sfx.play('paper'); }, 520);
    setTimeout(() => {
      stamping = false;
      Sim.decideDoc(d, kind === 'approve');
      if (cur === 'docs') { docSel = 0; render(true); }
    }, 900);
  }

  /* ---------- Терминал ---------- */
  function forecast() {
    const el = Math.max(30, G.time - CFG.DAY_START);
    const pace = G.ducks / el;
    const left = CFG.DAY_END - G.time;
    let pending = 0;
    for (const ev of G.sched) if (ev.type === 'deliver') pending += ev.kg;
    const maxByRubber = (G.rubber + pending) / CFG.KG_PER_DUCK;
    const more = Math.min(pace * left, maxByRubber);
    const payroll = Sim.payrollNow();
    const profit = G.cash + Market.value() - G.dayStart + more * G.price - payroll - CFG.OVERHEAD;
    return { pace: pace * 60, ducks: G.ducks + more, payroll, profit, rubberMin: pace > 0 ? G.rubber / (pace * CFG.KG_PER_DUCK) : Infinity };
  }

  function renderTerminal() {
    const tab = curArg || 'balance';
    let html = head('Терминал «КРЯК-2000»', 'Windows 98 · 64 МБ ОЗУ');
    html += `<div class="tabs">
      <button class="tab ${tab === 'balance' ? 'on' : ''}" data-act="ttab" data-t="balance">Баланс</button>
      <button class="tab ${tab === 'market' ? 'on' : ''}" data-act="ttab" data-t="market">Биржа</button>
      <button class="tab ${tab === 'news' ? 'on' : ''}" data-act="ttab" data-t="news">Новости${G.news.length > (G.newsSeen || 0) ? ` (${G.news.length - (G.newsSeen || 0)} новых)` : ''}</button>
    </div><div class="p-body ${tab === 'news' ? 'news-body' : 'crt'}">`;
    const L = G.ledger;
    if (tab === 'balance') {
      const f = forecast();
      const line = (k, v, cls) => `<div class="ln ${cls || ''}"><span>${k}</span><i></i><b>${v}</b></div>`;
      const other = (L.office || 0) + (L.staff || 0) + (L.charity || 0);
      html += `<div class="crt-cols"><div>
        <h4>&gt; КАССА</h4>
        ${line('Наличные', U.money(G.cash))}
        ${line('Выручка за день', U.money(L.sales || 0, true), 'up')}
        ${line('Сырьё', U.money(L.materials || 0))}
        ${line('Офис и персонал', U.money(other))}
        ${L.chaos ? line('Убытки от хаоса', U.money(L.chaos), 'down') : ''}
        ${L.bribe ? line('«Конверт» от Гусева', U.money(L.bribe, true)) : ''}
        ${line('Портфель (акции+облигации)', U.money(Market.value()))}
        <h4>&gt; К ВЫПЛАТЕ В 18:00</h4>
        ${line('Зарплаты', U.money(-f.payroll), 'down')}
        ${line('Аренда и электричество', U.money(-CFG.OVERHEAD), 'down')}
        ${line('Прогноз прибыли дня ≈', U.money(f.profit, true), f.profit >= 0 ? 'up big' : 'down big')}
      </div><div>
        <h4>&gt; ПРОИЗВОДСТВО</h4>
        ${line('Уток выпущено', `${Math.floor(G.ducks)} / ${U.num(G.plan)}`)}
        ${line('Темп', `${Math.round(f.pace)} уток/час`)}
        ${line('Прогноз к 18:00', `≈ ${Math.round(f.ducks)}`, f.ducks >= G.plan ? 'up' : 'down')}
        ${line('Цена утки', '$' + G.price.toFixed(2))}
        ${line('Резина на складе', `${Math.round(G.rubber)} кг`, G.rubber < 100 ? 'down' : '')}
        ${line('Хватит примерно на', isFinite(f.rubberMin) ? `${Math.round(f.rubberMin)} мин` : '—', f.rubberMin < 40 ? 'down' : '')}
        ${G.time < G.breakdownUntil ? line('Конвейер', 'СЛОМАН', 'down') : ''}
        <h4>&gt; РЕПУТАЦИЯ</h4>
        ${line('Репутация компании', `${Math.round(G.rep)} / 100`, G.rep >= 50 ? 'up' : 'down')}
        ${line('Утечек к ГусьКорп', String(G.leaks), G.leaks ? 'down' : '')}
      </div></div>`;
    } else if (tab === 'market') {
      html += `<p class="crt-note">Наличные: <b>${U.money(G.cash)}</b>. Курс меняется каждую игровую минуту. Читайте новости — они подсказывают, что будет.</p><table class="mkt">
        <tr><th>Бумага</th><th>Цена</th><th>За день</th><th>График</th><th>У вас</th><th></th></tr>`;
      for (const id in G.market.t) {
        const k = G.market.t[id];
        const ch = (k.price / k.open - 1) * 100;
        const val = k.shares * k.price;
        const pl = val - k.cost;
        html += `<tr>
          <td><b>${id}</b><small>${U.esc(k.name)}</small></td>
          <td>$${k.price.toFixed(2)}</td>
          <td class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</td>
          <td><canvas class="spark" data-id="${id}" width="64" height="16"></canvas></td>
          <td>${k.shares ? `${k.shares} шт.<small class="${pl >= 0 ? 'up' : 'down'}">${U.money(val)} (${U.money(pl, true)})</small>` : '—'}</td>
          <td class="acts">${k.own ? '<small>не торгуется</small>' : `<button class="tbtn" data-act="buy" data-id="${id}" data-v="1000">+$1k</button><button class="tbtn" data-act="buy" data-id="${id}" data-v="5000">+$5k</button>${k.shares ? `<button class="tbtn sell" data-act="sell" data-id="${id}">Продать</button>` : ''}`}</td>
        </tr>`;
      }
      html += `<tr class="bond"><td><b>ОБЛ</b><small>Гособлигации, +3% к 18:00</small></td><td>—</td><td class="up">гарантия</td><td></td>
        <td>${G.market.bonds ? U.money(G.market.bonds) : '—'}</td>
        <td class="acts"><button class="tbtn" data-act="bond" data-v="1000">+$1k</button><button class="tbtn" data-act="bond" data-v="5000">+$5k</button></td></tr>`;
      if (G.market.penny) html += `<tr><td><b>PNNY</b><small>«ПенниДак» от брокера</small></td><td>?</td><td>?</td><td></td><td>${U.money(G.market.penny)}</td><td><small>итог в 18:00</small></td></tr>`;
      html += '</table>';
      const hov = Object.values(G.market.t).map(k => `<li><b>${k.id}</b> — ${U.esc(k.desc)}</li>`).join('');
      html += `<ul class="crt-desc">${hov}</ul>`;
    } else {
      html += News.render(G.news, newsMark);
      G.newsSeen = G.news.length;
    }
    return html + '</div>';
  }

  function drawSparks() {
    document.querySelectorAll('canvas.spark').forEach(cv => {
      const k = G.market.t[cv.dataset.id];
      const g = cv.getContext('2d');
      g.clearRect(0, 0, 64, 16);
      const h = k.hist.slice(-64);
      const mn = Math.min(...h), mx = Math.max(...h);
      const up = h[h.length - 1] >= h[0];
      g.fillStyle = up ? '#5dff7a' : '#ff5a5a';
      h.forEach((p, i) => {
        const y = 15 - Math.round(((p - mn) / Math.max(0.0001, mx - mn)) * 14);
        g.fillRect(i + (64 - h.length), y, 1, 1);
      });
    });
  }

  /* ---------- Телефон ---------- */
  function renderPhone() {
    let html = head('Телефон', 'дисковый, надёжный');
    html += '<div class="p-body">';
    if (G.call) {
      const c = Content.CALLS[G.call.key].who();
      html += `<div class="ringing"><img src="${portrait(c.look)}" alt=""><div><b>Звонит: ${U.esc(c.name)}</b><small>${U.esc(c.title)}</small></div><button class="btn big" data-act="answer">Ответить</button></div>`;
    }
    html += '<ul class="phone-list">';
    for (const a of Sim.PHONE) {
      const left = (G.cd[a.id] || 0) - G.time;
      const cost = a.cost();
      html += `<li><div><b>${a.name}</b><small>${a.desc()}</small></div>
        <span class="cost">${cost ? U.money(cost) : 'бесплатно'}</span>
        ${left > 0 ? `<span class="cd">через ${left} мин</span>` : `<button class="btn" data-act="phone" data-id="${a.id}" ${cost > G.cash ? 'disabled' : ''}>Позвонить</button>`}</li>`;
    }
    return html + '</ul></div>';
  }

  /* ---------- Сотрудники ---------- */
  const STATUS = e => {
    if (e.gone) return { fired: 'уволен(а)', home: 'дома до завтра', quit: 'уволился(ась)', fled: 'сбежал(а) в ГусьКорп' }[e.gone];
    if (e.exiting) return 'уходит…';
    if (e.state === 'visit') return 'у вас в кабинете';
    if (e.state === 'walk') return e.purpose === 'office' ? 'идёт к вам' : 'идёт на место';
    if (e.state === 'errand') return NPC.taskLabel(e);
    if (G.time < e.sleepUntil) return 'спит за столом';
    return 'за рабочим столом';
  };
  const sanBar = s => `<div class="sbar"><i style="width:${Math.round(s)}%" class="${s > 70 ? 'g' : s > 40 ? 'y' : s > 15 ? 'o' : 'r'}"></i></div>`;
  const suspTxt = e => (e.evidence ? 'ДОКАЗАНО' : e.suspicion >= 60 ? 'серьёзные' : e.suspicion >= 25 ? 'есть сомнения' : 'нет');

  const seniority = e => (e.hiredDay === G.day ? (e.hiredDay === 1 ? 'с первого дня' : 'новичок, первый день') : `в компании ${G.day - (e.hiredDay || 1) + 1} дн.`);
  function renderStaff() {
    let html = head('Сотрудники', `день ${G.day} · нажмите на карточку, чтобы открыть досье`);
    html += '<div class="p-body staff">';
    for (const e of G.emps) {
      const st = Sim.stage(e);
      if (e.gone && e.gone !== 'home') {
        const n = G.inbox.filter(d => d.kind === 'resume').length;
        html += `<div class="card vacancy" data-act="cvtab">
          <div class="vac-seat">?</div>
          <b>Вакансия</b><small>${U.esc(e.role)}</small>
          <span class="lbl">раньше: ${U.esc(e.name)} ${U.esc(e.surname[0])}. — ${STATUS(e)}</span>
          <span class="out">${n ? `резюме в лотке: ${n}` : 'ждём резюме'}</span>
        </div>`;
        continue;
      }
      html += `<div class="card ${e.gone ? 'gone' : ''} ${e.newbie || e.hiredDay === G.day && G.day > 1 ? 'newbie' : ''} st${st}" data-act="dossier" data-id="${e.uid}">
        <img src="${portrait(e.look, empMood(e))}" alt="">
        <b>${U.esc(e.name)} ${U.esc(e.surname[0])}.</b><small>${U.esc(e.role)}</small>
        ${e.gone ? '' : sanBar(e.sanity)}
        <span class="lbl">${e.gone ? STATUS(e) : Content.STAGE_TXT[st]}</span>
        ${!e.gone && e.state !== 'seated' ? `<span class="where">${STATUS(e)}</span>` : ''}
        <span class="out">${Math.round(e.produced)} уток</span>
        ${e.clues.length ? `<span class="flag" title="Есть наблюдения">!</span>` : ''}
      </div>`;
    }
    return html + '</div>';
  }

  function renderDossier(e) {
    if (!e) return head('Досье');
    const st = Sim.stage(e);
    const others = G.emps.filter(o => o !== e && !o.gone);
    const avg = others.length ? others.reduce((s, o) => s + o.produced, 0) / others.length : 0;
    let html = head('Досье сотрудника', `таб. № ${100 + e.uid}`);
    html += `<div class="p-body dossier">
      <div class="d-top">
        <img src="${portrait(e.look, empMood(e))}" alt="">
        <div>
          <h3>${U.esc(e.name)} ${U.esc(e.surname)}</h3>
          <p>${U.esc(e.role)} · ${e.female ? e.pers.f : e.pers.name}</p>
          <p>Зарплата: $${e.salary}/день${e.fined ? ' (оштрафован' + (e.female ? 'а' : '') + ')' : ''}${e.bonus ? ` · премия $${e.bonus}` : ''} · ${seniority(e)}</p>
          <p>Статус: <b>${STATUS(e)}</b></p>
        </div>
      </div>
      ${e.gone ? '' : `<div class="d-row"><span>Рассудок</span>${sanBar(e.sanity)}<b>${Math.round(e.sanity)}% · ${Content.STAGE_TXT[st]}</b></div>`}
      <div class="d-row"><span>Выработка сегодня</span><b>${Math.round(e.produced)} уток</b><small>в среднем по офису ${Math.round(avg)}</small></div>
      <div class="d-row"><span>Подозрения</span><div class="sbar susp"><i style="width:${e.evidence ? 100 : e.suspicion}%"></i></div><b>${suspTxt(e)}</b></div>
      <h4>Наблюдения</h4>
      ${e.clues.length ? `<ul class="clues">${e.clues.slice().reverse().map(c => `<li class="${c.day && c.day < G.day ? 'past' : ''}"><b>${c.day && c.day < G.day ? (c.day === G.day - 1 ? 'вчера' : `день ${c.day}`) : U.time(c.t)}</b> ${U.esc(U.fill(c.text, e))}${c.strong ? ' <em>!</em>' : ''}</li>`).join('')}</ul>` : '<p class="muted">Пока ничего подозрительного не замечено.</p>'}
      ${e.doubleAgent ? '<p class="good">Двойной агент: сливает ГусьКорп фальшивки.</p>' : ''}
      <div class="d-btns">
        ${G.emps.includes(e) && NPC.canCall(e) && G.visitor !== e ? `<button class="btn big" data-act="callin" data-id="${e.uid}">Вызвать в кабинет</button>` : ''}
        ${e.state === 'visit' ? `<button class="btn big" data-act="talk" data-id="${e.uid}">Продолжить разговор</button>` : ''}
        <button class="btn" data-act="staff">← Все сотрудники</button>
      </div>
    </div>`;
    return html;
  }

  /* ---------- Комнаты ---------- */
  function phoneBtn(id) {
    const a = Sim.PHONE.find(p => p.id === id);
    const left = (G.cd[id] || 0) - G.time;
    const cost = a.cost();
    return `<li><div><b>${a.name}</b><small>${a.desc()}</small></div><span class="cost">${cost ? U.money(cost) : 'бесплатно'}</span>
      ${left > 0 ? `<span class="cd">через ${left} мин</span>` : `<button class="btn" data-act="phone" data-id="${id}" ${cost > G.cash ? 'disabled' : ''}>Сделать</button>`}</li>`;
  }
  const empRow = (e, extra) => `<li class="emp-row" data-act="dossier" data-id="${e.uid}"><img src="${portrait(e.look, empMood(e))}" alt=""><span><b>${U.esc(e.name)} ${U.esc(e.surname)}</b><small>${U.esc(e.role)}</small></span><em>${extra}</em></li>`;
  const KIT_TASKS = ['coffee', 'fridge', 'cooler', 'feed', 'sofa', 'lunch', 'pizza'];

  function renderRoom(id) {
    const ROOM = Plan.ROOMS.find(r => r.id === id) || { name: '' };
    let html = '';
    if (id === 'srv') {
      const log = NPC.srvLog();
      const ak = NPC.akhmet();
      html = head('Серверная', 'журнал доступа · сисадмин Ахмет') + `<div class="p-body room">
        <p class="room-note">Допуск в серверную есть только у <b>инженеров пищалок</b> и <b>аналитиков</b>. Ахмет замечает чужих, только когда сидит на месте${ak && ak.away ? ' — <b>сейчас его нет</b>, он ушёл чинить технику' : ''}.</p>
        ${log.length ? `<table class="srv"><tr><th>Время</th><th>Кто</th><th>Допуск</th><th>Ахмет</th></tr>${log.map(l => `<tr class="${l.ok ? '' : 'bad'}" data-act="dossier" data-id="${l.uid}"><td>${U.time(l.t)}</td><td><b>${U.esc(l.name)}</b><small>${U.esc(l.role)}</small></td><td>${l.ok ? 'есть' : 'НЕТ'}</td><td>${l.seen ? 'видел' : 'не видел'}</td></tr>`).join('')}</table>` : '<p class="muted">Сегодня в серверную ещё никто не заходил.</p>'}
        <p class="muted small">Кликните по строке, чтобы открыть досье. Без допуска сюда иногда заходят и честные люди — за зарядкой или от скуки.</p>
      </div>`;
    } else if (id === 'wc') {
      const inside = G.emps.filter(e => e.task === 'wc' && !e.gone);
      html = head('Туалет', 'две кабинки, вечная очередь') + `<div class="p-body room">
        ${inside.length ? `<ul class="emp-list">${inside.map(e => empRow(e, e.hidden ? `сидит ${G.time - e.taskStart} мин` : 'идёт туда')).join('')}</ul>` : '<p class="muted">Обе кабинки свободны.</p>'}
        <p class="room-note">Нормальный визит — 5 минут. Если кто-то сидит по полчаса — это повод присмотреться к его выработке.</p>
      </div>`;
    } else if (id === 'kit') {
      const c = NPC.cat();
      const here = G.emps.filter(e => !e.gone && KIT_TASKS.includes(e.task));
      const where = c.onDesk ? 'сидит на вашем столе' : c.moving ? 'куда-то идёт' : c.pose === 'loaf' ? 'спит' : c.pose === 'eat' ? 'ест' : 'сидит и наблюдает';
      html = head('Комната отдыха', 'кофе, диван, кулер и кот') + `<div class="p-body room">
        <div class="cat-card"><b>Кот Кексик</b> — ${where}.
          <div class="d-row"><span>Сытость</span>${sanBar(100 - c.hunger)}<b>${NPC.catHungry() ? 'голоден!' : 'сыт'}</b></div>
          <small>Рядом с Кексиком сотрудники сходят с ума медленнее. Голодный кот мяукает у миски, а потом садится вам на бумаги.</small>
          <button class="btn" data-act="feedcat" ${NPC.catHungry() ? '' : 'disabled'}>Попросить покормить Кексика</button>
        </div>
        <h4>Сейчас на кухне</h4>
        ${here.length ? `<ul class="emp-list">${here.map(e => empRow(e, NPC.taskLabel(e))).join('')}</ul>` : '<p class="muted">Никого — все работают. Подозрительно.</p>'}
        <h4>Заказать</h4><ul class="phone-list">${phoneBtn('coffee')}${phoneBtn('pizza')}${phoneBtn('music')}</ul>
      </div>`;
    } else if (id === 'meet') {
      const meetLeft = (G.flags.meetUntil || 0) - G.time, psyLeft = (G.flags.psyUntil || 0) - G.time;
      const cd = (G.cd.meeting || 0) - G.time;
      html = head('Переговорная', 'планёрки и психолог') + `<div class="p-body room">
        <p class="room-note">${meetLeft > 0 ? `Идёт планёрка, ещё ${meetLeft} мин.` : psyLeft > 0 ? `Идёт сеанс психолога, ещё ${psyLeft} мин.` : 'Переговорная свободна.'}</p>
        <ul class="phone-list">
          <li><div><b>Провести планёрку</b><small>Все свободные сотрудники на 24 минуты уходят в переговорную. Конвейер без них простаивает, зато каждому +15 рассудка и +6% к выработке до конца дня.</small></div>
          <span class="cost">бесплатно</span>${cd > 0 ? `<span class="cd">через ${cd} мин</span>` : `<button class="btn" data-act="meeting" ${meetLeft > 0 || psyLeft > 0 ? 'disabled' : ''}>Собрать</button>`}</li>
          ${phoneBtn('psy')}
        </ul>
      </div>`;
    } else if (id === 'store') {
      const el = Math.max(30, G.time - CFG.DAY_START);
      const kgPerH = (G.ducks / el) * 60 * CFG.KG_PER_DUCK;
      const pending = G.sched.filter(ev => ev.type === 'deliver');
      html = head('Склад резины', 'мастер цеха Михалыч') + `<div class="p-body room">
        <div class="crt small-crt">
          <div class="ln"><span>На складе</span><i></i><b>${Math.round(G.rubber)} кг</b></div>
          <div class="ln"><span>Расход</span><i></i><b>≈${Math.round(kgPerH)} кг/час</b></div>
          <div class="ln ${G.rubber / Math.max(1, kgPerH) < 0.7 ? 'down' : ''}"><span>Хватит примерно на</span><i></i><b>${kgPerH > 1 ? Math.round(G.rubber / kgPerH * 60) + ' мин' : '—'}</b></div>
          <div class="ln"><span>Едет поставок</span><i></i><b>${pending.length ? pending.map(p => `${p.kg} кг в ${U.time(p.t)}`).join(', ') : 'нет'}</b></div>
          ${G.time < G.breakdownUntil ? `<div class="ln down"><span>Конвейер</span><i></i><b>СЛОМАН до ${U.time(G.breakdownUntil)}</b></div>` : ''}
        </div>
        <p class="room-note">Обычную резину ($3/кг) закупает отдел снабжения — счёт придёт в лоток документов. Срочная — дороже, но приедет быстро.</p>
        <ul class="phone-list">${phoneBtn('rubber')}</ul>
      </div>`;
    } else html = head(ROOM.name);
    return html;
  }

  function renderJournal() {
    let html = head('Журнал дня', 'всё, что случилось');
    html += `<div class="p-body"><ul class="journal">${G.log.map(l => `<li class="t-${l.type}"><b>${U.time(l.t)}</b> ${U.esc(l.text)}</li>`).join('') || '<li>Пока тихо.</li>'}</ul></div>`;
    return html;
  }

  function renderHelp() {
    return head('Как играть') + `<div class="p-body help">
      <p>Вы — менеджер «Кря Индастриз». Каждый рабочий день длится с <b>9:00 до 18:00</b>, вечером — совет директоров. Дни идут один за другим: всё, что вы сделали сегодня, останется с вами завтра.</p>
      <h4>Что делать</h4>
      <ul>
        <li><b>Рабочий стол</b> (лоток документов) — три вкладки: <b>Документы</b>, <b>Резюме</b> и <b>Новости</b>. Берите штамп «СОГЛАСОВАНО» или «ОТКАЗАНО» и шлёпайте по бумаге. Сомневаетесь — переключитесь на газету, не закрывая окно.</li>
        <li><b>Газета «Утренний Кряк»</b> — крупные заголовки с плашками: какая бумага, сколько стоит и что сулит новость (ажиотаж, тревожный знак, обвал, ждут рост). Слухи выходят заранее — успейте купить или продать.</li>
        <li><b>Найм.</b> Когда кто-то уходит или вы его увольняете, стол пустеет, и в лоток начинают приходить резюме. «Согласовано» — человек выходит на работу. Читайте внимательно: лентяи пишут про сон и диван, а ГусьКорп подсылает «кандидатов» с гусиными рекомендациями.</li>
        <li><b>Сотрудники</b> работают за стеклом. Кликните по любому — откроется досье. Вызывайте подозрительных на ковёр: расспросите, обыщите портфель, премируйте, оштрафуйте или увольте.</li>
        <li><b>Офис живёт сам.</b> Сотрудники ходят за кофе, болтают у кулера, кормят кота и сами приходят к вам с жалобами, идеями и просьбами.</li>
        <li><b>Шпионы ГусьКорп</b> фотографируют чертежи и копируют дискеты. Пока шпион на месте — будут утечки, и завтра тоже.</li>
        <li><b>Безумие.</b> Полоска над головой — рассудок. За ночь люди отдыхают, но не до конца: если вечером офис был Уолл-стрит, утро начнётся на нервах.</li>
        <li><b>Деньги.</b> Касса, акции, облигации и репутация переходят в следующий день. Покупки вроде массажного кресла и кофемашины остаются навсегда.</li>
        <li><b>Совет директоров</b> в 18:00: повышение (план растёт), оставление, штраф или увольнение. Два штрафа подряд — увольнение. Игра сохраняется в начале каждого дня.</li>
      </ul>
      <h4>Управление</h4>
      <ul class="keys">
        <li><kbd>1</kbd>–<kbd>6</kbd> — панели хотбара, <kbd>N</kbd> — газета</li>
        <li><kbd>A</kbd> / <kbd>D</kbd> — штамп «согласовано» / «отказано», <kbd>Q</kbd> — следующая вкладка рабочего стола</li>
        <li><kbd>Пробел</kbd> — пауза, <kbd>F</kbd> — ускорить время, <kbd>M</kbd> — звук, <kbd>Esc</kbd> — закрыть окно</li>
      </ul>
      <p class="muted">Пока открыт рабочий стол, время идёт вдвое медленнее, во время разговоров — вчетверо.</p>
    </div>`;
  }

  /* ---------- Клики в окнах ---------- */
  function onPanelDown(ev) {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'buy' || a === 'sell' || a === 'bond' || a === 'phone') {
      ev.preventDefault();
      if (a === 'buy') { const n = Market.buy(b.dataset.id, +b.dataset.v); if (n) { Sfx.play('coin'); Sim.log(`Куплено ${n} акций ${b.dataset.id}`); } else { Sfx.play('bad'); toast('Не хватает денег.', 'bad'); } }
      if (a === 'sell') { const got = Market.sell(b.dataset.id); if (got) { Sfx.play('coin'); Sim.log(`Продано ${b.dataset.id} на ${U.money(got)}`); } }
      if (a === 'bond') { if (Market.buyBonds(+b.dataset.v)) { Sfx.play('coin'); Sim.log(`Куплены облигации на ${U.money(+b.dataset.v)}`); } else { Sfx.play('bad'); toast('Не хватает денег.', 'bad'); } }
      if (a === 'phone') Sim.phoneAction(b.dataset.id);
      render();
    }
  }
  function onPanelClick(ev) {
    const paper = ev.target.closest('#paper');
    if (paper && held && !stamping) { stampAt(held, ev.clientX, ev.clientY); return; }
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') close();
    else if (a === 'doc') { docSel = +b.dataset.i; Sfx.play('paper'); render(true); }
    else if (a === 'stamp') pickStamp(b.dataset.s);
    else if (a === 'ttab') { curArg = b.dataset.t; if (curArg === 'news') newsMark = G.newsSeen || 0; Sfx.play('click'); render(true); }
    else if (a === 'dtab') { setDocTab(b.dataset.t); }
    else if (a === 'answer') answerCall();
    else if (a === 'dossier') { const e = Sim.byUid(+b.dataset.id); if (e) { Sfx.play('click'); openPanel('dossier', e); } }
    else if (a === 'cvtab') { Sfx.play('click'); openPanel('docs', 'cv'); }
    else if (a === 'staff') { Sfx.play('click'); openPanel('staff'); }
    else if (a === 'meeting') {
      if (G.time < (G.cd.meeting || 0)) return;
      const n = NPC.meeting();
      G.cd.meeting = G.time + 150;
      Sim.toast(n ? `Планёрка! В переговорную идут ${n} чел. Конвейер подождёт.` : 'Все заняты — планёрку собрать не удалось.', n ? 'good' : 'warn');
      Sfx.play('open'); close();
    } else if (a === 'feedcat') { NPC.clickCat(); render(true); }
    else if (a === 'callin') { const e = Sim.byUid(+b.dataset.id); if (e && Sim.callIn(e)) close(); }
    else if (a === 'talk') { const e = Sim.byUid(+b.dataset.id); if (e) { close(); openTalk(e); } }
  }

  /* ---------- Диалоги ---------- */
  const D = { open: false, pages: [], page: 0, full: '', shown: 0, options: null, onDone: null, blipT: 0 };
  function dialog(o) {
    D.open = true;
    D.pages = o.pages || [o.text || ''];
    D.page = 0;
    D.options = o.options || null;
    D.onDone = o.onDone || null;
    G.dialog = true;
    G.dialogKind = o.kind || 'call';
    if (cur) close();
    const sp = o.speaker || { name: '', title: '' };
    $('dlg-name').textContent = sp.name || '';
    $('dlg-title').textContent = sp.title || '';
    $('dlg-img').src = sp.look ? portrait(sp.look, sp.mood) : duckURL;
    $('dialog').classList.remove('hidden');
    $('dialog').classList.toggle('board', G.dialogKind === 'board');
    startPage();
    tooltip(null);
  }
  function startPage() {
    D.full = D.pages[D.page];
    D.shown = 0;
    $('dlg-text').textContent = '';
    $('dlg-opts').innerHTML = '';
    $('dlg-next').classList.remove('show');
  }
  function finishTyping() {
    D.shown = D.full.length;
    $('dlg-text').textContent = D.full;
    const last = D.page === D.pages.length - 1;
    if (last && D.options) {
      $('dlg-opts').innerHTML = D.options.map((op, i) => `<button class="opt ${op.cls || ''}" data-i="${i}">${U.esc(op.label)}</button>`).join('');
      $('dlg-opts').querySelectorAll('.opt').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        const op = D.options[+b.dataset.i];
        Sfx.play('click');
        closeDialog();
        op.fn();
      }));
    } else {
      $('dlg-next').classList.add('show');
    }
  }
  function onDialogClick() {
    if (!D.open) return;
    if (D.shown < D.full.length) { finishTyping(); return; }
    const last = D.page === D.pages.length - 1;
    if (last && D.options) return;
    Sfx.play('click');
    if (!last) { D.page++; startPage(); return; }
    const done = D.onDone;
    closeDialog();
    if (done) done();
  }
  function closeDialog() {
    D.open = false;
    G.dialog = false;
    G.dialogKind = null;
    $('dialog').classList.add('hidden');
  }
  function advanceDialog() { if (D.open) onDialogClick(); }

  /* ---------- Разговор с сотрудником ---------- */
  const speakerOf = e => ({ name: `${e.name} ${e.surname}`, title: e.role, look: e.look, mood: e.bonus && Sim.stage(e) < 2 ? 'happy' : empMood(e) });

  function openTalk(e, text) {
    if (e.state !== 'visit') return;
    e.pendingTalk = false;
    if (e.visitReason && !text) { openReason(e); return; }
    const st = Sim.stage(e);
    const opts = [];
    if (!e.asked) opts.push({ label: 'Как продвигается работа?', fn: () => openTalk(e, Sim.askWork(e)) });
    if (!e.searched) opts.push({ label: 'Проверить портфель и телефон', fn: () => openTalk(e, Sim.search(e)) });
    if (!e.soul) opts.push({ label: 'Поговорить по душам (+рассудок)', fn: () => openTalk(e, Sim.soul(e)) });
    opts.push({ label: 'Принять решение →', fn: () => decide(e) });
    dialog({ speaker: speakerOf(e), text: U.fill(text || U.pick(Data.TALK.greet[st]), e), options: opts, kind: 'talk' });
  }
  function decide(e) {
    const opts = [
      { label: 'Вернуть к работе', fn: () => finish(e, 'back', null) },
      { label: `Премия $200 (+35 рассудка)`, fn: () => finish(e, 'back', Sim.bonus(e)) },
      { label: 'Штраф $100 из зарплаты', fn: () => finish(e, 'back', Sim.fine(e)) },
      { label: 'Отправить домой отдохнуть', fn: () => finish(e, 'home', Sim.sendHome(e)) },
    ];
    if (e.evidence && e.trait === 'spy' && !e.doubleAgent) {
      opts.push({ label: 'Перевербовать в двойного агента', fn: () => { const r = Sim.turn(e); finish(e, e.fled ? 'leave' : 'back', r); } });
    }
    opts.push({ label: 'УВОЛИТЬ', cls: 'danger', fn: () => confirmFire(e) });
    opts.push({ label: '← Назад', fn: () => openTalk(e, 'Что-то ещё, босс?') });
    dialog({ speaker: speakerOf(e), text: U.fill('(Вы задумчиво смотрите на {name}. Что решим?)', e), options: opts, kind: 'talk' });
  }
  function confirmFire(e) {
    dialog({
      speaker: speakerOf(e),
      text: U.fill('(Уволить {name}? Это навсегда. Если {он|она} не виноват{|а} — офис этого не забудет.)', e),
      options: [
        { label: 'Да, уволить', cls: 'danger', fn: () => finish(e, 'fire', Sim.fire(e)) },
        { label: 'Нет, подождите', fn: () => decide(e) },
      ],
      kind: 'talk',
    });
  }
  function openReason(e) {
    const r = e.visitReason;
    dialog({
      speaker: speakerOf(e), text: r.text, kind: 'talk',
      options: r.options.map(o => ({
        label: o.label, cls: o.cls,
        fn: () => { const res = o.fn(e) || {}; e.visitReason = null; Sfx.play('click'); finish(e, res.how || 'back', res.text); },
      })).concat([{ label: 'Сначала другое… (расспросить)', fn: () => { e.visitReason = null; openTalk(e, 'Ну… давайте. Что вы хотели спросить?'); } }]),
    });
  }
  function finish(e, how, reply) {
    if (reply) dialog({ speaker: speakerOf(e), text: U.fill(reply, e), onDone: () => Sim.endVisit(e, how), kind: 'talk' });
    else Sim.endVisit(e, how);
  }

  function answerCall() {
    if (!G.call) return;
    if (G.dialog) { toast('Сначала закончите разговор.', 'warn'); return; }
    if (cur) close();
    const key = G.call.key;
    G.call = null;
    Sfx.play('click');
    Content.CALLS[key].open();
  }

  /* ---------- Обновление HUD ---------- */
  function update(dt) {
    if (!G) return;
    if (G.phase === 'day' || G.phase === 'intro') {
      $('c-day').textContent = `${Sim.WEEK[Sim.weekday()]} · День ${G.day}`;
      $('c-time').textContent = U.time(G.time);
      $('c-sky').src = Spr.iconURL(G.time >= U.T(17, 20) ? 'moon' : 'sun', 3);
      cashShown = U.lerp(cashShown, G.cash, Math.min(1, dt * 6));
      if (Math.abs(cashShown - G.cash) < 1) cashShown = G.cash;
      $('c-cash').textContent = U.money(cashShown);
      $('c-cash').classList.toggle('neg', G.cash < 0);
      const ch = Math.round(G.chaos);
      $('m-chaos').style.width = ch + '%';
      $('m-chaos').className = ch >= 80 ? 'r' : ch >= 60 ? 'o' : ch >= 40 ? 'y' : 'g';
      $('t-chaos').textContent = ch + '%';
      $('chaos-label').textContent = ch >= 80 ? 'УОЛЛ-СТРИТ 2001' : ch >= 60 ? 'Безумие' : ch >= 40 ? 'Нервно' : ch >= 20 ? 'Рабочая суета' : 'Спокойно';
      $('chaos-label').className = ch >= 60 ? 'hot' : '';
      $('m-ducks').style.width = Math.min(100, (G.ducks / G.plan) * 100) + '%';
      $('t-ducks').textContent = Math.floor(G.ducks);
      $('m-rubber').style.width = Math.min(100, (G.rubber / 600) * 100) + '%';
      $('m-rubber').className = G.rubber < 90 ? 'r' : G.rubber < 200 ? 'y' : 'b';
      $('t-rubber').textContent = Math.round(G.rubber) + ' кг';
      const badge = (id, n, cls) => {
        const b = document.querySelector(`#slot-${id} .badge`);
        b.textContent = n ? String(n) : '';
        b.className = 'badge' + (n ? ' show ' + (cls || '') : '');
      };
      badge('docs', G.inbox.length, G.inbox.length > 4 ? 'red' : '');
      badge('phone', G.call ? '!' : 0, 'red');
      badge('staff', G.emps.filter(e => !e.gone && Sim.stage(e) >= 2).length, 'red');
      $('slot-phone').classList.toggle('ring', !!G.call);
      document.querySelectorAll('#hotbar .slot').forEach(b => b.classList.toggle('on', b.id === 'slot-' + cur));
      $('b-speed').classList.toggle('on', G.speed > 1);
      $('b-pause').classList.toggle('on', G.paused);
    }
    if (!D.open && !cur && G.phase === 'day' && G.visitor && G.visitor.state === 'visit' && G.visitor.pendingTalk) {
      openTalk(G.visitor);
    }
    if (D.open && D.shown < D.full.length) {
      D.shown = Math.min(D.full.length, D.shown + dt * 62);
      $('dlg-text').textContent = D.full.slice(0, Math.floor(D.shown));
      D.blipT -= dt;
      if (D.blipT <= 0) { Sfx.play('blip'); D.blipT = 0.05; }
      if (D.shown >= D.full.length) finishTyping();
    }
    if (cur && cur !== 'docs' && cur !== 'help') {
      refreshT -= dt;
      if (refreshT <= 0) { refreshT = 0.6; render(); }
    } else if (cur === 'docs') render();
  }

  /* Новый день: чистим окна и уведомления */
  function resetDay() {
    if (cur) close();
    if (D.open) closeDialog();
    dropStamp();
    $('toasts').innerHTML = '';
    cashShown = G.cash; lastInboxLen = -1; lastNewsLen = -1; docTab = 'docs'; newsMark = 0; docSel = 0;
    $('b-speed').innerHTML = `<img src="${Spr.iconURL('play', 3)}" alt="">`;
  }

  function onKey(ev) {
    const k = ev.key.toLowerCase();
    if (ev.target && ev.target.tagName === 'INPUT') return false;
    if (D.open && (k === ' ' || k === 'enter')) { advanceDialog(); return true; }
    if (k === 'escape') { if (held) dropStamp(); else close(); return true; }
    if (G.phase !== 'day' || D.open) return false;
    const hb = HOTBAR.find(h => h.key === k);
    if (hb) { toggle(hb.id); return true; }
    if (cur === 'docs' && (k === 'a' || k === 'ф')) { if (tabDocs().length) stampAt('approve'); return true; }
    if (cur === 'docs' && (k === 'd' || k === 'в')) { if (tabDocs().length) stampAt('reject'); return true; }
    if (cur === 'docs' && (k === 'tab' || k === 'q' || k === 'й')) { const order = ['docs', 'cv', 'news']; setDocTab(order[(order.indexOf(docTab) + 1) % 3]); return true; }
    if (k === 'n' || k === 'т') { if (cur === 'docs') setDocTab(docTab === 'news' ? pickTab() : 'news'); else openPanel('docs', 'news'); return true; }
    return false;
  }

  return {
    init, toast, say, tooltip, openPanel, openDossier, close, dialog, closeDialog, openTalk, answerCall, update, onKey, resetDay,
    isOpen: () => !!cur, dialogOpen: () => D.open, portrait, duck: () => duckURL,
  };
})();
