'use strict';
/* Установка игры как приложения (PWA): Windows, macOS, Android, iPhone/iPad */
(() => {
  const $ = id => document.getElementById(id);
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mac = /Macintosh/.test(ua) && !iOS;
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|FxiOS|Firefox|OPR/.test(ua);
  const firefox = /Firefox|FxiOS/.test(ua);
  const android = /Android/.test(ua);
  const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  let prompt = null;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => null));
  }
  const btn = $('btn-install'), help = $('install-help');
  if (!btn || installed()) return;

  function show(html) {
    help.innerHTML = html;
    help.classList.remove('hidden');
    ['how', 'archive'].forEach(id => $(id) && $(id).classList.add('hidden'));
  }
  function instructions() {
    if (iOS && !safari) return show('<b>На iPhone и iPad</b> игру можно установить только из <b>Safari</b>. Откройте этот сайт в Safari и нажмите кнопку установки ещё раз.');
    if (iOS) return show('<b>iPhone / iPad:</b> нажмите <b>«Поделиться»</b> <span class="ic">⬆︎</span> внизу экрана → <b>«На экран „Домой“»</b> → <b>«Добавить»</b>. Значок с уткой появится на главном экране.');
    if (mac && safari) return show('<b>Mac, Safari:</b> нажмите кнопку <b>«Поделиться»</b> <span class="ic">⬆︎</span> справа вверху окна Safari → <b>«Добавить в Dock»</b>. Или в строке меню в самом верху экрана: <b>«Файл» → «Добавить в Dock»</b> (если Safari развёрнут на весь экран, подведите мышь к верхнему краю — меню появится). Нужен macOS Sonoma или новее; на более старых системах откройте игру в <b>Chrome</b> и нажмите «Установить игру».');
    if (firefox) return show('Firefox не умеет устанавливать сайты как приложения. Откройте игру в <b>Chrome</b>, <b>Edge</b> или <b>Яндекс Браузере</b> (на iPhone — в Safari) и нажмите «Установить игру».');
    if (android) return show('<b>Android:</b> меню браузера <b>⋮</b> → <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.');
    return show('<b>Windows / Mac, Chrome или Edge:</b> нажмите значок установки <span class="ic">⊕</span> справа в адресной строке или меню <b>⋮ → «Установить My Little Office»</b>.');
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; btn.classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => {
    btn.classList.add('hidden');
    show('Готово! Игра установлена — ищите значок с уткой на рабочем столе, в меню «Пуск», Launchpad или на главном экране.');
  });
  /* браузеры без автоматического запроса — показываем кнопку с инструкцией */
  if (iOS || safari || firefox) btn.classList.remove('hidden');
  else setTimeout(() => btn.classList.remove('hidden'), 2500);

  btn.addEventListener('click', async () => {
    if (prompt) {
      prompt.prompt();
      const r = await prompt.userChoice.catch(() => null);
      prompt = null;
      if (r && r.outcome === 'accepted') btn.classList.add('hidden');
      return;
    }
    instructions();
  });
})();
