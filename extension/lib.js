// Auslesen, Abgleich und Import der MIPP-Liste (dieselbe Logik wie im Lesezeichen, js/mipp.js).
// cfg: { key, db, refresh, h27, hall, rev, tokenUrl? }  (Einrichtungscode von mipp.html)
(function (g) {
  'use strict';
  function make(CFG) {
    var OWN = ['6', '7'], FROM = CFG.h27 ? ['3', '27'] : ['3'];
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
    function plan(rows, tasks) {
      var now = Date.now(), t0 = new Date(), today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()), ops = {}, st = { neu: 0, moved: 0, chg: 0, same: 0, past: 0 }, by = {};
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
      return { ops: ops, st: st };
    }
    function importDirect(rows) {
      var tok = '';
      return fetch((CFG.tokenUrl || 'https://securetoken.googleapis.com/v1/token') + '?key=' + encodeURIComponent(CFG.key), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(CFG.refresh) })
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
    return { parse: parse, pick: pick, plan: plan, importDirect: importDirect };
  }
  g.MippLib = { make: make };
})(self);
