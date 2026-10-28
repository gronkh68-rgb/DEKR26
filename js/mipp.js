// Erzeugt das MIPP-Lesezeichen (Bookmarklet). Es liest nur den Seitentext und schickt ihn per postMessage an das Dashboard.
(function () {
  'use strict';
  var base = location.origin + location.pathname.replace(/[^\/]*$/, '');
  // Läuft im Tab von MIPP. Ziel-Adresse wird beim Erzeugen eingesetzt.
  var SRC = function () {
    var D = '__BASE__', lines = [], sel = String(window.getSelection ? getSelection() : '');
    function add(t) { String(t).split(/\r?\n|\t/).forEach(function (x) { x = x.trim(); if (x) lines.push(x); }); }
    if (sel.trim()) add(sel);
    else {
      var best = null, n = 0;
      [].forEach.call(document.querySelectorAll('table'), function (t) {
        var c = t.querySelectorAll('tr').length;
        if (c > n) { n = c; best = t; }
      });
      if (best) [].forEach.call(best.querySelectorAll('tr'), function (r) {
        [].forEach.call(r.children, function (c) { add(c.innerText || c.textContent); });
      });
      else add(document.body.innerText);
    }
    if (!lines.length) { alert('Nichts zum Übernehmen gefunden. Bitte die Auslieferliste öffnen.'); return; }
    var text = lines.join('\n'), sent = false;
    var w = window.open(D + 'index.html?mipp=' + Date.now());
    function copy() {
      try { navigator.clipboard.writeText(text).then(function () { alert(lines.length + ' Zellen kopiert. Im Dashboard unter Import mit Strg+V einfügen.'); }); } catch (e) { prompt('Zum Kopieren Strg+C drücken:', text.slice(0, 1000)); }
    }
    function h(e) {
      if (!w || e.source !== w || !e.data || e.data.t !== 'dekr-ready') return;
      sent = true; window.removeEventListener('message', h);
      w.postMessage({ t: 'dekr-mipp', text: text }, new URL(D).origin);
    }
    window.addEventListener('message', h);
    setTimeout(function () { if (!sent) { window.removeEventListener('message', h); copy(); } }, 12000);
  };
  // Kommentare und Einrückung entfernen (vor dem Einsetzen der Adresse, sie enthält „//")
  var body = SRC.toString().replace(/\/\/[^\n]*\n/g, '\n').replace(/\s*\n\s*/g, ' ');
  var code = '(' + body.replace('__BASE__', base) + ')()';
  var url = 'javascript:' + encodeURIComponent(code);
  document.getElementById('bm').setAttribute('href', url);
  document.getElementById('bmCode').value = url;
  document.getElementById('copyBm').onclick = function () {
    var info = document.getElementById('copyInfo');
    try {
      navigator.clipboard.writeText(url).then(function () { info.textContent = 'Kopiert.'; }, function () { info.textContent = 'Bitte Code im Feld markieren und kopieren.'; });
    } catch (e) { info.textContent = 'Bitte Code im Feld markieren und kopieren.'; }
  };
  document.getElementById('bm').onclick = function (e) { e.preventDefault(); alert('Diesen Knopf in die Lesezeichenleiste ziehen, nicht hier klicken.'); };
})();
