/* =========================================================
   cube-core.js — логика кубика Рубика 3×3 (без DOM).
   Координаты как в CSS: x вправо, y ВНИЗ, z к зрителю.
   Грани: U (y=-1), D (y=+1), R (x=+1), L (x=-1), F (z=+1), B (z=-1).
   ========================================================= */
(function (root) {
  'use strict';

  var COLOR_HEX = {
    W: '#f4f4f0', Y: '#ffd500', G: '#009e60',
    B: '#0a51c4', R: '#d62828', O: '#ff7a00'
  };

  // Локальные нормали наклеек (ключ = исходная грань)
  var NORMALS = {
    R: [1, 0, 0], L: [-1, 0, 0],
    U: [0, -1, 0], D: [0, 1, 0],
    F: [0, 0, 1], B: [0, 0, -1]
  };
  var FACE_KEYS = ['R', 'L', 'U', 'D', 'F', 'B'];

  // Базовая раскраска до поворота z2: белый сверху, зелёный спереди
  var INITIAL_COLOR = { U: 'W', D: 'Y', F: 'G', B: 'B', R: 'R', L: 'O' };

  // Базовая ориентация самоучителя: жёлтый сверху, зелёный спереди
  var BASE = 'z2';

  /* ---------- матрицы 3×3 ---------- */
  function identity() { return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; }
  function mul(A, B) {
    var R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++)
      for (var j = 0; j < 3; j++)
        for (var k = 0; k < 3; k++) R[i][j] += A[i][k] * B[k][j];
    return R;
  }
  function mulVec(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
    ];
  }
  // Поворот на +90° вокруг оси (как CSS rotateX/Y/Z)
  var Q90 = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
  ];
  function rotMat(axis, quarters) {
    var n = ((quarters % 4) + 4) % 4, r = identity();
    for (var i = 0; i < n; i++) r = mul(Q90[axis], r);
    return r;
  }

  /* ---------- определения ходов ----------
     ang: +1 / -1 — знак поворота на 90° вокруг оси для хода «по часовой» */
  var DEFS = {
    R: { axis: 0, layers: [1], ang: 1 },
    L: { axis: 0, layers: [-1], ang: -1 },
    U: { axis: 1, layers: [-1], ang: -1 },
    D: { axis: 1, layers: [1], ang: 1 },
    F: { axis: 2, layers: [1], ang: 1 },
    B: { axis: 2, layers: [-1], ang: -1 },
    M: { axis: 0, layers: [0], ang: -1 },
    E: { axis: 1, layers: [0], ang: 1 },
    S: { axis: 2, layers: [0], ang: 1 },
    r: { axis: 0, layers: [0, 1], ang: 1 },
    l: { axis: 0, layers: [-1, 0], ang: -1 },
    u: { axis: 1, layers: [-1, 0], ang: -1 },
    d: { axis: 1, layers: [0, 1], ang: 1 },
    f: { axis: 2, layers: [0, 1], ang: 1 },
    b: { axis: 2, layers: [-1, 0], ang: -1 },
    x: { axis: 0, layers: [-1, 0, 1], ang: 1 },
    y: { axis: 1, layers: [-1, 0, 1], ang: -1 },
    z: { axis: 2, layers: [-1, 0, 1], ang: 1 }
  };

  function tokenize(alg) {
    return String(alg || '')
      .replace(/[\u2019\u2018\u02bc`]/g, "'")
      .replace(/[()\[\]]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function parseMove(tok) {
    var m = /^([URFDLBMESxyzurfdlb])(w?)(2'|'2|2|')?$/.exec(tok);
    if (!m) throw new Error('Неизвестный ход: ' + tok);
    var face = m[1];
    if (m[2] === 'w') face = face.toLowerCase();
    var def = DEFS[face];
    if (!def) throw new Error('Неизвестный ход: ' + tok);
    var suf = m[3] || '', k = 1;
    if (suf === "'") k = -1; else if (suf) k = 2;
    return {
      name: tok, face: face, axis: def.axis, layers: def.layers,
      quarters: def.ang * k, suffix: suf
    };
  }

  function invertToken(t) {
    if (/2'$|'2$/.test(t)) return t.replace(/2'$|'2$/, '2');
    if (/2$/.test(t)) return t;
    if (/'$/.test(t)) return t.slice(0, -1);
    return t + "'";
  }
  function invertAlg(alg) {
    return tokenize(alg).reverse().map(invertToken).join(' ');
  }
  function repeatAlg(alg, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(alg);
    return out.join(' ');
  }

  /* ---------- состояние ---------- */
  function createPieces() {
    var pieces = [], id = 0;
    for (var x = -1; x <= 1; x++)
      for (var y = -1; y <= 1; y++)
        for (var z = -1; z <= 1; z++) {
          var st = {};
          if (x === 1) st.R = INITIAL_COLOR.R;
          if (x === -1) st.L = INITIAL_COLOR.L;
          if (y === -1) st.U = INITIAL_COLOR.U;
          if (y === 1) st.D = INITIAL_COLOR.D;
          if (z === 1) st.F = INITIAL_COLOR.F;
          if (z === -1) st.B = INITIAL_COLOR.B;
          pieces.push({
            id: id++, home: [x, y, z], p: [x, y, z],
            m: identity(), stickers: st
          });
        }
    return pieces;
  }

  function CubeState() { this.pieces = createPieces(); }

  CubeState.prototype.clone = function () {
    var c = new CubeState();
    for (var i = 0; i < this.pieces.length; i++) {
      var s = this.pieces[i], d = c.pieces[i];
      d.p = s.p.slice();
      d.m = [s.m[0].slice(), s.m[1].slice(), s.m[2].slice()];
    }
    return c;
  };

  CubeState.prototype.applyParsed = function (mv) {
    var Q = rotMat(mv.axis, mv.quarters);
    for (var i = 0; i < this.pieces.length; i++) {
      var pc = this.pieces[i];
      if (mv.layers.indexOf(pc.p[mv.axis]) !== -1) {
        pc.p = mulVec(Q, pc.p);
        pc.m = mul(Q, pc.m);
      }
    }
    return this;
  };

  CubeState.prototype.apply = function (alg) {
    var t = tokenize(alg);
    for (var i = 0; i < t.length; i++) this.applyParsed(parseMove(t[i]));
    return this;
  };

  // Карта наклеек: "x,y,z|nx,ny,nz" → цвет
  CubeState.prototype.facelets = function () {
    var map = {};
    for (var i = 0; i < this.pieces.length; i++) {
      var pc = this.pieces[i];
      for (var k in pc.stickers) {
        var n = mulVec(pc.m, NORMALS[k]);
        map[pc.p.join(',') + '|' + n.join(',')] = pc.stickers[k];
      }
    }
    return map;
  };

  var FACE_VIEW = {
    U: function (r, c) { return { p: [c - 1, -1, r - 1], n: [0, -1, 0] }; },
    D: function (r, c) { return { p: [c - 1, 1, 1 - r], n: [0, 1, 0] }; },
    F: function (r, c) { return { p: [c - 1, r - 1, 1], n: [0, 0, 1] }; },
    B: function (r, c) { return { p: [1 - c, r - 1, -1], n: [0, 0, -1] }; },
    R: function (r, c) { return { p: [1, r - 1, 1 - c], n: [1, 0, 0] }; },
    L: function (r, c) { return { p: [-1, r - 1, c - 1], n: [-1, 0, 0] }; }
  };

  function key(p, n) { return p.join(',') + '|' + n.join(','); }

  // 3×3 цветов грани, как её видно снаружи
  CubeState.prototype.face = function (name, map) {
    map = map || this.facelets();
    var out = [];
    for (var r = 0; r < 3; r++) {
      var row = [];
      for (var c = 0; c < 3; c++) {
        var v = FACE_VIEW[name](r, c);
        row.push(map[key(v.p, v.n)]);
      }
      out.push(row);
    }
    return out;
  };

  CubeState.prototype.isSolved = function () {
    var map = this.facelets(), names = ['U', 'D', 'F', 'B', 'R', 'L'];
    for (var i = 0; i < names.length; i++) {
      var f = this.face(names[i], map), c = f[1][1];
      for (var r = 0; r < 3; r++)
        for (var q = 0; q < 3; q++) if (f[r][q] !== c) return false;
    }
    return true;
  };

  // Вид сверху на последний слой: верх + полоски боковых граней
  CubeState.prototype.topView = function () {
    var map = this.facelets(), t = { U: this.face('U', map), B: [], F: [], L: [], R: [] };
    for (var i = -1; i <= 1; i++) {
      t.B.push(map[key([i, -1, -1], [0, 0, -1])]);
      t.F.push(map[key([i, -1, 1], [0, 0, 1])]);
      t.L.push(map[key([-1, -1, i], [-1, 0, 0])]);
      t.R.push(map[key([1, -1, i], [1, 0, 0])]);
    }
    return t;
  };

  CubeState.prototype.signature = function () {
    var map = this.facelets(), names = ['U', 'R', 'F', 'D', 'L', 'B'], s = '';
    for (var i = 0; i < names.length; i++)
      s += this.face(names[i], map).map(function (r) { return r.join(''); }).join('');
    return s;
  };

  function createBase() { return new CubeState().apply(BASE); }

  /* ---------- скрамбл ---------- */
  function randomScramble(len) {
    len = len || 20;
    var faces = ['U', 'D', 'R', 'L', 'F', 'B'], mods = ['', "'", '2'];
    var axisOf = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
    var out = [], last = null, last2 = null;
    while (out.length < len) {
      var f = faces[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      if (last && axisOf[f] === axisOf[last] && last2 === f) continue;
      out.push(f + mods[Math.floor(Math.random() * 3)]);
      last2 = last; last = f;
    }
    return out.join(' ');
  }

  /* ---------- наборы деталей (для подсветки цели шага) ---------- */
  function kind(pc) {
    var n = 0;
    for (var i = 0; i < 3; i++) if (pc.home[i] !== 0) n++;
    return n === 3 ? 'corner' : n === 2 ? 'edge' : n === 1 ? 'center' : 'core';
  }
  /* ВАЖНО: pc.home — исходные координаты (до базового поворота z2).
     Белая грань исходно сверху (y = -1), после z2 она внизу.
     Поэтому «белый слой» = home y === -1, «жёлтый слой» = home y === +1.
     Слот «справа-спереди внизу» после z2 занимают детали с home (-1,-1,1) и (-1,0,1),
     слот «слева-спереди внизу» — (1,-1,1) и (1,0,1). */
  function at(pc, x, y, z) { return pc.home[0] === x && pc.home[1] === y && pc.home[2] === z; }
  function whiteEdgeOrCenter(pc) {
    var k = kind(pc);
    return k === 'center' || (k === 'edge' && pc.home[1] === -1);
  }
  var FOCUS = {
    centers: function (pc) { return kind(pc) === 'center'; },
    edges: function (pc) { return kind(pc) === 'edge'; },
    corners: function (pc) { return kind(pc) === 'corner'; },
    cross: whiteEdgeOrCenter,
    xcross: function (pc) {
      return whiteEdgeOrCenter(pc) || at(pc, -1, -1, 1) || at(pc, -1, 0, 1);
    },
    xxcross: function (pc) {
      return whiteEdgeOrCenter(pc) || at(pc, -1, -1, 1) || at(pc, -1, 0, 1) ||
        at(pc, 1, -1, 1) || at(pc, 1, 0, 1);
    },
    layer1: function (pc) { return kind(pc) === 'center' || pc.home[1] === -1; },
    f2l: function (pc) { return kind(pc) === 'center' || pc.home[1] <= 0; },
    // жёлтый крест: только жёлтые стикеры рёбер и центра сверху
    ycross: function (pc, k) {
      return k === 'D' && pc.home[1] === 1 && (pc.home[0] === 0 || pc.home[2] === 0);
    },
    all: function () { return true; }
  };

  root.CubeCore = {
    COLOR_HEX: COLOR_HEX, FACE_KEYS: FACE_KEYS, NORMALS: NORMALS, BASE: BASE,
    CubeState: CubeState, createBase: createBase,
    tokenize: tokenize, parseMove: parseMove, invertAlg: invertAlg,
    repeatAlg: repeatAlg, randomScramble: randomScramble,
    FOCUS: FOCUS, kind: kind, rotMat: rotMat
  };
})(typeof window !== 'undefined' ? window : globalThis);
