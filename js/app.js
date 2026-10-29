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
  Store.subscribe(function () {
    $('mode').textContent = Store.isOffline() ? 'Offline' : Store.remote ? 'Live' : 'Lokal-Demo';
    $('mode').className = 'tag ' + (Store.isOffline() ? 'demo' : Store.remote ? 'live' : 'demo');
  });
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
  // Dein Name: wird bei Bestätigungen, Bestellungen und Änderungen im Dashboard verwendet
  $('me').value = Util.getName();
  $('mName').value = Util.getName();
  $('me').onchange = function () {
    Util.setName($('me').value.trim());
    $('mName').value = $('me').value.trim();
  };

  $('planToggle').onclick = function () { $('plan').hidden = !$('plan').hidden; };

  // Plant eine KR (genau eine Position). Ein früherer Eintrag derselben KR wird ersetzt, der Status bleibt.
  // Gibt die Schreib-Operationen zurück (für Store.batch).
  function planOps(kr, pos, day, hall0, extra, forceHall, week) {
    week = week || viewWeek;
    var hall = !pos ? '' : forceHall || hall0;
    var id = Util.taskId(week, kr, hall || '0', pos || '0');
    var tasks = Store.get().tasks, wasDone = false, ops = [], prev = null;
    // Jede KR gibt es nur einmal (auch wochenübergreifend): frühere Einträge werden ersetzt
    Object.keys(tasks).forEach(function (tid) {
      if (tasks[tid].kr === kr) {
        prev = prev || tasks[tid];
        wasDone = wasDone || !!tasks[tid].done;
        if (tid !== id) ops.push({ coll: 'tasks', id: tid, val: null });
      }
    });
    var cur = tasks[id];
    var t = { week: week, kr: kr, day: day, hall: hall, pos: pos, done: cur ? !!cur.done : wasDone };
    if (extra && extra.scope) t.scope = extra.scope;
    if (extra && extra.usa) t.usa = true;
    if (extra && extra.from) t.from = extra.from;
    if (extra && extra.chg) { t.chg = extra.chg; t.chgK = extra.chgK; t.chgAt = Date.now(); }
    else if (prev && prev.chg) { t.chg = prev.chg; t.chgK = prev.chgK; t.chgAt = prev.chgAt; }
    var src = cur || prev;   // „abgeschlossen" und Kisten bleiben bei erneutem Planen/Import erhalten
    if (src && src.k2) t.k2 = src.k2;
    if (src && src.k5) t.k5 = src.k5;
    if (src && src.closed) { t.done = true; t.closed = true; t.closedAt = src.closedAt; t.closedBy = src.closedBy; }
    ops.push({ coll: 'tasks', id: id, val: t });
    return ops;
  }

  $('plan').onsubmit = function (e) {
    e.preventDefault();
    var kr = Util.normKr($('pKr').value);
    var hall0 = $('pHall').value;
    var day = +$('pDay').value;
    var raw = $('pPos').value.trim();
    if (!kr) return;
    var pp = raw ? Util.parsePos(raw) : null;
    if (raw && !pp) { toast('Position nicht erkannt, z.B. 7 42 Z'); return; }
    var pos = pp ? pp.pos : '';
    var hallId = (pp && pp.hall && Halls.byShort(pp.hall)) || hall0;
    if (pp && !Halls.hasRow(hallId, pp.pos.charAt(0))) {
      toast('Buchstabe ' + pp.pos.charAt(0) + ' gibt es in ' + Halls.get(hallId).name + ' nicht (vorhanden: ' + Halls.rowLetters(hallId).split('').join(' ') + ')');
      return;
    }
    Store.batch(planOps(kr, pos, day, hallId, null, hallId)).catch(function () { toast('Speichern fehlgeschlagen'); });
    $('pKr').value = ''; $('pPos').value = '';
  };

  // Empfänger: Dashboard (allgemein), alle QR-Besitzer oder ein bestimmter Code
  function renderRecipients(state) {
    var cur = $('mTo').value;
    var qs = Object.keys(state.qrs).map(function (id) { return { id: id, name: state.qrs[id].name, t: state.qrs[id].t }; })
      .sort(function (a, b) { return a.t - b.t; });
    $('mTo').innerHTML = '<option value="">Allgemein (Dashboard)</option><option value="all">An alle QR-Besitzer</option>' +
      qs.map(function (q) { return '<option value="' + esc(q.id) + '">An ' + esc(q.name) + '</option>'; }).join('');
    if ([].some.call($('mTo').options, function (o) { return o.value === cur; })) $('mTo').value = cur;
  }
  $('send').onsubmit = function (e) {
    e.preventDefault();
    var name = $('mName').value.trim() || 'Deufol';
    var text = $('mText').value.trim();
    if (!text) return;
    Util.setName($('mName').value.trim());
    $('me').value = $('mName').value.trim();
    var to = $('mTo').value, msg;
    if (to) {
      var who = to === 'all' ? 'alle QR-Besitzer' : $('mTo').options[$('mTo').selectedIndex].text.replace(/^An /, '');
      msg = { type: 'dm', by: name, to: to, text: 'An ' + who + ': ' + text };
    } else {
      msg = { type: 'msg', by: name, text: text };
    }
    Store.addMsg(msg).then(function () {
      if (!to) return;
      // Push an die Handys der Empfänger
      var qrs = Store.get().qrs, targets = to === 'all' ? Object.keys(qrs) : [to];
      targets.forEach(function (qid) { Push.toQr(qid, 'Nachricht von ' + name, text); });
    }).catch(function () { toast('Senden fehlgeschlagen'); });
    $('mText').value = '';
  };

  $('allToggle').onclick = function () { allMode = !allMode; sel = null; render(Store.get()); };
  $('krFilter').oninput = function () { krFilter = $('krFilter').value; renderAllKr(weekTasks(Store.get())); };
  $('dayBar').onclick = function (e) {
    var b = e.target.closest('button[data-dayvis]');
    if (!b) return;
    var d = b.dataset.dayvis;
    dayPrefs.hidden[d] = dayPrefs.hidden[d] ? 0 : 1;
    saveDayPrefs(); render(Store.get());
  };
  $('hallSwitch').onclick = function (e) {
    var b = e.target.closest('button[data-hall]');
    if (!b) return;
    hallIdx = Math.max(0, Halls.all.findIndex(function (x) { return x.id === b.dataset.hall; }));
    sel = null; render(Store.get());
  };

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
    }).filter(function (t) { return allMode || t.week === viewWeek; });
  }

  var openProb = {};   // KR -> offenes Problem vorhanden
  var waveKr = {};     // KR -> unbestätigte „Beipack bereit“-Meldung (Position pulsiert mit Druckwellen)
  function badges(t) {
    var from = t.from ? ' <span class="badge">aus Halle ' + esc(t.from) + '</span>' : '';
    var fresh = t.chg && Date.now() - t.chgAt < 864e5;   // Vermerk 24 Stunden lang
    return from + (t.scope ? ' <span class="badge">' + esc(t.scope) + '</span>' : '') + (t.usa ? ' <span class="badge usa">USA</span>' : '') +
      (fresh ? ' <span class="badge chg" title="' + esc(t.chg) + '">' + esc(t.chgK || 'geändert') + '</span>' : '') +
      (t.k2 || t.k5 ? ' <span class="badge kis" title="Kisten">' + (t.k2 ? 'K2 ×' + t.k2 : '') + (t.k2 && t.k5 ? ' · ' : '') + (t.k5 ? 'K5 ×' + t.k5 : '') + '</span>' : '') +
      (openProb[t.kr] ? ' <span class="badge prob">Problem</span>' : '');
  }

  // ---------- Linke Spalte ----------
  // Tage ein-/ausklappen und ausblenden (im Browser gemerkt). Standard: nur der heutige Tag ist offen.
  var DAYS_KEY = 'dekr26_days';
  var dayPrefs = { open: {}, hidden: {} };
  try { dayPrefs = Object.assign(dayPrefs, JSON.parse(localStorage.getItem(DAYS_KEY)) || {}); } catch (e) { /* ignorieren */ }
  function saveDayPrefs() { try { localStorage.setItem(DAYS_KEY, JSON.stringify(dayPrefs)); } catch (e) { /* ignorieren */ } }
  function dayKey(d) { return viewWeek + '-' + d; }
  function isOpen(d) {
    var o = dayPrefs.open[dayKey(d)];
    if (o !== undefined) return !!o;
    return viewWeek === WEEK ? d === Util.todayIdx() : d === 1;
  }
  // Status einer KR: nicht bereit (offen) -> bereit (Handy/Dashboard) -> abgeschlossen (nur Dashboard)
  function stOf(t) { return t.closed ? 'abgeschlossen' : t.done ? 'bereit' : 'nicht bereit'; }
  var showClosed = false;
  try { showClosed = localStorage.getItem('dekr26_showclosed') === '1'; } catch (e) { /* ignorieren */ }

  // Karten der KR einer Liste von Einträgen (je KR eine Karte)
  function krCards(dt) {
    var groups = {}, order = [], html = '';
    dt.forEach(function (t) {
      if (!groups[t.kr]) { groups[t.kr] = []; order.push(t.kr); }
      groups[t.kr].push(t);
    });
    order.forEach(function (kr) {
      var ts = groups[kr];
      var all = ts.every(function (t) { return t.done; }), allClosed = ts.every(function (t) { return t.closed; });
      html += '<div class="card kr ' + (allClosed ? 'closed' : all ? 'ok' : 'open') + '"><div class="kr-n"><span>KR ' + esc(kr) + badges(ts[0]) + '</span>' +
        '<span style="color:' + (allClosed ? 'var(--dim)' : all ? 'var(--green)' : 'var(--orange)') + '">' +
        (allClosed ? 'abgeschlossen' : ts.filter(function (t) { return t.done; }).length + '/' + ts.length) + '</span></div><div class="chips">';
      ts.sort(function (a, b) { return a.pos < b.pos ? -1 : 1; }).forEach(function (t) {
        var isSel = sel && (sel.id ? sel.id === t.id : sel.hall === t.hall && sel.pos === t.pos);
        html += '<button class="chip' + (t.closed ? ' closed' : t.done ? ' done' : '') + (isSel ? ' sel' : '') +
          '" data-id="' + esc(t.id) + '">' +
          (t.pos ? esc(Halls.label(t.hall, t.pos)) : t.from ? 'Lieferung Halle ' + esc(t.from) : 'ohne Position') + '</button>';
      });
      html += '</div></div>';
    });
    return html;
  }

  // Alle KR aller Wochen, nach Woche und Tag geordnet, mit Suchfilter (KR, Position, Lieferumfang)
  var allMode = false, krFilter = '';
  function renderAllKr(tasks) {
    var q = krFilter.trim().toLowerCase();
    var list = tasks.filter(function (t) {
      if (!q) return true;
      var hay = (t.kr + ' ' + (t.pos ? Halls.label(t.hall, t.pos) : '') + ' ' + (t.scope || '') + (t.usa ? ' usa' : '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    }).sort(function (a, b) { return a.week < b.week ? -1 : a.week > b.week ? 1 : a.day - b.day; });
    var done = list.filter(function (t) { return t.done; }).length;
    var html = '<div class="empty" style="margin-bottom:6px">' + list.length + ' Einträge · ' + done + ' fertig' + (q ? ' (gefiltert)' : '') + '</div>';
    var last = '';
    for (var d = 0; d < list.length; d++) {
      var t = list[d], key = t.week + '-' + t.day;
      if (key !== last) {
        if (last) html += '</div>';
        var grp = list.filter(function (x) { return x.week === t.week && x.day === t.day; });
        html += '<div class="day"><div class="day-h orb"><span>' + kwText(t.week) + ' · ' + Util.DAYS[t.day] + ' ' + Util.dayDate(t.week, t.day) +
          '</span><span class="cnt">' + grp.filter(function (x) { return x.done; }).length + '/' + grp.length + '</span></div>';
        html += krCards(grp);
        last = key;
      }
    }
    if (last) html += '</div>';
    $('week-list').innerHTML = list.length ? html : '<div class="empty">Keine KR gefunden.</div>';
  }

  // Kisten pro Tag (am Handy eingetragen): kleine Anzeige am Tageskopf
  function kistenTag(dt) {
    var k2 = 0, k5 = 0;
    dt.forEach(function (t) { k2 += +t.k2 || 0; k5 += +t.k5 || 0; });
    return (k2 || k5) ? '<small class="kis" title="Kisten gesamt an diesem Tag">K2 ' + k2 + ' · K5 ' + k5 + '</small> ' : '';
  }
  function renderWeek(tasks) {
    $('dayBar').hidden = allMode;
    $('krFilter').hidden = !allMode;
    $('allToggle').textContent = allMode ? 'Woche' : 'Alle KR';
    if (allMode) { renderAllKr(tasks); return; }
    var html = '';
    $('dayBar').innerHTML = [1, 2, 3, 4, 5].map(function (d) {
      var hid = !!dayPrefs.hidden[d];
      return '<button class="daychip' + (hid ? ' off' : '') + '" data-dayvis="' + d + '" title="' + (hid ? 'Einblenden' : 'Ausblenden') + '">' +
        Util.DAYS[d].slice(0, 2) + '</button>';
    }).join('');
    for (var d = 1; d <= 5; d++) {
      if (dayPrefs.hidden[d]) continue;
      var dt = tasks.filter(function (t) { return t.day === d; });
      var done = dt.filter(function (t) { return t.done; }).length;
      var groups = {}, order = [];
      dt.forEach(function (t) {
        if (!groups[t.kr]) { groups[t.kr] = []; order.push(t.kr); }
        groups[t.kr].push(t);
      });
      var isToday = viewWeek === WEEK && d === Util.todayIdx();
      var open = isOpen(d);
      html += '<div class="day' + (isToday ? ' today' : '') + '">' +
        '<div class="day-h orb" data-day="' + d + '"><span>' + (open ? '▾ ' : '▸ ') + Util.DAYS[d] + ' ' + Util.dayDate(viewWeek, d) + (isToday ? ' · heute' : '') +
        '</span><span class="cnt">' + kistenTag(dt) + done + '/' + dt.length + '</span></div>';
      if (!open) { html += '</div>'; continue; }
      if (!order.length) html += '<div class="empty">– keine KR –</div>';
      html += krCards(dt);
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
    // Abgeschlossene Positionen sind erledigt: sie stehen nur auf der Karte, wenn „Abgeschlossene zeigen" gewählt ist
    var mapPos = {};
    Object.keys(byPos).forEach(function (p) {
      var ts = byPos[p].filter(function (t) { return showClosed || !t.closed; });
      if (ts.length) mapPos[p] = ts;
    });
    var posKeys = Object.keys(mapPos);
    var activeKeys = Object.keys(byPos).filter(function (p) { return byPos[p].some(function (t) { return !t.closed; }); });
    var ready = activeKeys.filter(function (p) { return byPos[p].filter(function (t) { return !t.closed; }).every(function (t) { return t.done; }); }).length;
    var closedN = Object.keys(byPos).length - activeKeys.length;

    $('hallName').textContent = hall.name;
    $('hallStat').textContent = ready + '/' + activeKeys.length + ' Positionen bereit' + (closedN ? ' · ' + closedN + ' abgeschlossen' : '');
    $('hallSwitch').innerHTML = Halls.all.map(function (x, i) {
      return '<button type="button" class="' + (i === hallIdx ? 'btn-main' : '') + '" data-hall="' + x.id + '">' + esc(x.name) + '</button>';
    }).join('');
    $('hallSwitch').hidden = Halls.all.length < 2;

    // Kartengröße: Zoom in Prozent der Breite (im Admin-Modus mindestens 200 %), Schrift unabhängig davon
    var effZoom = editing ? Math.max(mapZoom, 200) : mapZoom;
    var svg = '<svg class="map' + (lay.plan ? ' plan' : '') + '" style="width:' + effZoom + '%" viewBox="' + lay.vb + '">';
    if (lay.plan) svg += lay.plan;
    lay.labels.forEach(function (l) {
      if (!editing) {
        if (l.off) return;
        svg += '<text class="axis" style="font-size:' + Math.max(lay.font, 10) * mapFont + 'px" x="' + l.x + '" y="' + l.y + '">' + esc(l.t) + '</text>';
        return;
      }
      var col = l.axis === 'c';
      var lh = l.h || lay.ph;
      var rx = col ? l.x - lay.pw / 2 + 1 : l.x - 15, ry = col ? l.y - 15 : l.y - 4 - lh / 2 + 1;
      svg += '<g class="handle' + (l.off ? ' off' : '') + '" data-axis="' + l.axis + '" data-i="' + l.i + '"><rect x="' + rx + '" y="' + ry +
        '" width="' + (col ? lay.pw - 2 : 30) + '" height="' + (col ? 20 : lh - 2) + '" rx="3"/>' +
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
      var ts = mapPos[p.id];
      var cls = 'cell';
      if (ts) {
        var act = ts.filter(function (t) { return !t.closed; });
        cls += !act.length ? ' closed' : act.every(function (t) { return t.done; }) ? ' done' : ' open';
        if (act.some(function (t) { return openProb[t.kr]; })) cls += ' prob';
        else if (act.some(function (t) { return waveKr[t.kr]; })) cls += ' wave';
      }
      if (sel && sel.hall === hall.id && sel.pos === p.id) cls += ' sel';
      svg += '<g data-pos="' + esc(p.id) + '"><rect class="' + cls + '" x="' + p.x + '" y="' + p.y +
        '" width="' + p.w + '" height="' + p.h + '" rx="2"><title>' + esc(Halls.label(hall.id, p.id)) + '</title></rect>';
      if (/ (prob|wave)/.test(cls)) {
        // Druckwellen: rot bei Problem, grün bei neuer „Beipack bereit“-Meldung (bis zur Bestätigung)
        var rc = / prob/.test(cls) ? ' red' : '', cx = p.x + p.w / 2, cy = p.y + p.h / 2, rr = Math.min(p.w, p.h) / 2;
        for (var wv = 0; wv < 3; wv++) {
          svg += '<circle class="cp-ring' + rc + '" cx="' + cx + '" cy="' + cy + '" r="' + rr + '" style="animation-delay:' + (wv * 0.8) + 's"/>';
        }
      }
      if (ts) svg += '<text class="cell-t" style="font-size:' + (p.f * mapFont) + 'px" x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + p.f * mapFont / 3) + '">' + esc(Halls.label('', p.id)) + '</text>';
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
        (sel.id ? (Store.get().tasks[sel.id] && Store.get().tasks[sel.id].from ? 'Lieferung aus Halle ' + esc(Store.get().tasks[sel.id].from) : 'Eintrag ohne Position') : 'Position ' + esc(Halls.label(sel.hall, sel.pos))) + '</div>';
      var notes = ts.filter(function (t) { return t.chg && Date.now() - t.chgAt < 864e5; });
      if (!ts.length) html += '<div class="empty">Kein Beipack geplant.</div>';
      notes.forEach(function (t) { html += '<div class="note">KR ' + esc(t.kr) + ': ' + esc(t.chg) + '</div>'; });
      ts.forEach(function (t) {
        html += '<div class="line"><span>KR ' + esc(t.kr) + badges(t) + ' · ' + Util.DAYS[t.day].slice(0, 2) + ' · <b style="color:' +
          (t.closed ? 'var(--dim)' : t.done ? 'var(--green)' : 'var(--orange)') + '">' + esc(stOf(t)) + '</b>' +
          (t.closed && t.closedBy ? ' <span class="meta">von ' + esc(t.closedBy) + '</span>' : '') + '</span><span>' +
          (t.closed
            ? '<button class="btn-sm" data-act="reopen" data-id="' + esc(t.id) + '">Wieder öffnen</button> '
            : '<button class="btn-sm" data-act="toggle" data-id="' + esc(t.id) + '">' + (t.done ? 'Nicht bereit' : 'Bereit') + '</button> ' +
              '<button class="btn-sm btn-ok" data-act="close" data-id="' + esc(t.id) + '">Abschließen</button> ') +
          '<button class="btn-sm btn-warn" data-act="del" data-id="' + esc(t.id) + '">Löschen</button></span></div>';
      });
    } else {
      html += '<div class="empty">Position auf der Karte oder in der Liste anklicken.</div>';
    }
    if (missing.length) {
      html += '<div class="note" style="margin-top:6px">Außerhalb des Rasters: ' + missing.map(function (id) { return esc(Halls.label(Halls.all[hallIdx].id, id)); }).join(', ') + '</div>';
    }
    el.innerHTML = html;
  }

  // ---------- Nachrichten ----------
  function renderMsgs(state) {
    if (Store.isLocked()) return;   // noch keine Daten: nichts vormerken, sonst gelten später alle als neu
    var all = Object.keys(state.msgs).map(function (id) {
      var m = state.msgs[id]; m.id = id; return m;
    }).filter(function (m) { return m.type !== 'plan' && m.type !== 'order'; })   // Planung/Import und Bestellungen stehen nicht im Nachrichtenstrom
      .sort(function (a, b) { return b.t - a.t; });
    // Unbestätigte „fertig"-Meldungen stehen immer oben und pulsieren grün
    var needsAck = function (m) { return (m.type === 'done' || m.type === 'problem') && !m.ack; };
    var unack = all.filter(needsAck);
    var list = unack.concat(all.filter(function (m) { return !needsAck(m); }).slice(0, 70));
    $('cMsg').textContent = unack.length || '';

    var fresh = {}, focusHall = '';
    if (seen) {
      list.forEach(function (m) {
        if (!seen[m.id]) {
          fresh[m.id] = 1;
          if (m.type === 'done' || m.type === 'problem') { toast(m.text); Sound.play(m.type); }
          if (m.type === 'done' && m.kr && !editing) focusHall = m.kr;
        }
      });
    }
    seen = seen || {};
    list.forEach(function (m) { seen[m.id] = 1; });
    // Neue „Beipack bereit“-Meldung: Karte wechselt in die Halle dieser Position
    if (focusHall) {
      var tk = Object.keys(state.tasks).map(function (id) { return state.tasks[id]; }).filter(function (t) { return t.kr === focusHall && t.hall; })[0];
      var ix = tk ? Halls.all.findIndex(function (h) { return h.id === tk.hall; }) : -1;
      if (ix >= 0 && ix !== hallIdx) { hallIdx = ix; sel = null; renderMap(mapTasks(weekTasks(state))); }
    }

    $('msgs').innerHTML = list.length ? list.map(function (m) {
      var pulse = needsAck(m);
      return '<div class="msg ' + esc(m.type) + (pulse ? ' pulse' : '') + (fresh[m.id] ? ' fresh' : '') + '">' + esc(m.text) +
        '<small>' + Util.time(m.t) + ' · ' + esc(m.by || '') + (m.ack ? ' · ✔ bestätigt von ' + esc(m.ack.by) : '') + (m.type === 'dm' && m.reads ? ' · ✔ gelesen von ' + Object.keys(m.reads).map(function (k) { return esc(m.reads[k].by); }).join(', ') : '') + '</small>' +
        '<span class="acts">' + (pulse ? '<button class="btn-sm btn-ok" data-ack="' + esc(m.id) + '">Bestätigen</button>' : '') +
        '<button class="btn-sm btn-warn" data-delmsg="' + esc(m.id) + '">Löschen</button></span></div>';
    }).join('') : '<div class="empty">Keine Nachrichten.</div>';
  }
  $('msgs').onclick = function (e) {
    var d = e.target.closest('button[data-delmsg]');
    if (d) { Store.setMsg(d.dataset.delmsg, null).catch(function () { toast('Löschen fehlgeschlagen'); }); return; }
    var b = e.target.closest('button[data-ack]');
    var m = b && Store.get().msgs[b.dataset.ack];
    if (!m) return;
    Store.updateMsg(b.dataset.ack, { ack: { by: Util.getName() || 'Deufol', t: Date.now() } })
      .then(function () { Push.ack(m, Util.getName()); })
      .catch(function () { toast('Bestätigen fehlgeschlagen'); });
  };

  var tab = 'msgs';
  function openOrderIds(state) {
    return Object.keys(state.orders).filter(function (id) { return state.orders[id].status !== 'erledigt' && state.orders[id].kind !== 'ueber'; });
  }
  function openUeberIds(state) {
    return Object.keys(state.orders).filter(function (id) { return state.orders[id].status !== 'erledigt' && state.orders[id].kind === 'ueber'; });
  }
  var ordSeen = null;
  function renderOrders(state) {
    if (Store.isLocked()) return;
    var openIds = Object.keys(state.orders).filter(function (id) { return state.orders[id].status === 'offen' && state.orders[id].kind !== 'ueber'; });
    if (ordSeen) {
      openIds.forEach(function (id) {
        var o = state.orders[id];
        if (!ordSeen[id] && !(o.func === 'Dashboard' && o.by === Util.getName())) { toast('Neue Podest-Bestellung: ' + o.items.join(', ') + (o.where ? ' · ' + o.where : '')); Sound.play('order'); }
      });
    }
    ordSeen = ordSeen || {};
    openIds.forEach(function (id) { ordSeen[id] = 1; });
    var ids = Object.keys(state.orders).filter(function (id) { return state.orders[id].kind !== 'ueber'; }).sort(function (a, b) { return state.orders[b].t - state.orders[a].t; }).slice(0, 60);
    ids.sort(function (a, b) { return (state.orders[a].status === 'erledigt') - (state.orders[b].status === 'erledigt'); });
    $('orders').innerHTML = ids.length ? ids.map(function (id) {
      var o = state.orders[id], fin = o.status === 'erledigt';
      return '<div class="item' + (fin ? ' ok' : '') + '"><b>' + esc(o.items.join(', ')) + '</b><span>' + esc(o.where) + '</span>' +
        '<span class="meta">' + Util.time(o.t) + ' · ' + esc(o.by) + ' · <b>' + esc(o.status) + '</b>' + (o.statusBy ? ' von ' + esc(o.statusBy) : '') + '</span>' +
        '<span class="acts">' + (fin ? '' : (o.status === 'offen' ? '<button class="btn-sm" data-oid="' + id + '" data-st="angenommen">Annehmen</button>' : '') +
          '<button class="btn-sm btn-ok" data-oid="' + id + '" data-st="erledigt">Erledigt</button>') +
        '<button class="btn-sm btn-warn" data-oid="' + id + '" data-st="del">Löschen</button></span></div>';
    }).join('') : '<div class="empty">Keine Podest-Bestellungen.</div>';
  }
  // Anfragen „Überspielen": annehmen, als fertig melden, löschen
  var ueSeen = null;
  function renderUeber(state) {
    if (Store.isLocked()) return;
    var ids = Object.keys(state.orders).filter(function (id) { return state.orders[id].kind === 'ueber'; });
    var openIds = ids.filter(function (id) { return state.orders[id].status === 'offen'; });
    if (ueSeen) {
      openIds.forEach(function (id) {
        if (!ueSeen[id]) { var o = state.orders[id]; toast('Neue Anfrage Überspielen: ' + o.where + ' (' + o.by + ')'); Sound.play('order'); }
      });
    }
    ueSeen = ueSeen || {};
    openIds.forEach(function (id) { ueSeen[id] = 1; });
    ids.sort(function (x, y) { return state.orders[y].t - state.orders[x].t; });
    ids = ids.slice(0, 60);
    ids.sort(function (x, y) { return (state.orders[x].status === 'erledigt') - (state.orders[y].status === 'erledigt'); });
    $('uebs').innerHTML = ids.length ? ids.map(function (id) {
      var o = state.orders[id], fin = o.status === 'erledigt';
      return '<div class="item' + (fin ? ' ok' : '') + '"><b>Überspielen · ' + esc(o.where) + '</b>' + (o.note ? '<span>' + esc(o.note) + '</span>' : '') +
        '<span class="meta">' + Util.time(o.t) + ' · ' + esc(o.by) + (o.func ? ' (' + esc(o.func) + ')' : '') + ' · <b>' + esc(fin ? 'fertig' : o.status) + '</b>' + (o.statusBy ? ' von ' + esc(o.statusBy) : '') + '</span>' +
        '<span class="acts">' + (fin ? '' : (o.status === 'offen' ? '<button class="btn-sm" data-oid="' + id + '" data-st="angenommen">Annehmen</button>' : '') +
          '<button class="btn-sm btn-ok" data-oid="' + id + '" data-st="erledigt">Fertig melden</button>') +
        '<button class="btn-sm btn-warn" data-oid="' + id + '" data-st="del">Löschen</button></span></div>';
    }).join('') : '<div class="empty">Keine Anfragen Überspielen.</div>';
  }
  function renderProbs(state) {
    var ids = Object.keys(state.problems).sort(function (a, b) { return state.problems[b].t - state.problems[a].t; }).slice(0, 60);
    ids.sort(function (a, b) { return (state.problems[a].status !== 'offen') - (state.problems[b].status !== 'offen'); });
    $('probs').innerHTML = ids.length ? ids.map(function (id) {
      var p = state.problems[id], open = p.status === 'offen';
      return '<div class="item ' + (open ? 'prob' : 'ok') + '"><b>KR ' + esc(p.kr) + (p.where ? ' · ' + esc(p.where) : '') + '</b><span>' + esc(p.text) + '</span>' +
        '<span class="meta">' + Util.time(p.t) + ' · ' + esc(p.by) + (p.func ? ' (' + esc(p.func) + ')' : '') + ' · <b>' + esc(p.status) + '</b>' + (p.solvedBy ? ' von ' + esc(p.solvedBy) : '') + '</span>' +
        '<span class="acts">' + (open ? '<button class="btn-sm btn-ok" data-pid="' + id + '" data-st="solve">Gelöst</button>' : '') +
        '<button class="btn-sm btn-warn" data-pid="' + id + '" data-st="del">Löschen</button></span></div>';
    }).join('') : '<div class="empty">Keine Probleme.</div>';
  }
  // ---- Podest vom Dashboard bestellen ----
  var dSel = {}, dAuto = '';
  function renderDOrder(state) {
    var names = podestList(state).map(function (p) { return p.name; });
    if (!names.length) names = (window.DEKR_CONFIG || {}).podests || [];
    $('dPdList').innerHTML = names.map(function (n) {
      return '<button type="button" class="chip pick' + (dSel[n] ? ' on' : '') + '" data-n="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('') || '<span class="empty">Keine Auswahl hinterlegt – bitte Text eintragen.</span>';
    var cur = $('dKrList').childElementCount;
    var list = Object.keys(state.tasks).map(function (id) { return state.tasks[id]; });
    if (cur !== list.length) {
      $('dKrList').innerHTML = list.slice(0, 500).map(function (t) {
        return '<option value="' + esc(t.kr) + '">KR ' + esc(t.kr) + (t.pos ? ' · ' + esc(Halls.label(t.hall, t.pos)) : '') + '</option>';
      }).join('');
    }
  }
  $('dPdList').onclick = function (e) {
    var b = e.target.closest('.pick');
    if (!b) return;
    dSel[b.dataset.n] = !dSel[b.dataset.n];
    renderDOrder(Store.get());
  };
  function fillDPos() {
    var kr = Util.normKr($('dPdKr').value), ts = Object.keys(Store.get().tasks).map(function (id) { return Store.get().tasks[id]; })
      .filter(function (t) { return t.kr === kr; });
    var cur = $('dPdPos').value.trim(), auto = ts[0] && ts[0].pos ? Halls.label(ts[0].hall, ts[0].pos) : '';
    if (!cur || cur === dAuto) { $('dPdPos').value = auto; dAuto = auto; }
  }
  $('dPdKr').addEventListener('input', fillDPos);
  $('dPdPos').addEventListener('input', function () { if ($('dPdPos').value.trim() !== dAuto) dAuto = ''; });
  $('dOrder').onsubmit = function (e) {
    e.preventDefault();
    var items = Object.keys(dSel).filter(function (n) { return dSel[n]; });
    var free = $('dPdText').value.trim();
    if (free) items.push(free);
    var kr = Util.normKr($('dPdKr').value), raw = $('dPdPos').value.trim();
    if (!items.length) { toast('Bitte Podest auswählen oder Text eintragen'); return; }
    if (!kr && !raw) { toast('Bitte KR oder Position angeben'); return; }
    var pp = raw ? Util.parsePos(raw) : null;
    if (raw && !pp) { toast('Position nicht erkannt, z.B. 7 42 Z'); return; }
    var t = kr ? Object.keys(Store.get().tasks).map(function (id) { return Store.get().tasks[id]; }).filter(function (x) { return x.kr === kr; })[0] : null;
    var hallId = (pp && pp.hall && Halls.byShort(pp.hall)) || (t && t.hall) || Halls.all[0].id;
    var posL = pp ? Halls.label(hallId, pp.pos) : t && t.pos ? Halls.label(t.hall, t.pos) : '';
    var where = [kr ? 'KR ' + kr : '', posL].filter(Boolean).join(' · ');
    var name = Util.getName();
    // Doppelte Bestellung verhindern (gleiche ID bei Wiederholung, gleiche Bestellung in den letzten 2 Minuten)
    var all = Store.get().orders, key = items.join('|');
    if (!dOrderId) dOrderId = Util.uid();
    var dup = Object.keys(all).some(function (id) {
      var o = all[id];
      return id !== dOrderId && o.func === 'Dashboard' && o.by === name && o.where === where && o.items.join('|') === key && Date.now() - o.t < 12e4;
    });
    if (dup) { toast('Diese Bestellung wurde gerade schon aufgegeben'); return; }
    var btn = $('dOrder').querySelector('.btn-main');
    btn.disabled = true;
    Store.setOrder(dOrderId, { items: items, kr: kr, where: where, by: name, func: 'Dashboard', qid: '', t: Date.now(), status: 'offen' })
      .then(function () {
        dOrderId = null;
        Push.send('podest', 'Podest-Bestellung', 'Podest bestellt: ' + items.join(', ') + ' für ' + where + ' (' + name + ')', 3, ['package']);
        dSel = {}; dAuto = ''; $('dPdText').value = ''; $('dPdKr').value = ''; $('dPdPos').value = '';
        renderDOrder(Store.get()); toast('Bestellt');
      }).catch(function () { toast('Bestellen fehlgeschlagen'); }).then(function () { btn.disabled = false; });
  };
  var dOrderId = null;

  function renderTabs() {
    var ids = { msgs: 'msgs', orders: 'orders', ueber: 'uebs', probs: 'probs' };
    Object.keys(ids).forEach(function (k) { $(ids[k]).hidden = k !== tab; });
    $('send').hidden = tab !== 'msgs';
    $('dOrder').hidden = tab !== 'orders';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('sel', b.dataset.tab === tab); });
  }
  document.querySelector('.tabs').onclick = function (e) {
    var b = e.target.closest('.tab');
    if (b) { tab = b.dataset.tab; renderTabs(); }
  };
  $('uebs').onclick = function (e) { $('orders').onclick(e); };
  $('orders').onclick = function (e) {
    var b = e.target.closest('button[data-oid]');
    var o = b && Store.get().orders[b.dataset.oid];
    if (!o) return;
    var p = b.dataset.st === 'del' ? Store.setOrder(b.dataset.oid, null)
      : Store.updateOrder(b.dataset.oid, { status: b.dataset.st, statusBy: Util.getName() || 'Deufol', statusAt: Date.now() })
        .then(function () { if (!o.selfDone) Push.orderStatus(o, b.dataset.st, Util.getName()); });
    p.catch(function () { toast('Speichern fehlgeschlagen'); });
  };
  $('probs').onclick = function (e) {
    var b = e.target.closest('button[data-pid]');
    var pr = b && Store.get().problems[b.dataset.pid];
    if (!pr) return;
    var p = b.dataset.st === 'del' ? Store.setProblem(b.dataset.pid, null)
      : Store.updateProblem(b.dataset.pid, { status: 'gelöst', solvedBy: Util.getName() || 'Deufol', solvedAt: Date.now() })
        .then(function () { Push.toQr(pr.qid, 'Problem gelöst', '✔ Problem KR ' + pr.kr + ' gelöst von ' + Util.getName()); });
    p.catch(function () { toast('Speichern fehlgeschlagen'); });
  };

  function mapTasks(tasks) {
    return allMode ? tasks : tasks.filter(function (t) { return !dayPrefs.hidden[t.day]; });
  }
  function render(state) {
    openProb = {};
    Object.keys(state.problems).forEach(function (id) { if (state.problems[id].status === 'offen') openProb[state.problems[id].kr] = 1; });
    $('cOrd').textContent = openOrderIds(state).length || '';
    $('cUeb').textContent = openUeberIds(state).length || '';
    renderUeber(state);
    $('cProb').textContent = Object.keys(openProb).length ? Object.keys(state.problems).filter(function (id) { return state.problems[id].status === 'offen'; }).length : '';
    renderOrders(state);
    renderProbs(state);
    renderRecipients(state);
    renderDOrder(state);
    renderTabs();
    waveKr = {};
    Object.keys(state.msgs).forEach(function (id) {
      var m = state.msgs[id];
      if (m.type === 'done' && !m.ack && m.kr) waveKr[m.kr] = 1;
    });
    var tasks = weekTasks(state);
    renderWeek(tasks);
    // Ausgeblendete Tage verschwinden auch von der Karte (in der Ansicht „Alle KR" gilt das nicht)
    renderMap(mapTasks(tasks));
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

  // Kartengröße (Zoom und Schrift) im Browser gemerkt
  function loadNum(key, def, min, max) {
    try { var v = parseFloat(localStorage.getItem(key)); if (v >= min && v <= max) return v; } catch (e) { /* ignorieren */ }
    return def;
  }
  var mapZoom = loadNum('dekr26_mapzoom', 100, 50, 400), mapFont = loadNum('dekr26_mapfont', 1, 0.6, 2.4);
  function setMapSize(zoom, font) {
    mapZoom = Math.max(50, Math.min(400, Math.round(zoom)));
    mapFont = Math.max(0.6, Math.min(2.4, Math.round(font * 100) / 100));
    try { localStorage.setItem('dekr26_mapzoom', mapZoom); localStorage.setItem('dekr26_mapfont', mapFont); } catch (e) { /* ignorieren */ }
    $('zVal').textContent = mapZoom + '%';
    render(Store.get());
  }
  $('zOut').onclick = function () { setMapSize(mapZoom - 20, mapFont); };
  $('zIn').onclick = function () { setMapSize(mapZoom + 20, mapFont); };
  $('zFit').onclick = function () { setMapSize(100, 1); };
  $('fOut').onclick = function () { setMapSize(mapZoom, mapFont / 1.2); };
  $('fIn').onclick = function () { setMapSize(mapZoom, mapFont * 1.2); };
  $('zVal').textContent = mapZoom + '%';
  // Strg + Mausrad über der Karte zoomt
  $('map').addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setMapSize(mapZoom + (e.deltaY < 0 ? 20 : -20), mapFont);
  }, { passive: false });

  // Abgeschlossene auf der Karte zeigen/verbergen
  $('showClosed').checked = showClosed;
  $('showClosed').onchange = function () {
    showClosed = $('showClosed').checked;
    try { localStorage.setItem('dekr26_showclosed', showClosed ? '1' : '0'); } catch (e) { /* ignorieren */ }
    render(Store.get());
  };

  // ---------- Klicks ----------
  $('week-list').onclick = function (e) {
    var h = !allMode && e.target.closest('.day-h');
    if (h) {
      var d = +h.dataset.day;
      dayPrefs.open[dayKey(d)] = isOpen(d) ? 0 : 1;
      saveDayPrefs(); render(Store.get());
      return;
    }
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
    } else if (b.dataset.act === 'close') {
      // „Abgeschlossen" setzen nur wir am Dashboard (nicht am Handy)
      var who = Util.getName() || 'Deufol';
      p = Store.updateTask(b.dataset.id, { done: true, doneAt: t.doneAt || Date.now(), doneBy: t.doneBy || who, closed: true, closedAt: Date.now(), closedBy: who });
    } else if (b.dataset.act === 'reopen') {
      p = Store.updateTask(b.dataset.id, { closed: null, closedAt: null, closedBy: null });
    } else {
      var nd = !t.done;
      p = Store.updateTask(b.dataset.id, { done: nd, doneAt: nd ? Date.now() : null, doneBy: nd ? (Util.getName() || 'Deufol') : null });
    }
    p.catch(function () { toast('Speichern fehlgeschlagen'); });
  };

  // ---------- Import (Kopieren und Einfügen) ----------
  // Nur die gewählten Spalten werden verarbeitet; alles andere wird verworfen und nie gespeichert.
  // Gespeichert werden: KR, Tag, Halle, Position, Lieferumfang (Maschine/komplett) und ein USA-Hinweis (Land = US).
  var ROLES = [['', 'ignorieren'], ['kr', 'KR'], ['year', 'Jahr'], ['kw', 'KW'], ['day', 'Tag'], ['date', 'Datum'], ['hall', 'Halle'], ['num', 'Nummer'],
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
    var rows = [['KR', 'Jahr', 'KW', 'Tag', 'Datum', 'Halle', 'Nummer', 'Buchstabe', 'Lieferumfang', 'Land']];
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
      var dt = /^\d{1,2}\.\d{1,2}\.(\d{4}|\d{2})$/.test(rec[4] || '') ? 4 : -1;   // Datum steht direkt hinter dem Wochentag
      rows.push([rec[krI], rec[1], rec[2], rec[3], dt >= 0 ? rec[dt] : '', R[0] || '', k ? R[k] : '', k ? R[2 * k] : '', sc >= 0 ? rec[sc] : '',
        c >= 0 ? rec[c] : '']);
    });
    return rows;
  }
  function parseTable(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    // Eine echte Tabelle hat in (fast) jeder Zeile Tabs; einzelne Tab-Zeilen in der Zellen-pro-Zeile-Liste zählen nicht
    var tabLines = lines.filter(function (l) { return /\S\t\S/.test(l); }).length;
    if (tabLines * 5 < lines.length) {
      var rec = parseRecords(text);
      if (rec) return rec;
    }
    var sep = /\t/.test(text) ? /\t/ : /;/.test(text) ? /;/ : /\s{2,}/;
    return lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim(); }); });
  }
  function guess(h) {
    h = String(h || '').toLowerCase().trim();
    if (/^kr(\W|$)|kr-?nr/.test(h)) return 'kr';
    if (h === 'tag') return 'day';
    if (/^datum|^date$/.test(h)) return 'date';
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
  var DELIVERED_HALL = '3';   // Halle 3 gehört nicht zu uns: KR werden nur geliefert
  function readRow(r, ci, dayDef) {
    var g = function (role) { return ci[role] >= 0 ? (r[ci[role]] || '') : ''; };
    var kr = Util.normKr(g('kr'));
    if (!kr) return { skip: 'leer' };
    var hall = '', from = '';
    if (ci.hall >= 0) {
      var major = g('hall').trim().split('.')[0];
      hall = Halls.byShort(major);   // Hallen 6 und 7 (eigene Hallen)
      // Aus Halle 3 wird nur geliefert: Eintrag ohne Position, mit Hinweis auf die Herkunft
      if (!hall && major === DELIVERED_HALL) from = major;
      else if (!hall) return { skip: 'andere Halle' };
    }
    var scope = '';
    if (ci.scope >= 0) {
      var sc = g('scope').toLowerCase();
      scope = /schrumpf/.test(sc) ? '' : /komplett/.test(sc) ? 'komplett' : /maschine/.test(sc) ? 'Maschine' : '';
      if (!scope) return { skip: 'Lieferumfang' };
    }
    var pos = '';
    if (from) { /* Lieferung: keine Position */ }
    else if (ci.pos >= 0) pos = Util.normPos(g('pos'));
    else if (ci.num >= 0 && ci.letter >= 0) {
      var letter = (g('letter').toUpperCase().match(/[A-Z]/) || [''])[0];
      var num = (g('num').match(/\d+/) || [''])[0];
      if (letter && num) pos = letter + num;
    }
    var usa = g('country').trim().toUpperCase() === 'US';
    var yr = (g('year').match(/\d{4}/) || [''])[0], kw = (g('kw').match(/\d{1,2}/) || [''])[0];
    var week = yr && kw ? yr + '-W' + (kw.length < 2 ? '0' : '') + kw : viewWeek;
    var day = ci.day >= 0 ? parseDay(g('day')) || dayDef : dayDef;
    // Ein Datum hat Vorrang: es legt Kalenderwoche und Wochentag eindeutig fest (mehrere Wochen haben jeweils einen Montag)
    var dm = ci.date >= 0 ? g('date').match(/(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})/) : null;
    if (dm) {
      var dy = +dm[3] < 100 ? +dm[3] + 2000 : +dm[3], dd = new Date(dy, +dm[2] - 1, +dm[1]);
      if (dd.getFullYear() === dy && dd.getMonth() === +dm[2] - 1 && dd.getDate() === +dm[1]) {
        week = Util.isoWeek(dd);
        if (dd.getDay() >= 1 && dd.getDay() <= 5) day = dd.getDay();
      }
    }
    return { week: week, kr: kr, day: day, hall: hall, pos: pos, scope: scope, usa: usa, from: from };
  }
  function roleIdx() {
    var ci = {};
    ROLES.forEach(function (r) { if (r[0]) ci[r[0]] = imp.cols.indexOf(r[0]); });
    return ci;
  }
  // Liest die eingefügte Liste aus: gültige Einträge (je KR der erste) und Zähler der übersprungenen
  function collect() {
    var ci = roleIdx(), head = $('impHead').checked, dayDef = +$('impDay').value;
    var out = { items: [], hall: 0, scope: 0 }, seen = {};
    if (ci.kr < 0) return out;
    imp.rows.slice(head ? 1 : 0).forEach(function (r) {
      var x = readRow(r, ci, dayDef);
      if (x.skip === 'andere Halle') out.hall++;
      else if (x.skip === 'Lieferumfang') out.scope++;
      else if (!x.skip && !seen[x.kr]) {
        seen[x.kr] = 1;
        x.hallEff = x.pos ? (x.hall || Halls.all[0].id) : '';
        out.items.push(x);
      }
    });
    return out;
  }
  function posText(hall, pos) {
    return Halls.label(hall, pos);
  }
  function kwText(w) { return 'KW ' + w.split('-W')[1]; }
  // z.B. "Mo 26.10. (KW 44)" – das Datum macht gleiche Wochentage verschiedener Wochen unterscheidbar
  function dayText(w, d) { return Util.DAYS[d].slice(0, 2) + ' ' + Util.dayDate(w, d) + ' (' + kwText(w) + ')'; }
  // Vergleicht die Liste mit dem gespeicherten Stand: neu, verschoben, geändert, entfallen
  function diffItems(items) {
    var tasks = Store.get().tasks, byKr = {}, weeks = {}, inList = {};
    var res = { neu: [], moved: [], chg: [], gone: [], same: 0 };
    Object.keys(tasks).forEach(function (id) {
      var t = Object.assign({ id: id }, tasks[id]);
      (byKr[t.kr] = byKr[t.kr] || []).push(t);
    });
    items.forEach(function (x) {
      inList[x.kr] = 1; weeks[x.week] = 1;
      var ex = byKr[x.kr];
      if (!ex) { x.how = 'neu'; res.neu.push(x); return; }
      var e = ex[0], moved = [], ch = [];
      if (e.week !== x.week || e.day !== x.day) moved.push(dayText(e.week, e.day) + ' → ' + dayText(x.week, x.day));
      if ((e.pos || '') !== (x.pos || '') || (e.pos && (e.hall || '') !== x.hallEff)) {
        ch.push('Position ' + posText(e.hall, e.pos) + ' → ' + posText(x.hallEff, x.pos));
      }
      if ((e.scope || '') !== (x.scope || '')) ch.push('Lieferumfang ' + (e.scope || '–') + ' → ' + (x.scope || '–'));
      if (!!e.usa !== !!x.usa) ch.push(x.usa ? 'jetzt USA' : 'nicht mehr USA');
      x.chg = moved.concat(ch).join('; ');
      x.how = moved.length ? 'verschoben' : ch.length ? 'geändert' : 'gleich';
      x.chgK = x.how;
      if (x.how === 'verschoben') res.moved.push(x);
      else if (x.how === 'geändert') res.chg.push(x);
      else res.same++;
    });
    Object.keys(byKr).forEach(function (kr) {
      byKr[kr].forEach(function (t) {
        if (!inList[kr] && weeks[t.week] && !t.done) res.gone.push(t);
      });
    });
    return res;
  }
  function renderDiff(d) {
    var any = d.moved.length || d.chg.length || d.gone.length;
    var li = function (cls, kr, txt) { return '<li class="' + cls + '"><b>KR ' + esc(kr) + '</b> ' + esc(txt) + '</li>'; };
    var html = '<div class="diff-sum"><span class="b-new">Neu ' + d.neu.length + '</span> <span class="b-mov">Verschoben ' +
      d.moved.length + '</span> <span class="b-chg">Geändert ' + d.chg.length + '</span> <span class="b-gone">Entfallen ' +
      d.gone.length + '</span> <span>Unverändert ' + d.same + '</span></div>';
    if (any) {
      html += '<ul class="diff-list">' +
        d.moved.map(function (x) { return li('b-mov', x.kr, 'verschoben: ' + x.chg); }).join('') +
        d.chg.map(function (x) { return li('b-chg', x.kr, 'geändert: ' + x.chg); }).join('') +
        d.gone.map(function (t) { return li('b-gone', t.kr, 'steht nicht mehr in der Liste (' + dayText(t.week, t.day) + ')'); }).join('') +
        '</ul>';
    }
    $('impDiff').innerHTML = html;
    $('impDropRow').hidden = !d.gone.length;
  }
  function renderImp() {
    var rows = parseTable($('impText').value);
    imp.rows = rows;
    var n = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var head = $('impHead').checked;
    if (!n) {
      imp.cols = []; $('impPreview').innerHTML = ''; $('impGo').disabled = true; $('impInfo').textContent = '';
      $('impDiff').innerHTML = ''; $('impDropRow').hidden = true; return;
    }
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
    var ok = imp.cols.indexOf('kr') >= 0;
    $('impGo').disabled = !ok;
    if (!ok) { $('impInfo').textContent = 'Bitte über der KR-Spalte „KR" wählen.'; $('impDiff').innerHTML = ''; return; }
    var c = collect(), weeks = {};
    c.items.forEach(function (x) { weeks[x.week] = 1; });
    $('impInfo').textContent = c.items.length + ' KR (' + Object.keys(weeks).sort().map(function (w) { return kwText(w) + ' ' + Util.dayDate(w, 1) + '–' + Util.dayDate(w, 5); }).join(', ') + ') · ' +
      c.hall + ' andere Halle · ' + c.items.filter(function (x) { return x.from; }).length + ' aus Halle 3 (ohne Position) · ' + c.scope + ' ohne Maschine/komplett (übersprungen) · ' +
      c.items.filter(function (x) { return x.usa; }).length + ' USA' +
      (rows.multi ? ' · ' + rows.multi + ' mit mehreren Spots (erster wird genommen)' : '') +
      ' · nicht gewählte Spalten werden verworfen.';
    renderDiff(diffItems(c.items));
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
    var c = collect(), head = $('impHead').checked;
    if (!c.items.length) { toast('Keine KR gefunden'); return; }
    var d = diffItems(c.items), ops = [], firstWeek = '';
    c.items.forEach(function (x) {
      if (!firstWeek || x.week < firstWeek) firstWeek = x.week;
      var extra = { scope: x.scope, usa: x.usa, from: x.from };
      if (x.how === 'verschoben' || x.how === 'geändert') { extra.chg = x.chg; extra.chgK = x.how; }
      ops = ops.concat(planOps(x.kr, x.pos, x.day, x.hallEff || Halls.all[0].id, extra, x.hallEff, x.week));
    });
    if ($('impDrop').checked) d.gone.forEach(function (t) { ops.push({ coll: 'tasks', id: t.id, val: null }); });
    if (head) {
      try { localStorage.setItem(MAP_KEY, JSON.stringify({ sig: sigOf(imp.rows[0]), cols: imp.cols })); } catch (e) { /* ignorieren */ }
    }
    $('impGo').disabled = true;
    Store.batch(ops).then(function () {
      toast('Import: ' + d.neu.length + ' neu, ' + d.moved.length + ' verschoben, ' + d.chg.length + ' geändert');
      viewWeek = firstWeek; weekLabel(); render(Store.get());
      $('impText').value = ''; imp.cols = []; renderImp();
      $('impModal').hidden = true;
    }).catch(function () { toast('Import fehlgeschlagen'); renderImp(); });
  };
  $('impDay').innerHTML = $('pDay').innerHTML;

  // ---------- QR-Codes ----------
  // Der Code enthält nur die ID (?q=...). Name, Funktion und Rechte lassen sich daher jederzeit ändern,
  // ohne dass ausgedruckte Codes ungültig werden.
  var PERM_LABELS = [['report', 'Beipack melden (bereit/Problem)'], ['order', 'Podest bestellen'], ['kisten', 'Kisten je KR eintragen (K2/K5)'],
    ['podest', 'Bestellungen bearbeiten'], ['solve', 'Probleme lösen'], ['status', 'Bereit/Nicht bereit setzen'],
    ['dash', 'Mobiles Dashboard'], ['ueber', 'Anfrage Überspielen']];
  var PRESETS = [
    ['standard', 'Standard (melden + bestellen)', '', { report: 1, order: 1 }],
    ['kisten', 'Kisten K2/K5 eintragen', '', { report: 1, kisten: 1 }],
    ['podest', 'Podest-Empfänger', 'Podest-Empfänger', { podest: 1, order: 1 }],
    ['elektriker', 'Elektriker', 'Elektriker', { report: 1, status: 1 }],
    ['ueber', 'Anfrage Überspielen', '', { report: 1, ueber: 1 }],
    ['mobil', 'Mobiles Dashboard (Push)', 'Dashboard mobil', { dash: 1 }],
    ['alles', 'Alle Rechte', '', { report: 1, order: 1, podest: 1, solve: 1, status: 1, dash: 1, ueber: 1, kisten: 1 }]
  ];
  function permsOf(q) { return q.perms && Object.keys(q.perms).length ? q.perms : { report: 1, order: 1 }; }
  // n/f/p sind nur ein Rückfall, falls das Handy die QR-Daten nicht aus der Datenbank laden kann
  function scanUrl(q) {
    var u = new URL('scan.html', location.href);
    u.searchParams.set('q', q.id);
    u.searchParams.set('n', q.name);
    if (q.func) u.searchParams.set('f', q.func);
    u.searchParams.set('p', Object.keys(permsOf(q)).join(','));
    var k = (Store.get().settings || {}).regcode;   // Anmelde-Code: neue Handys melden sich damit automatisch an
    if (k) u.searchParams.set('k', k);
    return u.href;
  }
  function presetOptions(sel) {
    return PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === sel ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('');
  }
  function renderQr(state) {
    var list = Object.keys(state.qrs).map(function (id) {
      var q = state.qrs[id]; q.id = id; return q;
    }).sort(function (a, b) { return a.t - b.t; });
    $('qrWarn').hidden = Store.remote;
    $('qrHint').textContent = list.length ? '' : 'Noch keine QR-Codes. Name eintragen, Vorlage wählen und „Hinzufügen" klicken.';
    $('qrGrid').innerHTML = list.map(function (q) {
      var qr = qrcode(0, 'M'), pm = permsOf(q);
      qr.addData(scanUrl(q));
      qr.make();
      return '<div class="card qr-card" data-id="' + esc(q.id) + '">' +
        '<h3 class="print-only">' + esc(q.name) + '</h3>' +
        (q.func ? '<div class="print-only">' + esc(q.func) + '</div>' : '') +
        '<input class="no-print" data-f="name" value="' + esc(q.name) + '" maxlength="40" placeholder="Name">' +
        '<input class="no-print" data-f="func" value="' + esc(q.func || '') + '" maxlength="40" placeholder="Funktion">' +
        '<select class="no-print" data-preset><option value="">Vorlage anwenden …</option>' + presetOptions('') + '</select>' +
        '<div class="perms no-print">' + PERM_LABELS.map(function (p) {
          return '<label><input type="checkbox" data-perm="' + p[0] + '"' + (pm[p[0]] ? ' checked' : '') + '>' + esc(p[1]) + '</label>';
        }).join('') + '</div>' +
        qr.createSvgTag(4, 2) +
        '<div class="no-print qr-links"><a href="' + esc(scanUrl(q)) + '" target="_blank" rel="noopener">Seite am PC testen ↗</a> ' +
        '<button class="btn-sm" data-card="' + esc(q.id) + '">Karte drucken</button> ' +
        '<button class="btn-sm btn-warn" data-del="' + esc(q.id) + '">Löschen</button></div></div>';
    }).join('');
    renderPodestEdit(state);
  }
  // Einzelne Karte mit Gestaltung drucken (Name, Funktion, QR-Code, Rechte)
  var CARD_DO = { report: 'Beipack melden', status: 'Bereit setzen', order: 'Podest bestellen', podest: 'Bestellungen bearbeiten',
    solve: 'Probleme lösen', dash: 'Mobiles Dashboard', ueber: 'Anfrage Überspielen' };
  function cardHtml(q) {
    var qr = qrcode(0, 'M'), pm = permsOf(q);
    qr.addData(scanUrl(q));
    qr.make();
    var dos = Object.keys(CARD_DO).filter(function (k) { return pm[k]; }).map(function (k) { return '<li>' + esc(CARD_DO[k]) + '</li>'; }).join('');
    return '<div class="pcard' + ($('cardDark').checked ? '' : ' light') + '">' +
      '<svg class="pc-frame" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 88,1 99,12 99,139 12,139 1,128" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
      '<div class="pc-top"><b>DEUKRO26</b><span>BEIPACK-ABHOLUNG</span></div>' +
      '<div class="pc-hz"></div>' +
      '<div class="pc-name">' + esc(q.name) + '</div>' +
      (q.func ? '<div class="pc-func">' + esc(q.func) + '</div>' : '<div class="pc-func">&nbsp;</div>') +
      '<div class="pc-qr">' + qr.createSvgTag(4, 2) + '</div>' +
      '<div class="pc-scan">&#9654; MIT DER HANDY-KAMERA SCANNEN</div>' +
      (dos ? '<ul class="pc-do">' + dos + '</ul>' : '') +
      '<div class="pc-bar"></div>' +
      '<div class="pc-foot"><span>ID-' + esc(String(q.id || '').slice(-6).toUpperCase()) + '</span><span>' + esc(location.host) + '</span></div>' +
      '<i class="pc-c c1"></i><i class="pc-c c2"></i><i class="pc-c c3"></i><i class="pc-c c4"></i></div>';
  }
  var cardId = '';
  function showCard(id) {
    var q = Store.get().qrs[id];
    if (!q) return;
    cardId = id;
    $('cardBox').innerHTML = cardHtml(Object.assign({ id: id }, q));
    $('cardModal').hidden = false;
  }
  $('qrGrid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-card]');
    if (b) showCard(b.dataset.card);
  });
  $('cardDark').onchange = function () { if (cardId) showCard(cardId); };
  $('cardClose').onclick = function () { $('cardModal').hidden = true; };
  $('cardPrint').onclick = function () {
    document.body.classList.add('print-card');
    var done = function () { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 60000);
  };
  $('qrOpen').onclick = function () { $('qrModal').hidden = false; renderQr(Store.get()); };
  $('qrClose').onclick = function () { $('qrModal').hidden = true; };
  $('qrPrint').onclick = function () {
    document.body.classList.add('print-qr');
    window.print();
    document.body.classList.remove('print-qr');
  };
  $('qrPreset').innerHTML = presetOptions('standard');
  $('qrForm').onsubmit = function (e) {
    e.preventDefault();
    var name = $('qrName').value.trim();
    if (!name) return;
    var pre = PRESETS.filter(function (p) { return p[0] === $('qrPreset').value; })[0];
    var func = $('qrFunc').value.trim() || pre[2];
    Store.setQr(Util.uid(), { name: name, func: func, t: Date.now(), perms: Object.assign({}, pre[3]) })
      .catch(function () { toast('Speichern fehlgeschlagen'); });
    $('qrName').value = ''; $('qrFunc').value = '';
  };
  $('qrGrid').onclick = function (e) {
    var b = e.target.closest('button[data-del]');
    if (b && confirm('QR-Code löschen?')) Store.setQr(b.dataset.del, null).catch(function () { toast('Löschen fehlgeschlagen'); });
  };
  $('qrGrid').onchange = function (e) {
    var card = e.target.closest('.qr-card');
    var q = card && Store.get().qrs[card.dataset.id];
    if (!q) return;
    var upd = { name: q.name, func: q.func || '', t: q.t, perms: permsOf(q) };
    var t = e.target;
    if (t.matches('input[data-f]')) {
      upd[t.dataset.f] = t.value.trim();
    } else if (t.matches('input[data-perm]')) {
      upd.perms = {};
      Array.prototype.forEach.call(card.querySelectorAll('input[data-perm]'), function (c) { if (c.checked) upd.perms[c.dataset.perm] = 1; });
    } else if (t.matches('select[data-preset]')) {
      var pre = PRESETS.filter(function (p) { return p[0] === t.value; })[0];
      if (!pre) return;
      upd.perms = Object.assign({}, pre[3]);
      if (pre[2]) upd.func = pre[2];
    } else {
      return;
    }
    if (!upd.name) { toast('Name darf nicht leer sein'); renderQr(Store.get()); return; }
    if (!Object.keys(upd.perms).length) { toast('Mindestens eine Funktion auswählen'); renderQr(Store.get()); return; }
    Store.setQr(card.dataset.id, upd).catch(function () { toast('Speichern fehlgeschlagen'); });
  };

  // Podest-Auswahl für die Handys (Vorgabe aus js/config.js, bis hier etwas gespeichert wird)
  function podestList(state) {
    return Object.keys(state.podests).map(function (id) { var p = state.podests[id]; return { id: id, name: p.name, t: p.t }; })
      .sort(function (a, b) { return a.t - b.t; });
  }
  function renderPodestEdit(state) {
    var list = podestList(state), defs = (window.DEKR_CONFIG || {}).podests || [];
    var chips = list.length ? list.map(function (p) { return { id: p.id, name: p.name }; }) : defs.map(function (n) { return { id: '', name: n }; });
    $('pdEdit').innerHTML = chips.map(function (p) {
      return '<span class="chip">' + esc(p.name) + '<button data-pdel="' + esc(p.id) + '" data-pname="' + esc(p.name) + '" title="Entfernen">×</button></span>';
    }).join('') || '<span class="empty">Keine Auswahl – nur Texteingabe am Handy.</span>';
  }
  // Beim ersten Ändern wird die Vorgabe in die Datenbank übernommen
  function seedPodests() {
    var st = Store.get();
    if (podestList(st).length) return [];
    return ((window.DEKR_CONFIG || {}).podests || []).map(function (n, i) { return Store.setPodest('d' + i, { name: n, t: i }); });
  }
  $('pdAdd').onclick = function () {
    var name = $('pdName').value.trim();
    if (!name) return;
    var jobs = seedPodests();
    jobs.push(Store.setPodest(Util.uid(), { name: name, t: Date.now() }));
    Promise.all(jobs).catch(function () { toast('Speichern fehlgeschlagen'); });
    $('pdName').value = '';
  };
  // Ersetzt die gespeicherte Auswahl durch die Standardliste aus js/config.js
  $('pdReset').onclick = function () {
    if (!window.confirm('Podest-Auswahl auf die Standardliste zurücksetzen? Die bisherige Liste wird ersetzt.')) return;
    var st = Store.get().podests, defs = (window.DEKR_CONFIG || {}).podests || [];
    var jobs = Object.keys(st).map(function (id) { return Store.setPodest(id, null); });
    defs.forEach(function (n, i) { jobs.push(Store.setPodest('d' + i, { name: n, t: i })); });
    Promise.all(jobs).then(function () { toast('Standardliste geladen'); }).catch(function () { toast('Speichern fehlgeschlagen'); });
  };
  $('pdEdit').onclick = function (e) {
    var b = e.target.closest('button[data-pname]');
    if (!b) return;
    var jobs = seedPodests();
    Promise.all(jobs).then(function () {
      var st = Store.get().podests;
      var id = Object.keys(st).filter(function (k) { return st[k].name === b.dataset.pname; })[0];
      return id ? Store.setPodest(id, null) : null;
    }).catch(function () { toast('Speichern fehlgeschlagen'); });
  };
  Store.subscribe(function (state) {
    var typing = document.activeElement && $('qrGrid').contains(document.activeElement);
    if (!$('qrModal').hidden && !typing) renderQr(state);
  });

  // ---------- Admin: Anmeldung und Geräte-Freigabe (nur mit authApiKey) ----------
  // Gerätebeschreibung aus Browser-Kennung und (falls vorhanden) Modellangabe
  function uaText(ua, x) {
    ua = String(ua || '');
    var os = '', m;
    if ((m = /Android ([\d.]+)/.exec(ua))) os = 'Android ' + m[1];
    else if ((m = /(?:iPhone|CPU) OS ([\d_]+)/.exec(ua)) && /iPhone|iPad/.test(ua)) os = (/iPad/.test(ua) ? 'iPadOS ' : 'iOS ') + m[1].replace(/_/g, '.');
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    var br = '';
    if ((m = /Edg\/([\d]+)/.exec(ua))) br = 'Edge ' + m[1];
    else if ((m = /Firefox\/([\d]+)/.exec(ua))) br = 'Firefox ' + m[1];
    else if ((m = /(?:Chrome|CriOS)\/([\d]+)/.exec(ua))) br = 'Chrome ' + m[1];
    else if ((m = /Version\/([\d]+).*Safari/.exec(ua))) br = 'Safari ' + m[1];
    // Chrome meldet in der Kennung nur noch eine feste Android-Version; die echte steht in den Geräteangaben
    if (x && x.os) os = x.os.replace(/(\d+(?:\.\d+)?)(?:\.0)*$/, '$1');
    var model = x && x.model ? x.model : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : '';
    return [model, os, br].filter(Boolean).join(' · ');
  }
  function doLogin(mail, pw, errEl) {
    errEl.textContent = '';
    var oldUid = '';
    Auth.login(mail.value.trim(), pw.value).then(function (old) {
      oldUid = old;
      pw.value = '';
      return Store.reconnect();
    }).then(function () {
      // Die Anfrage des Geräts vor der Admin-Anmeldung ist überflüssig
      if (oldUid) Store.setDevice(oldUid, null).catch(function () { /* nicht schlimm */ });
      applyRoleUi();
      renderAdmin();
    }).catch(function (e) {
      errEl.textContent = 'Anmeldung fehlgeschlagen' + (e && e.message ? ' (' + e.message + ')' : '');
    });
  }
  $('lockLogin').onsubmit = function (e) { e.preventDefault(); doLogin($('lockMail'), $('lockPw'), $('lockErr')); };
  $('admLogin').onsubmit = function (e) { e.preventDefault(); doLogin($('admMail'), $('admPw'), $('admErr')); };
  var pendingDev = 0;
  function loadDevices() {
    if (!Auth.isAdmin()) return;
    Store.devices().then(function (d) {
      var ids = Object.keys(d).sort(function (a, b) { return (d[a].ok === true) - (d[b].ok === true) || d[b].t - d[a].t; });
      pendingDev = ids.filter(function (id) { return d[id].ok !== true; }).length;
      $('admOpen').textContent = 'Admin' + (pendingDev ? ' (' + pendingDev + ')' : '');
      $('devList').innerHTML = ids.length ? ids.map(function (id) {
        var x = d[id], ok = x.ok === true;
        return '<div class="item' + (ok ? ' ok' : '') + '"><b>' + esc(x.n || 'Unbenannt') + ' · Code ' + esc(id.slice(-6).toUpperCase()) + '</b>' +
          '<span class="meta"><b>' + esc(uaText(x.ua, x) || 'Unbekanntes Gerät') + '</b></span>' +
          '<span class="meta">Bildschirm ' + esc(x.scr || '–') + ' · Sprache ' + esc(x.lang || '–') + ' · Zeitzone ' + esc(x.tz || '–') + '</span>' +
          '<span class="meta">angemeldet ' + new Date(x.t).toLocaleString('de-DE') + (ok ? ' · freigegeben' + (x.by ? ' von ' + esc(x.by) : '') : ' · wartet auf Freigabe') + '</span>' +
          '<span class="acts">' + (ok ? '' : '<button class="btn-sm btn-ok" data-dev="' + esc(id) + '" data-act="ok">Freigeben</button>') +
          '<button class="btn-sm btn-warn" data-dev="' + esc(id) + '" data-act="del">' + (ok ? 'Sperren' : 'Ablehnen') + '</button></span></div>';
      }).join('') : '<div class="empty">Keine Geräte.</div>';
    }).catch(function () { /* keine Berechtigung oder offline */ });
  }
  $('devList').onclick = function (e) {
    var b = e.target.closest('button[data-dev]');
    if (!b) return;
    Store.devices().then(function (d) {
      var x = d[b.dataset.dev] || {};
      return Store.setDevice(b.dataset.dev, b.dataset.act === 'ok' ? Object.assign({}, x, { ok: true, by: Util.getName(), at: Date.now() }) : null);
    }).then(loadDevices).catch(function () { toast('Fehlgeschlagen (Admin angemeldet?)'); });
  };
  function renderAdmin() {
    var adm = Auth.isAdmin();
    $('admLogin').hidden = adm;
    $('admBody').hidden = !adm;
    $('admWho').textContent = adm ? 'Angemeldet als ' + Auth.email() : '';
    if (adm) {
      loadDevices();
      var rc = (Store.get().settings || {}).regcode || '';
      if (document.activeElement !== $('codeIn')) $('codeIn').value = rc;
      $('codeInfo').textContent = rc ? 'Aktiver Code: ' + rc + ' (steckt in neu erzeugten QR-Links)' : 'Kein Code: Jedes Gerät, das die Seite öffnet, kann eine Anfrage senden.';
    }
  }
  // Anmelde-Code für neue Geräte (Regeln prüfen ihn serverseitig)
  function saveCode(v) {
    Store.setSetting('regcode', v || null).then(function () { renderAdmin(); toast(v ? 'Code gespeichert' : 'Code entfernt'); })
      .catch(function () { toast('Speichern fehlgeschlagen (Regeln mit Code-Prüfung veröffentlicht?)'); });
  }
  $('codeSave').onclick = function () { saveCode($('codeIn').value.trim().replace(/[^A-Za-z0-9_-]/g, '')); };
  $('codeRand').onclick = function () {
    var v = '', chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    for (var i = 0; i < 8; i++) v += chars.charAt(Math.floor(Math.random() * chars.length));
    $('codeIn').value = v; saveCode(v);
  };
  $('codeOff').onclick = function () { $('codeIn').value = ''; saveCode(''); };
  $('devClear').onclick = function () {
    Store.devices().then(function (d) {
      var ids = Object.keys(d).filter(function (id) { return d[id].ok !== true; });
      if (!ids.length) { toast('Keine wartenden Geräte'); return null; }
      if (!confirm(ids.length + ' wartende Geräte ablehnen?')) return null;
      return Store.clearDevices(ids).then(loadDevices);
    }).catch(function () { toast('Fehlgeschlagen (Admin angemeldet?)'); });
  };
  $('admOpen').onclick = function () { $('admModal').hidden = false; renderAdmin(); };
  $('admClose').onclick = function () { $('admModal').hidden = true; };
  // Komplette Daten als Datei herunterladen (Sicherung)
  $('admBackup').onclick = function () {
    var blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'deukro26-sicherung-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
  };
  $('admLogout').onclick = function () { Auth.logout(); location.reload(); };
  if (Store.secure) {
    $('admOpen').hidden = false;
    $('lockCode').textContent = Auth.code();
    setInterval(function () { if (Auth.isAdmin()) loadDevices(); }, 10000);
    Store.subscribe(function () {
      $('lockModal').hidden = !Store.isLocked();
      $('lockCode').textContent = Auth.code();
      $('lockReq').hidden = Store.isRequested();
      $('lockWait').hidden = !Store.isRequested();
    });
    // Freigabe anfragen erst auf Tippen (nicht automatisch), mit Zugangscode falls vorhanden
    $('lockReq').onsubmit = function (e) {
      e.preventDefault();
      $('lockReqErr').textContent = '';
      Store.requestAccess($('lockCodeIn').value).catch(function (err) {
        $('lockReqErr').textContent = err && err.message === 'code' ? 'Zugangscode falsch oder fehlt.' : 'Keine Verbindung – bitte erneut versuchen.';
      });
    };
    // Das Gerät trägt sich mit dem gemerkten Namen zur Freigabe ein
    Store.setDeviceLabel('Dashboard ' + Util.getName());
  }

  // Ton an/aus (im Browser gemerkt)
  function soundLabel() { $('soundBtn').textContent = Sound.label(); }
  window.DEKR_NTFY = function () {
    return [{ label: 'Beipack fertig, Probleme, Überspielen', sub: '' }, { label: 'Neue Podest-Bestellungen', sub: 'podest' }];
  };
  $('soundBtn').onclick = function () { Sound.panel(); };
  document.addEventListener('dekr-sound', soundLabel);
  soundLabel();

  // Nur der Admin ändert Layout und QR-Codes (die Datenbank-Regeln erzwingen es; hier werden die Knöpfe ausgeblendet)
  function applyRoleUi() {
    var adm = !Store.secure || Auth.isAdmin();
    $('editToggle').hidden = !adm;
    $('qrOpen').hidden = !adm;
  }
  applyRoleUi();

  // Alte Einträge werden einmal pro Sitzung aufgeräumt (nur Admin): Nachrichten > 14 Tage, erledigte Bestellungen und
  // gelöste Probleme > 30 Tage, KR-Einträge von Wochen, die mehr als 8 Wochen zurückliegen. Hält die Datenmenge klein.
  var pruned = false;
  function pruneOld(state) {
    if (pruned || Store.isLocked() || (Store.secure && !Auth.isAdmin())) return;
    if (!Object.keys(state.tasks).length && !Object.keys(state.msgs).length) return;
    pruned = true;
    var now = Date.now(), day = 864e5, ops = [], cutoff = Util.addWeeks(WEEK, -8);
    Object.keys(state.msgs).forEach(function (id) { if (now - state.msgs[id].t > 14 * day) ops.push({ coll: 'msgs', id: id, val: null }); });
    Object.keys(state.orders).forEach(function (id) {
      var o = state.orders[id];
      if (o.status === 'erledigt' && now - (o.statusAt || o.t) > 30 * day) ops.push({ coll: 'orders', id: id, val: null });
    });
    Object.keys(state.problems).forEach(function (id) {
      var p = state.problems[id];
      if (p.status !== 'offen' && now - (p.solvedAt || p.t) > 30 * day) ops.push({ coll: 'problems', id: id, val: null });
    });
    Object.keys(state.tasks).forEach(function (id) { if (state.tasks[id].week < cutoff) ops.push({ coll: 'tasks', id: id, val: null }); });
    if (ops.length) Store.batch(ops).catch(function () { /* nächstes Mal */ });
  }
  // MIPP-Lesezeichen: nimmt den gelesenen Listentext entgegen und öffnet damit den Import (gespeichert wird erst mit „Importieren")
  function mippOriginOk(origin) {
    var extra = (window.DEKR_CONFIG && window.DEKR_CONFIG.mippOrigins) || [];
    if (extra.indexOf(origin) >= 0) return true;
    try { var u = new URL(origin); return u.protocol === 'https:' && /(^|\.)krones-group\.com$/.test(u.hostname); } catch (e) { return false; }
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!window.opener || e.source !== window.opener || !mippOriginOk(e.origin)) return;
    if (!d || d.t !== 'dekr-mipp' || typeof d.text !== 'string' || d.text.length > 3000000) return;
    $('impText').value = d.text; imp.cols = [];
    $('impModal').hidden = false;
    renderImp();
    toast('Liste aus MIPP übernommen – bitte prüfen und importieren');
  });
  if (window.opener && /[?&]mipp=/.test(location.search)) {
    try { window.opener.postMessage({ t: 'dekr-ready' }, '*'); } catch (e) { /* ignorieren */ }
  }

  Store.subscribe(pruneOld);

  Store.subscribe(render);
  Store.start();
})();
