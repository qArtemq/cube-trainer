/* PWA: регистрация service worker, кнопка «Установить», подсказка для iPhone/iPad. */
(function () {
  'use strict';

  var btn = document.getElementById('installBtn');
  var deferred = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function isIos() {
    var ua = window.navigator.userAgent || '';
    var iPadOs = ua.indexOf('Macintosh') !== -1 && window.navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || iPadOs;
  }

  function toast(text) {
    var old = document.getElementById('pwaToast');
    if (old) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'pwaToast';
    el.className = 'pwa-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 9000);
  }

  function show() { if (btn && !isStandalone()) btn.hidden = false; }
  function hide() { if (btn) btn.hidden = true; }

  // service worker нужен для работы без сети и для установки; работает только по HTTPS или на localhost
  if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* не критично: сайт работает и без него */ });
    });
  }

  // Chrome / Edge / Android: браузер сам сообщает, что сайт можно установить
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    show();
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    hide();
  });

  // Safari на iPhone/iPad не умеет показывать окно установки — только «Поделиться → На экран “Домой”»
  if (isIos() && !isStandalone()) show();

  if (btn) {
    btn.addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; hide(); });
      } else if (isIos()) {
        toast('Нажми «Поделиться» (квадрат со стрелкой) → «На экран “Домой”». Откроется как приложение, без адресной строки.');
      } else {
        toast('Установи через меню браузера: «Установить приложение» или «Добавить на главный экран».');
      }
    });
  }
})();
