// Erzeugt das MIPP-Lesezeichen (Bookmarklet). Es liest nur den Seitentext und schickt ihn per postMessage an das Dashboard.
(function () {
  'use strict';
  var base = location.origin + location.pathname.replace(/[^\/]*$/, '');
  // Läuft im Tab von MIPP, liest die Liste, macht das Kurzformat daraus und zeigt es in einem neuen Fenster zum Kopieren.
  // Es gibt keine Verbindung zum Dashboard. Das Programm darf keine Zeilenkommentare und keine Doppel-Schrägstriche enthalten (sie werden beim Erzeugen entfernt).
  var SRC = function () {
    var VER = '__VER__', OWN = ['6', '7'], FROM = ['3', '27'], w = null;
    try { w = window.open('', '_blank'); } catch (e0) { w = null; }
    var sel = String(window.getSelection ? getSelection() : ''), cands = [];
    function split(t, arr) { String(t).split(/\r?\n|\t/).forEach(function (x) { x = x.trim(); if (x) arr.push(x); }); }
    function flagCode(e) {
      var v = (e.getAttribute('alt') || e.getAttribute('title') || e.getAttribute('aria-label') || '').trim();
      if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
      var m = /(?:^|[\s_-])(?:flag|fi|flag-icon|country)[-_]([a-z]{2})(?:\s|$)/i.exec(String(e.getAttribute('class') || ''));
      return m ? m[1].toUpperCase() : '';
    }
    function cellLines(c, arr) {
      var t = String(c.innerText || c.textContent || '').trim(), flags = [];
      [].forEach.call(c.querySelectorAll('img,svg,span,i,div,[title],[aria-label]'), function (e) { var f = flagCode(e); if (f && t.indexOf(f) < 0 && flags.indexOf(f) < 0) flags.push(f); });
      flags.forEach(function (f) { arr.push(f); });
      split(t, arr);
    }
    function walk() {
      var arr = [], tw = document.createTreeWalker(document.body, 5, null, false), nd, pe, cs, al;
      while ((nd = tw.nextNode())) {
        if (nd.nodeType === 3) {
          pe = nd.parentElement;
          if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
          cs = getComputedStyle(pe);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          split(nd.nodeValue, arr);
        } else if (nd.tagName === 'IMG') {
          al = (nd.getAttribute('alt') || nd.getAttribute('title') || '').trim();
          if (al) arr.push(al);
        }
      }
      return arr;
    }
    if (sel.trim()) { var one = []; split(sel, one); cands.push(one); }
    else {
      var best = null, n = 0;
      [].forEach.call(document.querySelectorAll('table'), function (t) {
        var c = t.querySelectorAll('tr').length;
        if (c > n) { n = c; best = t; }
      });
      if (best) {
        var viaSel = [], viaCells = [];
        try {
          var g = window.getSelection(), rg = document.createRange();
          rg.selectNodeContents(best); g.removeAllRanges(); g.addRange(rg);
          split(String(g), viaSel); g.removeAllRanges();
        } catch (e) { viaSel = []; }
        [].forEach.call(best.querySelectorAll('tr'), function (r) { [].forEach.call(r.children, function (c) { cellLines(c, viaCells); }); });
        cands.push(viaCells, viaSel);
      } else { var body = []; split(document.body.innerText, body); cands.push(body); }
      var whole = [];
      try {
        var g2 = window.getSelection(), rg2 = document.createRange();
        rg2.selectNodeContents(document.body); g2.removeAllRanges(); g2.addRange(rg2);
        split(String(g2), whole); g2.removeAllRanges();
      } catch (e2) { whole = []; }
      cands.push(whole);
      try { cands.push(walk()); } catch (e5) { /* weitere Lesarten genügen */ }
    }
    if (!cands.some(function (x) { return x.length; })) { if (w) w.close(); alert('Nichts zum Übernehmen gefunden. Bitte die Auslieferliste öffnen.'); return; }
    function finish() {
    var DAYS = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 7 };
    function pad(x) { return (x < 10 ? '0' : '') + x; }
    function dateOf(y, kw, d) {
      var j = new Date(y, 0, 4), m = new Date(y, 0, 4 - ((j.getDay() || 7) - 1) + 7 * (kw - 1));
      m.setDate(m.getDate() + d - 1);
      return pad(m.getDate()) + '.' + pad(m.getMonth() + 1) + '.' + m.getFullYear();
    }
    function idx(arr, re, from) {
      for (var i = from || 0; i < arr.length; i++) if (re.test(arr[i])) return i;
      return -1;
    }
    function parse(lines) {
    var starts = [], j;
    for (j = 0; j + 3 < lines.length; j++) {
      if (/^\d+$/.test(lines[j]) && /^20\d\d$/.test(lines[j + 1]) && /^\d{1,2}$/.test(lines[j + 2]) && DAYS[lines[j + 3].toLowerCase()]) starts.push(j);
    }
    var dbg = '', dbgKr = '', out = ['KR;Datum;Halle;Position;Lieferumfang;Land'], seen = {}, other = 0, noScope = 0, noLand = 0, bad = 0, multi = 0;
    starts.forEach(function (s, i) {
      var rec = lines.slice(s, i + 1 < starts.length ? starts[i + 1] : lines.length);
      var t = idx(rec, /Uhr$/), seg = idx(rec, /^\d{5}$/, t + 1), krI = seg < 0 ? -1 : idx(rec, /^KR[0-9A-Z]+$/i, seg);
      if (t < 0 || seg < 0 || krI < 0) { bad++; return; }
      var a = t + 1;
      while (a < seg && !/^\d{1,2}(\.\d)?$/.test(rec[a])) a++;
      var R = rec.slice(a, seg), k = R.length % 3 === 0 ? R.length / 3 : 0;
      if (k > 1) multi++;
      var hall = (R[0] || '').split('.')[0], num = k ? R[k] : '', letter = k ? R[2 * k] : '';
      var c = idx(rec, /^[A-Za-z]{2}(?:$|[\s\-–:,(])/, krI + 1), sc = idx(rec, /^(komplett|maschine|schrumpftunnel)/i, c >= 0 ? c + 2 : krI + 1);
      var kr = rec[krI].toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^KR/, '');
      var low = sc >= 0 ? rec[sc].toLowerCase() : '', scope = /komplett/.test(low) ? 'komplett' : /schrumpf/.test(low) ? 'Schrumpftunnel' : /maschine/.test(low) ? 'Maschine' : '';
      var own = OWN.indexOf(hall) >= 0;
      if (!own && FROM.indexOf(hall) < 0) { other++; return; }
      if (!scope) { noScope++; return; }
      var key = kr + (scope === 'Schrumpftunnel' ? '~S' : '');
      if (seen[key]) return;
      var pos = own ? ((letter.toUpperCase().match(/[A-Z]/) || [''])[0] + (num.match(/\d+/) || [''])[0]) : '';
      if (pos.length < 2) pos = '';
      var dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(rec[4] || ''), date;
      if (dm) date = pad(+dm[1]) + '.' + pad(+dm[2]) + '.' + (+dm[3] < 100 ? 2000 + +dm[3] : dm[3]);
      else date = dateOf(+rec[1], +rec[2], DAYS[rec[3].toLowerCase()]);
      seen[key] = 1;
      var di = idx(rec, /^\d{1,2}\.\d{1,2}\.\d{4}$/, krI + 1), glued = di >= 0 && /^[A-Z]{2}(?=[A-Z][a-z]|\s|$)/.test(rec[di + 1] || '') ? rec[di + 1].slice(0, 2) : '';
      var land = rec.slice(krI + 1).some(function (x) { return /^(US|USA)$/i.test(x); }) ? 'US' : (c >= 0 ? rec[c].slice(0, 2).toUpperCase() : glued);
      out.push([kr, date, hall, pos, scope, land].join(';'));
      if (!land) { noLand++; if (!dbg) { dbg = rec.slice(krI, krI + 12).join(' | '); dbgKr = rec[krI]; } }
    });
    return { starts: starts, lines: lines, out: out, other: other, noScope: noScope, noLand: noLand, bad: bad, multi: multi, dbg: dbg, dbgKr: dbgKr, land: out.filter(function (x) { return /;[A-Z]{2}$/.test(x); }).length };
    }
    var res = null;
    cands.forEach(function (l) { var r = parse(l); if (!res || r.land > res.land || (r.land === res.land && r.out.length > res.out.length)) res = r; });
    var out = res.out, starts = res.starts, lines = res.lines, other = res.other, noScope = res.noScope, noLand = res.noLand, bad = res.bad, multi = res.multi, dbg = res.dbg, diag = '';
    if (res.dbgKr) {
      try {
        var hit = null;
        [].forEach.call(document.querySelectorAll('td,th,div,span,a,p'), function (e) { if (!hit && !e.children.length && e.textContent.trim() === res.dbgKr) hit = e; });
        if (hit) { var rowEl = hit.closest('tr') || hit.parentElement.parentElement; diag = rowEl.outerHTML.replace(/\s+/g, ' ').slice(0, 3500); }
      } catch (e6) { diag = ''; }
    }
    var count = out.length - 1, text = starts.length ? out.join('\n') : lines.join('\n');
    var info = !starts.length ? 'Format nicht erkannt: es folgt der gelesene Rohtext (' + lines.length + ' Zellen).' :
      count + ' KR im Kurzformat · ' + other + ' andere Halle ausgeblendet · ' + noScope + ' ohne Lieferumfang ausgeblendet' + (noLand ? ' · ' + noLand + ' ohne erkannten Ländercode (Zellen nach der KR: ' + dbg + ')' : '') + (bad ? ' · ' + bad + ' Einträge nicht lesbar' : '') + (multi ? ' · ' + multi + ' mit mehreren Spots (erster)' : '');
    function show(d, root, closer) {
      function el(tag, css, txt) { var e = d.createElement(tag); e.style.cssText = css || ''; if (txt) e.textContent = txt; root.appendChild(e); return e; }
      var BTN = 'font:700 13px monospace;letter-spacing:.1em;text-transform:uppercase;padding:10px 18px;border:1px solid #fcee09;background:#fcee09;color:#000;cursor:pointer;margin:0 8px 8px 0';
      el('h1', 'font:900 18px monospace;letter-spacing:.12em;color:#fcee09;margin:0 0 12px', 'DEUKRO26 · LISTE AUS MIPP · v' + VER);
      el('div', 'color:#00f0ff;margin-bottom:12px;font-size:13px', info);
      var ta = el('textarea', 'width:100%;box-sizing:border-box;height:55vh;background:#0b0e16;color:#e8f9ff;border:1px solid #3a3d18;padding:10px;font:13px monospace');
      ta.value = text; ta.readOnly = true;
      var bar = el('div', 'margin-top:12px');
      var msg = d.createElement('span');
      msg.style.cssText = 'color:#2dffb3;font-size:13px';
      var b = d.createElement('button');
      b.style.cssText = BTN; b.textContent = 'Alles kopieren';
      bar.appendChild(b);
      var rb = d.createElement('button');
      rb.style.cssText = BTN.replace('#fcee09;background:#fcee09;color:#000', '#3a3d18;background:#0b0e16;color:#e8f9ff'); rb.textContent = 'Rohtext kopieren';
      rb.addEventListener('click', function () {
        var hid = d.createElement('textarea');
        hid.value = lines.join('\n'); hid.style.cssText = 'position:fixed;left:-9999px;top:0';
        d.body.appendChild(hid); hid.select();
        var ok2 = false;
        try { ok2 = d.execCommand('copy'); } catch (e3) { ok2 = false; }
        hid.remove();
        msg.textContent = ok2 ? 'Rohtext kopiert (Notlösung: im Dashboard-Import einfügen).' : 'Rohtext konnte nicht kopiert werden.';
      });
      bar.appendChild(rb);
      if (closer) { var x = d.createElement('button'); x.style.cssText = BTN.replace('#fcee09;background:#fcee09;color:#000', '#3a3d18;background:#0b0e16;color:#e8f9ff'); x.textContent = 'Schließen'; x.addEventListener('click', closer); bar.appendChild(x); }
      bar.appendChild(msg);
      function copy() {
        ta.focus(); ta.select();
        var ok = false;
        try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
        if (!ok) { try { (d.defaultView || window).navigator.clipboard.writeText(text); ok = true; } catch (e2) { ok = false; } }
        msg.textContent = ok ? 'Kopiert. Im Dashboard unter Import einfügen.' : 'Bitte mit Strg+C kopieren (Text ist markiert).';
      }
      b.addEventListener('click', copy);
      if (diag) {
        el('div', 'color:#ff9a3d;font-size:12px;margin-top:16px', 'Ländercode nicht erkannt. Diagnose: HTML der ersten Zeile ohne Land (bitte an Claude schicken, enthält Daten dieser einen Zeile):');
        var dt = el('textarea', 'width:100%;box-sizing:border-box;height:90px;background:#0b0e16;color:#e8f9ff;border:1px solid #3a3d18;padding:8px;font:11px monospace');
        dt.value = diag; dt.readOnly = true;
      }
      el('div', 'color:#7a8a96;font-size:12px;margin-top:8px', 'Im Dashboard: Import öffnen, einfügen (Strg+V) oder „Aus Zwischenablage einlesen“ klicken.');
      ta.focus(); ta.select();
    }
    if (w && w.document) {
      w.document.title = 'DEUKRO26 · Liste';
      w.document.body.style.cssText = 'margin:0;padding:20px;background:#05060b;color:#e8f9ff;font-family:monospace';
      show(w.document, w.document.body, null);
    } else {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;overflow:auto;padding:20px;background:#05060b;color:#e8f9ff;font-family:monospace';
      document.body.appendChild(ov);
      show(document, ov, function () { ov.remove(); });
    }
    }
    var fin = false;
    function go(extra) {
      if (fin) return;
      fin = true;
      if (extra && extra.trim()) { var x = []; split(extra, x); cands.push(x); }
      finish();
    }
    if (sel.trim()) go('');
    else {
      try {
        var g3 = window.getSelection(), rg3 = document.createRange();
        rg3.selectNodeContents(document.body); g3.removeAllRanges(); g3.addRange(rg3);
        var okc = document.execCommand('copy');
        g3.removeAllRanges();
        if (okc && navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(go, function () { go(''); });
          setTimeout(function () { go(''); }, 4000);
        } else go('');
      } catch (e4) { go(''); }
    }
  };
  // Kommentare und Einrückung entfernen (vor dem Einsetzen der Adresse, sie enthält „//")
  var body = SRC.toString().replace(/\/\/[^\n]*\n/g, '\n').replace(/\s*\n\s*/g, ' ');
  var ver = (window.DEKR_VERSION && window.DEKR_VERSION.n) || '?';
  document.getElementById('bmVer').textContent = 'v' + ver;
  var code = '(' + body.replace('__BASE__', base).replace('__VER__', ver) + ')()';
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
