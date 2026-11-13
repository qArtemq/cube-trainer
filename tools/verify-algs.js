/* =========================================================
   tools/verify-algs.js — проверка всех алгоритмов из js/data-algs.js
   через симулятор куба (js/cube-core.js).

   Запуск (нужен Node.js):   node tools/verify-algs.js
   Или в консоли браузера на странице проекта:  verifyAll()

   Что проверяется:
   • OLL: каждый алгоритм не ломает F2L, все 57 случаев РАЗНЫЕ (с учётом поворота U);
   • PLL: не ломает F2L и ориентацию, все 21 случай РАЗНЫЕ (с учётом U до и после);
   • 2-look OLL;
   • F2L: каждый алгоритм трогает только слот «справа-спереди» (остальные 3 слота и крест целы).
   ========================================================= */
function verifyAll() {
  'use strict';
  var C = CubeCore, D = CFOP_DATA;
  var errors = [];
  var eq = function (arr, v) { return arr.every(function (x) { return x === v; }); };

  function f2lOK(s) {
    var m = s.facelets(), d = s.face('D', m);
    if (!d.every(function (r) { return eq(r, d[1][1]); })) return false;
    var sides = ['F', 'B', 'R', 'L'];
    for (var i = 0; i < sides.length; i++) {
      var f = s.face(sides[i], m);
      for (var r = 1; r <= 2; r++) if (!eq(f[r], f[1][1])) return false;
    }
    return true;
  }
  // Приводим куб к базовой ориентации (жёлтый сверху, зелёный спереди)
  function normalize(s) {
    var xs = ['', 'x', 'x2', "x'"], ys = ['', 'y', 'y2', "y'"], zs = ['', 'z', 'z2', "z'"];
    for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) for (var c = 0; c < 4; c++) {
      var t = s.clone().apply([xs[a], ys[b], zs[c]].join(' '));
      if (t.face('U')[1][1] === 'Y' && t.face('F')[1][1] === 'G') return t;
    }
    return null;
  }
  function pat(s) {
    var t = s.topView(), top = t.U[1][1], bit = function (c) { return c === top ? '1' : '0'; };
    return t.U.map(function (r) { return r.map(bit).join(''); }).join('') + '|' +
      [t.B, t.R, t.F, t.L].map(function (a) { return a.map(bit).join(''); }).join('');
  }
  function canonOLL(s) {
    var best = null, t = s.clone();
    for (var i = 0; i < 4; i++) { var p = pat(t); if (best === null || p < best) best = p; t.apply('U'); }
    return best;
  }
  var U = ['', 'U', 'U2', "U'"];

  // ---- OLL ----
  var seen = {}, nums = [];
  D.oll.forEach(function (o) {
    nums.push(o.n);
    try {
      var S = normalize(C.createBase().apply(o.alg));
      var Cs = normalize(C.createBase().apply(C.invertAlg(o.alg)));
      if (!S || !f2lOK(S)) errors.push('OLL ' + o.n + ': ломает F2L');
      if (!Cs || !f2lOK(Cs)) errors.push('OLL ' + o.n + ': ломает F2L (обратный)');
      var key = Cs ? canonOLL(Cs) : 'ERR' + o.n;
      if (seen[key]) errors.push('OLL ' + o.n + ' дублирует случай OLL ' + seen[key]);
      seen[key] = o.n;
    } catch (e) { errors.push('OLL ' + o.n + ': ' + e.message); }
  });
  for (var n = 1; n <= 57; n++) if (nums.indexOf(n) < 0) errors.push('нет OLL ' + n);

  // ---- PLL ----
  var solvedSig = C.createBase().signature(), pseen = {};
  D.pll.forEach(function (p) {
    try {
      var S = normalize(C.createBase().apply(p.alg));
      if (!S) { errors.push('PLL ' + p.name + ': центры сдвинуты'); return; }
      if (!f2lOK(S)) errors.push('PLL ' + p.name + ': ломает F2L');
      var u = S.face('U');
      if (!u.every(function (r) { return eq(r, u[1][1]); })) errors.push('PLL ' + p.name + ': ломает ориентацию');
      var best = null;
      for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) {
        var t = normalize(C.createBase().apply(U[a] + ' ' + C.invertAlg(p.alg) + ' ' + U[b]));
        var sg = t.signature(); if (best === null || sg < best) best = sg;
      }
      if (best === solvedSig) errors.push('PLL ' + p.name + ': ничего не меняет');
      if (pseen[best]) errors.push('PLL ' + p.name + ' дублирует ' + pseen[best]);
      pseen[best] = p.name;
    } catch (e) { errors.push('PLL ' + p.name + ': ' + e.message); }
  });

  // ---- 2-look OLL ----
  ['oll2Edges', 'oll2Corners'].forEach(function (g) {
    D[g].forEach(function (o) {
      var S = normalize(C.createBase().apply(o.alg)), Cs = normalize(C.createBase().apply(C.invertAlg(o.alg)));
      if (!f2lOK(S) || !f2lOK(Cs)) errors.push(g + ' ' + o.id + ': ломает F2L');
    });
  });

  // ---- F2L: затронут только слот «справа-спереди» ----
  var base = C.createBase(), byId = {};
  base.pieces.forEach(function (p) { byId[p.id] = p; });
  var slotIds = base.pieces.filter(function (p) {
    var k = p.p.join(); return k === '1,1,1' || k === '1,0,1';
  }).map(function (p) { return p.id; });
  function same(a, b) { return a.p.join() === b.p.join() && JSON.stringify(a.m) === JSON.stringify(b.m); }
  function onlySlot(s) {
    return s.pieces.every(function (pc) {
      var bp = byId[pc.id];
      return bp.p[1] < 0 || slotIds.indexOf(pc.id) >= 0 || same(pc, bp);
    });
  }
  D.f2l.forEach(function (c) {
    try {
      var Cs = C.createBase().apply(C.invertAlg(c.alg)), S = C.createBase().apply(c.alg);
      if (!onlySlot(Cs) || !onlySlot(S)) errors.push('F2L «' + c.alg + '»: задевает другие слоты');
    } catch (e) { errors.push('F2L «' + c.alg + '»: ' + e.message); }
  });

  return {
    ok: errors.length === 0,
    errors: errors,
    ollCases: Object.keys(seen).length,
    pllCases: Object.keys(pseen).length,
    f2lCases: D.f2l.length
  };
}

if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  global.window = global;
  require('../js/cube-core.js');
  require('../js/data-algs.js');
  var res = verifyAll();
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}
