// Hallen-Definition.
//
// Mit `grid` wird ein Positionsraster (Zeilenbuchstaben x Spaltennummern) über die Zeichnung `plan`
// gelegt. x/y/w/h sind Koordinaten im viewBox-System der Hallenzeichnung.
// Optional: `layout: { cols: {c14: 12}, rows: {rA: -4} }` = fest eingebaute Verschiebungen (Export aus dem Admin-Modus).
// Optional: `aisles: [[x,y,w,h],...]` = Gänge ohne Positionen; `layout.off` blendet Spalten/Zeilen aus.
// Optional: `valid: ['A1','A2',...]` beschränkt die Halle auf tatsächlich vorhandene Positionen.
// Ohne `grid` entsteht ein einfaches Platzhalter-Raster (rows x cols).

// Halle 7.1 (nachgezeichnet nach Flucht- und Rettungsplan). Koordinaten = Pixel der Planvorlage.
// Gänge [x, y, Breite, Höhe]: dort gibt es keine Positionen
var AISLES_H7 = [
  [210, 308, 58, 682], [985, 308, 22, 795], [210, 480, 1295, 40], [210, 733, 1420, 42],
  [210, 948, 1420, 42], [1465, 480, 40, 510], [1535, 990, 95, 40], [1550, 365, 20, 95]
];

// Arbeitsflächen [x, y, Breite, Höhe]: Positionen werden in diese Flächen gelegt und nie in die grünen Gänge
var BLOCKS_H7 = [
  [268, 308, 717, 172], [268, 520, 717, 213], [268, 775, 717, 173], [268, 990, 717, 113],
  [1007, 308, 553, 172], [1007, 520, 458, 213], [1007, 775, 458, 173], [1007, 990, 373, 113]
];

var PLAN_H7 = [
  '<rect class="p-floor" x="210" y="308" width="1355" height="795"/>',
  // Fluchtwege / Gänge (bleiben frei, siehe AISLES_H7)
  '<g class="p-aisle">' + AISLES_H7.map(function (a) {
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '"/>';
  }).join('') + '</g>',
  // Arbeitsflächen (grau): nur dort liegen Positionen, siehe BLOCKS_H7
  '<g class="p-block">' + BLOCKS_H7.map(function (a) {
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '"/>';
  }).join('') + '</g>',
  // Büros, Sozialräume, Lager
  '<g class="p-office">',
  '<rect x="1565" y="308" width="195" height="312"/>',
  '<rect x="1507" y="640" width="255" height="345"/>',
  '<rect x="215" y="310" width="120" height="70"/>',
  '<rect x="210" y="1010" width="60" height="93"/>',
  '<rect x="1380" y="990" width="380" height="113"/>',
  '</g>',
  '<g class="p-rack"><rect x="1432" y="778" width="28" height="165"/><rect x="1510" y="785" width="45" height="160"/></g>',
  '<text class="p-t" x="1662" y="470" text-anchor="middle">Büro / Sozial</text>',
  '<text class="p-t" x="1634" y="820" text-anchor="middle">Lager</text>'
].join('');

// Halle 6 (nachgezeichnet nach Flucht- und Rettungsplan Halle 6.1, Montage EG). Koordinaten = Pixel der Planvorlage.
var AISLES_H6 = [
  [190, 318, 15, 230], [205, 545, 445, 45], [598, 390, 52, 555], [598, 390, 1127, 22], [650, 565, 1075, 23],
  [968, 410, 24, 155], [1715, 390, 20, 360], [190, 865, 415, 23], [190, 888, 1290, 57]
];

// Arbeitsflächen [x, y, Breite, Höhe] (zwischen den grünen Fluchtwegen)
var BLOCKS_H6 = [
  [205, 322, 393, 223], [125, 590, 473, 275], [650, 322, 1065, 68], [650, 412, 318, 153], [992, 412, 723, 153],
  [650, 588, 950, 300]
];

var PLAN_H6 = [
  '<rect class="p-floor" x="120" y="318" width="1530" height="667"/>',
  '<g class="p-aisle">' + AISLES_H6.map(function (a) {
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '"/>';
  }).join('') + '<polygon points="1480,888 1640,715 1640,790 1560,888"/></g>',
  '<g class="p-block">' + BLOCKS_H6.map(function (a) {
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '"/>';
  }).join('') + '</g>',
  // Räume (Sozial, Sanitär, Eingänge)
  '<g class="p-office">',
  '<rect x="125" y="318" width="65" height="230"/>',
  '<rect x="125" y="500" width="115" height="95"/>',
  '<rect x="120" y="945" width="320" height="40"/>',
  '<rect x="1480" y="945" width="170" height="40"/>',
  '<rect x="1620" y="590" width="95" height="155"/>',
  '<rect x="1650" y="330" width="195" height="490"/>',
  '</g>',
  '<text class="p-t" x="1748" y="590" text-anchor="middle">Anbau</text>'
].join('');

// Jede n-te Spalte behalten (z.B. 3, 6, 9, ...), alle anderen ausblenden
function everyNth(cols, n) {
  var off = {};
  for (var i = 1; i <= cols; i++) if (i % n) off['c' + i] = 1;
  return off;
}

window.DEKR_HALLS = [
  {
    id: 'H1', name: 'Halle 7.1', short: '7',
    vb: '190 286 1590 840',
    plan: PLAN_H7,
    aisles: AISLES_H7,
    blocks: BLOCKS_H7,
    // Aus den Spots der Arbeitsliste (9, 12, 21, 24, 30, 42): nur Vielfache von 3 werden genutzt
    layout: { off: everyNth(49, 3) },
    // Genutzte Buchstaben, verteilt auf die vier Arbeitsflächen von oben nach unten: [y, Höhe, Buchstaben]
    grid: { x: 215, y: 310, w: 1330, h: 790, rows: 'BFKNPTYZ', cols: 49,
      bands: [[308, 172, 'BF'], [520, 213, 'KN'], [775, 173, 'PTY'], [990, 113, 'Z']] }
  },
  {
    id: 'H2', name: 'Halle 6', short: '6',
    vb: '100 296 1770 720',
    plan: PLAN_H6,
    aisles: AISLES_H6,
    blocks: BLOCKS_H6,
    // Annahme: Buchstaben A bis Z von oben nach unten, Nummern 1 bis 49 von links nach rechts (Feinabstimmung im Admin-Modus)
    grid: { x: 125, y: 322, w: 1525, h: 566, rows: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cols: 49,
      bands: [[322, 243, 'ABCDEFGHIJKL'], [588, 300, 'MNOPQRSTUVWXYZ']] }
  }
];

window.Halls = (function () {
  var CELL = 30, GAP = 3, PAD = 26;
  var cache = {};

  // Raster-Parameter: Startpunkt, Zellabstand (cw/ch) und Zellgröße (pw/ph)
  function spec(h) {
    if (h.grid) {
      var g = h.grid, cw = g.w / g.cols, ch = g.h / g.rows.length;
      var ys = [], hs = [];
      if (g.bands) {
        // Zeilen gleichmäßig innerhalb ihrer Arbeitsfläche verteilen
        g.bands.forEach(function (b) {
          var n = b[2].length, rh = (b[1] - 6) / n;
          for (var i = 0; i < n; i++) { ys.push(b[0] + 3 + i * rh); hs.push(rh - 3); }
        });
      }
      var ph = g.bands ? hs.reduce(function (a, v) { return a + v; }, 0) / hs.length : ch;
      return { x: g.x, y: g.y, cw: cw, ch: ch, pw: cw, ph: ph, rows: g.rows, cols: g.cols,
        rowY: function (r) { return ys.length ? ys[r] : g.y + r * ch; },
        rowH: function (r) { return hs.length ? hs[r] : ch; },
        vb: h.vb, plan: h.plan, font: Math.min(cw, ph) * 0.42 };
    }
    return { x: PAD, y: PAD, cw: CELL + GAP, ch: CELL + GAP, pw: CELL, ph: CELL, rows: h.rows, cols: h.cols,
      rowY: function (r) { return PAD + r * (CELL + GAP); }, rowH: function () { return CELL; },
      vb: '0 0 ' + (PAD * 2 + h.cols * (CELL + GAP)) + ' ' + (PAD * 2 + h.rows.length * (CELL + GAP)),
      plan: null, font: 9 };
  }

  // ov = { cols: { c14: dx }, rows: { rA: dy }, off: { c5: 1, rB: 1 } }
  // verschiebt Spalten/Zeilen und blendet Spalten (cN) / Zeilen (rX) aus
  function inAisle(h, x, y) {
    return (h.aisles || []).some(function (a) { return x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3]; });
  }

  // Legt eine Zelle vollständig in die nächstgelegene Arbeitsfläche (nie in Gänge)
  function snap(h, p) {
    if (!h.blocks) return p;
    var cx = p.x + p.w / 2, cy = p.y + p.h / 2, best = null, bd = Infinity, pad = 3;
    // Bevorzugt Flächen in derselben Höhe (Zeile bleibt in ihrem Band), sonst die nächstgelegene
    var level = h.blocks.filter(function (b) { return cy >= b[1] && cy <= b[1] + b[3]; });
    (level.length ? level : h.blocks).forEach(function (b) {
      var dx = Math.max(b[0] - cx, 0, cx - (b[0] + b[2])), dy = Math.max(b[1] - cy, 0, cy - (b[1] + b[3])), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = b; }
    });
    var w = Math.min(p.w, best[2] - 2 * pad), hh = Math.min(p.h, best[3] - 2 * pad);
    return { id: p.id, w: w, h: hh, f: Math.min(w, hh) * 0.42,
      x: Math.max(best[0] + pad, Math.min(cx - w / 2, best[0] + best[2] - pad - w)),
      y: Math.max(best[1] + pad, Math.min(cy - hh / 2, best[1] + best[3] - pad - hh)) };
  }

  function build(h, ov) {
    ov = ov || h.layout;
    var s = spec(h), oc = (ov && ov.cols) || {}, or = (ov && ov.rows) || {}, off = (ov && ov.off) || {};
    var valid = null, positions = [], labels = [], colKeys = [], rowKeys = [], xs = [], vis = [], wOf = {}, r, c;
    if (h.valid) { valid = {}; h.valid.forEach(function (id) { valid[id] = 1; }); }

    for (c = 0; c < s.cols; c++) {
      xs.push(s.x + c * s.cw + (oc['c' + (c + 1)] || 0));
      if (!off['c' + (c + 1)]) vis.push(c);
    }
    // Ausgeblendete Nachbarspalten machen die sichtbare Zelle breiter
    vis.forEach(function (col, i) {
      var gap = i + 1 < vis.length ? xs[vis[i + 1]] - xs[col] : s.cw;
      wOf[col] = Math.max(2, Math.min(s.pw + gap - s.cw, s.pw + 3 * s.cw));
    });

    for (c = 0; c < s.cols; c++) {
      colKeys.push('c' + (c + 1));
      labels.push({ t: String(c + 1), x: xs[c] + s.pw / 2, y: s.y - 8, axis: 'c', i: c, off: !!off['c' + (c + 1)] });
    }
    for (r = 0; r < s.rows.length; r++) {
      var rk = 'r' + s.rows[r], dy = or[rk] || 0, y = s.rowY(r) + dy, rh = s.rowH(r);
      rowKeys.push(rk);
      labels.push({ t: s.rows[r], x: s.x - 12, y: y + rh / 2 + 4, h: rh, axis: 'r', i: r, off: !!off[rk] });
      if (off[rk]) continue;
      for (c = 0; c < s.cols; c++) {
        var id = s.rows[r] + (c + 1);
        if (off['c' + (c + 1)] || (valid && !valid[id])) continue;
        if (inAisle(h, xs[c] + s.pw / 2, y + rh / 2)) continue;
        positions.push(snap(h, { id: id, x: xs[c] - (wOf[c] - s.pw) / 2, y: y, w: wOf[c], h: rh, f: h.grid ? Math.min(wOf[c], rh) * 0.42 : s.font }));
      }
    }
    return { vb: s.vb, plan: s.plan, font: s.font, pw: s.pw, ph: s.ph, positions: positions, labels: labels,
      colKeys: colKeys, rowKeys: rowKeys };
  }

  return {
    all: window.DEKR_HALLS,
    get: function (id) {
      return window.DEKR_HALLS.filter(function (h) { return h.id === id; })[0] || null;
    },
    layout: function (id, ov) {
      if (ov && (ov.all || Object.keys(ov.cols || {}).length || Object.keys(ov.rows || {}).length || Object.keys(ov.off || {}).length)) return build(this.get(id), ov);
      if (!cache[id]) cache[id] = build(this.get(id), null);
      return cache[id];
    },
    // Anzeige wie in der Arbeitsliste: Halle, Nummer, Buchstabe (z.B. "7 42 Z")
    label: function (hallId, pos) {
      if (!pos) return '–';
      var h = this.get(hallId), m = /^([A-Z])(\d+)$/.exec(pos);
      return (h && h.short ? h.short + ' ' : '') + (m ? m[2] + ' ' + m[1] : pos);
    },
    // Hallennummer ("7", "7.1", "6") -> Hallen-ID
    byShort: function (s) {
      var major = String(s).split('.')[0], r = window.DEKR_HALLS.filter(function (h) { return h.short === major; })[0];
      return r ? r.id : '';
    },
    // Zelle einer Position aus der Liste, auch wenn das Raster sie ausblendet (Liste hat Vorrang)
    cellFor: function (id, pos, ov) {
      var h = this.get(id), s = spec(h);
      ov = ov || h.layout || {};
      var m = /^([A-Z])(\d+)$/.exec(pos);
      if (!m) return null;
      var r = s.rows.indexOf(m[1]), c = +m[2] - 1;
      if (r < 0 || c < 0 || c >= s.cols) return null;
      var wide = ov.off && Object.keys(ov.off).length ? s.pw + 2 * s.cw : s.pw;
      var x = s.x + c * s.cw + ((ov.cols || {})['c' + (c + 1)] || 0), y = s.rowY(r) + ((ov.rows || {})['r' + m[1]] || 0), rh = s.rowH(r);
      return snap(h, { id: pos, x: x - (wide - s.pw) / 2, y: y, w: wide, h: rh, f: h.grid ? Math.min(wide, rh) * 0.42 : s.font });
    },
    // Gibt es den Buchstaben (die Zeile) in dieser Halle?
    hasRow: function (id, letter) { return spec(this.get(id)).rows.indexOf(letter) >= 0; },
    rowLetters: function (id) { return spec(this.get(id)).rows; },
    // Hallen, in denen die Position existiert
    find: function (pos) {
      var self = this;
      return window.DEKR_HALLS.filter(function (h) {
        return self.layout(h.id).positions.some(function (p) { return p.id === pos; });
      });
    }
  };
})();
