/* =========================================================
   viewer.js — панель с 3D-кубом: демо алгоритмов, цели шагов,
   свободный режим (кнопки + клавиатура).
   ========================================================= */
(function () {
  'use strict';
  var CC = window.CubeCore;
  var SPEEDS = [900, 650, 430, 260, 140];

  function Viewer(root) {
    var self = this;
    this.root = root;
    var q = function (s) { return root.querySelector(s); };
    this.stage = q('.v-stage');
    this.titleEl = q('.v-title');
    this.noteEl = q('.v-note');
    this.movesEl = q('.v-moves');
    this.statusEl = q('.v-status');
    this.freeEl = q('.v-free');
    this.moreEl = q('.v-more');
    // когда ряд кнопок ходов раскрыт, на телефоне панель выезжает выше (см. .pad-open в CSS), чтобы всё помещалось без прокрутки
    if (this.moreEl) {
      var syncPad = function () { root.classList.toggle('pad-open', self.moreEl.open); };
      this.moreEl.addEventListener('toggle', syncPad);
      syncPad();
    }
    this.btn = {
      reset: q('[data-v="reset"]'), back: q('[data-v="back"]'),
      play: q('[data-v="play"]'), fwd: q('[data-v="fwd"]'),
      flip: q('[data-v="flip"]')
    };
    this.speedEl = q('.v-speed');
    this.cube = new window.Cube3D(this.stage);

    this.moves = []; this.idx = 0; this.playing = false;
    this.jobs = []; this.running = false;
    this.mode = 'demo'; this.cfg = null;
    this.history = []; this.scrambled = false;
    this.speed = 3;
    try { this.speed = Math.min(5, Math.max(1, +localStorage.getItem('cft.speed') || 3)); } catch (e) { /* ignore */ }
    this.speedEl.value = this.speed;

    this._bindControls();
    this._buildFree();
    this.loadFree({ note: 'Тяни куб, чтобы повернуть. Кнопки ходов и перемешивание — в «Свободном режиме». На клавиатуре: R L U D F B (Shift — против часовой), сначала кликни по кубу.', silent: true });
  }

  Viewer.prototype.dur = function (mv) {
    var b = SPEEDS[this.speed - 1];
    return Math.abs(mv.quarters) > 1 ? b * 1.5 : b;
  };

  /* ---- очередь задач ---- */
  Viewer.prototype.enqueue = function (fn) {
    var self = this;
    return new Promise(function (res) {
      self.jobs.push({ fn: fn, res: res });
      self._run();
    });
  };
  Viewer.prototype._run = function () {
    if (this.running) return;
    this.running = true;
    var self = this;
    (function next() {
      var j = self.jobs.shift();
      if (!j) { self.running = false; return; }
      Promise.resolve().then(j.fn).then(function () { j.res(); next(); },
        function (e) { console.error(e); j.res(); next(); });
    })();
  };
  Viewer.prototype.stop = function () {
    this.playing = false;
    this.cube.gen++;
    var js = this.jobs; this.jobs = [];
    js.forEach(function (j) { j.res(); });
    this._updateButtons();
  };

  /* ---- шаги ---- */
  Viewer.prototype._forward = function () {
    var self = this;
    if (this.idx >= this.moves.length) return Promise.resolve();
    var i = this.idx, mv = this.moves[i];
    return this.cube.animate(mv, this.dur(mv)).then(function (ok) {
      if (ok) { self.idx = i + 1; self._mark(); }
    });
  };
  Viewer.prototype._back = function () {
    var self = this;
    if (this.idx <= 0) return Promise.resolve();
    var i = this.idx - 1;
    var inv = CC.parseMove(CC.invertAlg(this.moves[i].name));
    return this.cube.animate(inv, this.dur(inv)).then(function (ok) {
      if (ok) { self.idx = i; self._mark(); }
    });
  };
  Viewer.prototype.play = function () {
    var self = this;
    if (this.mode !== 'demo' || !this.moves.length) return;
    if (this.playing) return;
    if (this.idx >= this.moves.length) { this.restart(true); return; }
    this.playing = true; this._updateButtons();
    var g = this.cube.gen;
    (function loop() {
      if (!self.playing || self.cube.gen !== g) return;
      if (self.idx >= self.moves.length) {
        self.playing = false; self._updateButtons(); self._mark(); return;
      }
      self.enqueue(function () { return self._forward(); }).then(function () {
        setTimeout(loop, 70);
      });
    })();
  };
  Viewer.prototype.pause = function () { this.playing = false; this._updateButtons(); };
  Viewer.prototype.restart = function (auto) {
    if (this.cfg) this.loadDemo(Object.assign({}, this.cfg, { auto: !!auto }));
  };

  /* ---- загрузка режимов ---- */
  Viewer.prototype.loadDemo = function (o) {
    this.stop();
    this.mode = 'demo'; this.cfg = o;
    this.root.classList.remove('is-free');
    var st = CC.createBase();
    if (o.setup) st.apply(o.setup);
    this.cube.focus = null;
    this.cube.setState(st);
    this.cube.setView(o.view || 'default');
    var alg = (o.repeat && o.repeat > 1) ? CC.repeatAlg(o.alg, o.repeat) : o.alg;
    this.moves = CC.tokenize(alg).map(CC.parseMove);
    this.idx = 0;
    this.titleEl.textContent = o.title || 'Демонстрация';
    this.noteEl.textContent = o.note || '';
    this._renderChips();
    this._mark();
    this._updateButtons();
    if (!o.silent) this.open();
    if (o.auto !== false && this.moves.length) {
      var self = this, g = this.cube.gen;
      setTimeout(function () { if (self.cube.gen === g) self.play(); }, 650);
    }
  };

  Viewer.prototype.loadGoal = function (o) {
    this.stop();
    this.mode = 'goal'; this.cfg = null;
    this.root.classList.remove('is-free');
    this.cube.focus = CC.FOCUS[o.focus] || null;
    this.cube.setState(CC.createBase());
    this.cube.setView(o.view || 'default');
    this.moves = []; this.idx = 0;
    this.titleEl.textContent = o.title || 'Цель шага';
    this.noteEl.textContent = o.note || '';
    this._renderChips();
    this._updateButtons();
    this.open();
  };

  Viewer.prototype.loadFree = function (o) {
    o = o || {};
    this.stop();
    this.mode = 'free'; this.cfg = null;
    this.root.classList.add('is-free');
    var st = CC.createBase();
    if (o.setup) st.apply(o.setup);
    this.cube.focus = null;
    this.cube.setState(st);
    this.cube.setView(o.view || 'default');
    this.moves = []; this.idx = 0; this.history = [];
    this.scrambled = !!o.setup;
    this.titleEl.textContent = o.title || 'Свободный режим';
    this.noteEl.textContent = o.note || '';
    this._renderChips();
    this._updateButtons();
    if (!o.silent) {
      this.open();
      // в свободном режиме кнопки ходов — главное: раскрываем их сами, чтобы не искать
      if (this.moreEl) this.moreEl.open = true;
    }
  };

  Viewer.prototype.scramble = function (text) {
    var sc = text || CC.randomScramble(20);
    this.loadFree({ setup: sc, title: 'Скрамбл на кубе', note: 'Скрамбл: ' + sc + '. Собери куб сам кнопками или клавишами (кликни по кубу).' });
  };

  /* ---- свободные ходы ---- */
  Viewer.prototype.userMove = function (tok) {
    var self = this;
    if (this.mode !== 'free') this.loadFree({});
    var mv = CC.parseMove(tok);
    this.enqueue(function () {
      return self.cube.animate(mv, Math.min(self.dur(mv), 260)).then(function (ok) {
        if (!ok) return;
        self.history.push(tok);
        self.statusEl.textContent = '';
        if (self.scrambled && self.cube.state.isSolved()) {
          self.scrambled = false;
          self.statusEl.textContent = '🎉 Куб собран!';
        }
      });
    });
  };
  Viewer.prototype.undo = function () {
    var self = this;
    if (this.mode !== 'free' || !this.history.length) return;
    var tok = this.history.pop();
    var inv = CC.parseMove(CC.invertAlg(tok));
    this.enqueue(function () { return self.cube.animate(inv, 200); });
  };

  /* ---- UI ---- */
  Viewer.prototype.open = function () { this.root.classList.add('open'); document.body.classList.add('viewer-open'); };
  Viewer.prototype.close = function () { this.root.classList.remove('open'); document.body.classList.remove('viewer-open'); };

  Viewer.prototype._renderChips = function () {
    var box = this.movesEl;
    box.innerHTML = '';
    this.moves.forEach(function (m, i) {
      var s = document.createElement('span');
      s.className = 'v-chip'; s.textContent = m.name; s.dataset.i = i;
      box.appendChild(s);
    });
    this.statusEl.textContent = '';
  };
  Viewer.prototype._mark = function () {
    var chips = this.movesEl.children, self = this;
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('done', i < self.idx);
      chips[i].classList.toggle('cur', i === self.idx && self.idx < self.moves.length);
    }
    // длинный алгоритм не помещается в 2 строки: двигаем только саму полосу ходов, чтобы текущий ход был виден
    var cur = this.movesEl.querySelector('.cur');
    if (cur) {
      var box = this.movesEl, top = cur.offsetTop - box.offsetTop;
      if (top < box.scrollTop) box.scrollTop = top;
      else if (top + cur.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + cur.offsetHeight - box.clientHeight;
    }
    if (this.mode === 'demo' && this.moves.length && this.idx >= this.moves.length)
      this.statusEl.textContent = '✓ Готово. ⏮ — повторить';
    else if (this.mode === 'demo') this.statusEl.textContent = '';
    this._updateButtons();
  };
  Viewer.prototype._updateButtons = function () {
    // режим нужен стилям: в «цели шага» и «свободном режиме» кнопки демо-проигрывателя скрыты
    this.root.dataset.mode = this.mode;
    var demo = this.mode === 'demo' && this.moves.length > 0;
    this.btn.reset.disabled = !demo;
    this.btn.back.disabled = !demo || this.idx <= 0;
    this.btn.fwd.disabled = !demo || this.idx >= this.moves.length;
    this.btn.play.disabled = !demo;
    this.btn.play.textContent = this.playing ? '⏸' : '▶';
    this.btn.play.title = this.playing ? 'Пауза' : 'Играть';
  };

  Viewer.prototype._bindControls = function () {
    var self = this;
    this.btn.reset.addEventListener('click', function () { self.restart(false); });
    this.btn.play.addEventListener('click', function () {
      if (self.playing) self.pause(); else self.play();
    });
    this.btn.back.addEventListener('click', function () {
      self.pause(); self.enqueue(function () { return self._back(); });
    });
    this.btn.fwd.addEventListener('click', function () {
      self.pause(); self.enqueue(function () { return self._forward(); });
    });
    this.btn.flip.addEventListener('click', function () {
      self.cube.setView(self.cube.rx > 0 ? 'default' : 'bottom');
    });
    this.speedEl.addEventListener('input', function () {
      self.speed = +self.speedEl.value;
      try { localStorage.setItem('cft.speed', String(self.speed)); } catch (e) { /* ignore */ }
    });
    this.root.querySelector('.v-close').addEventListener('click', function () { self.close(); });
    var fab = document.getElementById('viewerFab');
    if (fab) fab.addEventListener('click', function () {
      if (self.root.classList.contains('open')) self.close(); else self.open();
    });

    this.stage.addEventListener('keydown', function (e) {
      var k = e.key;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var up = k.length === 1 ? k.toUpperCase() : '';
      var tok = null;
      if ('RLUDFB'.indexOf(up) !== -1 && up) tok = up + (e.shiftKey ? "'" : '');
      else if ('xyz'.indexOf(k.toLowerCase()) !== -1 && k.length === 1) tok = k.toLowerCase() + (e.shiftKey ? "'" : '');
      if (tok) { e.preventDefault(); self.userMove(tok); }
    });
  };

  Viewer.prototype._buildFree = function () {
    var self = this, box = this.freeEl;
    box.innerHTML = '';
    var grid = document.createElement('div'); grid.className = 'v-pad';
    ['R', 'L', 'U', 'D', 'F', 'B'].forEach(function (f) {
      ['', "'", '2'].forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = f + s; b.dataset.mv = f + s;
        b.addEventListener('click', function () { self.userMove(f + s); });
        grid.appendChild(b);
      });
    });
    box.appendChild(grid);
    var row = document.createElement('div'); row.className = 'v-pad-row';
    function add(label, fn, cls) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label; if (cls) b.className = cls;
      b.addEventListener('click', fn); row.appendChild(b);
    }
    ['x', 'y', 'z'].forEach(function (t) { add(t, function () { self.userMove(t); }); });
    add('↶ Отмена', function () { self.undo(); });
    add('🔀 Перемешать', function () { self.scramble(); }, 'accent');
    add('Сброс', function () { self.loadFree({ note: 'Куб собран. Жёлтый сверху, зелёный спереди.' }); });
    box.appendChild(row);
  };

  window.Viewer = Viewer;
})();
