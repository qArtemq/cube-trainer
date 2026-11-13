/* =========================================================
   diagrams.js — диаграммы «вид сверху» для случаев OLL / PLL.
   Рисуются из состояния симулятора, поэтому всегда совпадают
   с тем, что алгоритм реально решает.
   ========================================================= */
(function () {
  'use strict';
  var CC = window.CubeCore, HEX = CC.COLOR_HEX, GREY = '#4b536b';

  function rect(x, y, w, h, fill, rx) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (rx || 3) + '" fill="' + fill + '"/>';
  }

  // mode: 'oll' (жёлтое/серое) или 'pll' (все цвета)
  function topSVG(state, mode, px) {
    var t = state.topView(), top = t.U[1][1];
    var col = function (c) { return mode === 'oll' ? (c === top ? HEX.Y : GREY) : HEX[c]; };
    var cell = 20, gap = 2, band = 8, pad = band + 3, total = pad * 2 + cell * 3 + gap * 2;
    var s = '<rect width="' + total + '" height="' + total + '" rx="10" fill="#0f1320"/>';
    var r, c, i;
    for (r = 0; r < 3; r++)
      for (c = 0; c < 3; c++)
        s += rect(pad + c * (cell + gap), pad + r * (cell + gap), cell, cell, col(t.U[r][c]));
    for (i = 0; i < 3; i++) {
      var o = pad + i * (cell + gap);
      s += rect(o, 1, cell, band, col(t.B[i]), 2);
      s += rect(o, total - 1 - band, cell, band, col(t.F[i]), 2);
      s += rect(1, o, band, cell, col(t.L[i]), 2);
      s += rect(total - 1 - band, o, band, cell, col(t.R[i]), 2);
    }
    return '<svg class="diag" viewBox="0 0 ' + total + ' ' + total + '" width="' + (px || 86) +
      '" height="' + (px || 86) + '" role="img" aria-hidden="true">' + s + '</svg>';
  }

  // Диаграмма случая, который решает алгоритм alg (setup = обратный алгоритм)
  function caseSVG(alg, mode, px) {
    var st = CC.createBase().apply(CC.invertAlg(alg));
    return topSVG(st, mode, px);
  }

  window.CubeDiagrams = { topSVG: topSVG, caseSVG: caseSVG };
})();
