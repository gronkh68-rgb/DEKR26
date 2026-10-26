// Handy-Meldeseite: KR als fertig melden
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var params = new URLSearchParams(location.search);
  var mine = [];

  // Name und Funktion kommen vom QR-Code (?q=ID, im Dashboard gepflegt) und sind nicht änderbar.
  // ?n=Name dient nur zum Testen ohne gespeicherten QR-Code.
  var qid = params.get('q');
  var fixedName = (params.get('n') || '').trim();
  var qr = fixedName ? { name: fixedName, func: '' } : null;

  function setReady(ok, msg) {
    $('go').disabled = !ok;
    $('kr').disabled = !ok;
    $('note').textContent = msg || '';
  }

  function applyQr(state) {
    if (fixedName) { qr = { name: fixedName, func: '' }; }
    else if (qid) { qr = state.qrs[qid] || null; }
    $('name').value = qr ? qr.name : '';
    $('who').textContent = qr && qr.func ? qr.func : '';
    $('who').hidden = !(qr && qr.func);
    if (qr) setReady(true);
    else setReady(false, qid ? 'QR-Code unbekannt oder gelöscht.' : 'Bitte über einen QR-Code öffnen.');
  }

  if (qid && !fixedName) setReady(false, 'Lädt …');
  Store.subscribe(applyQr);
  if (!qid && !fixedName) applyQr(Store.get());

  function toast(t, bad) {
    var el = $('toast');
    el.textContent = t;
    el.style.borderColor = el.style.color = bad ? 'var(--red)' : 'var(--green)';
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

  function renderHist() {
    $('hist').innerHTML = mine.length
      ? '<div class="col-title orb" style="margin-bottom:6px">Zuletzt gemeldet</div>' + mine.map(function (m) {
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
    var ids = Object.keys(all).filter(function (id) { return all[id].week === WEEK && all[id].kr === kr; });
    var jobs = [], places = [];
    if (!ids.length) {
      jobs.push(Store.setTask(Util.taskId(WEEK, kr, '0', '0'), {
        week: WEEK, kr: kr, day: Util.todayIdx(), hall: '', pos: '', done: true, doneAt: Date.now(), doneBy: qr.name
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
      mine.unshift({ t: Date.now(), text: text }); renderHist();
      toast('Gemeldet: KR ' + kr);
      $('kr').value = '';
      $('kr').focus();
    }).catch(function () {
      toast('Fehler – bitte erneut versuchen', true);
    }).then(function () { $('go').disabled = false; });
  };

  Store.start();
})();
