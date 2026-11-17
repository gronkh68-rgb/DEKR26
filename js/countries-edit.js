// Admin: Länder, Punktfarben und Namen bearbeiten. Gespeichert unter settings/countries = { map: { CODE: { n: Name, z: blue|yellow|red|none } }, col: { blue, yellow, red } }.
// Nur der Admin darf schreiben (Datenbank-Regeln); alle Geräte lesen die Änderungen mit.
window.CtyEdit = (function () {
  'use strict';
  var esc = Util.esc, C = window.Countries, filter = '', onlyChanged = false;
  var ZN = { '': 'Standard', blue: 'Blau', yellow: 'Gelb', red: 'Rot', none: 'Kein Punkt' };
  function cfg() {
    var c = (Store.get().settings || {}).countries;
    return { map: Object.assign({}, c && c.map), col: Object.assign({}, c && c.col) };
  }
  function save(n) {
    Object.keys(n.map).forEach(function (k) { var o = n.map[k]; if (!o || (!o.n && !o.z)) delete n.map[k]; });
    Object.keys(n.col).forEach(function (k) { if (!n.col[k]) delete n.col[k]; });
    var empty = !Object.keys(n.map).length && !Object.keys(n.col).length;
    return Store.setSetting('countries', empty ? null : n);
  }
  function zoneOpts(sel, code) {
    var d = code ? C.defZone(code) : '';
    return ['', 'blue', 'yellow', 'red', 'none'].map(function (z) {
      return '<option value="' + z + '"' + (z === sel ? ' selected' : '') + '>' + esc(z === '' ? 'Standard' + (d ? ' (' + ZN[d] + ')' : ' (kein Punkt)') : ZN[z]) + '</option>';
    }).join('');
  }
  function listHtml() {
    var c = cfg(), codes = C.known().concat(Object.keys(c.map).filter(function (k) { return C.known().indexOf(k) < 0; }));
    var q = filter.toLowerCase();
    codes = codes.filter(function (k) {
      if (onlyChanged && !c.map[k]) return false;
      return !q || k.toLowerCase().indexOf(q) >= 0 || C.name(k).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return C.name(a).localeCompare(C.name(b), 'de'); });
    var MAX = 120, shown = codes.slice(0, MAX);
    return shown.map(function (k) {
      var o = c.map[k] || {}, z = C.zone(k);
      return '<div class="cty-row" data-c="' + esc(k) + '"><b>' + (z ? '<i class="dot ' + z + '"></i> ' : '') + esc(k) + '</b>' +
        '<input data-n value="' + esc(o.n || C.name(k)) + '" maxlength="40" aria-label="Name ' + esc(k) + '">' +
        '<select data-z aria-label="Punkt ' + esc(k) + '">' + zoneOpts(o.z || '', k) + '</select>' +
        '<button type="button" class="btn-sm" data-reset title="Auf Standard zurücksetzen"' + (c.map[k] ? '' : ' disabled') + '>↺</button></div>';
    }).join('') + (codes.length > MAX ? '<div class="empty">… und ' + (codes.length - MAX) + ' weitere, bitte suchen.</div>' : '') + (codes.length ? '' : '<div class="empty">Kein Land gefunden.</div>');
  }
  function colorsHtml() {
    var c = cfg();
    return ['blue', 'yellow', 'red'].map(function (z) {
      return '<label>' + esc(ZN[z]) + ' (' + esc(C.ZONE[z]) + ') <input type="color" data-col="' + z + '" value="' + esc(c.col[z] || C.DEFCOL[z]) + '"></label>';
    }).join('');
  }
  function refresh(root) {
    var list = root.querySelector('.cty-list'), cols = root.querySelector('.cty-cols');
    if (!list) return;
    if (root.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) return;   // Eingabe nicht unterbrechen
    list.innerHTML = listHtml();
    cols.innerHTML = colorsHtml();
  }
  function mount(root) {
    if (!root) return;
    if (!root.querySelector('.cty-list')) {
      root.innerHTML = '<div class="empty">Punkt je Land: Blau (Sonderziel) hat Vorrang vor Gelb (Europa oder Landweg), Rot ist Seefracht. Name und Farbe lassen sich ändern, neue Länder hinzufügen.</div>' +
        '<div class="cty-cols"></div><div class="qr-add"><input class="cty-filter" placeholder="Land oder Code suchen …" autocomplete="off" style="flex:1">' +
        '<label class="chk" style="padding:0"><input type="checkbox" class="cty-only"> nur geänderte</label></div>' +
        '<div class="cty-list"></div>' +
        '<form class="cty-add qr-add"><input data-ac placeholder="Code (z. B. RB)" maxlength="3" size="6" autocomplete="off" required><input data-an placeholder="Name" maxlength="40" autocomplete="off" required>' +
        '<select data-az>' + zoneOpts('red', '') + '</select><button class="btn-sm">Hinzufügen</button></form>' +
        '<div class="qr-add"><button type="button" class="btn-sm btn-warn cty-colreset">Farben zurücksetzen</button></div>';
      bind(root);
    }
    root.querySelector('.cty-filter').value = filter; root.querySelector('.cty-only').checked = onlyChanged;
    var a = document.activeElement; if (a && root.contains(a)) a.blur();
    refresh(root);
  }
  function bind(root) {
    var err = function () { if (window.toast) window.toast('Speichern fehlgeschlagen'); };
    root.addEventListener('input', function (e) {
      if (e.target.classList.contains('cty-filter')) { filter = e.target.value.trim(); root.querySelector('.cty-list').innerHTML = listHtml(); }
    });
    root.addEventListener('change', function (e) {
      var t = e.target, row = t.closest('.cty-row'), n;
      if (t.classList.contains('cty-only')) { onlyChanged = t.checked; root.querySelector('.cty-list').innerHTML = listHtml(); return; }
      if (t.dataset.col) { n = cfg(); n.col[t.dataset.col] = t.value; save(n).catch(err); return; }
      if (!row) return;
      var k = row.dataset.c;
      n = cfg();
      var o = Object.assign({}, n.map[k]);
      if (t.matches('input[data-n]')) { var v = t.value.trim(); if (v && v !== C.defName(k)) o.n = v; else delete o.n; }
      if (t.matches('select[data-z]')) { if (t.value) o.z = t.value; else delete o.z; }
      n.map[k] = o;
      save(n).then(function () { root.querySelector('.cty-list').innerHTML = listHtml(); }).catch(err);
    });
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      var n = cfg();
      if (t.hasAttribute('data-reset')) { delete n.map[t.closest('.cty-row').dataset.c]; save(n).then(function () { root.querySelector('.cty-list').innerHTML = listHtml(); }).catch(err); }
      else if (t.classList.contains('cty-colreset')) { n.col = {}; save(n).catch(err); }
    });
    root.addEventListener('submit', function (e) {
      if (!e.target.classList.contains('cty-add')) return;
      e.preventDefault();
      var f = e.target, k = f.querySelector('[data-ac]').value.trim().toUpperCase(), nm = f.querySelector('[data-an]').value.trim();
      if (!/^[A-Z]{2,3}$/.test(k) || !nm) return;
      var n = cfg(), o = { n: nm }, z = f.querySelector('[data-az]').value;
      if (z) o.z = z;
      n.map[k] = o;
      save(n).then(function () { f.reset(); filter = ''; root.querySelector('.cty-filter').value = ''; root.querySelector('.cty-list').innerHTML = listHtml(); }).catch(err);
    });
  }
  return { mount: mount, refresh: refresh };
})();
