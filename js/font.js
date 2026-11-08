'use strict';
/* Надписи на canvas: настоящие шрифты в полном разрешении экрана
   (холст рисуется в DS раз крупнее логических 480×288, поэтому текст остаётся чётким) */
const Font = (() => {
  const FACES = {
    sign: '"Russo One", "Arial Black", sans-serif',
    tick: '"Oswald", "Arial Narrow", sans-serif',
    body: '"Nunito", "Segoe UI", sans-serif',
  };
  const mctx = document.createElement('canvas').getContext('2d');
  const css = o => `${o.weight || 400} ${o.size || 7}px ${FACES[o.face || 'sign']}`;

  /* x — левый край (или центр при align:'center'), cy — вертикальный центр строки */
  function draw(ctx, text, x, cy, color, o = {}) {
    const s = String(text);
    ctx.save();
    ctx.font = css(o);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(s);
    const asc = m.actualBoundingBoxAscent || (o.size || 7) * 0.72;
    const desc = m.actualBoundingBoxDescent || 0;
    const y = cy + (asc - desc) / 2;
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x + 0.5, y + 0.5); }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function width(text, o = {}) {
    mctx.font = css(o);
    return mctx.measureText(String(text)).width;
  }
  /* Ждём, пока подгрузятся шрифты, чтобы первая отрисовка не была запасным шрифтом */
  function ready() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const fams = ['7px "Russo One"', '700 7px "Oswald"', '400 7px "Oswald"', '600 14px "Nunito"', '800 14px "Nunito"', '14px "PT Serif"', '700 14px "PT Serif"', 'italic 14px "PT Serif"'];
    return Promise.all(fams.map(f => document.fonts.load(f, 'АБВ abc 123').catch(() => null))).then(() => null);
  }
  return { draw, width, ready, FACES };
})();
