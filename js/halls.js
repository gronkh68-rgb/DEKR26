// Hallen-Definition. Platzhalter-Raster, bis die echten Grundrisse eingepflegt sind.
//
// Variante A (Raster): rows = Zeilenbuchstaben, cols = Anzahl Spalten -> Positionen A1..A<cols> usw.
// Variante B (Grundriss): image = 'img/halle1.png', width/height = Bildgröße in px und
//   positions = [{ id: 'A14', x: 120, y: 40, w: 30, h: 30 }, ...] (Koordinaten im Bild).
window.DEKR_HALLS = [
  { id: 'H1', name: 'HALLE 1', rows: 'ABCDEFGHIJKL', cols: 24 },
  { id: 'H2', name: 'HALLE 2', rows: 'MNOPQRSTUVWX', cols: 36 }
];

window.Halls = (function () {
  var CELL = 30, GAP = 3, PAD = 26;
  var cache = {};

  function build(h) {
    if (h.positions) {
      return { w: h.width, h: h.height, image: h.image || null, positions: h.positions, labels: [] };
    }
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
      w: PAD * 2 + h.cols * (CELL + GAP), h: PAD * 2 + h.rows.length * (CELL + GAP),
      image: null, positions: positions, labels: labels
    };
  }

  return {
    all: window.DEKR_HALLS,
    get: function (id) {
      return window.DEKR_HALLS.filter(function (h) { return h.id === id; })[0] || null;
    },
    layout: function (id) {
      if (!cache[id]) cache[id] = build(this.get(id));
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
