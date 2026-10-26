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

var PLAN_H7 = [
  '<rect class="p-floor" x="210" y="308" width="1355" height="795"/>',
  // Fluchtwege / Gänge (bleiben frei, siehe AISLES_H7)
  '<g class="p-aisle">' + AISLES_H7.map(function (a) {
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '"/>';
  }).join('') + '</g>',
  // Arbeitsflächen
  '<g class="p-block">',
  '<rect x="268" y="308" width="717" height="172"/>',
  '<rect x="268" y="520" width="717" height="213"/>',
  '<rect x="268" y="775" width="717" height="173"/>',
  '<rect x="268" y="990" width="717" height="113"/>',
  '<rect x="1007" y="308" width="553" height="172"/>',
  '<rect x="1007" y="520" width="458" height="213"/>',
  '<rect x="1007" y="775" width="458" height="173"/>',
  '<rect x="1007" y="990" width="373" height="113"/>',
  '</g>',
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
  '<text class="p-t" x="1634" y="820" text-anchor="middle">Lager</text>',
  // Ausgänge links, Eingänge rechts
  '<g class="p-exit">',
  '<rect x="126" y="545" width="64" height="34" rx="3"/>',
  '<rect x="126" y="778" width="64" height="34" rx="3"/>',
  '<rect x="120" y="990" width="64" height="34" rx="3"/>',
  '<rect x="126" y="385" width="64" height="34" rx="3"/>',
  '<polygon points="1895,607 1895,652 1850,629"/>',
  '<polygon points="1895,1010 1895,1055 1850,1032"/>',
  '</g>',
  '<text class="p-t" x="1822" y="595" text-anchor="end">Eingang</text>',
  '<text class="p-t" x="1822" y="1000" text-anchor="end">Eingang</text>'
].join('');

// Jede n-te Spalte behalten (z.B. 3, 6, 9, ...), alle anderen ausblenden
function everyNth(cols, n) {
  var off = {};
  for (var i = 1; i <= cols; i++) if (i % n) off['c' + i] = 1;
  return off;
}

window.DEKR_HALLS = [
  {
    id: 'H1', name: 'Halle 7.1',
    vb: '100 270 1820 860',
    plan: PLAN_H7,
    aisles: AISLES_H7,
    // Aus den Spots der Arbeitsliste (9, 12, 21, 24, 30, 42): nur Vielfache von 3 werden genutzt
    layout: { off: everyNth(49, 3) },
    grid: { x: 215, y: 310, w: 1330, h: 790, rows: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cols: 49 }
  },
  { id: 'H2', name: 'Halle 6', rows: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cols: 49 } // Platzhalter-Raster bis zum Plan
];

window.Halls = (function () {
  var CELL = 30, GAP = 3, PAD = 26;
  var cache = {};

  // Raster-Parameter: Startpunkt, Zellabstand (cw/ch) und Zellgröße (pw/ph)
  function spec(h) {
    if (h.grid) {
      var g = h.grid, cw = g.w / g.cols, ch = g.h / g.rows.length;
      return { x: g.x, y: g.y, cw: cw, ch: ch, pw: cw, ph: ch, rows: g.rows, cols: g.cols,
        vb: h.vb, plan: h.plan, font: Math.min(cw, ch) * 0.42 };
    }
    return { x: PAD, y: PAD, cw: CELL + GAP, ch: CELL + GAP, pw: CELL, ph: CELL, rows: h.rows, cols: h.cols,
      vb: '0 0 ' + (PAD * 2 + h.cols * (CELL + GAP)) + ' ' + (PAD * 2 + h.rows.length * (CELL + GAP)),
      plan: null, font: 9 };
  }

  // ov = { cols: { c14: dx }, rows: { rA: dy }, off: { c5: 1, rB: 1 } }
  // verschiebt Spalten/Zeilen und blendet Spalten (cN) / Zeilen (rX) aus
  function inAisle(h, x, y) {
    return (h.aisles || []).some(function (a) { return x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3]; });
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
      var rk = 'r' + s.rows[r], dy = or[rk] || 0, y = s.y + r * s.ch + dy;
      rowKeys.push(rk);
      labels.push({ t: s.rows[r], x: s.x - 12, y: y + s.ph / 2 + 4, axis: 'r', i: r, off: !!off[rk] });
      if (off[rk]) continue;
      for (c = 0; c < s.cols; c++) {
        var id = s.rows[r] + (c + 1);
        if (off['c' + (c + 1)] || (valid && !valid[id])) continue;
        if (inAisle(h, xs[c] + s.pw / 2, y + s.ph / 2)) continue;
        positions.push({ id: id, x: xs[c] - (wOf[c] - s.pw) / 2, y: y, w: wOf[c], h: s.ph, f: h.grid ? Math.min(wOf[c], s.ph) * 0.42 : s.font });
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
    // Zelle einer Position aus der Liste, auch wenn das Raster sie ausblendet (Liste hat Vorrang)
    cellFor: function (id, pos, ov) {
      var h = this.get(id), s = spec(h);
      ov = ov || h.layout || {};
      var m = /^([A-Z])(\d+)$/.exec(pos);
      if (!m) return null;
      var r = s.rows.indexOf(m[1]), c = +m[2] - 1;
      if (r < 0 || c < 0 || c >= s.cols) return null;
      var wide = ov.off && Object.keys(ov.off).length ? s.pw + 2 * s.cw : s.pw;
      var x = s.x + c * s.cw + ((ov.cols || {})['c' + (c + 1)] || 0), y = s.y + r * s.ch + ((ov.rows || {})['r' + m[1]] || 0);
      return { id: pos, x: x - (wide - s.pw) / 2, y: y, w: wide, h: s.ph, f: h.grid ? Math.min(wide, s.ph) * 0.42 : s.font };
    },
    // Hallen, in denen die Position existiert
    find: function (pos) {
      var self = this;
      return window.DEKR_HALLS.filter(function (h) {
        return self.layout(h.id).positions.some(function (p) { return p.id === pos; });
      });
    }
  };
})();
