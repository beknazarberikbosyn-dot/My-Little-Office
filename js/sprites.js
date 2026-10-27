'use strict';
/* Пиксельная графика: люди, утки, иконки. Всё рисуется кодом, без картинок. */
const Spr = (() => {
  let c = null;
  const use = ctx => { c = ctx; };
  const ctx = () => c;
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

  function bake(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const col = pal[rows[j][i]];
        if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); }
      }
    }
    return cv;
  }

  /* ---------- Человечек ---------- */
  function person(x, y, L, o = {}) {
    x = Math.round(x); y = Math.round(y);
    const dir = o.dir || 'down';
    const f = o.frame || 0;
    const skin = L.skin, skinD = U.shade(L.skin, -30);
    const hair = L.hair, hairD = U.shade(L.hair, -22), hairL = U.shade(L.hair, 28);
    const body = L.jacket || L.shirt;
    const bodyD = U.shade(body, -30);
    const top = y - 16;
    const hy = top - 8;

    if (!o.noLegs) {
      R(x - 5, y - 1, 10, 2, 'rgba(0,0,0,0.2)');
      let l1 = 0, l2 = 0;
      if (o.walking) { if (f % 2 === 0) l1 = -1; else l2 = -1; }
      const leg = L.skirt && dir !== 'up' ? '#3a2a2a' : L.pants;
      R(x - 4, y - 7, 3, 6 + l1, leg);
      R(x + 1, y - 7, 3, 6 + l2, leg);
      R(x - 4, y - 1 + l1, 3, 1, '#1e1a18');
      R(x + 1, y - 1 + l2, 3, 1, '#1e1a18');
      if (L.skirt) { R(x - 5, y - 9, 10, 4, L.skirt); R(x - 5, y - 6, 10, 1, U.shade(L.skirt, -25)); }
    }

    /* торс */
    R(x - 5, top, 10, 9, body);
    R(x + 3, top, 2, 9, bodyD);
    if (dir !== 'up') {
      if (L.jacket) R(x - 2, top, 4, 4, L.shirt);
      else R(x - 2, top, 4, 1, U.shade(L.shirt, 25));
      if (L.tie && dir === 'down' && !o.tieOnHead) {
        R(x - 1, top, 2, 6, L.tie);
        R(x - 1, top, 2, 1, U.shade(L.tie, 35));
      }
    }
    if (!L.skirt) R(x - 5, top + 8, 10, 1, '#2a201a');

    /* руки */
    const arms = o.arms || 'down';
    if (arms === 'up') {
      const a = f % 2;
      R(x - 7, top - 7 + a * 2, 2, 9 - a * 2, body); R(x - 7, top - 9 + a * 2, 2, 2, skin);
      R(x + 5, top - 5 - a * 2, 2, 7 + a * 2, body); R(x + 5, top - 7 - a * 2, 2, 2, skin);
    } else if (arms === 'thump') {
      if (f % 2) {
        R(x - 6, top + 2, 12, 2, body); R(x - 2, top + 2, 4, 2, skin);
      } else {
        R(x - 7, top + 1, 2, 6, body); R(x + 5, top + 1, 2, 6, body);
        R(x - 7, top + 7, 2, 2, skin); R(x + 5, top + 7, 2, 2, skin);
      }
    } else if (arms === 'phone') {
      R(x - 7, top + 1, 2, 7, body); R(x - 7, top + 8, 2, 2, skin);
      R(x + 4, top - 3, 2, 5, body); R(x + 3, top - 6, 2, 3, skin);
      R(x + 4, hy + 1, 2, 6, '#222');
    } else if (arms === 'box') {
      R(x - 7, top + 1, 2, 5, body); R(x + 5, top + 1, 2, 5, body);
      R(x - 7, top + 3, 14, 8, '#c49a6c'); R(x - 7, top + 3, 14, 1, '#d9b384'); R(x - 7, top + 10, 14, 1, '#9b764d');
      R(x - 4, top + 1, 2, 3, '#3f8f3a'); R(x + 1, top, 2, 3, '#f3e2a0'); R(x + 3, top + 1, 1, 2, '#ffd23f');
    } else {
      R(x - 7, top + 1, 2, 7, body); R(x + 5, top + 1, 2, 7, bodyD);
      R(x - 7, top + 8, 2, 2, skin); R(x + 5, top + 8, 2, 2, skin);
    }

    /* голова */
    const sleep = o.mood === 'sleep';
    const hdy = sleep ? 2 : 0;
    const H = hy + hdy;
    R(x - 4, H, 8, 8, skin);
    R(x - 4, H + 7, 8, 1, skinD);

    if (dir === 'up') {
      R(x - 4, H - 1, 8, 8, hair);
      R(x - 5, H, 1, 5, hair); R(x + 4, H, 1, 5, hair);
      if (L.hairStyle === 'long') { R(x - 5, H, 10, 10, hair); }
      if (L.hairStyle === 'bun') R(x - 2, H - 3, 4, 3, hair);
      if (L.hairStyle === 'bald') { R(x - 4, H - 1, 8, 3, skin); R(x - 4, H + 2, 8, 4, hair); }
    } else {
      const st = L.hairStyle;
      if (st === 'bald') {
        R(x - 5, H + 1, 1, 4, hair); R(x + 4, H + 1, 1, 4, hair);
        R(x - 1, H, 3, 1, 'rgba(255,255,255,0.5)');
      } else {
        R(x - 4, H - 1, 8, 3, hair);
        R(x - 5, H, 1, 4, hair); R(x + 4, H, 1, 4, hair);
        R(x - 2, H - 1, 3, 1, hairL);
        if (st === 'long') { R(x - 5, H, 2, 10, hair); R(x + 3, H, 2, 10, hair); R(x - 5, H + 9, 2, 1, hairD); }
        if (st === 'bob') { R(x - 5, H, 2, 6, hair); R(x + 3, H, 2, 6, hair); }
        if (st === 'bun') { R(x - 2, H - 3, 4, 3, hair); R(x - 1, H - 3, 2, 1, hairL); }
        if (st === 'spiky') { R(x - 4, H - 2, 1, 1, hair); R(x - 1, H - 3, 2, 2, hair); R(x + 2, H - 2, 1, 1, hair); }
        if (st === 'slick') { R(x - 4, H - 1, 8, 2, hair); R(x - 1, H - 1, 1, 2, hairD); R(x + 1, H, 3, 1, hair); }
        if (dir === 'left') R(x + 1, H, 3, 5, hair);
        if (dir === 'right') R(x - 4, H, 3, 5, hair);
      }

      /* лицо */
      const mood = o.mood || 'normal';
      const ex = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const eye = '#2b1d14';
      if (sleep) {
        R(x - 3, H + 4, 2, 1, eye); R(x + 1, H + 4, 2, 1, eye);
      } else if (mood === 'crazy') {
        R(x - 3 + ex, H + 2, 2, 2, '#fff'); R(x + 1 + ex, H + 2, 2, 2, '#fff');
        R(x - 2 + ex, H + 3, 1, 1, '#000'); R(x + 1 + ex, H + 2, 1, 1, '#000');
      } else {
        if (dir === 'down') { R(x - 2, H + 3, 1, 2, eye); R(x + 1, H + 3, 1, 2, eye); }
        else R(x + (ex < 0 ? -3 : 2), H + 3, 1, 2, eye);
      }
      if (mood === 'stress' || mood === 'mad' || mood === 'crazy') {
        R(x - 3 + ex, H + 2 - (mood === 'crazy' ? 1 : 0), 2, 1, hairD);
        R(x + 1 + ex, H + 2 - (mood === 'crazy' ? 1 : 0), 2, 1, hairD);
      }
      if (L.glasses && !sleep && mood !== 'crazy' && dir === 'down') {
        R(x - 3, H + 3, 2, 2, '#2a2a2a'); R(x + 1, H + 3, 2, 2, '#2a2a2a'); R(x - 1, H + 3, 2, 1, '#2a2a2a');
        R(x - 3, H + 3, 1, 1, '#9ad'); R(x + 1, H + 3, 1, 1, '#9ad');
      }
      if (dir === 'down') {
        if (mood === 'mad' || mood === 'crazy') {
          if (f % 2) R(x - 1, H + 5, 3, 2, '#7a1f1f'); else R(x - 1, H + 6, 3, 1, '#7a1f1f');
        } else if (mood === 'happy') {
          R(x - 2, H + 5, 1, 1, skinD); R(x - 1, H + 6, 2, 1, '#7a1f1f'); R(x + 1, H + 5, 1, 1, skinD);
        } else if (mood === 'stress') {
          R(x - 1, H + 6, 3, 1, skinD);
        } else {
          R(x - 1, H + 6, 2, 1, skinD);
        }
        if (o.flush) { R(x - 4, H + 4, 2, 2, 'rgba(230,60,40,0.45)'); R(x + 2, H + 4, 2, 2, 'rgba(230,60,40,0.45)'); }
      }
    }
    if (o.tieOnHead) {
      const tie = L.tie || '#c0392b';
      R(x - 4, H + 1, 8, 1, tie); R(x + 4, H + 1, 2, 1, tie);
      R(x + 5, H + 2, 1, 2 + (f % 2), tie);
    }
    if (o.sweat) { R(x + 5, H + 1 + (f % 3), 1, 2, '#8fd3ff'); }
  }

  /* ---------- Утка ---------- */
  const DUCK = bake([
    '....YYY...',
    '...YYwYY..',
    '...YYkYOO.',
    '....YYYOO.',
    'Y...YYY...',
    'YY.YYYYYY.',
    'YYYYYYwYYy',
    '.YYYYYYYYy',
    '..yyyyyyy.',
  ], { Y: '#ffd23f', y: '#e3a515', w: '#fff3a8', k: '#1d1d1d', O: '#ff8a1c' });
  const DUCK_L = (() => {
    const cv = document.createElement('canvas'); cv.width = DUCK.width; cv.height = DUCK.height;
    const g = cv.getContext('2d'); g.translate(DUCK.width, 0); g.scale(-1, 1); g.drawImage(DUCK, 0, 0);
    return cv;
  })();
  const DUCK_EVIL = bake([
    '....GGG...',
    '...GGwGG..',
    '...GGrGOO.',
    '....GGGOO.',
    'G...GGG...',
    'GG.GGGGGG.',
    'GGGGGGwGGg',
    '.GGGGGGGGg',
    '..ggggggg.',
  ], { G: '#e8e8e8', g: '#b8b8c0', w: '#ffffff', r: '#c0392b', O: '#ff8a1c' });

  function duck(x, y, left, evil) {
    c.drawImage(evil ? DUCK_EVIL : (left ? DUCK_L : DUCK), Math.round(x), Math.round(y));
  }

  /* ---------- Иконки (для HUD и меток над головами) ---------- */
  const PAL = {
    '#': '#3b2414', W: '#fbf3e0', w: '#e0d2b0', b: '#8a7a66', G: '#3fa34d', g: '#5dff7a', R: '#d23c3c', r: '#9e2626',
    B: '#3b6ea8', K: '#1c1c1c', Y: '#ffd23f', y: '#e3a515', O: '#ff8a1c', C: '#d8d0bc', c: '#a89f88',
    S: '#f1c9a5', H: '#4a2f1c', T: '#5a7fb8', t: '#3d5f91', P: '#e86a9a', N: '#2b3a55', L: '#9fd3ff',
  };
  const ICONS = {
    docs: [
      '..........',
      '.#######..',
      '.#WWWWW##.',
      '.#WbbbW#w#',
      '.#WWWWWW#.',
      '.#WbbbbW#.',
      '.#WWWWWW#.',
      '.#WbRRRW#.',
      '.#WRRRRW#.',
      '.#WWRRWW#.',
      '.########.',
      '..........',
    ],
    terminal: [
      '..........',
      '##########',
      '#CCCCCCCC#',
      '#CKKKKKKc#',
      '#CKgKKKKc#',
      '#CKKgKgKc#',
      '#CKKKgKKc#',
      '#CCCCCCCc#',
      '##########',
      '...#cc#...',
      '.########.',
      '..........',
    ],
    phone: [
      '..........',
      '.########.',
      '#RRRRRRRR#',
      '#R#....#R#',
      '##.####.##',
      '..#RRRR#..',
      '.#RRWWRR#.',
      '.#RWKKWR#.',
      '.#RRWWRR#.',
      '.#RRRRRR#.',
      '.########.',
      '..........',
    ],
    staff: [
      '..........',
      '.HHH..HHH.',
      'HSSSHHSSSH',
      '.SKSK.SKS.',
      '.SSSS.SSS.',
      '..SS...S..',
      '.TTTT.PPP.',
      'TTtTTTPPPP',
      'TTtTTTPPPP',
      'TTtTT.PPPP',
      '..........',
      '..........',
    ],
    news: [
      '..........',
      '##########',
      '#WWWWWWWW#',
      '#WKKKKKKW#',
      '#WWWWWWWW#',
      '#WbbW#BBW#',
      '#WbbW#BBW#',
      '#WWWW#WWW#',
      '#WbbbbbbW#',
      '#WWWWWWWW#',
      '##########',
      '..........',
    ],
    help: [
      '..........',
      '...####...',
      '..#YYYY#..',
      '.#YY##YY#.',
      '.#YYYY#Y#.',
      '.#YYY#YY#.',
      '.#YYY#YY#.',
      '.#YYYYYY#.',
      '..#YY#Y#..',
      '...####...',
      '..........',
      '..........',
    ],
    sun: [
      '....Y....',
      '.Y..Y..Y.',
      '..YYYYY..',
      '..YOOOY..',
      'YYYOOOYYY',
      '..YOOOY..',
      '..YYYYY..',
      '.Y..Y..Y.',
      '....Y....',
    ],
    moon: [
      '...YYY...',
      '..YY.....',
      '.YY......',
      '.YY......',
      '.YY......',
      '.YY......',
      '..YY.....',
      '...YYY...',
      '.........',
    ],
    pause: ['........', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '........'],
    play: ['........', '.#......', '.###....', '.#####..', '.######.', '.#####..', '.###....', '.#......'],
    fast: ['........', '#...#...', '##..##..', '###.###.', '########', '###.###.', '##..##..', '#...#...'],
    sound: ['........', '...#..#.', '..##...#', '####.#.#', '####.#.#', '..##...#', '...#..#.', '........'],
    mute: ['........', '...#....', '..##.#.#', '####..#.', '####.#.#', '..##....', '...#....', '........'],
  };
  const iconCache = {};
  function iconURL(name, scale = 4) {
    const key = name + scale;
    if (iconCache[key]) return iconCache[key];
    const base = bake(ICONS[name], PAL);
    const cv = document.createElement('canvas');
    cv.width = base.width * scale; cv.height = base.height * scale;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, cv.width, cv.height);
    iconCache[key] = cv.toDataURL();
    return iconCache[key];
  }

  /* Значки над головами 7x7 */
  const MARKS = {
    alert: bake(['..###..', '.#YYY#.', '.#Y#Y#.', '.#Y#Y#.', '.#YYY#.', '.#Y#Y#.', '..###..'], { '#': '#3b2414', Y: '#ffd23f' }),
    bang: bake(['.#####.', '#RRWRR#', '#RRWRR#', '#RRWRR#', '#RRRRR#', '#RRWRR#', '.#####.'], { '#': '#3b0f0f', R: '#e04040', W: '#fff' }),
    cam: bake(['.......', '..##...', '#######', '#KKWKK#', '#KWWWK#', '#KKWKK#', '#######'], { '#': '#222', K: '#555', W: '#9fd3ff' }),
    disk: bake(['#######', '#BWWWB#', '#BWWWB#', '#BBBBB#', '#BKKKB#', '#BKKKB#', '#######'], { '#': '#111', B: '#2b4f8a', W: '#e8e8e8', K: '#888' }),
    phone: bake(['.......', '.##.##.', '.#R.R#.', '..RRR..', '.RRWRR.', '.RRRRR.', '.......'], { '#': '#222', R: '#d23c3c', W: '#fff' }),
    zzz: bake(['..####.', '....#..', '...#...', '..####.', '#####..', '..#....', '#####..'], { '#': '#cfe6ff' }),
    cards: bake(['.#####.', '.#WWW#.', '.#WRW#.', '.#RRR#.', '.#WRW#.', '.#WWW#.', '.#####.'], { '#': '#222', W: '#fff', R: '#d23c3c' }),
    chat: bake(['.#####.', '#GGGGG#', '#GWGWG#', '#GGGGG#', '.##G##.', '...#...', '.......'], { '#': '#1d4f1d', G: '#5bd16a', W: '#fff' }),
    heart: bake(['.......', '.##.##.', '#RR#RR#', '#RRRRR#', '.#RRR#.', '..#R#..', '...#...'], { '#': '#5a1010', R: '#ff5a6e' }),
    money: bake(['#######', '#GGGGG#', '#GG$GG#', '#G$$$G#', '#GG$GG#', '#GGGGG#', '#######'], { '#': '#0f3d17', G: '#5cb85c', $: '#e8ffe0' }),
    star: bake(['...#...', '..#Y#..', '##YYY##', '.#YYY#.', '.#Y#Y#.', '#.#.#.#', '.......'], { '#': '#6b4a00', Y: '#ffd23f' }),
  };
  function mark(name, x, y) { const m = MARKS[name]; if (m) c.drawImage(m, Math.round(x), Math.round(y)); }
  function markURL(name, scale = 4) {
    const key = 'm_' + name + scale;
    if (iconCache[key]) return iconCache[key];
    const m = MARKS[name];
    if (!m) return '';
    const cv = document.createElement('canvas');
    cv.width = m.width * scale; cv.height = m.height * scale;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(m, 0, 0, cv.width, cv.height);
    iconCache[key] = cv.toDataURL();
    return iconCache[key];
  }

  /* Портрет: человек крупным планом на отдельном canvas */
  function portrait(L, o = {}) {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d');
    const prev = c;
    use(g);
    person(8, 29, L, Object.assign({ noLegs: true }, o));
    use(prev);
    return cv;
  }

  function portraitURL(L, o, scale = 6) {
    const p = portrait(L, o);
    const cv = document.createElement('canvas');
    cv.width = p.width * scale; cv.height = p.height * scale;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(p, 0, 0, cv.width, cv.height);
    return cv.toDataURL();
  }

  return { use, ctx, R, bake, person, duck, iconURL, mark, markURL, portrait, portraitURL, DUCK };
})();
