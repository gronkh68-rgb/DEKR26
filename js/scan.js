// Handy-Seite: Beipack melden, Podest bestellen, Bestellungen bearbeiten, Probleme lösen
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var params = new URLSearchParams(location.search);
  var RECENT_KEY = 'dekr26_recent_' + (new URLSearchParams(location.search).get('q') || 'x');
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { recent = []; }
  var PERM_KEYS = ['report', 'order', 'podest', 'solve', 'status', 'dash', 'ueber'];
  var VIEWS = ['beipack', 'podest', 'ueber', 'orders', 'problems', 'dash', 'chat'];

  // Name, Funktion und Rechte kommen vom QR-Code (?q=ID, im Dashboard gepflegt).
  // n/f/p im Link sind nur Rückfall, falls die Daten nicht aus der Datenbank kommen.
  var qid = params.get('q');
  var urlName = (params.get('n') || '').trim();
  // Rückfall nur ohne gemeinsame Datenbank (Demo): sonst muss ein gelöschter QR-Code ungültig werden
  var urlQr = urlName && !Store.remote ? { name: urlName, func: (params.get('f') || '').trim(), perms: toPerms(params.get('p')) } : null;
  var qr = urlQr, view = '', pdSel = {};
  var urlKey = (params.get('k') || '').trim(), autoAsked = false;
  $('lockReq').onsubmit = function (e) {
    e.preventDefault();
    $('lockReqErr').textContent = '';
    Store.requestAccess($('lockCodeIn').value || urlKey).catch(function (err) {
      $('lockReqErr').textContent = err && err.message === 'code' ? 'Zugangscode falsch oder fehlt.' : 'Keine Verbindung – bitte erneut versuchen.';
    });
  };

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
  function renderRecent() {
    $('hist').innerHTML = recent.length
      ? '<div class="col-title orb" style="margin-bottom:6px">Zuletzt</div>' + recent.slice(0, 15).map(function (m) {
        return '<div class="msg done">' + esc(m.text) + '<small>' + Util.time(m.t) + '</small></div>';
      }).join('') : '';
  }
  // Die Liste bleibt über Neuladen und Schließen erhalten (nur im Browser dieses Handys)
  function done(text) {
    recent.unshift({ t: Date.now(), text: text });
    recent = recent.slice(0, 30);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) { /* ignorieren */ }
    renderRecent();
  }
  renderRecent();

  // ---------- Benachrichtigungen ----------
  function canNotify() { return 'Notification' in window && Notification.permission === 'granted'; }
  function notify(title, body, tag, kind) {
    Sound.play(kind || 'ding');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if (!canNotify()) return;
    var plain = function () { try { new Notification(title, { body: body, tag: tag }); } catch (e) { /* ignorieren */ } };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      var timeout = new Promise(function (_, rej) { setTimeout(rej, 2000); });
      Promise.race([navigator.serviceWorker.ready, timeout]).then(function (reg) { reg.showNotification(title, { body: body, tag: tag }); }).catch(plain);
    } else plain();
  }
  function notifState() {
    var el = $('notifInfo'), b = $('notifBtn');
    if (!('Notification' in window)) { el.textContent = 'Dieser Browser unterstützt keine Benachrichtigungen.'; b.hidden = true; return; }
    b.hidden = Notification.permission === 'granted';
    el.textContent = Notification.permission === 'granted'
      ? 'Benachrichtigungen sind aktiv, solange diese Seite geöffnet ist.'
      : Notification.permission === 'denied' ? 'Benachrichtigungen sind im Browser blockiert.' : '';
  }
  $('notifBtn').onclick = function () {
    if (navigator.serviceWorker) navigator.serviceWorker.register('sw.js').catch(function () { /* ignorieren */ });
    Notification.requestPermission().then(notifState);
  };
  if (canNotify() && navigator.serviceWorker) navigator.serviceWorker.register('sw.js').catch(function () { /* ignorieren */ });

  // Bestätigungen für den Melder: ✔ „KR … bestätigt von …"
  function ackSeen() {
    try { return JSON.parse(localStorage.getItem('dekr26_ackseen')) || {}; } catch (e) { return {}; }
  }
  function checkAcks(state) {
    if (!qid) return;
    var seenA = ackSeen(), changed = false;
    Object.keys(state.msgs).forEach(function (id) {
      var m = state.msgs[id];
      if (m.qid !== qid || !m.ack || seenA[id]) return;
      seenA[id] = 1; changed = true;
      if (Date.now() - m.ack.t > 864e5) return;
      var text = m.type === 'problem' ? '✔ Problem KR ' + m.kr + ': Empfang bestätigt von ' + m.ack.by
        : '✔ ' + (m.kr ? 'KR ' + m.kr + ' ' : '') + 'bestätigt von ' + m.ack.by;
      done(text); toast(text); notify('Bestätigt', text, 'ack' + id);
    });
    if (changed) { try { localStorage.setItem('dekr26_ackseen', JSON.stringify(seenA)); } catch (e) { /* ignorieren */ } }
  }

  // Rückmeldung zur eigenen Podest-Bestellung (angenommen / erledigt)
  function checkOrders(state) {
    if (!qid) return;
    var seenO;
    try { seenO = JSON.parse(localStorage.getItem('dekr26_ordseen')) || {}; } catch (e) { seenO = {}; }
    var changed = false;
    Object.keys(state.orders).forEach(function (id) {
      var o = state.orders[id], key = id + ':' + o.status;
      if (o.qid !== qid || o.status === 'offen' || o.selfDone || seenO[key]) return;
      seenO[key] = 1; changed = true;
      if (Date.now() - (o.statusAt || 0) > 864e5) return;
      var ue = o.kind === 'ueber';
      var text = ue ? '✔ Anfrage Überspielen (' + o.where + ') ' + (o.status === 'erledigt' ? 'fertig' : o.status) + ' von ' + (o.statusBy || 'Deufol')
        : '✔ Podest-Bestellung (' + o.items.join(', ') + (o.where ? ' · ' + o.where : '') + ') ' + o.status + ' von ' + (o.statusBy || 'Deufol');
      done(text); toast(text); notify(ue ? 'Überspielen ' + o.status : 'Podest ' + o.status, text, 'ord' + key);
    });
    if (changed) { try { localStorage.setItem('dekr26_ordseen', JSON.stringify(seenO)); } catch (e) { /* ignorieren */ } }
  }

  // Rückmeldung zum eigenen Problem: gelöst
  function checkProblems(state) {
    if (!qid) return;
    var seenP;
    try { seenP = JSON.parse(localStorage.getItem('dekr26_probseen')) || {}; } catch (e) { seenP = {}; }
    var changed = false;
    Object.keys(state.problems).forEach(function (id) {
      var p = state.problems[id];
      if (p.qid !== qid || p.status !== 'gelöst' || p.selfDone || seenP[id]) return;
      seenP[id] = 1; changed = true;
      if (Date.now() - (p.solvedAt || 0) > 864e5) return;
      var text = '✔ Problem KR ' + p.kr + ' gelöst von ' + (p.solvedBy || 'Deufol');
      done(text); toast(text); notify('Problem gelöst', text, 'prob' + id);
    });
    if (changed) { try { localStorage.setItem('dekr26_probseen', JSON.stringify(seenP)); } catch (e) { /* ignorieren */ } }
  }

  // ---------- Nachrichten vom Dashboard (Posteingang) ----------
  var inboxSeen = null;
  function readSet() {
    try { return JSON.parse(localStorage.getItem('dekr26_dmread')) || {}; } catch (e) { return {}; }
  }
  function renderInbox(state) {
    var rd = readSet();
    var ms = Object.keys(state.msgs).map(function (id) { return Object.assign({ id: id }, state.msgs[id]); })
      .filter(function (m) { return m.type === 'dm' && (m.to === 'all' || (qid && m.to === qid)) && !(qid && m.fq === qid) && Date.now() - m.t < 1728e5 && !rd[m.id]; })
      .sort(function (a, b) { return b.t - a.t; });
    if (inboxSeen) {
      ms.forEach(function (m) { if (!inboxSeen[m.id]) { toast('Nachricht von ' + m.by); notify('Nachricht von ' + m.by, m.text.replace(/^An [^:]*: /, ''), m.id); } });
    }
    inboxSeen = inboxSeen || {};
    ms.forEach(function (m) { inboxSeen[m.id] = 1; });
    $('inbox').innerHTML = ms.map(function (m) {
      return '<div class="item dm"><b>Nachricht von ' + esc(m.by) + '</b><span>' + esc(m.text.replace(/^An [^:]*: /, '')) + '</span>' +
        '<span class="meta">' + Util.time(m.t) + '</span><span class="acts"><button class="btn-ok" data-dm="' + m.id + '">Gelesen</button></span></div>';
    }).join('');
  }
  $('inbox').onclick = function (e) {
    var b = e.target.closest('button[data-dm]');
    var m = b && Store.get().msgs[b.dataset.dm];
    if (!m) return;
    var rd = readSet(); rd[b.dataset.dm] = 1;
    try { localStorage.setItem('dekr26_dmread', JSON.stringify(rd)); } catch (err) { /* ignorieren */ }
    var rf = {}; rf['reads/' + (qid || 'x')] = { by: qr.name, t: Date.now() };
    Store.updateMsg(b.dataset.dm, rf).catch(function () { /* Lesebestätigung ist optional */ });
    renderInbox(Store.get());
  };

  // ---------- Messenger (für alle QR-Codes immer aktiv) ----------
  // Empfänger: Dashboard, alle QR-Besitzer oder ein bestimmter QR-Code. Nachrichten an Codes sind type 'dm' (fq = Absender-Code).
  function isMine(m) { return qid ? m.fq === qid : !!qr && m.by === qr.name && !m.to; }   // ohne QR-ID (Demo) nach Namen
  function chatTitle(m) { return (m.text || '').replace(/^An [^:]*: /, ''); }
  function renderChat(state) {
    if (view !== 'chat') return;
    var cur = $('chTo').value;
    var qs = Object.keys(state.qrs).filter(function (id) { return id !== qid; })
      .map(function (id) { return { id: id, name: state.qrs[id].name, t: state.qrs[id].t }; }).sort(function (a, b) { return a.t - b.t; });
    var opts = '<option value="">An das Dashboard</option>' + (qs.length ? '<option value="all">An alle QR-Besitzer</option>' : '') +
      qs.map(function (q) { return '<option value="' + esc(q.id) + '">An ' + esc(q.name) + '</option>'; }).join('');
    if ($('chTo').dataset.o !== opts) {
      $('chTo').innerHTML = opts; $('chTo').dataset.o = opts;
      if ([].some.call($('chTo').options, function (o) { return o.value === cur; })) $('chTo').value = cur;
    }
    var mine = qr ? qr.name : '';
    var ms = Object.keys(state.msgs).map(function (id) { return Object.assign({ id: id }, state.msgs[id]); }).filter(function (m) {
      if (Date.now() - m.t > 1728e5) return false;
      if (isMine(m)) return m.type === 'dm' || m.type === 'msg';
      return m.type === 'dm' && (m.to === 'all' || (qid && m.to === qid));
    }).sort(function (a, b) { return b.t - a.t; }).slice(0, 40);
    $('chList').innerHTML = ms.length ? ms.map(function (m) {
      var out = isMine(m);
      return '<div class="item' + (out ? ' ok' : ' dm') + '"><b>' + (out ? 'Du' + (m.type === 'msg' ? ' → Dashboard' : '') + (m.type === 'dm' && m.text.indexOf('An ') === 0 ? ' → ' + esc(m.text.slice(3, m.text.indexOf(':'))) : '') : esc(m.by)) + '</b><span>' + esc(chatTitle(m)) + '</span>' +
        '<span class="meta">' + Util.time(m.t) + (m.reads ? ' · ✔ gelesen von ' + Object.keys(m.reads).map(function (k) { return esc(m.reads[k].by); }).join(', ') : '') + '</span></div>';
    }).join('') : '<div class="empty">Noch keine Nachrichten.</div>';
  }
  $('chGo').onclick = function () {
    var text = $('chText').value.trim(), to = $('chTo').value;
    if (!text || !qr) return;
    var msg;
    if (to) {
      var qs = Store.get().qrs, who = to === 'all' ? 'alle QR-Besitzer' : (qs[to] ? qs[to].name : '?');
      msg = { type: 'dm', by: qr.name, to: to, fq: qid, text: 'An ' + who + ': ' + text };
    } else {
      msg = { type: 'msg', by: qr.name, fq: qid, text: text };
    }
    $('chGo').disabled = true;
    Store.addMsg(msg).then(function () {
      $('chText').value = '';
      toast('Gesendet');
      if (to) {
        var all = Store.get().qrs, targets = to === 'all' ? Object.keys(all).filter(function (id) { return id !== qid; }) : [to];
        targets.forEach(function (id) { Push.toQr(id, 'Nachricht von ' + qr.name, text); });
      } else {
        Push.send('', 'Nachricht von ' + qr.name, text, 3, ['speech_balloon']);
      }
      renderChat(Store.get());
    }).catch(fail).then(function () { $('chGo').disabled = false; });
  };

  // ---------- Mobiles Dashboard ----------
  var notifSeen = null;   // bereits gesehene Fertig-Meldungen (für neue Benachrichtigungen)
  function doneMsgs(state) {
    return Object.keys(state.msgs).map(function (id) { return Object.assign({ id: id }, state.msgs[id]); })
      .filter(function (m) { return m.type === 'done' || m.type === 'problem'; }).sort(function (a, b) { return b.t - a.t; });
  }
  function watchDone(state) {
    if (!perms().dash) return;
    var ms = doneMsgs(state);
    if (notifSeen) {
      ms.forEach(function (m) { if (!notifSeen[m.id] && !m.ack) notify(m.type === 'problem' ? 'Beipack: Problem' : 'Beipack bereit', m.text, m.id, m.type === 'problem' ? 'problem' : 'done'); });
    }
    notifSeen = notifSeen || {};
    ms.forEach(function (m) { notifSeen[m.id] = 1; });
  }
  function renderDash(state) {
    var ms = doneMsgs(state), un = ms.filter(function (m) { return !m.ack; }), ac = ms.filter(function (m) { return m.ack; }).slice(0, 5);
    var today = Object.keys(state.tasks).map(function (id) { return state.tasks[id]; })
      .filter(function (t) { return t.week === WEEK && t.day === Util.todayIdx(); });
    var open = today.filter(function (t) { return !t.done; });
    var item = function (m, pulse) {
      return '<div class="item ' + (pulse ? 'pulse' : 'ok') + '"><b>' + esc(m.text) + '</b><span class="meta">' + Util.time(m.t) + ' · ' + esc(m.by || '') +
        (m.ack ? ' · ✔ bestätigt von ' + esc(m.ack.by) : '') + '</span>' +
        (pulse ? '<span class="acts"><button class="btn-ok" data-ackm="' + m.id + '">Bestätigen</button></span>' : '') + '</div>';
    };
    $('dashList').innerHTML =
      '<div class="col-title orb" style="margin:8px 0">Neu gemeldet (' + un.length + ')</div>' +
      (un.length ? un.map(function (m) { return item(m, true); }).join('') : '<div class="empty">Nichts Neues.</div>') +
      '<div class="col-title orb" style="margin:12px 0 8px">Heute: ' + (today.length - open.length) + '/' + today.length + ' fertig</div>' +
      (open.length ? '<div class="chips">' + open.slice(0, 40).map(function (t) {
        return '<span class="chip">KR ' + esc(t.kr) + (t.pos ? ' · ' + esc(Halls.label(t.hall, t.pos)) : '') + '</span>';
      }).join('') + '</div>' : '') +
      (ac.length ? '<div class="col-title orb" style="margin:12px 0 8px">Zuletzt bestätigt</div>' + ac.map(function (m) { return item(m, false); }).join('') : '');
    notifState();
    renderAllList(state);
  }
  // Ton an/aus und Bildschirm anlassen (Wake Lock)
  function soundLabel() { $('soundBtn').textContent = Sound.label(); }
  window.DEKR_NTFY = function () {
    var l = [], p = perms();
    if (qid) l.push({ label: 'Rückmeldungen und Nachrichten an dieses Handy', sub: 'q' + qid });
    if (p.dash) l.push({ label: 'Beipack fertig, Probleme, Überspielen', sub: '' });
    if (p.podest) l.push({ label: 'Neue Podest-Bestellungen', sub: 'podest' });
    return l;
  };
  $('soundBtn').onclick = function () { Sound.panel(); };
  document.addEventListener('dekr-sound', soundLabel);
  soundLabel();
  var wakeLock = null, wantWake = false;
  try { wantWake = localStorage.getItem('dekr26_wake') === '1'; } catch (e) { /* ignorieren */ }
  function wakeOn() {
    if (!navigator.wakeLock || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* nicht erlaubt */ });
  }
  if (navigator.wakeLock) {
    $('wakeRow').hidden = false;
    $('wakeChk').checked = wantWake;
    $('wakeChk').onchange = function () {
      wantWake = $('wakeChk').checked;
      try { localStorage.setItem('dekr26_wake', wantWake ? '1' : '0'); } catch (e) { /* ignorieren */ }
      if (wantWake) wakeOn(); else if (wakeLock) wakeLock.release();
    };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && wantWake) wakeOn(); });
    if (wantWake) wakeOn();
  }

  // Alle KR aller Wochen mit Suche
  var dashTab = 'new';
  function renderAllList(state) {
    if ($('dashAll').hidden) return;
    var q = $('allFilter').value.trim().toLowerCase();
    var probs = {};
    Object.keys(state.problems).forEach(function (id) { if (state.problems[id].status === 'offen') probs[state.problems[id].kr] = 1; });
    var list = Object.keys(state.tasks).map(function (id) { return state.tasks[id]; }).filter(function (t) {
      if (!q) return true;
      return (t.kr + ' ' + (t.pos ? Halls.label(t.hall, t.pos) : '') + ' ' + (t.scope || '') + (t.usa ? ' usa' : '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.week < b.week ? -1 : a.week > b.week ? 1 : a.day - b.day; });
    var html = '<div class="empty" style="margin-bottom:6px">' + list.length + ' Einträge · ' + list.filter(function (t) { return t.done; }).length + ' fertig</div>', last = '';
    list.slice(0, 300).forEach(function (t) {
      var key = t.week + '-' + t.day;
      if (key !== last) { html += '<div class="daysep">KW ' + esc(t.week.split('-W')[1]) + ' · ' + esc(Util.DAYS[t.day]) + ' ' + esc(Util.dayDate(t.week, t.day)) + '</div>'; last = key; }
      html += '<div class="krrow' + (t.closed ? ' closed' : t.done ? ' ok' : '') + '"><span><b>KR ' + esc(t.kr) + '</b>' +
        (t.scope ? ' <span class="badge">' + esc(t.scope) + '</span>' : '') + (t.usa ? ' <span class="badge usa">USA</span>' : '') +
        (probs[t.kr] ? ' <span class="badge prob">Problem</span>' : '') +
        '<small>' + (t.pos ? esc(Halls.label(t.hall, t.pos)) : t.from ? 'Lieferung aus Halle ' + esc(t.from) : 'ohne Position') + '</small></span><span class="st">' + (t.closed ? 'abgeschlossen' : t.done ? 'bereit' : 'nicht bereit') + '</span></div>';
    });
    $('allList').innerHTML = list.length ? html : '<div class="empty">Keine KR gefunden.</div>';
  }
  $('allFilter').addEventListener('input', function () { renderAllList(Store.get()); });
  $('v-dash').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-dt]');
    if (!b) return;
    dashTab = b.dataset.dt;
    Array.prototype.forEach.call($('v-dash').querySelectorAll('button[data-dt]'), function (x) { x.classList.toggle('sel', x.dataset.dt === dashTab); });
    $('dashNew').hidden = dashTab !== 'new';
    $('dashAll').hidden = dashTab !== 'all';
    renderAllList(Store.get());
  });
  $('v-dash').onclick = function (e) {
    var b = e.target.closest('button[data-ackm]');
    var m = b && Store.get().msgs[b.dataset.ackm];
    if (!m) return;
    Store.updateMsg(b.dataset.ackm, { ack: { by: qr.name, t: Date.now() } }).then(function () { Push.ack(m, qr.name); }).catch(fail);
  };

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
    var html = list.slice(0, 500).map(function (t) {
      return '<option value="' + esc(t.kr) + '">KR ' + esc(t.kr) + (t.pos ? ' · ' + esc(Halls.label(t.hall, t.pos)) : '') +
        ' · ' + esc(Util.DAYS[t.day].slice(0, 2)) + (t.closed ? ' · abgeschlossen' : t.done ? ' · bereit' : '') + '</option>';
    }).join('');
    if (html !== lastKrHtml) { lastKrHtml = html; $('krlist').innerHTML = html; }   // nur bei Änderung, sonst flackert die Auswahl
  }
  var lastKrHtml = '';
  function krInfo() { showKrInfo($('kr'), $('krInfo')); }
  function showKrInfo(input, box) {
    var kr = Util.normKr(input.value);
    if (!kr) { box.hidden = true; return; }
    var ts = tasksOf(kr);
    box.hidden = false;
    if (!ts.length) { box.innerHTML = 'KR ' + esc(kr) + ' steht nicht in der Liste.'; return; }
    var t = ts[0], np = openProblems(kr).length;
    box.innerHTML = '<b>KR ' + esc(kr) + '</b> · ' + (t.pos ? esc(Halls.label(t.hall, t.pos)) : t.from ? 'Lieferung aus Halle ' + esc(t.from) : 'ohne Position') + ' · ' +
      esc(Util.DAYS[t.day]) + (t.scope ? ' · ' + esc(t.scope) : '') + ' · <b style="color:' +
      (t.closed ? 'var(--dim)' : t.done ? 'var(--green)' : 'var(--orange)') + '">' + (t.closed ? 'abgeschlossen' : t.done ? 'bereit' : 'nicht bereit') + '</b>' +
      (np ? ' · <b style="color:var(--red)">' + np + ' Problem(e)</b>' : '');
  }

  // Alle Positionen der KR bereit bzw. wieder nicht bereit; ohne Eintrag entsteht einer ohne Position
  function markKr(kr, isDone) {
    var mine = tasksOf(kr), useWeek = weekOf(mine), ops = [], places = [];
    var ids = mine.filter(function (t) { return t.week === useWeek; });
    // „Abgeschlossen" setzt nur das Dashboard; am Handy ändert sich daran nichts mehr
    if (ids.length && ids.every(function (t) { return t.closed; })) return { blocked: true, ops: [], where: '' };
    ids = ids.filter(function (t) { return !t.closed; });
    if (!ids.length && isDone) {
      ops.push({ coll: 'tasks', id: Util.taskId(useWeek, kr, '0', '0'), val: {
        week: useWeek, kr: kr, day: Util.todayIdx(), hall: '', pos: '', done: true, doneAt: Date.now(), doneBy: qr.name } });
    }
    ids.forEach(function (t) {
      if (t.pos) places.push(Halls.label(t.hall, t.pos));
      if (!!t.done === isDone) return;
      ops.push({ coll: 'tasks', id: t.id, val: { done: isDone, doneAt: isDone ? Date.now() : null, doneBy: isDone ? qr.name : null }, patch: true });
    });
    return { ops: ops, where: places.length ? ' · ' + places.join(', ') : '' };
  }

  // ---------- Menü ----------
  function allowed() {
    var p = perms(), v = [];
    if (p.report || p.status) v.push(['beipack', 'Beipack bereit melden']);
    if (p.order) v.push(['podest', 'Podest bestellen']);
    if (p.ueber) v.push(['ueber', 'Anfrage Überspielen']);
    if (p.podest) v.push(['orders', 'Bestellungen']);
    if (p.solve) v.push(['problems', 'Probleme']);
    if (p.dash) v.push(['dash', 'Dashboard']);
    v.push(['chat', 'Messenger']);   // für alle QR-Codes immer aktiv
    return v;
  }
  function renderMenu() {
    var v = allowed(), ord = openOrders().length, pr = openProblems().length;
    if (!v.some(function (x) { return x[0] === view; })) {
      // Empfänger starten bei den Bestellungen, Problemlöser bei den Problemen
      var p0 = perms(), pref = p0.dash && !p0.report ? 'dash' : p0.podest ? 'orders' : p0.solve && !p0.report ? 'problems' : '';
      view = v.some(function (x) { return x[0] === pref; }) ? pref : v.length ? v[0][0] : '';
    }
    $('menu').innerHTML = v.map(function (x) {
      var cnt = x[0] === 'orders' ? ord : x[0] === 'problems' ? pr : 0;
      return '<button type="button" class="menu-btn' + (x[0] === view ? ' sel' : '') + '" data-view="' + x[0] + '">' +
        esc(x[1]) + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</button>';
    }).join('');
    VIEWS.forEach(function (k) { $('v-' + k).hidden = k !== view; });
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
    renderMenu(); renderLists(); renderChat(Store.get());
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
    var m = markKr(kr, isDone);
    if (m.blocked) { toast('KR ' + kr + ' ist bereits abgeschlossen.', true); return; }
    busy(true);
    var text = 'KR ' + kr + m.where + (isDone ? ' bereit' : ' nicht bereit') + ' (' + who() + ')';
    Store.batchUpdate(m.ops).then(function () {
      return Store.addMsg({ type: isDone ? 'done' : 'info', by: qr.name, text: text, kr: kr, qid: qid || '' });
    }).then(function () {
      done(text); toast((isDone ? 'Bereit gemeldet: KR ' : 'Zurückgenommen: KR ') + kr);
      if (isDone) Push.send('', 'Beipack bereit', text, 3, ['white_check_mark']);
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
    Store.setProblem(Util.uid(), { kr: kr, where: where, text: text, by: qr.name, func: qr.func || '', qid: qid || '', t: Date.now(), status: 'offen' })
      .then(function () { return Store.addMsg({ type: 'problem', by: qr.name, text: msg, kr: kr, qid: qid || '' }); })
      .then(function () {
        done(msg); toast('Problem gemeldet');
        Push.send('', 'Problem', msg, 4, ['warning']);
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
  // KR gewählt -> hinterlegte Position wird eingetragen (solange sie nicht von Hand geändert wurde)
  var pdAuto = '';   // zuletzt automatisch eingetragene Position
  function fillPdPos() {
    var kr = Util.normKr($('pdKr').value), t = kr ? tasksOf(kr)[0] : null;
    var cur = $('pdPos').value.trim();
    var auto = t && t.pos ? Halls.label(t.hall, t.pos) : '';
    if (!cur || cur === pdAuto) {
      $('pdPos').value = auto;
      pdAuto = auto;
    }
  }
  $('pdKr').addEventListener('input', fillPdPos);
  $('pdKr').addEventListener('change', fillPdPos);
  $('pdPos').addEventListener('input', function () { if ($('pdPos').value.trim() !== pdAuto) pdAuto = ''; });
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
    // Doppelte Bestellung verhindern: gleiche Bestellung dieses Geräts in den letzten 2 Minuten
    var all = Store.get().orders, key = items.join('|');
    if (!orderId) orderId = Util.uid();   // bei erneutem Tippen/Wiederholung dieselbe ID: es entsteht nur ein Eintrag
    var dup = Object.keys(all).some(function (id) {
      var o = all[id];
      return id !== orderId && o.qid === (qid || '') && o.where === where && o.items.join('|') === key && Date.now() - o.t < 12e4;
    });
    if (dup) { toast('Diese Bestellung wurde gerade schon aufgegeben', true); return; }
    $('pdGo').disabled = true;
    Store.setOrder(orderId, { items: items, kr: kr, where: where, by: qr.name, func: qr.func || '', qid: qid || '', t: Date.now(), status: 'offen' })
      .then(function () {
        done(msg); toast('Bestellt');
        Push.send('podest', 'Podest-Bestellung', msg, 3, ['package']);
        orderId = null;
        pdSel = {}; $('pdText').value = ''; $('pdKr').value = ''; $('pdPos').value = ''; pdAuto = '';
        renderPodestList(Store.get());
      }).catch(fail).then(function () { $('pdGo').disabled = false; });
  };
  var orderId = null;

  // ---------- Anfrage Überspielen: KR wählen, Anfrage geht ans Dashboard (annehmen, fertig melden) ----------
  var uId = null;
  $('ukr').addEventListener('input', function () { showKrInfo($('ukr'), $('ukrInfo')); });
  $('uGo').onclick = function () {
    var kr = Util.normKr($('ukr').value), note = $('unote').value.trim();
    if (!kr) { toast('Bitte eine KR-Nummer wählen', true); $('ukr').focus(); return; }
    var t = tasksOf(kr)[0];
    if (!t) { toast('Diese KR steht nicht in der Liste – bitte aus der Auswahl wählen', true); return; }
    var where = 'KR ' + kr + (t.pos ? ' · ' + Halls.label(t.hall, t.pos) : '');
    // Doppelte Anfrage verhindern (gleiche ID bei Wiederholung, gleiche KR in den letzten 2 Minuten)
    var all = Store.get().orders;
    if (!uId) uId = Util.uid();
    var dup = Object.keys(all).some(function (id) {
      var o = all[id];
      return id !== uId && o.kind === 'ueber' && o.kr === kr && o.qid === (qid || '') && Date.now() - o.t < 12e4;
    });
    if (dup) { toast('Diese Anfrage wurde gerade schon gesendet', true); return; }
    $('uGo').disabled = true;
    Store.setOrder(uId, { kind: 'ueber', items: ['Anfrage Überspielen'], kr: kr, where: where, note: note, by: qr.name, func: qr.func || '', qid: qid || '', t: Date.now(), status: 'offen' })
      .then(function () {
        done('Anfrage Überspielen gesendet: ' + where + (note ? ' (' + note + ')' : '') + ' (' + who() + ')');
        toast('Anfrage gesendet');
        Push.send('', 'Anfrage Überspielen', where + (note ? ' (' + note + ')' : '') + ' (' + who() + ')', 3, ['floppy_disk']);
        uId = null; $('ukr').value = ''; $('unote').value = ''; $('ukrInfo').hidden = true;
      }).catch(fail).then(function () { $('uGo').disabled = false; });
  };
  function renderMyUeber(state) {
    var ids = qid ? Object.keys(state.orders).filter(function (id) {
      var o = state.orders[id];
      return o.kind === 'ueber' && o.qid === qid && o.status !== 'erledigt';
    }).sort(function (a, b) { return state.orders[b].t - state.orders[a].t; }) : [];
    $('myUeber').innerHTML = ids.length
      ? '<div class="col-title orb" style="margin-bottom:8px">Meine offenen Anfragen</div>' + ids.map(function (id) {
        var o = state.orders[id];
        return '<div class="item"><b>' + esc(o.where) + '</b>' + (o.note ? '<span>' + esc(o.note) + '</span>' : '') +
          '<span class="meta">' + Util.time(o.t) + ' · <b>' + esc(o.status) + '</b>' + (o.statusBy ? ' von ' + esc(o.statusBy) : '') + '</span></div>';
      }).join('') : '';
  }

  // Eigene offene Bestellungen: der Besteller kann sie selbst als erledigt abhaken
  function renderMyOrders(state) {
    var ids = qid ? Object.keys(state.orders).filter(function (id) {
      return state.orders[id].qid === qid && state.orders[id].status !== 'erledigt' && state.orders[id].kind !== 'ueber';
    }).sort(function (a, b) { return state.orders[b].t - state.orders[a].t; }) : [];
    $('myOrders').innerHTML = ids.length
      ? '<div class="col-title orb" style="margin-bottom:8px">Meine offenen Bestellungen</div>' + ids.map(function (id) {
        var o = state.orders[id];
        return '<div class="item"><b>' + esc(o.items.join(', ')) + '</b><span>' + esc(o.where) + '</span><span class="meta">' + Util.time(o.t) +
          ' · <b>' + esc(o.status) + '</b>' + (o.statusBy ? ' von ' + esc(o.statusBy) : '') + '</span>' +
          '<span class="acts"><button class="btn-ok" data-mine="' + id + '">Erledigt</button></span></div>';
      }).join('') : '';
  }
  $('myOrders').onclick = function (e) {
    var b = e.target.closest('button[data-mine]');
    var o = b && Store.get().orders[b.dataset.mine];
    if (!o) return;
    b.disabled = true;
    Store.updateOrder(b.dataset.mine, { status: 'erledigt', statusBy: qr.name, statusAt: Date.now(), selfDone: 1 })
      .then(function () { done('Podest-Bestellung (' + o.items.join(', ') + (o.where ? ' · ' + o.where : '') + ') erledigt'); toast('Als erledigt markiert'); })
      .catch(fail);
  };

  // Empfänger werden über neue offene Bestellungen anderer benachrichtigt (einmal pro Bestellung)
  var ordSeen = null;
  function watchOrders(state) {
    if (!perms().podest) return;
    var ids = Object.keys(state.orders).filter(function (id) { return state.orders[id].status === 'offen' && state.orders[id].kind !== 'ueber'; });
    if (ordSeen) {
      ids.forEach(function (id) {
        var o = state.orders[id];
        if (ordSeen[id] || (qid && o.qid === qid)) return;
        var text = 'Neue Podest-Bestellung: ' + o.items.join(', ') + (o.where ? ' · ' + o.where : '');
        toast(text); notify('Podest-Bestellung', text, 'ord-' + id, 'order');
      });
    }
    ordSeen = ordSeen || {};
    ids.forEach(function (id) { ordSeen[id] = 1; });
  }

  // ---------- Bestellungen bearbeiten / Probleme lösen ----------
  function openOrders() {
    var o = Store.get().orders;
    return Object.keys(o).filter(function (id) { return o[id].status !== 'erledigt' && o[id].kind !== 'ueber'; });
  }
  function renderLists() {
    var s = Store.get();
    if (view === 'orders') {
      var ids = Object.keys(s.orders).filter(function (id) { return s.orders[id].kind !== 'ueber'; }).sort(function (a, b) { return s.orders[b].t - s.orders[a].t; }).slice(0, 40);
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
    b.disabled = true;
    Store.updateOrder(b.dataset.oid, { status: b.dataset.st, statusBy: qr.name, statusAt: Date.now() })
      .then(function () { if (!o.selfDone) Push.orderStatus(o, b.dataset.st, qr.name); }).catch(fail);
  };
  $('v-problems').onclick = function (e) {
    var b = e.target.closest('button[data-pid]');
    var p = b && Store.get().problems[b.dataset.pid];
    if (!p) return;
    Store.updateProblem(b.dataset.pid, { status: 'gelöst', solvedBy: qr.name, solvedAt: Date.now() }).then(function () {
      Push.toQr(p.qid, 'Problem gelöst', '✔ Problem KR ' + p.kr + ' gelöst von ' + qr.name);
      return Store.addMsg({ type: 'info', by: qr.name, text: 'Problem KR ' + p.kr + ' gelöst (' + who() + ')' });
    }).catch(fail);
  };

  // ---------- Start ----------
  function apply(state) {
    $('lockCover').hidden = !Store.isLocked();
    if (Store.isLocked()) {
      $('lockCode2').textContent = Auth.code();
      $('whoName').textContent = urlName;
      $('who').hidden = true;
      $('note').textContent = 'Dieses Gerät braucht eine Freigabe durch den Admin. Gerätecode: ' + Auth.code();
      $('lockReq').hidden = Store.isRequested();
      $('lockWait').hidden = !Store.isRequested();
      // Mit Code im Link (aus dem QR-Code) wird die Anfrage automatisch gestellt, sonst erst auf Tippen
      if (urlKey && !Store.isRequested() && !autoAsked) { autoAsked = true; Store.requestAccess(urlKey).catch(function () { $('lockReqErr').textContent = 'Zugangscode falsch oder abgelaufen.'; }); }
      $('menu').innerHTML = ''; $('inbox').innerHTML = '';
      VIEWS.forEach(function (k) { $('v-' + k).hidden = true; });
      return;
    }
    qr = (qid && state.qrs[qid]) || urlQr;
    var ok = !!qr;
    if (!ok && Store.isOffline()) {
      $('note').textContent = 'Keine Verbindung – bitte Internet prüfen und die Seite neu laden.';
      return;
    }
    $('whoName').textContent = ok ? qr.name : '';
    $('who').textContent = ok && qr.func ? qr.func : '';
    $('who').hidden = !(ok && qr.func);
    if (!ok) {
      $('note').textContent = qid ? 'QR-Code unbekannt oder gelöscht.' : 'Bitte über einen QR-Code öffnen.';
      $('menu').innerHTML = '';
      VIEWS.forEach(function (k) { $('v-' + k).hidden = true; });
      $('inbox').innerHTML = '';
      return;
    }
    $('note').textContent = Store.remote ? '' : 'Demo-Modus: Meldungen erreichen das Dashboard nicht.';
    fillKrList(state);
    renderMenu();
    renderPodestList(state);
    renderLists();
    krInfo();
    renderMyOrders(state);
    renderMyUeber(state);
    watchOrders(state);
    renderInbox(state);
    renderChat(state);
    renderDash(state);
    watchDone(state);
    checkAcks(state);
    checkOrders(state);
    checkProblems(state);
  }
  Store.setDeviceLabel(urlName || (qid ? 'QR ' + qid : 'Handy'));
  if (qid && !urlQr) $('note').textContent = 'Lädt …';
  Store.subscribe(apply);
  if (!qid && !urlQr) apply(Store.get());
  Store.start();
})();
