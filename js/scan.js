// Handy-Seite: Beipack melden, Podest bestellen, Bestellungen bearbeiten, Probleme lösen
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var params = new URLSearchParams(location.search);
  var recent = [];
  var PERM_KEYS = ['report', 'order', 'podest', 'solve', 'status'];

  // Name, Funktion und Rechte kommen vom QR-Code (?q=ID, im Dashboard gepflegt).
  // n/f/p im Link sind nur Rückfall, falls die Daten nicht aus der Datenbank kommen.
  var qid = params.get('q');
  var urlName = (params.get('n') || '').trim();
  var urlQr = urlName ? { name: urlName, func: (params.get('f') || '').trim(), perms: toPerms(params.get('p')) } : null;
  var qr = urlQr, view = '', pdSel = {};

  function toPerms(s) {
    var o = {};
    String(s || '').split(',').forEach(function (k) { if (PERM_KEYS.indexOf(k) >= 0) o[k] = 1; });
    return o;
  }
  function perms() {
    var p = (qr && qr.perms) || {};
    return Object.keys(p).length ? p : { report: 1, order: 1 };   // Vorgabe für ältere Codes
  }
  function who() { return qr.func ? qr.name + ' · ' + qr.func : qr.name; }
  function toast(t, bad) {
    var el = $('toast');
    el.textContent = t;
    el.style.borderColor = el.style.color = bad ? 'var(--red)' : 'var(--green)';
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3500);
  }
  function fail() { toast('Fehler – bitte erneut versuchen', true); }
  function done(text) {
    recent.unshift({ t: Date.now(), text: text });
    $('hist').innerHTML = '<div class="col-title orb" style="margin-bottom:6px">Zuletzt</div>' + recent.slice(0, 6).map(function (m) {
      return '<div class="msg done">' + esc(m.text) + '<small>' + Util.time(m.t) + '</small></div>';
    }).join('');
  }

  // ---------- KR-Daten ----------
  function tasksOf(kr) {
    var all = Store.get().tasks;
    return Object.keys(all).filter(function (id) { return all[id].kr === kr; }).map(function (id) {
      return Object.assign({ id: id }, all[id]);
    });
  }
  // aktuelle Woche, sonst nächste kommende, sonst letzte vergangene
  function weekOf(list) {
    var ws = {};
    list.forEach(function (t) { ws[t.week] = 1; });
    var wk = Object.keys(ws).sort();
    return ws[WEEK] ? WEEK : wk.filter(function (w) { return w > WEEK; })[0] || wk[wk.length - 1] || WEEK;
  }
  function openProblems(kr) {
    var ps = Store.get().problems;
    return Object.keys(ps).filter(function (id) { return ps[id].status === 'offen' && (!kr || ps[id].kr === kr); });
  }
  function fillKrList(state) {
    var list = Object.keys(state.tasks).map(function (id) { return state.tasks[id]; });
    list.sort(function (a, b) { return a.week < b.week ? -1 : a.week > b.week ? 1 : a.day - b.day; });
    $('krlist').innerHTML = list.slice(0, 500).map(function (t) {
      return '<option value="' + esc(t.kr) + '">KR ' + esc(t.kr) + (t.pos ? ' · ' + esc(Halls.label(t.hall, t.pos)) : '') +
        ' · ' + esc(Util.DAYS[t.day].slice(0, 2)) + (t.done ? ' · fertig' : '') + '</option>';
    }).join('');
  }
  function krInfo() {
    var kr = Util.normKr($('kr').value), box = $('krInfo');
    if (!kr) { box.hidden = true; return; }
    var ts = tasksOf(kr);
    box.hidden = false;
    if (!ts.length) { box.innerHTML = 'KR ' + esc(kr) + ' steht nicht in der Liste.'; return; }
    var t = ts[0], np = openProblems(kr).length;
    box.innerHTML = '<b>KR ' + esc(kr) + '</b> · ' + (t.pos ? esc(Halls.label(t.hall, t.pos)) : 'ohne Position') + ' · ' +
      esc(Util.DAYS[t.day]) + (t.scope ? ' · ' + esc(t.scope) : '') + ' · <b style="color:' +
      (t.done ? 'var(--green)' : 'var(--orange)') + '">' + (t.done ? 'fertig' : 'offen') + '</b>' +
      (np ? ' · <b style="color:var(--red)">' + np + ' Problem(e)</b>' : '');
  }

  // Alle Positionen der KR fertig bzw. wieder offen; ohne Eintrag entsteht einer ohne Position
  function markKr(kr, isDone) {
    var mine = tasksOf(kr), useWeek = weekOf(mine), jobs = [], places = [];
    var ids = mine.filter(function (t) { return t.week === useWeek; });
    if (!ids.length) {
      if (isDone) {
        jobs.push(Store.setTask(Util.taskId(useWeek, kr, '0', '0'), {
          week: useWeek, kr: kr, day: Util.todayIdx(), hall: '', pos: '', done: true, doneAt: Date.now(), doneBy: qr.name
        }));
      }
    }
    ids.forEach(function (t) {
      if (t.pos) places.push(Halls.label(t.hall, t.pos));
      if (!!t.done === isDone) return;
      var copy = {};
      Object.keys(t).forEach(function (k) { if (k !== 'id') copy[k] = t[k]; });
      copy.done = isDone;
      copy.doneAt = isDone ? Date.now() : null;
      copy.doneBy = isDone ? qr.name : null;
      jobs.push(Store.setTask(t.id, copy));
    });
    return { jobs: jobs, where: places.length ? ' · ' + places.join(', ') : '' };
  }

  // ---------- Menü ----------
  function allowed() {
    var p = perms(), v = [];
    if (p.report || p.status) v.push(['beipack', 'Beipack fertig melden']);
    if (p.order) v.push(['podest', 'Podest bestellen']);
    if (p.podest) v.push(['orders', 'Bestellungen']);
    if (p.solve) v.push(['problems', 'Probleme']);
    return v;
  }
  function renderMenu() {
    var v = allowed(), ord = openOrders().length, pr = openProblems().length;
    if (!v.some(function (x) { return x[0] === view; })) {
      // Empfänger starten bei den Bestellungen, Problemlöser bei den Problemen
      var p0 = perms(), pref = p0.podest ? 'orders' : p0.solve && !p0.report ? 'problems' : '';
      view = v.some(function (x) { return x[0] === pref; }) ? pref : v.length ? v[0][0] : '';
    }
    $('menu').innerHTML = v.map(function (x) {
      var cnt = x[0] === 'orders' ? ord : x[0] === 'problems' ? pr : 0;
      return '<button type="button" class="menu-btn' + (x[0] === view ? ' sel' : '') + '" data-view="' + x[0] + '">' +
        esc(x[1]) + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</button>';
    }).join('');
    ['beipack', 'podest', 'orders', 'problems'].forEach(function (k) { $('v-' + k).hidden = k !== view; });
    var p = perms();
    $('bOk').hidden = !(p.report || p.status);
    $('bProb').hidden = !p.report;
    $('bNot').hidden = !p.status;
    $('bBtns').style.gridTemplateColumns = $('bProb').hidden ? '1fr' : '1fr 1fr';
  }
  $('menu').onclick = function (e) {
    var b = e.target.closest('button[data-view]');
    if (!b) return;
    view = b.dataset.view;
    renderMenu(); renderLists();
  };

  // ---------- Beipack ----------
  $('kr').addEventListener('input', krInfo);
  function needKr() {
    var kr = Util.normKr($('kr').value);
    if (!kr) { toast('Bitte KR-Nummer eintragen', true); $('kr').focus(); }
    return kr;
  }
  function busy(on) { ['bOk', 'bProb', 'bNot', 'probSend'].forEach(function (id) { $(id).disabled = on; }); }
  function setStatus(isDone) {
    var kr = needKr();
    if (!kr) return;
    busy(true);
    var m = markKr(kr, isDone);
    var text = 'KR ' + kr + m.where + (isDone ? ' bereit' : ' nicht fertig') + ' (' + who() + ')';
    Promise.all(m.jobs).then(function () {
      return Store.addMsg({ type: isDone ? 'done' : 'plan', by: qr.name, text: text });
    }).then(function () {
      done(text); toast((isDone ? 'Gemeldet: KR ' : 'Zurückgenommen: KR ') + kr);
      $('kr').value = ''; $('probBox').hidden = true; krInfo(); $('kr').focus();
    }).catch(fail).then(function () { busy(false); });
  }
  $('bOk').onclick = function () { setStatus(true); };
  $('bNot').onclick = function () { setStatus(false); };
  $('bProb').onclick = function () {
    if (!needKr()) return;
    $('probBox').hidden = false;
    $('probText').focus();
  };
  $('probSend').onclick = function () {
    var kr = needKr(), text = $('probText').value.trim();
    if (!kr) return;
    if (!text) { toast('Bitte das Problem beschreiben', true); return; }
    busy(true);
    var ts = tasksOf(kr), t = ts[0];
    var where = t && t.pos ? Halls.label(t.hall, t.pos) : '';
    var msg = '⚠ Problem KR ' + kr + (where ? ' · ' + where : '') + ': ' + text + ' (' + who() + ')';
    Store.setProblem(Util.uid(), { kr: kr, where: where, text: text, by: qr.name, func: qr.func || '', t: Date.now(), status: 'offen' })
      .then(function () { return Store.addMsg({ type: 'problem', by: qr.name, text: msg }); })
      .then(function () {
        done(msg); toast('Problem gemeldet');
        $('kr').value = ''; $('probText').value = ''; $('probBox').hidden = true; krInfo();
      }).catch(fail).then(function () { busy(false); });
  };

  // ---------- Podest bestellen ----------
  function podestNames(state) {
    var st = Object.keys(state.podests).map(function (id) { return state.podests[id]; })
      .sort(function (a, b) { return a.t - b.t; }).map(function (p) { return p.name; });
    return st.length ? st : ((window.DEKR_CONFIG || {}).podests || []);
  }
  function renderPodestList(state) {
    $('pdList').innerHTML = podestNames(state).map(function (n) {
      return '<button type="button" class="chip pick' + (pdSel[n] ? ' on' : '') + '" data-n="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('') || '<span class="empty">Keine Auswahl hinterlegt – bitte Text eintragen.</span>';
  }
  $('pdList').onclick = function (e) {
    var b = e.target.closest('.pick');
    if (!b) return;
    pdSel[b.dataset.n] = !pdSel[b.dataset.n];
    renderPodestList(Store.get());
  };
  $('pdGo').onclick = function () {
    var items = Object.keys(pdSel).filter(function (n) { return pdSel[n]; });
    var free = $('pdText').value.trim();
    if (free) items.push(free);
    var kr = Util.normKr($('pdKr').value), raw = $('pdPos').value.trim();
    if (!items.length) { toast('Bitte Podest auswählen oder Text eintragen', true); return; }
    if (!kr && !raw) { toast('Bitte KR oder Position angeben', true); return; }
    var pp = raw ? Util.parsePos(raw) : null;
    if (raw && !pp) { toast('Position nicht erkannt, z.B. 7 42 Z', true); return; }
    var t = kr ? tasksOf(kr)[0] : null;
    var hallId = (pp && pp.hall && Halls.byShort(pp.hall)) || (t && t.hall) || Halls.all[0].id;
    var posL = pp ? Halls.label(hallId, pp.pos) : t && t.pos ? Halls.label(t.hall, t.pos) : '';
    var where = [kr ? 'KR ' + kr : '', posL].filter(Boolean).join(' · ');
    var msg = 'Podest bestellt: ' + items.join(', ') + ' für ' + where + ' (' + who() + ')';
    $('pdGo').disabled = true;
    Store.setOrder(Util.uid(), { items: items, kr: kr, where: where, by: qr.name, func: qr.func || '', t: Date.now(), status: 'offen' })
      .then(function () { return Store.addMsg({ type: 'order', by: qr.name, text: msg }); })
      .then(function () {
        done(msg); toast('Bestellt');
        pdSel = {}; $('pdText').value = ''; $('pdKr').value = ''; $('pdPos').value = '';
        renderPodestList(Store.get());
      }).catch(fail).then(function () { $('pdGo').disabled = false; });
  };

  // ---------- Bestellungen bearbeiten / Probleme lösen ----------
  function openOrders() {
    var o = Store.get().orders;
    return Object.keys(o).filter(function (id) { return o[id].status !== 'erledigt'; });
  }
  function renderLists() {
    var s = Store.get();
    if (view === 'orders') {
      var ids = Object.keys(s.orders).sort(function (a, b) { return s.orders[b].t - s.orders[a].t; }).slice(0, 40);
      ids.sort(function (a, b) { return (s.orders[a].status === 'erledigt') - (s.orders[b].status === 'erledigt'); });
      $('v-orders').innerHTML = ids.length ? ids.map(function (id) {
        var o = s.orders[id], fin = o.status === 'erledigt';
        return '<div class="item' + (fin ? ' ok' : '') + '"><b>' + esc(o.items.join(', ')) + '</b><span>' + esc(o.where) + '</span>' +
          '<span class="meta">' + Util.time(o.t) + ' · ' + esc(o.by) + (o.func ? ' (' + esc(o.func) + ')' : '') + ' · <b>' + esc(o.status) + '</b>' +
          (o.statusBy ? ' von ' + esc(o.statusBy) : '') + '</span>' +
          (fin ? '' : '<span class="acts">' + (o.status === 'offen' ? '<button data-oid="' + id + '" data-st="angenommen">Annehmen</button>' : '') +
            '<button class="btn-ok" data-oid="' + id + '" data-st="erledigt">Erledigt</button></span>') + '</div>';
      }).join('') : '<div class="empty">Keine Bestellungen.</div>';
    } else if (view === 'problems') {
      var pids = Object.keys(s.problems).sort(function (a, b) { return s.problems[b].t - s.problems[a].t; }).slice(0, 40);
      pids.sort(function (a, b) { return (s.problems[a].status !== 'offen') - (s.problems[b].status !== 'offen'); });
      $('v-problems').innerHTML = pids.length ? pids.map(function (id) {
        var p = s.problems[id], open = p.status === 'offen';
        return '<div class="item ' + (open ? 'prob' : 'ok') + '"><b>KR ' + esc(p.kr) + (p.where ? ' · ' + esc(p.where) : '') + '</b><span>' + esc(p.text) + '</span>' +
          '<span class="meta">' + Util.time(p.t) + ' · ' + esc(p.by) + (p.func ? ' (' + esc(p.func) + ')' : '') + ' · <b>' + esc(p.status) + '</b>' +
          (p.solvedBy ? ' von ' + esc(p.solvedBy) : '') + '</span>' +
          (open ? '<span class="acts"><button class="btn-ok" data-pid="' + id + '">Gelöst</button></span>' : '') + '</div>';
      }).join('') : '<div class="empty">Keine Probleme.</div>';
    }
  }
  $('v-orders').onclick = function (e) {
    var b = e.target.closest('button[data-oid]');
    var o = b && Store.get().orders[b.dataset.oid];
    if (!o) return;
    var upd = Object.assign({}, o, { status: b.dataset.st, statusBy: qr.name, statusAt: Date.now() });
    Store.setOrder(b.dataset.oid, upd).then(function () {
      return Store.addMsg({ type: 'order', by: qr.name, text: 'Podest-Bestellung (' + o.items.join(', ') + ' · ' + o.where + ') ' + b.dataset.st + ' (' + who() + ')' });
    }).catch(fail);
  };
  $('v-problems').onclick = function (e) {
    var b = e.target.closest('button[data-pid]');
    var p = b && Store.get().problems[b.dataset.pid];
    if (!p) return;
    var upd = Object.assign({}, p, { status: 'gelöst', solvedBy: qr.name, solvedAt: Date.now() });
    Store.setProblem(b.dataset.pid, upd).then(function () {
      return Store.addMsg({ type: 'plan', by: qr.name, text: 'Problem KR ' + p.kr + ' gelöst (' + who() + ')' });
    }).catch(fail);
  };

  // ---------- Start ----------
  function apply(state) {
    qr = (qid && state.qrs[qid]) || urlQr;
    var ok = !!qr;
    $('whoName').textContent = ok ? qr.name : '';
    $('who').textContent = ok && qr.func ? qr.func : '';
    $('who').hidden = !(ok && qr.func);
    if (!ok) {
      $('note').textContent = qid ? 'QR-Code unbekannt oder gelöscht.' : 'Bitte über einen QR-Code öffnen.';
      $('menu').innerHTML = '';
      ['beipack', 'podest', 'orders', 'problems'].forEach(function (k) { $('v-' + k).hidden = true; });
      return;
    }
    $('note').textContent = Store.remote ? '' : 'Demo-Modus: Meldungen erreichen das Dashboard nicht.';
    fillKrList(state);
    renderMenu();
    renderPodestList(state);
    renderLists();
    krInfo();
  }
  if (qid && !urlQr) $('note').textContent = 'Lädt …';
  Store.subscribe(apply);
  if (!qid && !urlQr) apply(Store.get());
  Store.start();
})();
