// Hauptseite (Dashboard)
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();   // aktuelle Kalenderwoche
  var viewWeek = WEEK;         // angezeigte Woche
  var hallIdx = 0;
  var sel = null;          // { hall, pos } oder { id } (Eintrag ohne Position)
  var seen = null;         // bereits gesehene Nachrichten-IDs
  var toastTimer = null;
  var editing = false;     // Modus: Spalten/Zeilen verschieben
  var drag = null;         // laufender Zieh-Vorgang { hall, axis, i, p0, base }
  var draft = null;        // Layout während des Ziehens

  // ---------- Kopf ----------
  function weekLabel() {
    $('week').textContent = 'KW ' + viewWeek.split('-W')[1] + (viewWeek === WEEK ? '' : ' · ' + viewWeek.split('-W')[0]);
    $('week').style.color = viewWeek === WEEK ? '' : 'var(--accent)';
  }
  weekLabel();
  function moveWeek(n) { viewWeek = Util.addWeeks(viewWeek, n); sel = null; weekLabel(); render(Store.get()); }
  $('weekPrev').onclick = function () { moveWeek(-1); };
  $('weekNext').onclick = function () { moveWeek(1); };
  $('mode').textContent = Store.remote ? 'Live' : 'Lokal-Demo';
  $('mode').className = 'tag ' + (Store.remote ? 'live' : 'demo');
  function tick() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    $('clock').textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  tick(); setInterval(tick, 1000);

  // ---------- Formulare ----------
  $('pDay').innerHTML = [1, 2, 3, 4, 5].map(function (d) {
    return '<option value="' + d + '"' + (d === Util.todayIdx() ? ' selected' : '') + '>' + Util.DAYS[d].slice(0, 2) + '</option>';
  }).join('');
  $('pHall').innerHTML = Halls.all.map(function (h) {
    return '<option value="' + h.id + '">' + esc(h.name) + '</option>';
  }).join('');
  $('mName').value = Util.getName();

  $('planToggle').onclick = function () { $('plan').hidden = !$('plan').hidden; };

  // Plant eine KR (genau eine Position). Ein früherer Eintrag derselben KR wird ersetzt, der Status bleibt.
  // Gibt die Schreib-Promises zurück.
  function planOne(kr, pos, day, hall0, extra, forceHall, week) {
    week = week || viewWeek;
    var hall = !pos ? '' : forceHall || hall0;
    var id = Util.taskId(week, kr, hall || '0', pos || '0');
    var tasks = Store.get().tasks, wasDone = false, jobs = [];
    Object.keys(tasks).forEach(function (tid) {
      if (tasks[tid].week === week && tasks[tid].kr === kr) {
        wasDone = wasDone || !!tasks[tid].done;
        if (tid !== id) jobs.push(Store.removeTask(tid));
      }
    });
    var cur = tasks[id];
    var t = { week: week, kr: kr, day: day, hall: hall, pos: pos, done: cur ? !!cur.done : wasDone };
    if (extra && extra.scope) t.scope = extra.scope;
    if (extra && extra.usa) t.usa = true;
    jobs.push(Store.setTask(id, t));
    return jobs;
  }

  $('plan').onsubmit = function (e) {
    e.preventDefault();
    var kr = Util.normKr($('pKr').value);
    var hall0 = $('pHall').value;
    var day = +$('pDay').value;
    var list = $('pPos').value.split(/[\s,;]+/).map(Util.normPos).filter(Boolean);
    if (!kr) return;
    if (list.length > 1) { toast('Pro KR nur eine Position'); return; }
    var pos = list[0] || '';
    Promise.all(planOne(kr, pos, day, hall0)).then(function () {
      return Store.addMsg({ type: 'plan', by: Util.getName() || 'Disposition',
        text: 'KR ' + kr + ' geplant (' + Util.DAYS[day].slice(0, 2) + ')' + (pos ? ': ' + pos : '') });
    }).catch(function () { toast('Speichern fehlgeschlagen'); });
    $('pKr').value = ''; $('pPos').value = '';
  };

  $('send').onsubmit = function (e) {
    e.preventDefault();
    var name = $('mName').value.trim() || 'Anonym';
    var text = $('mText').value.trim();
    if (!text) return;
    Util.setName($('mName').value.trim());
    Store.addMsg({ type: 'msg', by: name, text: text }).catch(function () { toast('Senden fehlgeschlagen'); });
    $('mText').value = '';
  };

  $('hallSwitch').onclick = function () { hallIdx = (hallIdx + 1) % Halls.all.length; sel = null; render(Store.get()); };

  // ---------- Hilfen ----------
  function toast(t) {
    var el = $('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3500);
  }
  function weekTasks(state) {
    return Object.keys(state.tasks).map(function (id) {
      var t = state.tasks[id]; t.id = id; return t;
    }).filter(function (t) { return t.week === viewWeek; });
  }
  function hallOf(id) { return Halls.get(id); }

  function badges(t) {
    return (t.scope ? ' <span class="badge">' + esc(t.scope) + '</span>' : '') + (t.usa ? ' <span class="badge usa">USA</span>' : '');
  }

  // ---------- Linke Spalte ----------
  function renderWeek(tasks) {
    var html = '';
    for (var d = 1; d <= 5; d++) {
      var dt = tasks.filter(function (t) { return t.day === d; });
      var done = dt.filter(function (t) { return t.done; }).length;
      var groups = {}, order = [];
      dt.forEach(function (t) {
        if (!groups[t.kr]) { groups[t.kr] = []; order.push(t.kr); }
        groups[t.kr].push(t);
      });
      var isToday = viewWeek === WEEK && d === Util.todayIdx();
      html += '<div class="day' + (isToday ? ' today' : '') + '">' +
        '<div class="day-h orb"><span>' + Util.DAYS[d] + ' ' + Util.dayDate(viewWeek, d) + (isToday ? ' · heute' : '') +
        '</span><span class="cnt">' + done + '/' + dt.length + '</span></div>';
      if (!order.length) html += '<div class="empty">– keine KR –</div>';
      order.forEach(function (kr) {
        var ts = groups[kr];
        var all = ts.every(function (t) { return t.done; });
        html += '<div class="card kr ' + (all ? 'ok' : 'open') + '"><div class="kr-n"><span>KR ' + esc(kr) + badges(ts[0]) + '</span>' +
          '<span style="color:' + (all ? 'var(--green)' : 'var(--orange)') + '">' +
          ts.filter(function (t) { return t.done; }).length + '/' + ts.length + '</span></div><div class="chips">';
        ts.sort(function (a, b) { return a.pos < b.pos ? -1 : 1; }).forEach(function (t) {
          var isSel = sel && (sel.id ? sel.id === t.id : sel.hall === t.hall && sel.pos === t.pos);
          html += '<button class="chip' + (t.done ? ' done' : '') + (isSel ? ' sel' : '') +
            '" data-id="' + esc(t.id) + '">' +
            (t.pos ? esc(t.hall) + '·' + esc(t.pos) : 'ohne Position') + '</button>';
        });
        html += '</div></div>';
      });
      html += '</div>';
    }
    $('week-list').innerHTML = html;
  }

  // ---------- Karte ----------
  function renderMap(tasks) {
    var hall = Halls.all[hallIdx];
    var lay = Halls.layout(hall.id, ovFor(hall.id));
    var byPos = {};
    tasks.filter(function (t) { return t.hall === hall.id; }).forEach(function (t) {
      (byPos[t.pos] = byPos[t.pos] || []).push(t);
    });
    var posKeys = Object.keys(byPos);
    var ready = posKeys.filter(function (p) { return byPos[p].every(function (t) { return t.done; }); }).length;

    $('hallName').textContent = hall.name;
    $('hallStat').textContent = ready + '/' + posKeys.length + ' Positionen bereit';
    $('hallSwitch').textContent = '⇄ ' + Halls.all[(hallIdx + 1) % Halls.all.length].name;
    $('hallSwitch').hidden = Halls.all.length < 2;

    var svg = '<svg class="map' + (lay.plan ? ' plan' : '') + (editing ? ' zoom' : '') + '" viewBox="' + lay.vb + '">';
    if (lay.plan) svg += lay.plan;
    lay.labels.forEach(function (l) {
      if (!editing) {
        if (l.off) return;
        svg += '<text class="axis" style="font-size:' + Math.max(lay.font, 10) + 'px" x="' + l.x + '" y="' + l.y + '">' + esc(l.t) + '</text>';
        return;
      }
      var col = l.axis === 'c';
      var rx = col ? l.x - lay.pw / 2 + 1 : l.x - 15, ry = col ? l.y - 15 : l.y - 4 - lay.ph / 2 + 1;
      svg += '<g class="handle' + (l.off ? ' off' : '') + '" data-axis="' + l.axis + '" data-i="' + l.i + '"><rect x="' + rx + '" y="' + ry +
        '" width="' + (col ? lay.pw - 2 : 30) + '" height="' + (col ? 20 : lay.ph - 2) + '" rx="3"/>' +
        '<text x="' + l.x + '" y="' + l.y + '" style="font-size:13px">' + esc(l.t) + '</text></g>';
    });
    // Normalansicht: nur Positionen aus der Liste; im Admin-Modus das ganze Raster
    var known = {};
    lay.positions.forEach(function (p) { known[p.id] = p; });
    var missing = [], drawn = [];
    posKeys.forEach(function (id) {
      var cell = known[id] || Halls.cellFor(hall.id, id, ovFor(hall.id));
      if (cell) drawn.push(cell); else missing.push(id);
    });
    if (editing) drawn = lay.positions.concat(drawn.filter(function (c) { return !known[c.id]; }));
    drawn.forEach(function (p) {
      var ts = byPos[p.id];
      var cls = 'cell';
      if (ts) cls += ts.every(function (t) { return t.done; }) ? ' done' : ' open';
      if (sel && sel.hall === hall.id && sel.pos === p.id) cls += ' sel';
      svg += '<g data-pos="' + esc(p.id) + '"><rect class="' + cls + '" x="' + p.x + '" y="' + p.y +
        '" width="' + p.w + '" height="' + p.h + '" rx="2"><title>' + esc(p.id) + '</title></rect>';
      if (ts) svg += '<text class="cell-t" style="font-size:' + p.f + 'px" x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + p.f / 3) + '">' + esc(p.id) + '</text>';
      svg += '</g>';
    });
    $('map').innerHTML = svg + '</svg>';

    renderDetail(byPos, missing);
  }

  function renderDetail(byPos, missing) {
    var el = $('detail');
    var html = '';
    if (sel && (sel.id || sel.hall === Halls.all[hallIdx].id)) {
      var ts = sel.id ? (Store.get().tasks[sel.id] ? [Object.assign({ id: sel.id }, Store.get().tasks[sel.id])] : []) : byPos[sel.pos] || [];
      html += '<div class="orb" style="font-size:12px;color:var(--accent);margin-bottom:4px">' +
        (sel.id ? 'Eintrag ohne Position' : 'Position ' + esc(sel.pos)) + '</div>';
      if (!ts.length) html += '<div class="empty">Kein Beipack geplant.</div>';
      ts.forEach(function (t) {
        html += '<div class="line"><span>KR ' + esc(t.kr) + badges(t) + ' · ' + Util.DAYS[t.day].slice(0, 2) + ' · <b style="color:' +
          (t.done ? 'var(--green)' : 'var(--orange)') + '">' + (t.done ? 'Bereit' : 'Offen') + '</b></span><span>' +
          '<button class="btn-sm" data-act="toggle" data-id="' + esc(t.id) + '">' + (t.done ? 'Wieder offen' : 'Bereit') + '</button> ' +
          '<button class="btn-sm btn-warn" data-act="del" data-id="' + esc(t.id) + '">Löschen</button></span></div>';
      });
    } else {
      html += '<div class="empty">Position auf der Karte oder in der Liste anklicken.</div>';
    }
    if (missing.length) {
      html += '<div class="note" style="margin-top:6px">Außerhalb des Rasters: ' + missing.map(esc).join(', ') + '</div>';
    }
    el.innerHTML = html;
  }

  // ---------- Nachrichten ----------
  function renderMsgs(state) {
    var list = Object.keys(state.msgs).map(function (id) {
      var m = state.msgs[id]; m.id = id; return m;
    }).sort(function (a, b) { return b.t - a.t; }).slice(0, 80);

    var fresh = {};
    if (seen) {
      list.forEach(function (m) {
        if (!seen[m.id]) {
          fresh[m.id] = 1;
          if (m.type === 'done') toast(m.text);
        }
      });
    }
    seen = seen || {};
    list.forEach(function (m) { seen[m.id] = 1; });

    $('msgs').innerHTML = list.length ? list.map(function (m) {
      return '<div class="msg ' + esc(m.type) + (fresh[m.id] ? ' fresh' : '') + '">' + esc(m.text) +
        '<small>' + Util.time(m.t) + ' · ' + esc(m.by || '') + '</small></div>';
    }).join('') : '<div class="empty">Keine Nachrichten.</div>';
  }

  function render(state) {
    var tasks = weekTasks(state);
    renderWeek(tasks);
    renderMap(tasks);
    renderMsgs(state);
  }

  // ---------- Spalten / Zeilen verschieben ----------
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function ovFor(hallId) {
    if (drag && drag.hall === hallId) return draft;
    return Store.get().layout[hallId] || Halls.get(hallId).layout || {};
  }
  function toSvg(svg, e) {
    var pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function setEdit(on) {
    editing = on;
    $('editBar').hidden = !on;
    $('editToggle').textContent = on ? 'Fertig' : 'Admin-Modus';
    $('editToggle').className = on ? 'btn-ok' : '';
    render(Store.get());
  }
  function onMove(e) {
    var svg = $('map').querySelector('svg');
    if (!drag || !svg) return;
    var p = toSvg(svg, e);
    var d = Math.round((drag.axis === 'c' ? p.x - drag.p0.x : p.y - drag.p0.y) * 2) / 2;
    var lay = Halls.layout(drag.hall);
    var keys = drag.axis === 'c' ? lay.colKeys : lay.rowKeys, coll = drag.axis === 'c' ? 'cols' : 'rows';
    var last = $('follow').checked ? keys.length - 1 : drag.i;
    if (Math.abs(d) >= 1) drag.moved = true;
    draft = clone(drag.base);
    draft[coll] = draft[coll] || {};
    for (var j = drag.i; j <= last; j++) {
      draft[coll][keys[j]] = ((drag.base[coll] || {})[keys[j]] || 0) + d;
    }
    render(Store.get());
  }
  // Layout speichern; leere Angaben werden entfernt
  function saveOv(hall, ov) {
    var out = { cols: {}, rows: {}, off: {} }, n = 0;
    ['cols', 'rows', 'off'].forEach(function (c) {
      Object.keys(ov[c] || {}).forEach(function (k) {
        if (ov[c][k]) { out[c][k] = ov[c][k]; n++; }
      });
    });
    // Alles eingeblendet, obwohl die Halle ein Standardlayout hat: ausdrücklich merken
    if (!n && Halls.get(hall).layout) { out.all = 1; n = 1; }
    Store.setLayout(hall, n ? out : null).catch(function () { toast('Speichern fehlgeschlagen'); });
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.moved) {
      saveOv(d.hall, draft);
    } else {
      // Klick ohne Ziehen: Spalte/Zeile ein- bzw. ausblenden
      var lay = Halls.layout(d.hall);
      var key = (d.axis === 'c' ? lay.colKeys : lay.rowKeys)[d.i];
      var base = clone(d.base);
      base.off = base.off || {};
      base.off[key] = base.off[key] ? 0 : 1;
      saveOv(d.hall, base);
    }
    render(Store.get());
  }
  // Spalten im Raster behalten, z.B. jede 3. ab Spalte 1 (1, 4, 7, ...)
  function keepEvery(step, start) {
    var hall = Halls.all[hallIdx].id, lay = Halls.layout(hall), ov = clone(ovFor(hall));
    ov.off = {};
    lay.colKeys.forEach(function (k, i) {
      if (step > 1 && ((((i + 1 - start) % step) + step) % step) !== 0) ov.off[k] = 1;
    });
    saveOv(hall, ov);
  }
  $('keep3').onclick = function () { keepEvery(3, +$('keepStart').value); };
  $('keepAll').onclick = function () { keepEvery(1, 1); };
  $('editToggle').onclick = function () { setEdit(!editing); };
  $('editExport').onclick = function () {
    var hall = Halls.all[hallIdx];
    var ov = ovFor(hall.id);
    var text = 'layout: ' + JSON.stringify({ cols: ov.cols || {}, rows: ov.rows || {}, off: ov.off || {} }) + ',';
    var done = function () { toast('Layout von ' + hall.name + ' kopiert'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Kopieren mit Strg+C:', text); });
    } else {
      window.prompt('Kopieren mit Strg+C:', text);
    }
  };
  $('editReset').onclick = function () {
    if (confirm('Verschiebungen dieser Halle zurücksetzen?')) {
      Store.setLayout(Halls.all[hallIdx].id, null).catch(function () { toast('Speichern fehlgeschlagen'); });
    }
  };
  $('map').addEventListener('pointerdown', function (e) {
    var h = editing && e.target.closest('.handle');
    if (!h) return;
    e.preventDefault();
    var hall = Halls.all[hallIdx].id;
    drag = { hall: hall, axis: h.dataset.axis, i: +h.dataset.i, p0: toSvg($('map').querySelector('svg'), e), base: clone(ovFor(hall)) };
    draft = clone(drag.base);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  // ---------- Klicks ----------
  $('week-list').onclick = function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    var t = Store.get().tasks[b.dataset.id];
    if (!t) return;
    if (t.pos) {
      hallIdx = Math.max(0, Halls.all.findIndex(function (h) { return h.id === t.hall; }));
      sel = { hall: t.hall, pos: t.pos };
    } else {
      sel = { id: b.dataset.id };
    }
    render(Store.get());
  };
  $('map').onclick = function (e) {
    if (editing) return;
    var g = e.target.closest('g[data-pos]');
    if (!g) return;
    sel = { hall: Halls.all[hallIdx].id, pos: g.dataset.pos };
    render(Store.get());
  };
  $('detail').onclick = function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var t = Store.get().tasks[b.dataset.id];
    if (!t) return;
    var p;
    if (b.dataset.act === 'del') {
      if (!confirm('KR ' + t.kr + ' / ' + t.pos + ' löschen?')) return;
      p = Store.removeTask(b.dataset.id);
    } else {
      var copy = {}; Object.keys(t).forEach(function (k) { if (k !== 'id') copy[k] = t[k]; });
      copy.done = !t.done;
      copy.doneAt = copy.done ? Date.now() : null;
      copy.doneBy = copy.done ? (Util.getName() || 'Dashboard') : null;
      p = Store.setTask(b.dataset.id, copy);
    }
    p.catch(function () { toast('Speichern fehlgeschlagen'); });
  };

  // ---------- Import (Kopieren und Einfügen) ----------
  // Nur die gewählten Spalten werden verarbeitet; alles andere wird verworfen und nie gespeichert.
  // Gespeichert werden: KR, Tag, Halle, Position, Lieferumfang (Maschine/komplett) und ein USA-Hinweis (Land = US).
  var ROLES = [['', 'ignorieren'], ['kr', 'KR'], ['year', 'Jahr'], ['kw', 'KW'], ['day', 'Tag'], ['hall', 'Halle'], ['num', 'Nummer'],
    ['letter', 'Buchstabe'], ['pos', 'Position (A14)'], ['scope', 'Lieferumfang'], ['country', 'Land (US = USA)']];
  var imp = { rows: [], cols: [] };
  var MAP_KEY = 'dekr26_impmap';
  var DAY_KEYS = { mo: 1, di: 2, mi: 3, do: 4, fr: 5 };
  function parseDay(s) {
    s = String(s || '').trim().toLowerCase();
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
    if (m) {
      var y = m[3] ? +m[3] : new Date().getFullYear();
      if (y < 100) y += 2000;
      var d = new Date(y, +m[2] - 1, +m[1]).getDay();
      return d >= 1 && d <= 5 ? d : 0;
    }
    return DAY_KEYS[s.slice(0, 2)] || 0;
  }
  // Kopie der Arbeitsliste: jede Zelle steht in einer eigenen Zeile, die Spaltenzahl wechselt je Eintrag
  // (z.B. optionale Zelle "bestätigt", mehrere Spots). Ein Eintrag beginnt mit: Nr, Jahr, KW, Wochentag.
  function indexWhere(arr, re, from) {
    for (var i = from || 0; i < arr.length; i++) if (re.test(arr[i])) return i;
    return -1;
  }
  function parseRecords(text) {
    var L = text.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var starts = [], j;
    for (j = 0; j + 3 < L.length; j++) {
      if (/^\d+$/.test(L[j]) && /^20\d\d$/.test(L[j + 1]) && /^\d{1,2}$/.test(L[j + 2]) &&
        /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)$/i.test(L[j + 3])) starts.push(j);
    }
    if (!starts.length) return null;
    var rows = [['KR', 'Jahr', 'KW', 'Tag', 'Halle', 'Nummer', 'Buchstabe', 'Lieferumfang', 'Land']];
    rows.multi = 0;
    starts.forEach(function (s, i) {
      var rec = L.slice(s, i + 1 < starts.length ? starts[i + 1] : L.length);
      var t = indexWhere(rec, /Uhr$/), seg = indexWhere(rec, /^\d{5}$/, t + 1);
      var krI = seg < 0 ? -1 : indexWhere(rec, /^KR[0-9A-Z]+$/i, seg);
      if (t < 0 || seg < 0 || krI < 0) return;
      // Spot-Bereich: [Hallen][Nummern][Buchstaben], bei mehreren Spots je k Zellen
      var a = t + 1;
      while (a < seg && !/^\d{1,2}(\.\d)?$/.test(rec[a])) a++;
      var R = rec.slice(a, seg), k = R.length % 3 === 0 ? R.length / 3 : 0;
      if (k > 1) rows.multi++;
      var c = indexWhere(rec, /^[A-Z]{2}$/, krI + 1);
      var sc = indexWhere(rec, /^(komplett|maschine|schrumpftunnel)/i, c >= 0 ? c + 2 : krI + 1);
      rows.push([rec[krI], rec[1], rec[2], rec[3], R[0] || '', k ? R[k] : '', k ? R[2 * k] : '', sc >= 0 ? rec[sc] : '',
        c >= 0 ? rec[c] : '']);
    });
    return rows;
  }
  function parseTable(text) {
    if (!/\t/.test(text)) {
      var rec = parseRecords(text);
      if (rec) return rec;
    }
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var sep = /\t/.test(text) ? /\t/ : /;/.test(text) ? /;/ : /\s{2,}/;
    return lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim(); }); });
  }
  function guess(h) {
    h = String(h || '').toLowerCase().trim();
    if (/^kr(\W|$)|kr-?nr/.test(h)) return 'kr';
    if (h === 'tag') return 'day';
    if (/^jahr/.test(h)) return 'year';
    if (h === 'kw') return 'kw';
    if (/^spot|^halle/.test(h)) return 'hall';
    if (/^nummer/.test(h)) return 'num';
    if (/^buchstabe/.test(h)) return 'letter';
    if (/lieferumfang/.test(h)) return 'scope';
    if (/^land/.test(h)) return 'country';
    if (/^pos|^platz/.test(h)) return 'pos';
    return '';
  }
  function sigOf(row) { return (row || []).join('|'); }
  function autoCols(rows, n, head) {
    var cols = [], c;
    for (c = 0; c < n; c++) cols.push(head ? guess(rows[0][c]) : '');
    if (head) {
      try {
        var saved = JSON.parse(localStorage.getItem(MAP_KEY));
        if (saved && saved.sig === sigOf(rows[0])) return saved.cols;
      } catch (e) { /* ignorieren */ }
      // "Spot" überspannt drei Spalten: Halle | Nummer | Buchstabe
      cols.forEach(function (v, i) {
        if (v === 'hall') {
          if (!cols[i + 1] && !rows[0][i + 1]) cols[i + 1] = 'num';
          if (!cols[i + 2] && !rows[0][i + 2]) cols[i + 2] = 'letter';
        }
      });
    }
    return cols;
  }
  // Ergebnis je Zeile: { skip: Grund } oder { kr, day, hall, pos, scope, usa }
  function readRow(r, ci, dayDef) {
    var g = function (role) { return ci[role] >= 0 ? (r[ci[role]] || '') : ''; };
    var kr = Util.normKr(g('kr'));
    if (!kr) return { skip: 'leer' };
    var hall = '';
    if (ci.hall >= 0) {
      var major = g('hall').trim().split('.')[0];
      hall = major === '7' ? 'H1' : major === '6' ? 'H2' : '';
      if (!hall) return { skip: 'andere Halle' };
    }
    var scope = '';
    if (ci.scope >= 0) {
      var sc = g('scope').toLowerCase();
      scope = /schrumpf/.test(sc) ? '' : /komplett/.test(sc) ? 'komplett' : /maschine/.test(sc) ? 'Maschine' : '';
      if (!scope) return { skip: 'Lieferumfang' };
    }
    var pos = '';
    if (ci.pos >= 0) pos = Util.normPos(g('pos'));
    else if (ci.num >= 0 && ci.letter >= 0) {
      var letter = (g('letter').toUpperCase().match(/[A-Z]/) || [''])[0];
      var num = (g('num').match(/\d+/) || [''])[0];
      if (letter && num) pos = letter + num;
    }
    var usa = g('country').trim().toUpperCase() === 'US';
    var yr = (g('year').match(/\d{4}/) || [''])[0], kw = (g('kw').match(/\d{1,2}/) || [''])[0];
    var week = yr && kw ? yr + '-W' + (kw.length < 2 ? '0' : '') + kw : viewWeek;
    return { week: week, kr: kr, day: ci.day >= 0 ? parseDay(g('day')) || dayDef : dayDef, hall: hall, pos: pos, scope: scope, usa: usa };
  }
  function roleIdx() {
    var ci = {};
    ROLES.forEach(function (r) { if (r[0]) ci[r[0]] = imp.cols.indexOf(r[0]); });
    return ci;
  }
  function renderImp() {
    var rows = parseTable($('impText').value);
    imp.rows = rows;
    var n = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var head = $('impHead').checked;
    if (!n) { imp.cols = []; $('impPreview').innerHTML = ''; $('impGo').disabled = true; $('impInfo').textContent = ''; return; }
    if (imp.cols.length !== n) imp.cols = autoCols(rows, n, head);
    var html = '<table class="imp"><tr>' + imp.cols.map(function (v, c) {
      return '<th><select data-c="' + c + '">' + ROLES.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></th>';
    }).join('') + '</tr>';
    rows.slice(0, 8).forEach(function (r, i) {
      html += '<tr class="' + (i === 0 && head ? 'dim' : '') + '">' + imp.cols.map(function (v, c) {
        return '<td class="' + (v ? '' : 'dim') + '">' + esc(r[c] || '') + '</td>';
      }).join('') + '</tr>';
    });
    $('impPreview').innerHTML = html + '</table>';
    var ci = roleIdx();
    var ok = ci.kr >= 0;
    $('impGo').disabled = !ok;
    // Vorschau der Auswertung (ohne zu speichern)
    var data = rows.slice(head ? 1 : 0), cnt = { ok: 0, hall: 0, scope: 0, usa: 0 }, seen = {}, weeks = {};
    if (ok) data.forEach(function (r) {
      var x = readRow(r, ci, 1);
      if (x.skip === 'andere Halle') cnt.hall++;
      else if (x.skip === 'Lieferumfang') cnt.scope++;
      else if (!x.skip && !seen[x.week + x.kr]) { seen[x.week + x.kr] = 1; cnt.ok++; weeks[x.week] = 1; if (x.usa) cnt.usa++; }
    });
    $('impInfo').textContent = ok
      ? cnt.ok + ' KR werden importiert (' + Object.keys(weeks).sort().map(function (w) { return 'KW ' + w.split('-W')[1]; }).join(', ') + ') · ' + cnt.hall + ' andere Halle · ' + cnt.scope + ' ohne Maschine/komplett (übersprungen)' +
        (cnt.usa ? ' · ' + cnt.usa + ' USA' : '') + (rows.multi ? ' · ' + rows.multi + ' mit mehreren Spots (erster wird genommen)' : '') +
        ' · nicht gewählte Spalten werden verworfen.'
      : 'Bitte über der KR-Spalte „KR" wählen.';
  }
  $('impOpen').onclick = function () { $('impModal').hidden = false; };
  $('impClose').onclick = function () { $('impModal').hidden = true; };
  $('impText').oninput = function () { imp.cols = []; renderImp(); };
  $('impHead').onchange = function () { imp.cols = []; renderImp(); };
  $('impDay').onchange = renderImp;
  $('impPreview').onchange = function (e) {
    var sel = e.target.closest('select[data-c]');
    if (!sel) return;
    imp.cols[+sel.dataset.c] = sel.value;
    if (sel.value) imp.cols = imp.cols.map(function (v, c) { return c !== +sel.dataset.c && v === sel.value ? '' : v; });
    renderImp();
  };
  $('impGo').onclick = function () {
    var ci = roleIdx(), head = $('impHead').checked;
    var dayDef = +$('impDay').value, jobs = [], seen = {}, n = 0, noPos = 0, usa = 0, skipped = 0, firstWeek = '';
    imp.rows.slice(head ? 1 : 0).forEach(function (r) {
      var x = readRow(r, ci, dayDef);
      if (x.skip) { skipped++; return; }
      if (seen[x.week + x.kr]) return;
      seen[x.week + x.kr] = 1;
      if (!firstWeek || x.week < firstWeek) firstWeek = x.week;
      n++;
      if (!x.pos) noPos++;
      if (x.usa) usa++;
      jobs = jobs.concat(planOne(x.kr, x.pos, x.day, x.hall || Halls.all[0].id, { scope: x.scope, usa: x.usa }, x.hall, x.week));
    });
    if (!n) { toast('Keine KR gefunden'); return; }
    if (head) {
      try { localStorage.setItem(MAP_KEY, JSON.stringify({ sig: sigOf(imp.rows[0]), cols: imp.cols })); } catch (e) { /* ignorieren */ }
    }
    $('impGo').disabled = true;
    var msg = n + ' KR importiert' + (noPos ? ', ' + noPos + ' ohne Position' : '') + (usa ? ', ' + usa + ' USA' : '');
    Promise.all(jobs).then(function () {
      return Store.addMsg({ type: 'plan', by: Util.getName() || 'Disposition', text: msg });
    }).then(function () {
      toast(msg);
      viewWeek = firstWeek; weekLabel(); render(Store.get());
      $('impText').value = ''; imp.cols = []; renderImp();
      $('impModal').hidden = true;
    }).catch(function () { toast('Import fehlgeschlagen'); renderImp(); });
  };
  $('impDay').innerHTML = $('pDay').innerHTML;

  // ---------- QR-Codes ----------
  // Der Code enthält nur die ID (?q=...). Name und Funktion lassen sich daher jederzeit ändern,
  // ohne dass ausgedruckte Codes ungültig werden.
  // n/f sind nur ein Rückfall, falls das Handy die QR-Daten nicht aus der Datenbank laden kann
  function scanUrl(q) {
    var u = new URL('scan.html', location.href);
    u.searchParams.set('q', q.id);
    u.searchParams.set('n', q.name);
    if (q.func) u.searchParams.set('f', q.func);
    return u.href;
  }
  function renderQr(state) {
    var list = Object.keys(state.qrs).map(function (id) {
      var q = state.qrs[id]; q.id = id; return q;
    }).sort(function (a, b) { return a.t - b.t; });
    $('qrWarn').hidden = Store.remote;
    $('qrHint').textContent = list.length ? '' : 'Noch keine QR-Codes. Name (und Funktion) eintragen und „Hinzufügen" klicken.';
    $('qrGrid').innerHTML = list.map(function (q) {
      var qr = qrcode(0, 'M');
      qr.addData(scanUrl(q));
      qr.make();
      return '<div class="card qr-card" data-id="' + esc(q.id) + '">' +
        '<h3 class="print-only">' + esc(q.name) + '</h3>' +
        (q.func ? '<div class="print-only">' + esc(q.func) + '</div>' : '') +
        '<input class="no-print" data-f="name" value="' + esc(q.name) + '" maxlength="40" placeholder="Name">' +
        '<input class="no-print" data-f="func" value="' + esc(q.func || '') + '" maxlength="40" placeholder="Funktion">' +
        qr.createSvgTag(4, 2) +
        '<button class="btn-sm btn-warn no-print" data-del="' + esc(q.id) + '">Löschen</button></div>';
    }).join('');
  }
  $('qrOpen').onclick = function () { $('qrModal').hidden = false; renderQr(Store.get()); };
  $('qrClose').onclick = function () { $('qrModal').hidden = true; };
  $('qrPrint').onclick = function () {
    document.body.classList.add('print-qr');
    window.print();
    document.body.classList.remove('print-qr');
  };
  $('qrForm').onsubmit = function (e) {
    e.preventDefault();
    var name = $('qrName').value.trim();
    if (!name) return;
    Store.setQr(Util.uid(), { name: name, func: $('qrFunc').value.trim(), t: Date.now() })
      .catch(function () { toast('Speichern fehlgeschlagen'); });
    $('qrName').value = ''; $('qrFunc').value = '';
  };
  $('qrGrid').onclick = function (e) {
    var b = e.target.closest('button[data-del]');
    if (b && confirm('QR-Code löschen?')) Store.setQr(b.dataset.del, null).catch(function () { toast('Löschen fehlgeschlagen'); });
  };
  $('qrGrid').onchange = function (e) {
    var inp = e.target.closest('input[data-f]');
    var card = e.target.closest('.qr-card');
    var q = card && Store.get().qrs[card.dataset.id];
    if (!inp || !q) return;
    var upd = { name: q.name, func: q.func || '', t: q.t };
    upd[inp.dataset.f] = inp.value.trim();
    if (!upd.name) { toast('Name darf nicht leer sein'); renderQr(Store.get()); return; }
    Store.setQr(card.dataset.id, upd).catch(function () { toast('Speichern fehlgeschlagen'); });
  };
  Store.subscribe(function (state) {
    var typing = document.activeElement && $('qrGrid').contains(document.activeElement);
    if (!$('qrModal').hidden && !typing) renderQr(state);
  });

  Store.subscribe(render);
  Store.start();
})();
