// Handy-Meldeseite: KR als fertig melden
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var params = new URLSearchParams(location.search);
  var recent = [];

  // Name und Funktion kommen vom QR-Code (?q=ID, im Dashboard gepflegt) und sind nicht änderbar.
  var qid = params.get('q');
  // ?n / ?f im Link sind nur Rückfall, falls die QR-Daten nicht aus der Datenbank kommen
  var urlName = (params.get('n') || '').trim();
  var urlQr = urlName ? { name: urlName, func: (params.get('f') || '').trim() } : null;
  var qr = urlQr;

  function setReady(ok, msg) {
    $('go').disabled = !ok;
    $('kr').disabled = !ok;
    $('note').textContent = msg || '';
  }

  function applyQr(state) {
    qr = (qid && state.qrs[qid]) || urlQr;
    $('name').value = qr ? qr.name : '';
    $('who').textContent = qr && qr.func ? qr.func : '';
    $('who').hidden = !(qr && qr.func);
    if (qr) setReady(true, Store.remote ? '' : 'Demo-Modus: Die Meldung erreicht das Dashboard nicht.');
    else setReady(false, qid ? 'QR-Code unbekannt oder gelöscht.' : 'Bitte über einen QR-Code öffnen.');
  }

  if (qid && !urlQr) setReady(false, 'Lädt …');
  Store.subscribe(applyQr);
  if (!qid && !urlQr) applyQr(Store.get());

  function toast(t, bad) {
    var el = $('toast');
    el.textContent = t;
    el.style.borderColor = el.style.color = bad ? 'var(--red)' : 'var(--green)';
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

  function renderHist() {
    $('hist').innerHTML = recent.length
      ? '<div class="col-title orb" style="margin-bottom:6px">Zuletzt gemeldet</div>' + recent.map(function (m) {
        return '<div class="msg done">' + esc(m.text) + '<small>' + Util.time(m.t) + '</small></div>';
      }).join('') : '';
  }

  $('f').onsubmit = function (e) {
    e.preventDefault();
    var kr = Util.normKr($('kr').value);
    if (!qr || !kr) return;
    var who = qr.func ? qr.name + ' · ' + qr.func : qr.name;
    $('go').disabled = true;

    // Alle Positionen dieser KR (aktuelle Woche) werden fertig; ohne Eintrag entsteht einer ohne Position
    var all = Store.get().tasks;
    // Woche der KR: aktuelle, sonst die nächste kommende (bzw. letzte vergangene)
    var mine = Object.keys(all).filter(function (id) { return all[id].kr === kr; });
    var weeks = {};
    mine.forEach(function (id) { weeks[all[id].week] = 1; });
    var wk = Object.keys(weeks).sort();
    var useWeek = weeks[WEEK] ? WEEK : wk.filter(function (w) { return w > WEEK; })[0] || wk[wk.length - 1] || WEEK;
    var ids = mine.filter(function (id) { return all[id].week === useWeek; });
    var jobs = [], places = [];
    if (!ids.length) {
      jobs.push(Store.setTask(Util.taskId(useWeek, kr, '0', '0'), {
        week: useWeek, kr: kr, day: Util.todayIdx(), hall: '', pos: '', done: true, doneAt: Date.now(), doneBy: qr.name
      }));
    }
    ids.forEach(function (id) {
      var t = all[id];
      if (t.pos) places.push(Halls.get(t.hall) ? Halls.get(t.hall).name + ' ' + t.pos : t.pos);
      if (t.done) return;
      var copy = Object.assign({}, t);
      copy.done = true; copy.doneAt = Date.now(); copy.doneBy = qr.name;
      jobs.push(Store.setTask(id, copy));
    });
    var text = 'KR ' + kr + (places.length ? ' · ' + places.join(', ') : '') + ' bereit (' + who + ')';

    Promise.all(jobs).then(function () {
      return Store.addMsg({ type: 'done', by: qr.name, text: text });
    }).then(function () {
      recent.unshift({ t: Date.now(), text: text }); renderHist();
      toast('Gemeldet: KR ' + kr);
      $('kr').value = '';
      $('kr').focus();
    }).catch(function () {
      toast('Fehler – bitte erneut versuchen', true);
    }).then(function () { $('go').disabled = false; });
  };

  Store.start();
})();
