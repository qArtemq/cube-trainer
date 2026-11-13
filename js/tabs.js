/* =========================================================
   tabs.js — вкладки.
   Одновременно виден только один раздел, остальные скрыты;
   при переключении страница возвращается наверх и показывает
   новый текст на месте старого — без прокрутки вниз.

   • Главные вкладки — ссылки в шапке (#nav).
   • Внутри длинных разделов — подвкладки (.subtabs + .subpanel).
   • Адрес вида  #ll/pll  открывает раздел и подвкладку,
     кнопка «Назад» в браузере работает как обычно.
   • Последняя открытая вкладка запоминается.
   • Если скрипт упадёт — класс js-tabs снимается и показывается весь текст.
   ========================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  try { init(); } catch (err) {
    root.classList.remove('js-tabs');
    if (window.console) console.error(err);
  }

  function readStore(k, d) {
    try { var v = localStorage.getItem('cft.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function writeStore(k, v) {
    try { localStorage.setItem('cft.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
  function scrollTop() {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  }

  function init() {
    var nav = document.getElementById('nav');
    if (!nav) throw new Error('нет #nav');
    var baseTitle = document.title;
    var order = [], secs = {}, linkOf = {}, label = {};

    [].slice.call(nav.querySelectorAll('a[href^="#"]')).forEach(function (a) {
      var id = a.getAttribute('href').slice(1), s = document.getElementById(id);
      if (!s) return;
      order.push(id); secs[id] = s; linkOf[id] = a; label[id] = a.textContent.trim();
      a.setAttribute('role', 'tab');
      s.setAttribute('role', 'tabpanel');
    });
    if (!order.length) throw new Error('нет вкладок');
    nav.setAttribute('role', 'tablist');

    var current = '';
    var subOf = readStore('sub', {});
    if (!subOf || typeof subOf !== 'object') subOf = {};

    /* ---- подвкладки ---- */
    function setSub(id, sub) {
      var s = secs[id], bar = s.querySelector('.subtabs');
      if (!bar) return;
      var btns = [].slice.call(bar.querySelectorAll('[data-sub]'));
      var names = btns.map(function (b) { return b.dataset.sub; });
      if (names.indexOf(sub) < 0) sub = names.indexOf(subOf[id]) >= 0 ? subOf[id] : names[0];
      subOf[id] = sub; writeStore('sub', subOf);
      btns.forEach(function (b) {
        var on = b.dataset.sub === sub;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      [].forEach.call(s.querySelectorAll('.subpanel'), function (p) {
        p.classList.toggle('active', p.dataset.sub === sub);
      });
      centerIn(bar, btns.filter(function (b) { return b.dataset.sub === sub; })[0], false);
    }

    /* ---- показать раздел ---- */
    // прокручивает полосу (меню или подвкладки) так, чтобы активная кнопка оказалась по центру;
    // считаем по getBoundingClientRect, потому что offsetLeft у кнопок отсчитывается не от самой полосы
    function centerIn(bar, btn, smooth) {
      if (!bar || !btn || bar.scrollWidth <= bar.clientWidth) return;
      var left = bar.scrollLeft + (btn.getBoundingClientRect().left - bar.getBoundingClientRect().left) -
        (bar.clientWidth - btn.offsetWidth) / 2;
      if (bar.scrollTo) bar.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' }); else bar.scrollLeft = left;
    }
    function keepNavVisible(id) { centerIn(nav, linkOf[id], true); }
    function show(id, sub) {
      var changed = id !== current;
      current = id;
      order.forEach(function (k) {
        var on = k === id;
        secs[k].classList.toggle('active', on);
        linkOf[k].classList.toggle('active', on);
        linkOf[k].setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) linkOf[k].setAttribute('aria-current', 'page'); else linkOf[k].removeAttribute('aria-current');
      });
      setSub(id, sub);
      writeStore('tab', id);
      document.title = id === order[0] ? baseTitle : label[id] + ' · CFOP Путь';
      scrollTop();
      keepNavVisible(id);
      document.dispatchEvent(new CustomEvent('tabchange', { detail: { id: id, sub: subOf[id] || '', changed: changed } }));
    }

    /* ---- адрес ---- */
    function route(first) {
      var raw = (location.hash || '').replace(/^#/, ''), parts = raw.split('/');
      var id = parts[0], sub = parts[1] || '', anchor = null;
      try { id = decodeURIComponent(id); sub = decodeURIComponent(sub); } catch (e) { /* ignore */ }

      // ссылка на элемент внутри раздела (например #quizBox) — открываем его раздел
      if (id && !secs[id]) {
        anchor = document.getElementById(id);
        var host = anchor && anchor.closest ? anchor.closest('.sec') : null;
        if (host && secs[host.id]) { id = host.id; sub = ''; } else { anchor = null; id = ''; }
      }
      if (!id) {
        var saved = readStore('tab', '');
        id = (first && secs[saved]) ? saved : order[0];
        sub = '';
      }
      show(id, sub);
      if (anchor) {
        var panel = anchor.closest('.subpanel');
        if (panel) setSub(id, panel.dataset.sub);
        anchor.scrollIntoView();
      }
    }
    function go(h) {
      if (location.hash === '#' + h) route(false); else location.hash = h;
    }

    /* ---- кнопки «Назад / Далее» внизу каждого раздела ---- */
    order.forEach(function (id, i) {
      var bar = document.createElement('nav');
      bar.className = 'pager';
      bar.setAttribute('aria-label', 'Переход между разделами');
      function link(to, text, cls) {
        var a = document.createElement('a');
        a.className = 'btn ' + cls; a.href = '#' + to; a.textContent = text;
        bar.appendChild(a);
      }
      if (i > 0) link(order[i - 1], '← ' + label[order[i - 1]], 'pager-prev');
      if (i < order.length - 1) link(order[i + 1], 'Далее: ' + label[order[i + 1]] + ' →', 'pager-next');
      secs[id].appendChild(bar);
    });

    /* ---- подвкладки: клики ---- */
    order.forEach(function (id) {
      [].forEach.call(secs[id].querySelectorAll('.subtabs [data-sub]'), function (b) {
        b.setAttribute('role', 'tab');
        b.addEventListener('click', function () { go(id + '/' + b.dataset.sub); });
      });
    });

    /* ---- ссылки на вкладки: и в шапке, и в тексте ---- */
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || a.target === '_blank' || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
      var h = a.getAttribute('href').slice(1);
      if (h && secs[h.split('/')[0]]) { e.preventDefault(); go(h); }
    });

    /* стрелки ← → на шапке переключают вкладки */
    nav.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var j = order.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
      if (j < 0 || j >= order.length) return;
      e.preventDefault();
      linkOf[order[j]].focus();
      go(order[j]);
    });

    window.addEventListener('hashchange', function () { route(false); });
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }

    route(true);
    // фиксируем выбранную вкладку в адресе, чтобы «Назад» возвращал именно на неё
    if (!location.hash) {
      try { history.replaceState(null, '', '#' + current); } catch (e) { /* ignore */ }
    }

    window.Tabs = { go: go, current: function () { return current; }, order: order };
  }
})();
