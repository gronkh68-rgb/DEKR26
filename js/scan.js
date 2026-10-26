// Handy-Meldeseite: Position als fertig melden
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var WEEK = Util.isoWeek();
  var params = new URLSearchParams(location.search);
  var mine = [];

  // Name per QR-Code festgelegt (?n=...), sonst frei eintragbar und gemerkt
  var fixedName = (params.get('n') || '').trim();
  $('name').value = fixedName || Util.getName();
  if (fixedName) $('name').readOnly = true;
  // Halle ergibt sich aus der Position; nur wenn sie in mehreren Hallen existiert, wird gefragt
  function checkPos() {
    var pos = Util.normPos($('pos').value);
    var note = $('note');
    note.textContent = '';
    $('hallRow').hidden = true;
    if (!pos) return;
    var halls = Halls.find(pos);
    if (!halls.length) {
      note.textContent = 'Position ' + pos + ' nicht im Hallenplan – wird trotzdem gemeldet.';
      $('hall').innerHTML = '<option value="' + Halls.all[0].id + '">' + esc(Halls.all[0].name) + '</option>';
      return;
    }
    var prev = $('hall').value;
    $('hall').innerHTML = halls.map(function (h) {
      return '<option value="' + h.id + '">' + esc(h.name) + '</option>';
    }).join('');
    if (halls.some(function (h) { return h.id === prev; })) $('hall').value = prev;
    $('hallRow').hidden = halls.length < 2;
  }
  $('pos').addEventListener('input', checkPos);
  checkPos();

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
    var name = $('name').value.trim();
    var kr = Util.normKr($('kr').value);
    var pos = Util.normPos($('pos').value);
    var hall = $('hall').value;
    if (!name || !kr || !pos) return;
    Util.setName(name);
    $('go').disabled = true;

    var id = Util.taskId(WEEK, kr, hall, pos);
    var old = Store.get().tasks[id];
    var task = old ? Object.assign({}, old) : { week: WEEK, kr: kr, day: Util.todayIdx(), hall: hall, pos: pos };
    task.done = true; task.doneAt = Date.now(); task.doneBy = name;
    var text = 'KR ' + kr + ' · ' + Halls.get(hall).name + ' · ' + pos + ' bereit (' + name + ')';

    Store.setTask(id, task).then(function () {
      return Store.addMsg({ type: 'done', by: name, text: text });
    }).then(function () {
      mine.unshift({ t: Date.now(), text: text }); renderHist();
      toast('Gemeldet: ' + pos);
      $('pos').value = ''; $('kr').value = ''; $('note').textContent = '';
      $('kr').focus();
    }).catch(function () {
      toast('Fehler – bitte erneut versuchen', true);
    }).then(function () { $('go').disabled = false; });
  };

  Store.start();
})();
