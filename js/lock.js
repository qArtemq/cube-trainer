/* Режим «как приложение»: нельзя увеличивать страницу щипком / двойным касанием
   и нельзя выделять текст. Основная защита — в CSS (touch-action, user-select) и в meta viewport;
   здесь — то, что iOS Safari и часть браузеров игнорируют в CSS. Поля ввода (поиск OLL) не трогаем. */
(function () {
  'use strict';

  var doc = document;
  var opts = { passive: false };

  function inField(target) {
    var el = target && target.nodeType === 3 ? target.parentNode : target;
    return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));
  }

  // --- без зума ---
  // iOS Safari: щипок генерирует gesture-события, их можно отменить
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
    doc.addEventListener(name, function (e) { e.preventDefault(); }, opts);
  });

  // Остальные браузеры: движение двумя и более пальцами — это щипок, отменяем его
  doc.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, opts);

  // Ctrl + колесо мыши / щипок по тачпаду (в браузерах он приходит как wheel с ctrlKey)
  doc.addEventListener('wheel', function (e) {
    if (e.ctrlKey) e.preventDefault();
  }, opts);

  // --- без выделения ---
  doc.addEventListener('selectstart', function (e) {
    if (!inField(e.target)) e.preventDefault();
  });

  doc.addEventListener('dragstart', function (e) {
    if (!inField(e.target)) e.preventDefault();
  });

  // Долгое касание: меню «Копировать / Сохранить картинку». Только для сенсорных экранов —
  // с мышью правая кнопка остаётся обычной.
  doc.addEventListener('contextmenu', function (e) {
    if (inField(e.target)) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
  });

  // Если выделение всё же появилось (например, двойной тап в старом браузере) — сразу снимаем
  doc.addEventListener('selectionchange', function () {
    if (inField(doc.activeElement)) return; // пользователь работает с полем ввода — не мешаем
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!inField(sel.anchorNode)) sel.removeAllRanges();
  });
})();
