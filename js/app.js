// Hauptseite (Dashboard)
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var hallIdx = 0;
  var sel = null;          // { hall, pos }
  var seen = null;         // bereits gesehene Nachrichten-IDs
  var toastTimer = null;

  // ---------- Kopf ----------
  $('week').textContent = 'KW ' + WEEK.split('-W')[1];
  $('mode').textContent = Store.remote ? 'LIVE' : 'LOKAL-DEMO';
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
    var kr = $('pKr').value.trim();
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
        '<div class="day-h orb"><span>' + Util.DAYS[d] + (d === Util.todayIdx() ? ' · HEUTE' : '') +
        '</span><span class="cnt">' + done + '/' + dt.length + '</span></div>';
      if (!order.length) html += '<div class="empty">– keine KR –</div>';
      order.forEach(function (kr) {
        var ts = groups[kr];
        var all = ts.every(function (t) { return t.done; });
        html += '<div class="card kr ' + (all ? 'ok' : 'open') + '"><div class="kr-n"><span>' + esc(kr) + '</span>' +
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
    var lay = Halls.layout(hall.id);
    var byPos = {};
    tasks.filter(function (t) { return t.hall === hall.id; }).forEach(function (t) {
      (byPos[t.pos] = byPos[t.pos] || []).push(t);
    });
    var posKeys = Object.keys(byPos);
    var ready = posKeys.filter(function (p) { return byPos[p].every(function (t) { return t.done; }); }).length;

    $('hallName').textContent = hall.name;
    $('hallStat').textContent = ready + '/' + posKeys.length + ' POSITIONEN BEREIT';
    $('hallSwitch').textContent = '⇄ ' + Halls.all[(hallIdx + 1) % Halls.all.length].name;
    $('hallSwitch').hidden = Halls.all.length < 2;

    var svg = '<svg class="map" viewBox="0 0 ' + lay.w + ' ' + lay.h + '">';
    if (lay.image) svg += '<image href="' + esc(lay.image) + '" width="' + lay.w + '" height="' + lay.h + '"/>';
    lay.labels.forEach(function (l) { svg += '<text class="axis" x="' + l.x + '" y="' + l.y + '">' + esc(l.t) + '</text>'; });
    lay.positions.forEach(function (p) {
      var ts = byPos[p.id];
      var cls = 'cell';
      if (ts) cls += ts.every(function (t) { return t.done; }) ? ' done' : ' open';
      if (sel && sel.hall === hall.id && sel.pos === p.id) cls += ' sel';
      svg += '<g data-pos="' + esc(p.id) + '"><rect class="' + cls + '" x="' + p.x + '" y="' + p.y +
        '" width="' + p.w + '" height="' + p.h + '" rx="2"><title>' + esc(p.id) + '</title></rect>';
      if (ts) svg += '<text class="cell-t" x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + 3) + '">' + esc(p.id) + '</text>';
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
      html += '<div class="orb" style="font-size:12px;color:var(--cyan);margin-bottom:4px">POSITION ' + esc(sel.pos) + '</div>';
      if (!ts.length) html += '<div class="empty">Kein Beipack geplant.</div>';
      ts.forEach(function (t) {
        html += '<div class="line"><span>KR ' + esc(t.kr) + ' · ' + Util.DAYS[t.day].slice(0, 2) + ' · <b style="color:' +
          (t.done ? 'var(--green)' : 'var(--orange)') + '">' + (t.done ? 'BEREIT' : 'OFFEN') + '</b></span><span>' +
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

  // ---------- Klicks ----------
  $('week-list').onclick = function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    hallIdx = Math.max(0, Halls.all.findIndex(function (h) { return h.id === b.dataset.hall; }));
    sel = { hall: b.dataset.hall, pos: b.dataset.pos };
    render(Store.get());
  };
  $('map').onclick = function (e) {
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

  Store.subscribe(render);
  Store.start();
})();
