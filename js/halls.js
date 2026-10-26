// Hallen-Definition.
//
// Mit `grid` wird ein Positionsraster (Zeilenbuchstaben x Spaltennummern) über die Zeichnung `plan`
// gelegt. x/y/w/h sind Koordinaten im viewBox-System der Hallenzeichnung.
// Ohne `grid` entsteht ein einfaches Platzhalter-Raster (rows x cols).

// Halle 7.1 (nachgezeichnet nach Flucht- und Rettungsplan). Koordinaten = Pixel der Planvorlage.
var PLAN_H7 = [
  '<rect class="p-floor" x="210" y="308" width="1355" height="795"/>',
  // Fluchtwege / Gänge
  '<g class="p-aisle">',
  '<rect x="210" y="308" width="58" height="682"/>',
  '<rect x="985" y="308" width="22" height="795"/>',
  '<rect x="210" y="480" width="1295" height="40"/>',
  '<rect x="210" y="733" width="1420" height="42"/>',
  '<rect x="210" y="948" width="1420" height="42"/>',
  '<rect x="1465" y="480" width="40" height="510"/>',
  '<rect x="1535" y="990" width="95" height="40"/>',
  '<rect x="1550" y="365" width="20" height="95"/>',
  '</g>',
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

window.DEKR_HALLS = [
  {
    id: 'H1', name: 'Halle 7.1',
    vb: '100 270 1820 860',
    plan: PLAN_H7,
    grid: { x: 215, y: 310, w: 1330, h: 790, rows: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cols: 49 }
  },
  { id: 'H2', name: 'Halle 2', rows: 'ABCDEFGHIJKL', cols: 24 } // Platzhalter bis zum Plan
];

window.Halls = (function () {
  var CELL = 30, GAP = 3, PAD = 26;
  var cache = {};

  function buildGrid(h) {
    var g = h.grid, cw = g.w / g.cols, ch = g.h / g.rows.length, positions = [], labels = [], r, c;
    for (c = 0; c < g.cols; c++) {
      labels.push({ t: String(c + 1), x: g.x + c * cw + cw / 2, y: g.y - 6 });
    }
    for (r = 0; r < g.rows.length; r++) {
      labels.push({ t: g.rows[r], x: g.x - 10, y: g.y + r * ch + ch / 2 + 4 });
      for (c = 0; c < g.cols; c++) {
        positions.push({ id: g.rows[r] + (c + 1), x: g.x + c * cw, y: g.y + r * ch, w: cw, h: ch });
      }
    }
    return { vb: h.vb, plan: h.plan, font: Math.min(cw, ch) * 0.42, positions: positions, labels: labels };
  }

  function buildRaster(h) {
    var positions = [], labels = [], r, c;
    for (c = 1; c <= h.cols; c++) {
      labels.push({ t: String(c), x: PAD + (c - 1) * (CELL + GAP) + CELL / 2, y: PAD - 8 });
    }
    for (r = 0; r < h.rows.length; r++) {
      var y = PAD + r * (CELL + GAP);
      labels.push({ t: h.rows[r], x: PAD - 12, y: y + CELL / 2 + 4 });
      for (c = 1; c <= h.cols; c++) {
        positions.push({ id: h.rows[r] + c, x: PAD + (c - 1) * (CELL + GAP), y: y, w: CELL, h: CELL });
      }
    }
    return {
      vb: '0 0 ' + (PAD * 2 + h.cols * (CELL + GAP)) + ' ' + (PAD * 2 + h.rows.length * (CELL + GAP)),
      plan: null, font: 9, positions: positions, labels: labels
    };
  }

  return {
    all: window.DEKR_HALLS,
    get: function (id) {
      return window.DEKR_HALLS.filter(function (h) { return h.id === id; })[0] || null;
    },
    layout: function (id) {
      if (!cache[id]) {
        var h = this.get(id);
        cache[id] = h.grid ? buildGrid(h) : buildRaster(h);
      }
      return cache[id];
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
