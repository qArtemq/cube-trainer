/* =========================================================
   app.js — логика страницы: демо в 3D, библиотеки OLL/PLL,
   тренажёр распознавания, план (чек-листы), таймер.
   ========================================================= */
(function () {
  'use strict';
  var CC = window.CubeCore, D = window.CFOP_DATA, DG = window.CubeDiagrams;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('cft.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('cft.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  var V = new window.Viewer($('#viewer'));

  /* ---------- демо из data-атрибутов ---------- */
  function demoFromData(d) {
    var alg = d.alg || '', rep = +d.repeat || 1;
    var full = rep > 1 ? CC.repeatAlg(alg, rep) : alg;
    var setup = d.setup || '';
    var isCase = d.case !== undefined;
    if (isCase) setup = CC.invertAlg(full);
    return {
      title: d.title || alg, alg: alg, repeat: rep, setup: setup, view: d.view || '',
      note: d.note || (isCase ? 'Куб поставлен в ситуацию, которую решает этот алгоритм. Смотри, что происходит на каждом ходе.' : '')
    };
  }

  /* ---------- блоки .alg ---------- */
  $$('.alg').forEach(function (node) {
    var d = node.dataset, rep = +d.repeat || 1;
    var txt = rep > 1 ? '(' + d.alg + ')×' + rep : d.alg;
    node.innerHTML = (d.title ? '<span class="alg-title">' + esc(d.title) + '</span>' : '') +
      '<code>' + esc(txt) + '</code><button class="btn-3d" type="button">▶ 3D</button>';
    $('button', node).addEventListener('click', function () { V.loadDemo(demoFromData(d)); });
  });

  /* ---------- чипы ходов ---------- */
  var MOVE_NAMES = {
    R: 'правая грань', L: 'левая грань', U: 'верхняя грань', D: 'нижняя грань', F: 'передняя грань', B: 'задняя грань',
    x: 'весь куб, как R', y: 'весь куб, как U', z: 'весь куб, как F',
    r: 'два правых слоя сразу', f: 'два передних слоя сразу', M: 'средний слой (как L)'
  };
  $$('[data-chips]').forEach(function (box) {
    box.dataset.chips.split(/\s+/).forEach(function (tok) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = tok;
      b.addEventListener('click', function () {
        var base = tok[0], dir = /2/.test(tok) ? 'на 180°' : /'/.test(tok) ? 'против часовой стрелки' : 'по часовой стрелке';
        V.loadDemo({ title: 'Ход ' + tok, alg: tok, note: (MOVE_NAMES[base] || '') + ' — ' + dir + '.' });
      });
      box.appendChild(b);
    });
  });

  /* ---------- цели шагов ---------- */
  $$('.btn-goal').forEach(function (b) {
    b.addEventListener('click', function () {
      V.loadGoal({ focus: b.dataset.focus, view: b.dataset.view || '', title: b.dataset.title, note: b.dataset.note });
    });
  });

  /* ---------- «знаю» и счётчики ---------- */
  var learned = store.get('learned', {});
  function saveLearned() { store.set('learned', learned); }
  function countLearned(prefix) {
    return Object.keys(learned).filter(function (k) { return k.indexOf(prefix) === 0 && learned[k]; }).length;
  }

  /* ---------- карточка случая ---------- */
  var svgCache = {};
  function caseSvg(alg, mode) {
    var k = mode + '|' + alg;
    return svgCache[k] || (svgCache[k] = DG.caseSVG(alg, mode, 86));
  }
  function caseNote(mode) {
    return mode === 'oll'
      ? 'Диаграмма — вид сверху: жёлтое смотрит вверх, серое — нет. Куб расставлен в этот случай, алгоритм его решает.'
      : 'Диаграмма — вид сверху, все цвета. Куб расставлен в этот случай, алгоритм переставляет детали верхнего слоя.';
  }
  function caseCard(o) {
    var art = document.createElement('article');
    art.className = 'case';
    art.innerHTML =
      '<div class="case-img" title="Показать на 3D">' + caseSvg(o.alg, o.mode) + '</div>' +
      '<div class="case-body">' +
        '<div class="case-title">' + esc(o.title) + (o.sub ? ' <span>' + esc(o.sub) + '</span>' : '') + '</div>' +
        '<div class="case-alg">' + esc(o.alg) + '</div>' +
        '<div class="case-actions"><button class="btn-3d" type="button">▶ 3D</button>' +
        (o.key ? '<label class="learned"><input type="checkbox"> знаю</label>' : '') + '</div>' +
      '</div>';
    function play() {
      V.loadDemo({
        title: o.title + (o.sub ? ' · ' + o.sub : ''), alg: o.alg,
        setup: CC.invertAlg(o.alg), note: caseNote(o.mode)
      });
    }
    $('button', art).addEventListener('click', play);
    $('.case-img', art).addEventListener('click', play);
    if (o.key) {
      var cb = $('input', art);
      cb.checked = !!learned[o.key];
      art.classList.toggle('learned-yes', cb.checked);
      cb.addEventListener('change', function () {
        learned[o.key] = cb.checked; saveLearned();
        art.classList.toggle('learned-yes', cb.checked);
        updateCounters();
      });
    }
    return art;
  }

  /* ---------- 2-look списки ---------- */
  $$('.case-grid').forEach(function (grid) {
    var items = [];
    if (grid.dataset.list) items = D[grid.dataset.list];
    else if (grid.dataset.pll) {
      items = grid.dataset.pll.split(',').map(function (n) {
        return D.pll.filter(function (p) { return p.name === n; })[0];
      });
    }
    items.forEach(function (it) {
      grid.appendChild(caseCard({ title: it.name, sub: '', alg: it.alg, mode: grid.dataset.mode }));
    });
  });

  /* ---------- F2L ---------- */
  (function () {
    var box = $('#f2lList'), last = null;
    D.f2l.forEach(function (c) {
      if (c.g !== last) {
        var h = document.createElement('div'); h.className = 'f2l-group'; h.textContent = c.g; box.appendChild(h); last = c.g;
      }
      var row = document.createElement('div');
      row.className = 'f2l-item';
      row.innerHTML = '<span class="t">' + esc(c.title) + '</span><code>' + esc(c.alg) + '</code><button class="btn-3d" type="button">▶ 3D</button>';
      $('button', row).addEventListener('click', function () {
        V.loadDemo({
          title: 'F2L · ' + c.title, alg: c.alg, setup: CC.invertAlg(c.alg),
          note: 'Слот справа-спереди внизу (белый–зелёный–оранжевый). Куб поставлен в этот случай, алгоритм вставляет пару, не ломая остальное.'
        });
      });
      box.appendChild(row);
    });
  })();

  /* ---------- Полный PLL ---------- */
  var PLL_ORDER = ['Рёбра', 'Углы', 'Углы + рёбра', 'G-перестановки'];
  function renderPll() {
    var box = $('#pllLib'); box.innerHTML = '';
    PLL_ORDER.forEach(function (g) {
      var list = D.pll.filter(function (p) { return p.g === g; });
      if (!list.length) return;
      var h = document.createElement('h4'); h.className = 'lib-group'; h.textContent = g; box.appendChild(h);
      var grid = document.createElement('div'); grid.className = 'lib-grid';
      list.forEach(function (p) {
        grid.appendChild(caseCard({ title: 'PLL ' + p.name, sub: '', alg: p.alg, mode: 'pll', key: 'pll-' + p.name }));
      });
      box.appendChild(grid);
    });
  }

  /* ---------- Полный OLL ---------- */
  var OLL_ORDER = ['Крест (рёбра на местах)', 'Все углы ориентированы', 'Квадрат', 'Малая молния', 'Большая молния',
    'Рыба', 'Конь', 'Странные (Awkward)', 'P-образные', 'T-образные', 'C-образные', 'W-образные', 'Малая L', 'Линия (I)', 'Точка'];
  // латинские псевдонимы, чтобы работал поиск «sune», «anti», «pi» и т. п.
  var OLL_ALIAS = {
    21: 'h double sune', 22: 'pi', 23: 'u headlights', 24: 't', 25: 'l bowtie', 26: 'antisune anti-sune anti sune',
    27: 'sune', 28: 'stealth', 57: 'bridge h', 20: 'checkers', 1: 'runway', 2: 'zamboni'
  };
  var ollGroupSel = $('#ollGroup'), ollSearch = $('#ollSearch');
  OLL_ORDER.forEach(function (g) {
    var o = document.createElement('option'); o.value = g; o.textContent = g; ollGroupSel.appendChild(o);
  });
  function renderOll() {
    var box = $('#ollLib'); box.innerHTML = '';
    var q = ollSearch.value.trim().toLowerCase(), gsel = ollGroupSel.value;
    OLL_ORDER.forEach(function (g) {
      if (gsel && gsel !== g) return;
      var list = D.oll.filter(function (o) {
        if (o.g !== g) return false;
        if (!q) return true;
        return String(o.n) === q || ('oll ' + o.n).indexOf(q) !== -1 || o.name.toLowerCase().indexOf(q) !== -1 ||
          o.g.toLowerCase().indexOf(q) !== -1 || (OLL_ALIAS[o.n] || '').indexOf(q) !== -1;
      }).sort(function (a, b) { return a.n - b.n; });
      if (!list.length) return;
      var h = document.createElement('h4'); h.className = 'lib-group'; h.textContent = g; box.appendChild(h);
      var grid = document.createElement('div'); grid.className = 'lib-grid';
      list.forEach(function (o) {
        grid.appendChild(caseCard({ title: 'OLL ' + o.n, sub: o.name, alg: o.alg, mode: 'oll', key: 'oll-' + o.n }));
      });
      box.appendChild(grid);
    });
    if (!box.children.length) box.innerHTML = '<p class="muted">Ничего не найдено.</p>';
  }
  ollGroupSel.addEventListener('change', renderOll);
  ollSearch.addEventListener('input', renderOll);

  /* ---------- счётчики + синхронизация чек-листа ---------- */
  var checks = store.get('checks', {});
  function updateCounters() {
    var o = countLearned('oll-'), p = countLearned('pll-');
    $('#cntOll').textContent = o; $('#cntPll').textContent = p;
    syncCheck('p3a', p >= 21); syncCheck('p4a', o >= 57); syncCheck('p3b', o >= 30);
    updatePlan();
  }
  function syncCheck(key, val) {
    var cb = $('[data-save="' + key + '"]');
    if (!cb || cb.checked === val) return;
    cb.checked = val; checks[key] = val; store.set('checks', checks);
  }

  /* ---------- тренировка распознавания ---------- */
  var quiz = { kind: 'oll', item: null };
  var quizBox = $('#quizBox');
  function quizNext(kind) {
    if (kind) quiz.kind = kind;
    var only = $('#quizOnlyNew').checked;
    var list = (quiz.kind === 'oll' ? D.oll : D.pll).filter(function (it) {
      var key = quiz.kind === 'oll' ? 'oll-' + it.n : 'pll-' + it.name;
      return !only || !learned[key];
    });
    if (!list.length) { list = quiz.kind === 'oll' ? D.oll : D.pll; }
    var it = list[Math.floor(Math.random() * list.length)];
    quiz.item = it;
    // показываем тренировку прямо под кнопкой «Случайный …» в нужной подвкладке
    var qBtn = $('[data-quiz="' + quiz.kind + '"]'), qTools = qBtn ? qBtn.closest('.lib-tools') : null;
    if (qTools && qTools.parentNode) qTools.parentNode.insertBefore(quizBox, qTools.nextSibling);
    quizBox.hidden = false;
    $('#quizDiag').innerHTML = DG.caseSVG(it.alg, quiz.kind, 140);
    $('#quizAns').innerHTML = '<span class="muted">Что это за случай?</span>';
  }
  function quizShow() {
    var it = quiz.item; if (!it) return;
    var title = quiz.kind === 'oll' ? 'OLL ' + it.n + ' · ' + it.name : 'PLL ' + it.name;
    $('#quizAns').innerHTML = '<b>' + esc(title) + '</b><br><code>' + esc(it.alg) + '</code>';
    V.loadDemo({ title: title, alg: it.alg, setup: CC.invertAlg(it.alg), note: caseNote(quiz.kind) });
  }
  $$('[data-quiz]').forEach(function (b) {
    b.addEventListener('click', function () { quizNext(b.dataset.quiz); quizBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  });
  $('#quizShow').addEventListener('click', quizShow);
  $('#quizNext').addEventListener('click', function () { quizNext(); });

  /* ---------- чек-листы и прогресс плана ---------- */
  $$('[data-save]').forEach(function (cb) {
    cb.checked = !!checks[cb.dataset.save];
    cb.addEventListener('change', function () {
      checks[cb.dataset.save] = cb.checked; store.set('checks', checks); updatePlan();
    });
  });
  function updatePlan() {
    var all = $$('.stage [data-save]'), done = all.filter(function (c) { return c.checked; }).length;
    var pct = all.length ? Math.round(done * 100 / all.length) : 0;
    $('#planBar').style.width = pct + '%'; $('#planPct').textContent = pct + '%';
  }

  /* ---------- вкладки (сами вкладки — в tabs.js) ----------
     При смене раздела или подраздела закрываем тренировку распознавания;
     если ушли с «Тренажёра» посреди сборки или осмотра — сбрасываем таймер. */
  var prevTab = window.Tabs ? window.Tabs.current() : '';
  document.addEventListener('tabchange', function (e) {
    quizBox.hidden = true;
    var id = e.detail && e.detail.id;
    if (prevTab === 'trainer' && id !== 'trainer') abortTimer();
    prevTab = id;
  });

  /* =====================================================
     ТАЙМЕР
     ===================================================== */
  var timerEl = $('#timerDisplay'), hintEl = $('#timerHint'), scrEl = $('#scrambleText');
  var inspToggle = $('#inspToggle');
  var T = { state: 'idle', start: 0, raf: 0, hold: 0, insp: 0, ignoreRelease: false, pen: 0, scramble: '' };
  var times = store.get('times', []);

  function fmt(ms) {
    if (ms === Infinity) return 'DNF';
    var s = ms / 1000;
    if (s < 60) return s.toFixed(2);
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
  }
  function eff(t) { return t.pen === 'DNF' ? Infinity : t.ms + (t.pen === 2 ? 2000 : 0); }
  function setCls(c) { timerEl.className = 'timer' + (c ? ' ' + c : ''); }

  function newScramble() { T.scramble = CC.randomScramble(20); scrEl.textContent = T.scramble; }

  function average(arr, n) {
    if (arr.length < n) return '—';
    var last = arr.slice(-n).map(eff);
    var dnfs = last.filter(function (v) { return v === Infinity; }).length;
    if (dnfs > 1) return 'DNF';
    var sorted = last.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.slice(1, -1);
    var sum = mid.reduce(function (a, b) { return a + b; }, 0);
    return mid.some(function (v) { return v === Infinity; }) ? 'DNF' : fmt(sum / mid.length);
  }
  function renderStats() {
    var ok = times.map(eff).filter(function (v) { return v !== Infinity; });
    $('#stBest').textContent = ok.length ? fmt(Math.min.apply(null, ok)) : '—';
    $('#stMean').textContent = ok.length ? fmt(ok.reduce(function (a, b) { return a + b; }, 0) / ok.length) : '—';
    $('#stAo5').textContent = average(times, 5);
    $('#stAo12').textContent = average(times, 12);
    $('#stCount').textContent = times.length;
    var ol = $('#timesList'); ol.innerHTML = '';
    var start = Math.max(0, times.length - 36);
    for (var i = times.length - 1; i >= start; i--) {
      var t = times[i], li = document.createElement('li');
      li.value = i + 1;
      if (t.pen === 'DNF') { li.className = 'dnf'; li.textContent = 'DNF (' + fmt(t.ms) + ')'; }
      else if (t.pen === 2) { li.className = 'p2'; li.textContent = fmt(t.ms + 2000) + ' (+2)'; }
      else li.textContent = fmt(t.ms);
      ol.appendChild(li);
    }
    var l = times[times.length - 1];
    if (T.state === 'idle') timerEl.textContent = l ? (l.pen === 'DNF' ? 'DNF' : fmt(eff(l))) : '0.00';
  }
  function saveTimes() { store.set('times', times); renderStats(); }

  // сброс таймера без записи результата (например, при уходе с вкладки)
  function abortTimer() {
    if (T.state === 'idle') return;
    clearTimeout(T.hold); cancelAnimationFrame(T.raf); cancelAnimationFrame(T.insp);
    T.state = 'idle'; T.ignoreRelease = false;
    setCls(''); renderStats();
  }

  function loopRun() {
    if (T.state !== 'running') return;
    timerEl.textContent = fmt(performance.now() - T.start);
    T.raf = requestAnimationFrame(loopRun);
  }
  function startSolve(pen) {
    cancelAnimationFrame(T.insp);
    T.pen = pen; T.state = 'running'; T.start = performance.now();
    setCls('running'); hintEl.textContent = 'Идёт сборка… любое нажатие — стоп.';
    loopRun();
  }
  function stopSolve() {
    var ms = performance.now() - T.start;
    cancelAnimationFrame(T.raf);
    T.state = 'idle'; setCls('');
    times.push({ ms: Math.round(ms), pen: T.pen, sc: T.scramble, at: Date.now() });
    saveTimes(); newScramble();
    hintEl.textContent = 'Готово! Удерживай пробел для следующей сборки.';
  }
  function inspElapsed() { return (performance.now() - T.inspStart) / 1000; }
  function loopInsp() {
    if (T.state !== 'inspect' && T.state !== 'holdingInsp' && T.state !== 'readyInsp') return;
    var e = inspElapsed();
    if (e >= 17) {
      times.push({ ms: 0, pen: 'DNF', sc: T.scramble, at: Date.now() });
      T.state = 'idle'; setCls(''); saveTimes(); newScramble();
      timerEl.textContent = 'DNF'; hintEl.textContent = 'Не успел начать за 17 с — DNF (как на турнире).';
      return;
    }
    if (T.state === 'inspect') timerEl.textContent = e < 15 ? String(Math.ceil(15 - e)) : '+2';
    if (e >= 12 && e < 12.1) hintEl.textContent = '12 секунд!';
    else if (e >= 8 && e < 8.1) hintEl.textContent = '8 секунд!';
    T.insp = requestAnimationFrame(loopInsp);
  }
  function startInspection() {
    T.state = 'inspect'; T.inspStart = performance.now();
    setCls('inspect'); hintEl.textContent = 'Осмотр 15 с. Удерживай пробел и отпусти, чтобы начать сборку.';
    loopInsp();
  }
  function pressTimer() {
    if (T.state === 'running') { stopSolve(); T.ignoreRelease = true; return; }
    if (T.state === 'idle') {
      T.state = 'holding'; setCls('holding');
      T.hold = setTimeout(function () { if (T.state === 'holding') { T.state = 'ready'; setCls('ready'); } }, 320);
    } else if (T.state === 'inspect') {
      T.state = 'holdingInsp'; setCls('holding');
      T.hold = setTimeout(function () { if (T.state === 'holdingInsp') { T.state = 'readyInsp'; setCls('ready'); } }, 320);
    }
  }
  function releaseTimer() {
    if (T.ignoreRelease) { T.ignoreRelease = false; return; }
    clearTimeout(T.hold);
    var s = T.state;
    if (s === 'holding' || s === 'ready') {
      if (inspToggle.checked) startInspection();
      else if (s === 'ready') startSolve(0);
      else { T.state = 'idle'; setCls(''); }
    } else if (s === 'holdingInsp') {
      T.state = 'inspect'; setCls('inspect');
    } else if (s === 'readyInsp') {
      var e = inspElapsed();
      startSolve(e < 15 ? 0 : 2);
    }
  }

  timerEl.addEventListener('pointerdown', function (e) { e.preventDefault(); timerEl.focus(); pressTimer(); });
  timerEl.addEventListener('pointerup', function (e) { e.preventDefault(); releaseTimer(); });
  timerEl.addEventListener('pointercancel', function () { clearTimeout(T.hold); if (T.state === 'holding' || T.state === 'ready') { T.state = 'idle'; setCls(''); } });
  document.addEventListener('keydown', function (e) {
    var active = document.activeElement === timerEl || T.state !== 'idle';
    if (T.state === 'running' && !e.repeat) {
      if (e.code === 'Space') { e.preventDefault(); T.ignoreRelease = true; }
      stopSolve(); return;
    }
    if (e.key === 'Escape' && (T.state === 'inspect')) {
      cancelAnimationFrame(T.insp); T.state = 'idle'; setCls(''); renderStats(); return;
    }
    if (e.code === 'Space' && active) { e.preventDefault(); if (!e.repeat) pressTimer(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' && (document.activeElement === timerEl || T.state !== 'idle')) { e.preventDefault(); releaseTimer(); }
  });

  $('#newScramble').addEventListener('click', newScramble);
  $('#showScramble').addEventListener('click', function () { V.scramble(T.scramble); });
  $('#penPlus2').addEventListener('click', function () {
    var l = times[times.length - 1]; if (!l) return;
    l.pen = l.pen === 2 ? 0 : 2; saveTimes();
  });
  $('#penDnf').addEventListener('click', function () {
    var l = times[times.length - 1]; if (!l) return;
    l.pen = l.pen === 'DNF' ? 0 : 'DNF'; saveTimes();
  });
  $('#delLast').addEventListener('click', function () { times.pop(); saveTimes(); });
  $('#clearAll').addEventListener('click', function () {
    if (times.length && window.confirm('Удалить все сохранённые сборки?')) { times = []; saveTimes(); }
  });

  /* ---------- старт ---------- */
  renderPll(); renderOll(); updateCounters(); updatePlan();
  newScramble(); renderStats();
})();
