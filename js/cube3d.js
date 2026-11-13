/* =========================================================
   cube3d.js — 3D-кубик на чистом CSS 3D (без библиотек).
   Рисует состояние из CubeCore и анимирует повороты слоёв.
   ========================================================= */
(function () {
  'use strict';
  var CC = window.CubeCore;
  var DIM = '#2a3042', BLACK = '#0d1017';

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function Cube3D(stage) {
    this.stage = stage;
    this.state = CC.createBase();
    this.rx = -28; this.ry = -38;
    this.gen = 0; this.size = 60;
    this.focus = null;
    this.els = {}; this.faceEls = {};
    this._build();
    this._bindDrag();
    this.resize();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(stage);
    else window.addEventListener('resize', function () { self.resize(); });
  }

  Cube3D.prototype._build = function () {
    var stage = this.stage;
    stage.innerHTML = '';
    this.scene = el('div', 'c3-scene');
    this.rig = el('div', 'c3-rig');
    this.cube = el('div', 'c3-cube');
    this.rig.appendChild(this.cube);
    this.scene.appendChild(this.rig);
    stage.appendChild(this.scene);

    var self = this;
    this.state.pieces.forEach(function (pc) {
      var cubie = el('div', 'c3-cubie');
      var faces = {};
      CC.FACE_KEYS.forEach(function (k) {
        var f = el('div', 'c3-face c3-f-' + k);
        f.style.background = pc.stickers[k] ? CC.COLOR_HEX[pc.stickers[k]] : BLACK;
        cubie.appendChild(f);
        faces[k] = f;
      });
      self.cube.appendChild(cubie);
      self.els[pc.id] = cubie;
      self.faceEls[pc.id] = faces;
    });
    this.updateRig();
  };

  Cube3D.prototype.updateRig = function () {
    this.rig.style.transform = 'rotateX(' + this.rx + 'deg) rotateY(' + this.ry + 'deg)';
  };

  Cube3D.prototype.setView = function (name) {
    if (name === 'bottom') { this.rx = 28; this.ry = -38; }
    else if (name === 'top') { this.rx = -62; this.ry = -38; }
    else if (name === 'back') { this.rx = -28; this.ry = 142; }
    else { this.rx = -28; this.ry = -38; }
    this.updateRig();
  };

  Cube3D.prototype.resize = function () {
    var w = this.stage.clientWidth || 320, h = this.stage.clientHeight || 320;
    this.size = Math.max(34, Math.min(w, h) / 5.1);
    this.cube.style.setProperty('--s', this.size + 'px');
    this.scene.style.perspective = Math.round(this.size * 15) + 'px';
    this.renderAll();
  };

  Cube3D.prototype._base = function (pc) {
    var s = this.size, m = pc.m, p = pc.p;
    return 'matrix3d(' + [
      m[0][0], m[1][0], m[2][0], 0,
      m[0][1], m[1][1], m[2][1], 0,
      m[0][2], m[1][2], m[2][2], 0,
      p[0] * s, p[1] * s, p[2] * s, 1
    ].join(',') + ')';
  };

  Cube3D.prototype.renderAll = function () {
    for (var i = 0; i < this.state.pieces.length; i++) {
      var pc = this.state.pieces[i];
      this.els[pc.id].style.transform = this._base(pc);
    }
  };

  Cube3D.prototype.setState = function (state) {
    this.state = state;
    this.applyFocus();
    this.renderAll();
  };

  // Подсветка: детали вне набора затемняются
  Cube3D.prototype.applyFocus = function () {
    var f = this.focus;
    for (var i = 0; i < this.state.pieces.length; i++) {
      var pc = this.state.pieces[i], faces = this.faceEls[pc.id];
      for (var k in pc.stickers) {
        var on = !f || f(pc, k);
        faces[k].style.background = on ? CC.COLOR_HEX[pc.stickers[k]] : DIM;
        faces[k].style.opacity = on ? '1' : '.55';
      }
    }
  };

  Cube3D.prototype.animate = function (mv, ms) {
    var self = this;
    return new Promise(function (resolve) {
      if (!ms || ms <= 0) {
        self.state.applyParsed(mv); self.renderAll(); resolve(true); return;
      }
      var gen = self.gen;
      var affected = self.state.pieces.filter(function (pc) {
        return mv.layers.indexOf(pc.p[mv.axis]) !== -1;
      });
      var total = mv.quarters * 90;
      var fn = 'rotate' + 'XYZ'[mv.axis];
      var t0 = null;
      function frame(now) {
        if (gen !== self.gen) { resolve(false); return; }
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / ms);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        var a = total * e;
        for (var i = 0; i < affected.length; i++) {
          var pc = affected[i];
          self.els[pc.id].style.transform = fn + '(' + a + 'deg) ' + self._base(pc);
        }
        if (k < 1) requestAnimationFrame(frame);
        else { self.state.applyParsed(mv); self.renderAll(); resolve(true); }
      }
      requestAnimationFrame(frame);
    });
  };

  Cube3D.prototype._bindDrag = function () {
    var self = this, stage = this.stage, drag = false, lx = 0, ly = 0, moved = 0;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = true; moved = 0; lx = e.clientX; ly = e.clientY;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      stage.classList.add('dragging');
      stage.focus({ preventScroll: true });
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      // кнопку отпустили вне окна — не даём режиму «залипнуть»
      if (e.pointerType === 'mouse' && e.buttons === 0) { end(); return; }
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      self.ry += (e.clientX - lx) * 0.6;
      self.rx = clamp(self.rx - (e.clientY - ly) * 0.6, -89, 89);
      lx = e.clientX; ly = e.clientY;
      self.updateRig();
    });
    function end() { drag = false; stage.classList.remove('dragging'); }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('lostpointercapture', end);
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
    stage.addEventListener('selectstart', function (e) { e.preventDefault(); });
    // двойной клик сбрасывает вид только если куб не вращали
    stage.addEventListener('dblclick', function () { if (moved < 4) self.setView('default'); });
  };

  window.Cube3D = Cube3D;
})();
