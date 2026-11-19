// Erzeugt das MIPP-Lesezeichen (Bookmarklet). Es liest nur den Seitentext und schickt ihn per postMessage an das Dashboard.
(function () {
  'use strict';
  var base = location.origin + location.pathname.replace(/[^\/]*$/, '');
  // Läuft im Tab von MIPP, liest die Liste, macht das Kurzformat daraus und zeigt es in einem neuen Fenster zum Kopieren.
  // Es gibt keine Verbindung zum Dashboard. Das Programm darf keine Zeilenkommentare und keine Doppel-Schrägstriche enthalten (sie werden beim Erzeugen entfernt).
  var SRC = function () {
    var VER = '__VER__', CFG = __CFG__, OWN = ['6', '7'], FROM = CFG && !CFG.h27 ? ['3'] : ['3', '27'], w = null, HL = !!window.__dekrHeadless, tried = HL;
    function result(ok, txt) { window.__dekrResult = (ok ? 'OK ' : 'FEHLER ') + txt; }
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
    function walk(doc) {
      var d0 = doc || document, vw = d0.defaultView || window, arr = [], tw = d0.createTreeWalker(d0.body, 5, null, false), nd, pe, cs, al;
      while ((nd = tw.nextNode())) {
        if (nd.nodeType === 3) {
          pe = nd.parentElement;
          if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
          cs = vw.getComputedStyle(pe);
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
    if (!cands.some(function (x) { return x.length; })) { if (HL) { result(false, 'Seite leer gelesen'); return; } if (w) w.close(); alert('Nichts zum Übernehmen gefunden. Bitte die Auslieferliste öffnen.'); return; }
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
    function toast(txt, bad) {
      var t = document.createElement('div');
      t.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;padding:12px 18px;background:#05060b;color:' + (bad ? '#ff2a55' : '#2dffb3') + ';border:2px solid ' + (bad ? '#ff2a55' : '#2dffb3') + ';font:700 14px monospace;letter-spacing:.06em;box-shadow:0 0 16px rgba(0,0,0,.6)';
      t.textContent = txt;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1600);
    }
    var SD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    function isoWeek(d) {
      var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      var y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
      return y + '-W' + pad(wk);
    }
    function mondayOf(key) {
      var m = /^(\d{4})-W(\d{2})$/.exec(key), j4 = new Date(+m[1], 0, 4);
      return new Date(+m[1], 0, 4 - ((j4.getDay() || 7) - 1) + 7 * (+m[2] - 1));
    }
    function dayText(wk, d) {
      var m = mondayOf(wk);
      m.setDate(m.getDate() + d - 1);
      return SD[d] + ' ' + pad(m.getDate()) + '.' + pad(m.getMonth() + 1) + '. (KW ' + wk.split('-W')[1] + ')';
    }
    function label(hallId, pos) {
      if (!pos) return '–';
      var m = /^([A-Z])(\d+)$/.exec(pos);
      return (CFG.rev[hallId] ? CFG.rev[hallId] + ' ' : '') + (m ? m[2] + ' ' + m[1] : pos);
    }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function plan(rows, tasks) {
      var now = Date.now(), t0 = new Date(), today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()), ops = {}, st = { neu: 0, moved: 0, chg: 0, same: 0, past: 0 }, by = {}, lines = [];
      Object.keys(tasks).forEach(function (id) {
        var t = tasks[id];
        if (!t || !t.kr) return;
        var k = t.kr + (t.scope === 'Schrumpftunnel' ? '~S' : '');
        (by[k] = by[k] || []).push({ id: id, t: t });
      });
      rows.forEach(function (r) {
        var dm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(r[1]);
        if (!dm) return;
        var d = new Date(+dm[3], +dm[2] - 1, +dm[1]), wd = d.getDay(), day = wd >= 1 && wd <= 5 ? wd : 5, week = isoWeek(d);
        var kr = r[0], pos = r[3], scope = r[4], land = r[5], from = CFG.hall[r[2]] ? '' : r[2], usa = land === 'US', shr = scope === 'Schrumpftunnel';
        var hall = pos && !from ? CFG.hall[r[2]] || '' : '', ex = by[kr + (shr ? '~S' : '')], e = ex && ex[0] ? ex[0].t : null, how = 'neu', chg = '', movedFrom = '';
        if (e) {
          var mv = e.week !== week || e.day !== day, ch = [];
          if (mv) { chg = 'von ' + dayText(e.week, e.day) + ' nach ' + dayText(week, day); movedFrom = SD[e.day] + ' ' + dayText(e.week, e.day).slice(3, 9) + (e.week !== week ? ' (KW ' + e.week.split('-W')[1] + ')' : ''); }
          if ((e.pos || '') !== (pos || '') || (e.pos && (e.hall || '') !== hall)) ch.push('Position ' + label(e.hall, e.pos) + ' → ' + label(hall, pos));
          if ((e.scope || '') !== (scope || '')) ch.push('Lieferumfang ' + (e.scope || '–') + ' → ' + (scope || '–'));
          if (!!e.usa !== usa) ch.push(usa ? 'jetzt USA' : 'nicht mehr USA');
          chg = [chg].concat(ch).filter(Boolean).join('; ');
          how = mv ? 'verschoben' : ch.length ? 'geändert' : 'gleich';
        }
        if (d < today && (how === 'neu' || how === 'gleich')) { st.past++; return; }
        st[how === 'neu' ? 'neu' : how === 'verschoben' ? 'moved' : how === 'geändert' ? 'chg' : 'same']++;
        if (how === 'neu') lines.push('KR ' + kr + ' neu (' + dayText(week, day) + (pos ? ', ' + label(hall, pos) : from ? ', aus Halle ' + from : '') + ')');
        else if (how === 'verschoben' || how === 'geändert') lines.push('KR ' + kr + ' ' + how + ': ' + chg);
        var id = [week, kr.replace(/[^A-Za-z0-9_-]/g, '_'), hall || '0', pos || '0'].join('_') + (shr ? '_S' : ''), cur = tasks[id];
        var t = { week: week, kr: kr, day: day, hall: hall, pos: pos, done: cur ? !!cur.done : !!(ex && ex.some(function (x) { return x.t.done; })) };
        if (scope) t.scope = scope;
        if (usa) t.usa = true;
        if (land) t.country = land;
        if (from) t.from = from;
        t.impAt = now;
        if (how === 'verschoben' || how === 'geändert') { t.chg = chg; t.chgK = how; t.chgAt = now; if (movedFrom) t.movedFrom = movedFrom; }
        else if (e && e.chg) { t.chg = e.chg; t.chgK = e.chgK; t.chgAt = e.chgAt; if (e.movedFrom) t.movedFrom = e.movedFrom; }
        var src = cur || e;
        if (src && src.k2) t.k2 = src.k2;
        if (src && src.k5) t.k5 = src.k5;
        if (src && src.closed) { t.done = true; t.closed = true; t.closedAt = src.closedAt; t.closedBy = src.closedBy; }
        if (ex) ex.forEach(function (x) { if (x.id !== id) ops['tasks/' + x.id] = null; });
        ops['tasks/' + id] = t;
      });
      // Meldung im Dashboard-Nachrichtenstrom (Toast samt Ton), nur wenn sich wirklich etwas geändert hat, mit Details je KR
      if (st.neu + st.moved + st.chg > 0) {
        var MAXL = 8, detail = lines.slice(0, MAXL).join(' · ') + (lines.length > MAXL ? ' · und ' + (lines.length - MAXL) + ' weitere' : '');
        ops['msgs/' + uid()] = { type: 'import', by: CFG.name || 'MIPP-Import', text: 'MIPP-Import: ' + st.neu + ' neu, ' + st.moved + ' verschoben, ' + st.chg + ' geändert · ' + detail, t: now };
      }
      return { ops: ops, st: st };
    }
    function importDirect(rows) {
      var tok = '';
      return fetch('https:' + '/' + '/securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(CFG.key), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(CFG.refresh) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || 'Anmeldung HTTP ' + r.status); return j.id_token || j.idToken; }); })
        .then(function (t) { tok = t; return fetch(CFG.db + '/tasks.json?auth=' + encodeURIComponent(tok)); })
        .then(function (r) { if (!r.ok) throw new Error('Lesen HTTP ' + r.status); return r.json(); })
        .then(function (tasks) {
          var p = plan(rows, tasks || {});
          if (!Object.keys(p.ops).length) return p;
          return fetch(CFG.db + '/.json?auth=' + encodeURIComponent(tok), { method: 'PATCH', body: JSON.stringify(p.ops) }).then(function (r) { if (!r.ok) throw new Error('Schreiben HTTP ' + r.status); return p; });
        });
    }
    function pick(cs) {
      var best = null;
      cs.forEach(function (l) { var r = parse(l); if (!best || r.land > best.land || (r.land === best.land && r.out.length > best.out.length)) best = r; });
      return best;
    }
    function gatherDoc(doc) {
      var cs = [], bestT = null, nn = 0, cells = [];
      [].forEach.call(doc.querySelectorAll('table'), function (t) { var c = t.querySelectorAll('tr').length; if (c > nn) { nn = c; bestT = t; } });
      if (bestT) { [].forEach.call(bestT.querySelectorAll('tr'), function (r) { [].forEach.call(r.children, function (c) { cellLines(c, cells); }); }); cs.push(cells); }
      try { cs.push(walk(doc)); } catch (e8) { /* weitere Lesart genügt */ }
      return cs;
    }
    function startAuto() {
      if (!CFG) return;
      if (window.__dekrAuto) {
        window.__dekrAuto.next = Date.now() + window.__dekrAuto.mins * 60000;
        if (window.__dekrAuto.box && !window.__dekrAuto.box.isConnected) document.body.appendChild(window.__dekrAuto.box);
        return;
      }
      var A = { mins: 60, next: 0, on: true, busy: false, last: 'noch kein automatischer Import', frame: null };
      try { var sm = +localStorage.getItem('dekr26_auto_mins'); if (sm === 15 || sm === 30 || sm === 60) A.mins = sm; } catch (e11) { /* Vorgabe 60 */ }
      var guard = function (ev) { ev.preventDefault(); ev.returnValue = ''; return ''; };
      window.addEventListener('beforeunload', guard);
      window.__dekrAuto = A;
      A.next = Date.now() + A.mins * 60000;
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:16px;top:70px;z-index:2147483646;width:260px;padding:10px 12px;background:#05060b;color:#e8f9ff;border:1px solid #fcee09;font:12px monospace;box-shadow:0 0 14px rgba(0,0,0,.6)';
      var head = document.createElement('div');
      head.style.cssText = 'font:900 12px monospace;letter-spacing:.1em;color:#fcee09;margin-bottom:6px';
      head.textContent = 'DEUKRO26 · AUTO-IMPORT v' + VER;
      var stat = document.createElement('div'), last = document.createElement('div');
      last.style.cssText = 'color:#7a8a96;margin:4px 0 8px';
      var row = document.createElement('div'), sel2 = document.createElement('select');
      [15, 30, 60].forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = 'alle ' + m + ' Min'; if (m === A.mins) o.selected = true; sel2.appendChild(o); });
      var BT = 'font:700 11px monospace;padding:4px 8px;margin:4px 4px 0 0;border:1px solid #3a3d18;background:#0b0e16;color:#e8f9ff;cursor:pointer';
      function mk(txt, fn) { var b = document.createElement('button'); b.style.cssText = BT; b.textContent = txt; b.addEventListener('click', fn); row.appendChild(b); return b; }
      sel2.style.cssText = 'font:11px monospace;background:#0b0e16;color:#e8f9ff;border:1px solid #3a3d18;margin-right:4px';
      row.appendChild(sel2);
      var bNow = mk('Jetzt', function () { runAuto(); });
      var bPause = mk('Pause', function () { A.on = !A.on; bPause.textContent = A.on ? 'Pause' : 'Weiter'; if (A.on) A.next = Date.now() + A.mins * 60000; draw(); });
      mk('Beenden', function () { clearInterval(tm); if (A.frame) { A.frame.remove(); } box.remove(); window.removeEventListener('beforeunload', guard); delete window.__dekrAuto; });
      sel2.addEventListener('change', function () { A.mins = +sel2.value; try { localStorage.setItem('dekr26_auto_mins', String(A.mins)); } catch (e12) { /* ignorieren */ } A.next = Date.now() + A.mins * 60000; draw(); });
      box.appendChild(head); box.appendChild(stat); box.appendChild(last); box.appendChild(row);
      document.body.appendChild(box);
      A.box = box;
      function draw() {
        var left = Math.max(0, Math.round((A.next - Date.now()) / 1000));
        stat.textContent = A.busy ? 'Lädt MIPP neu und liest …' : A.on ? 'Nächster Import in ' + pad(Math.floor(left / 60)) + ':' + pad(left % 60) : 'Pausiert';
        last.textContent = A.last;
      }
      function done(txt) {
        A.busy = false; A.last = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + ' ' + txt;
        A.next = Date.now() + A.mins * 60000;
        if (A.frame) { A.frame.remove(); A.frame = null; }
        draw();
      }
      function runAuto() {
        if (A.busy) return;
        A.busy = true; draw();
        var fr = document.createElement('iframe'), fin2 = false;
        fr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1500px;height:1000px;border:0';
        A.frame = fr;
        function work() {
          if (fin2) return;
          fin2 = true;
          try {
            var res = pick(gatherDoc(fr.contentDocument));
            if (!res || res.out.length < 2) { done('✖ keine Liste gefunden (Seite offen und angemeldet?)'); return; }
            importDirect(res.out.slice(1).map(function (l) { return l.split(';'); })).then(function (p) {
              done('✔ ' + p.st.neu + ' neu, ' + p.st.moved + ' verschoben, ' + p.st.chg + ' geändert');
            }, function (er) { done('✖ ' + String((er && er.message) || er)); });
          } catch (e9) { done('✖ ' + String((e9 && e9.message) || e9)); }
        }
        fr.addEventListener('load', function () { setTimeout(work, 10000); });
        setTimeout(function () { if (!fin2) { fin2 = true; done('✖ Zeitüberschreitung beim Laden'); } }, 120000);
        fr.src = location.href;
        document.body.appendChild(fr);
      }
      var tm = setInterval(function () { if (!box.isConnected) document.body.appendChild(box); if (A.on && !A.busy && Date.now() >= A.next) runAuto(); draw(); }, 1000);
      draw();
    }
    function finish() {
    var res = null;
    cands.forEach(function (l) { var r = parse(l); if (!res || r.land > res.land || (r.land === res.land && r.out.length > res.out.length)) res = r; });
    if (res.noLand > 0 && !tried && !sel.trim() && navigator.clipboard && navigator.clipboard.readText) {
      tried = true;
      try {
        var g3 = window.getSelection(), rg3 = document.createRange();
        rg3.selectNodeContents(document.body); g3.removeAllRanges(); g3.addRange(rg3);
        var okc = document.execCommand('copy'), again = false;
        g3.removeAllRanges();
        if (okc) {
          var redo = function (t) { if (again) return; again = true; if (t && t.trim()) { var xx = []; split(t, xx); cands.push(xx); } finish(); };
          navigator.clipboard.readText().then(redo, function () { redo(''); });
          setTimeout(function () { redo(''); }, 2500);
          return;
        }
      } catch (e4) { /* weiter ohne Zwischenablage */ }
    }
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
      function copy(auto) {
        ta.focus(); ta.select();
        var ok = false;
        try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
        if (ok) { msg.textContent = (auto ? 'Automatisch kopiert. ' : 'Kopiert. ') + 'Jetzt das Dashboard öffnen, die Liste erscheint dort mit den Änderungen.'; return; }
        try {
          (d.defaultView || window).navigator.clipboard.writeText(text).then(function () { msg.textContent = (auto ? 'Automatisch kopiert. ' : 'Kopiert. ') + 'Jetzt das Dashboard öffnen, die Liste erscheint dort mit den Änderungen.'; }, function () { msg.textContent = 'Bitte „Alles kopieren“ klicken oder mit Strg+C kopieren (Text ist markiert).'; });
        } catch (e2) { msg.textContent = 'Bitte „Alles kopieren“ klicken oder mit Strg+C kopieren (Text ist markiert).'; }
      }
      b.addEventListener('click', function () { copy(false); });
      if (diag) {
        el('div', 'color:#ff9a3d;font-size:12px;margin-top:16px', 'Ländercode nicht erkannt. Diagnose: HTML der ersten Zeile ohne Land (bitte an Claude schicken, enthält Daten dieser einen Zeile):');
        var dt = el('textarea', 'width:100%;box-sizing:border-box;height:90px;background:#0b0e16;color:#e8f9ff;border:1px solid #3a3d18;padding:8px;font:11px monospace');
        dt.value = diag; dt.readOnly = true;
      }
      el('div', 'color:#7a8a96;font-size:12px;margin-top:8px', 'Danach das Dashboard öffnen (egal in welchem Browser): Das Fenster mit den Änderungen erscheint dort von selbst. Sonst im Import einfügen (Strg+V).');
      copy(true);
    }
    function fallback(er) {
      if (HL) { result(false, er || ('Keine Liste gefunden (angemeldet?) · ' + info)); return; }
      if (er) info = 'Direkter Import nicht möglich (' + er + '). ' + info;
      try { w = window.open('', '_blank'); } catch (e7) { w = null; }
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
    if (CFG && starts.length && count) {
      importDirect(out.slice(1).map(function (l) { return l.split(';'); })).then(function (p) {
        var s2 = p.st;
        if (HL) { result(true, s2.neu + ' neu, ' + s2.moved + ' verschoben, ' + s2.chg + ' geändert, ' + s2.same + ' unverändert, ' + s2.past + ' Vergangenes übersprungen'); return; }
        toast('✔ MIPP importiert: ' + s2.neu + ' neu, ' + s2.moved + ' verschoben, ' + s2.chg + ' geändert' + (s2.past ? ' (' + s2.past + ' Vergangenes übersprungen)' : '') + ' · v' + VER, false);
        try { startAuto(); } catch (e10) { toast('Auto-Import-Fenster Fehler: ' + String((e10 && e10.message) || e10), true); }
      }, function (er) { fallback(String((er && er.message) || er)); });
    } else fallback('');
    }
    finish();
  };
  // Kommentare und Einrückung entfernen (vor dem Einsetzen der Adresse, sie enthält „//")
  var body = SRC.toString().replace(/\/\/[^\n]*\n/g, '\n').replace(/\s*\n\s*/g, ' ');
  var ver = (window.DEKR_VERSION && window.DEKR_VERSION.n) || '?';
  document.getElementById('bmVer').textContent = 'v' + ver;
  // Zugang: das Lesezeichen enthält den Geräte-Zugang dessen, der es hier erzeugt (angemeldet in diesem Browser). Damit schreibt es die Liste direkt in die Datenbank.
  var A = {}, C = window.DEKR_CONFIG || {}, hallMap = {}, hallRev = {};
  try { A = JSON.parse(localStorage.getItem('dekr26_auth')) || {}; } catch (e) { A = {}; }
  (window.DEKR_HALLS || []).forEach(function (h) { hallMap[h.short] = h.id; hallRev[h.id] = h.short; });
  var haveAuth = !!(A.refresh && C.authApiKey && C.firebaseUrl);
  function perm27() {
    if (!haveAuth) return Promise.resolve(false);
    if (A.admin) return Promise.resolve(true);
    var id = ''; try { id = (JSON.parse(localStorage.getItem('dekr26_account')) || {}).id || ''; } catch (e) { id = ''; }
    if (!id) return Promise.resolve(false);
    return Auth.token().then(function (t) { return fetch(C.firebaseUrl + '/qrs/' + encodeURIComponent(id) + '/perms.json?auth=' + encodeURIComponent(t)); })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (p) { return !!(p && p.hall27); }).catch(function () { return false; });
  }
  var url = '', hlCode = '';
  function build(h27) {
    var cfg = haveAuth ? { key: C.authApiKey, db: C.firebaseUrl, refresh: A.refresh, h27: h27, hall: hallMap, rev: hallRev, name: (window.Util && Util.getName && Util.getName()) || 'MIPP-Import' } : null;
    var code = '(' + body.replace('__BASE__', base).replace('__VER__', ver).replace('__CFG__', function () { return JSON.stringify(cfg); }) + ')()';
    url = 'javascript:' + encodeURIComponent(code);
    hlCode = 'window.__dekrHeadless = true; ' + code;
    document.getElementById('bm').setAttribute('href', url);
    document.getElementById('bmCode').value = url;
    var ext = document.getElementById('extCode');
    if (ext) ext.value = cfg ? JSON.stringify(cfg) : '';
    document.getElementById('bmAuth').textContent = haveAuth
      ? 'Zugang enthalten' + (A.admin ? ' (Admin: besonders gut aufbewahren)' : '') + (h27 ? ', Halle 27 sichtbar' : '') + '. Klick im MIPP-Tab importiert direkt.'
      : 'Kein Zugang gefunden: Ohne Anmeldung kopiert das Lesezeichen nur. Öffne diese Seite in dem Browser, in dem du im Dashboard angemeldet bist.';
  }
  build(false);
  perm27().then(function (h) { if (h) build(true); });
  var ec = document.getElementById('copyExt');
  if (ec) ec.onclick = function () {
    var info = document.getElementById('extInfo'), t = document.getElementById('extCode').value;
    if (!t) { info.textContent = 'Kein Zugang gefunden: bitte erst im Dashboard anmelden.'; return; }
    try { navigator.clipboard.writeText(t).then(function () { info.textContent = 'Kopiert.'; }, function () { info.textContent = 'Bitte den Code im Feld markieren und kopieren.'; }); } catch (e) { info.textContent = 'Bitte den Code im Feld markieren und kopieren.'; }
  };
  var ps = document.getElementById('dlPs');
  if (ps) ps.onclick = function () {
    var info = document.getElementById('psInfo'), mu = document.getElementById('psUrl').value.trim();
    if (!haveAuth) { info.textContent = 'Kein Zugang gefunden: bitte erst im Dashboard anmelden.'; return; }
    if (!/^https?:\/\//i.test(mu)) { info.textContent = 'Bitte die MIPP-Adresse (Auslieferliste) eintragen.'; return; }
    fetch('tools/mipp-import.ps1?v=' + encodeURIComponent(ver)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
      t = t.replace('__URL__', function () { return mu.replace(/'/g, "''"); }).replace('__JS__', function () { return hlCode; });
      var blob = new Blob(['\uFEFF' + t.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'mipp-import.ps1'; document.body.appendChild(a); a.click(); a.remove();
      info.textContent = 'Heruntergeladen. Enthält deinen Zugang, nicht weitergeben.';
    }).catch(function (e) { info.textContent = 'Fehler: ' + e.message; });
  };
  document.getElementById('copyBm').onclick = function () {
    var info = document.getElementById('copyInfo');
    try {
      navigator.clipboard.writeText(url).then(function () { info.textContent = 'Kopiert.'; }, function () { info.textContent = 'Bitte Code im Feld markieren und kopieren.'; });
    } catch (e) { info.textContent = 'Bitte Code im Feld markieren und kopieren.'; }
  };
  document.getElementById('bm').onclick = function (e) { e.preventDefault(); alert('Diesen Knopf in die Lesezeichenleiste ziehen, nicht hier klicken.'); };
})();
