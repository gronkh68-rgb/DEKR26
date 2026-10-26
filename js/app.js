// Hauptseite (Dashboard)
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var hallIdx = 0;
  var sel = null;          // { hall, pos }
  var seen = null;         // bereits gesehene Nachrichten-IDs
  var toastTimer = null;
  var editing = false;     // Modus: Spalten/Zeilen verschieben
  var drag = null;         // laufender Zieh-Vorgang { hall, axis, i, p0, base }
  var draft = null;        // Layout während des Ziehens

  // ---------- Kopf ----------
  $('week').textContent = 'KW ' + WEEK.split('-W')[1];
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

  $('plan').onsubmit = function (e) {
    e.preventDefault();
    var kr = Util.normKr($('pKr').value);
    var hall0 = $('pHall').value;
    var day = +$('pDay').value;
    var list = $('pPos').value.split(/[\s,;]+/).map(Util.normPos).filter(Boolean);
    if (!kr || !list.length) return;
    var jobs = list.map(function (pos) {
      var found = Halls.find(pos);
      var hall = found.length && found.every(function (h) { return h.id !== hall0; }) ? found[0].id : hall0;
      var id = Util.taskId(WEEK, kr, hall, pos);
      var old = Store.get().tasks[id];
      if (old) return Promise.resolve();
      return Store.setTask(id, { week: WEEK, kr: kr, day: day, hall: hall, pos: pos, done: false });
    });
    Promise.all(jobs).then(function () {
      return Store.addMsg({ type: 'plan', by: Util.getName() || 'Disposition',
        text: 'KR ' + kr + ' geplant (' + Util.DAYS[day].slice(0, 2) + '): ' + list.join(', ') });
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
    }).filter(function (t) { return t.week === WEEK; });
  }
  function hallOf(id) { return Halls.get(id); }

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
      html += '<div class="day' + (d === Util.todayIdx() ? ' today' : '') + '">' +
        '<div class="day-h orb"><span>' + Util.DAYS[d] + (d === Util.todayIdx() ? ' · heute' : '') +
        '</span><span class="cnt">' + done + '/' + dt.length + '</span></div>';
      if (!order.length) html += '<div class="empty">– keine KR –</div>';
      order.forEach(function (kr) {
        var ts = groups[kr];
        var all = ts.every(function (t) { return t.done; });
        html += '<div class="card kr ' + (all ? 'ok' : 'open') + '"><div class="kr-n"><span>KR ' + esc(kr) + '</span>' +
          '<span style="color:' + (all ? 'var(--green)' : 'var(--orange)') + '">' +
          ts.filter(function (t) { return t.done; }).length + '/' + ts.length + '</span></div><div class="chips">';
        ts.sort(function (a, b) { return a.pos < b.pos ? -1 : 1; }).forEach(function (t) {
          var isSel = sel && sel.hall === t.hall && sel.pos === t.pos;
          html += '<button class="chip' + (t.done ? ' done' : '') + (isSel ? ' sel' : '') +
            '" data-hall="' + esc(t.hall) + '" data-pos="' + esc(t.pos) + '">' +
            esc(t.hall) + '·' + esc(t.pos) + '</button>';
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
        svg += '<text class="axis" style="font-size:' + Math.max(lay.font, 10) + 'px" x="' + l.x + '" y="' + l.y + '">' + esc(l.t) + '</text>';
        return;
      }
      var col = l.axis === 'c';
      var rx = col ? l.x - lay.pw / 2 + 1 : l.x - 15, ry = col ? l.y - 15 : l.y - 4 - lay.ph / 2 + 1;
      svg += '<g class="handle" data-axis="' + l.axis + '" data-i="' + l.i + '"><rect x="' + rx + '" y="' + ry +
        '" width="' + (col ? lay.pw - 2 : 30) + '" height="' + (col ? 20 : lay.ph - 2) + '" rx="3"/>' +
        '<text x="' + l.x + '" y="' + l.y + '" style="font-size:13px">' + esc(l.t) + '</text></g>';
    });
    lay.positions.forEach(function (p) {
      var ts = byPos[p.id];
      var cls = 'cell';
      if (ts) cls += ts.every(function (t) { return t.done; }) ? ' done' : ' open';
      if (sel && sel.hall === hall.id && sel.pos === p.id) cls += ' sel';
      svg += '<g data-pos="' + esc(p.id) + '"><rect class="' + cls + '" x="' + p.x + '" y="' + p.y +
        '" width="' + p.w + '" height="' + p.h + '" rx="2"><title>' + esc(p.id) + '</title></rect>';
      if (ts) svg += '<text class="cell-t" style="font-size:' + lay.font + 'px" x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + lay.font / 3) + '">' + esc(p.id) + '</text>';
      svg += '</g>';
    });
    $('map').innerHTML = svg + '</svg>';

    // Positionen, die nicht im Hallenplan existieren, trotzdem melden
    var known = {};
    lay.positions.forEach(function (p) { known[p.id] = 1; });
    var missing = posKeys.filter(function (p) { return !known[p]; });
    renderDetail(byPos, missing);
  }

  function renderDetail(byPos, missing) {
    var el = $('detail');
    var html = '';
    if (sel && sel.hall === Halls.all[hallIdx].id) {
      var ts = byPos[sel.pos] || [];
      html += '<div class="orb" style="font-size:12px;color:var(--accent);margin-bottom:4px">Position ' + esc(sel.pos) + '</div>';
      if (!ts.length) html += '<div class="empty">Kein Beipack geplant.</div>';
      ts.forEach(function (t) {
        html += '<div class="line"><span>KR ' + esc(t.kr) + ' · ' + Util.DAYS[t.day].slice(0, 2) + ' · <b style="color:' +
          (t.done ? 'var(--green)' : 'var(--orange)') + '">' + (t.done ? 'Bereit' : 'Offen') + '</b></span><span>' +
          '<button class="btn-sm" data-act="toggle" data-id="' + esc(t.id) + '">' + (t.done ? 'Wieder offen' : 'Bereit') + '</button> ' +
          '<button class="btn-sm btn-warn" data-act="del" data-id="' + esc(t.id) + '">Löschen</button></span></div>';
      });
    } else {
      html += '<div class="empty">Position auf der Karte oder in der Liste anklicken.</div>';
    }
    if (missing.length) {
      html += '<div class="note" style="margin-top:6px">Nicht im Hallenplan: ' + missing.map(esc).join(', ') + '</div>';
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
    draft = clone(drag.base);
    draft[coll] = draft[coll] || {};
    for (var j = drag.i; j <= last; j++) {
      draft[coll][keys[j]] = ((drag.base[coll] || {})[keys[j]] || 0) + d;
    }
    render(Store.get());
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (!drag) return;
    var out = { cols: {}, rows: {} }, n = 0;
    ['cols', 'rows'].forEach(function (c) {
      Object.keys(draft[c] || {}).forEach(function (k) {
        if (draft[c][k]) { out[c][k] = draft[c][k]; n++; }
      });
    });
    var hall = drag.hall;
    drag = null;
    Store.setLayout(hall, n ? out : null).catch(function () { toast('Speichern fehlgeschlagen'); });
    render(Store.get());
  }
  $('editToggle').onclick = function () { setEdit(!editing); };
  $('editExport').onclick = function () {
    var hall = Halls.all[hallIdx];
    var ov = ovFor(hall.id);
    var text = 'layout: ' + JSON.stringify({ cols: ov.cols || {}, rows: ov.rows || {} }) + ',';
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
    hallIdx = Math.max(0, Halls.all.findIndex(function (h) { return h.id === b.dataset.hall; }));
    sel = { hall: b.dataset.hall, pos: b.dataset.pos };
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

  // ---------- QR-Codes ----------
  function scanUrl(name) {
    var u = new URL('scan.html', location.href);
    if (name) u.searchParams.set('n', name);
    return u.href;
  }
  function renderQr(state) {
    var list = Object.keys(state.qrs).map(function (id) {
      var q = state.qrs[id]; q.id = id; return q;
    }).sort(function (a, b) { return a.t - b.t; });
    $('qrHint').textContent = list.length ? '' : 'Noch keine QR-Codes. Namen eintragen und „Hinzufügen" klicken.';
    $('qrGrid').innerHTML = list.map(function (q) {
      var qr = qrcode(0, 'M');
      qr.addData(scanUrl(q.name));
      qr.make();
      return '<div class="card qr-card"><h3>' + esc(q.name) + '</h3>' + qr.createSvgTag(4, 2) +
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
    var names = $('qrName').value.split(',').map(function (n) { return n.trim(); }).filter(Boolean);
    Promise.all(names.map(function (n, i) {
      return Store.setQr(Util.uid() + i, { name: n, t: Date.now() + i });
    })).catch(function () { toast('Speichern fehlgeschlagen'); });
    $('qrName').value = '';
  };
  $('qrGrid').onclick = function (e) {
    var b = e.target.closest('button[data-del]');
    if (b && confirm('QR-Code löschen?')) Store.setQr(b.dataset.del, null).catch(function () { toast('Löschen fehlgeschlagen'); });
  };
  Store.subscribe(function (state) { if (!$('qrModal').hidden) renderQr(state); });

  Store.subscribe(render);
  Store.start();
})();
