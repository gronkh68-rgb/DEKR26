// Admin-Bereich im mobilen Dashboard: Accounts anlegen, Rechte, Startcodes, Geräte, Löschen.
// Nutzt dieselben Funktionen wie die Verwaltung am PC (Account.*, Store.*); die Datenbank-Regeln lassen nur den Admin schreiben.
window.AdminM = (function () {
  'use strict';
  var esc = Util.esc;
  var PERM_LABELS = [['report', 'Beipack melden'], ['order', 'Podest bestellen'], ['kisten', 'Kisten K2/K5'], ['podest', 'Bestellungen bearbeiten'],
    ['solve', 'Probleme lösen'], ['status', 'Bereit/Nicht bereit'], ['dash', 'Mobiles Dashboard'], ['ueber', 'Überspielen']].concat(Account.DPERMS);
  var PRESETS = [
    ['standard', 'Standard (melden + bestellen)', '', { report: 1, order: 1 }],
    ['kisten', 'Kisten K2/K5 eintragen', '', { report: 1, kisten: 1 }],
    ['podest', 'Podest-Empfänger', 'Podest-Empfänger', { podest: 1, order: 1 }],
    ['elektriker', 'Elektriker', 'Elektriker', { report: 1, status: 1 }],
    ['ueber', 'Anfrage Überspielen', '', { report: 1, ueber: 1 }],
    ['mobil', 'Mobiles Dashboard (Push)', 'Dashboard mobil', { dash: 1 }],
    ['leitstand', 'Leitstand (Dashboard bearbeiten)', 'Leitstand', { dash: 1, dashEdit: 1 }],
    ['alles', 'Alle Rechte', '', { report: 1, order: 1, podest: 1, solve: 1, status: 1, dash: 1, ueber: 1, kisten: 1, dashEdit: 1 }]
  ];
  var bound = null, openIds = {}, toastFn = function () { /* wird bei mount gesetzt */ };

  function permsOf(q) { return q.perms && Object.keys(q.perms).length ? q.perms : { report: 1, order: 1 }; }
  function presetOpts(sel) { return PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === sel ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join(''); }
  function link(q) {
    var u = new URL('index.html', location.href);
    u.searchParams.set('p', q.id);
    var k = (Store.get().settings || {}).regcode;
    if (k) u.searchParams.set('k', k);
    return u.href;
  }
  function status(q) {
    if (q.guest) return '👤 Gast';
    if (!Account.usable(q)) return '⚠ kein Code';
    return q.codeInit ? '🔑 Startcode' : '🔑 aktiv';
  }
  function devs(q) {
    if (q.guest) return '';
    var d = q.dev || {};
    return '<div class="acct-devs">' + ['pc', 'mobile'].map(function (sl) {
      var x = d[sl];
      return '<div class="acct-dev"><span>' + (sl === 'pc' ? '🖥 PC' : '📱 Handy') + ': ' + (x ? '<b>' + esc(x.label || 'Gerät') + '</b> · seit ' + new Date(x.t || 0).toLocaleDateString('de-DE') : '<i>frei</i>') + '</span>' +
        (x ? ' <button type="button" class="btn-sm btn-warn" data-devrm="' + esc(q.id) + '|' + sl + '">Zurücksetzen</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function codeLine(q) {
    if (q.guest) return '';
    var nc = Account.newCodes()[q.id], txt = !Account.usable(q) ? 'Noch kein Code.' : q.codeInit ? (nc ? 'Startcode: <b>' + esc(nc) + '</b> (nur jetzt sichtbar)' : 'Startcode vergeben, wartet auf den eigenen Code.') : 'Eigener Code gesetzt.';
    return '<div class="acct-line">' + txt + '</div><div class="qr-add"><button type="button" class="btn-sm" data-gen="' + esc(q.id) + '">' + (Account.usable(q) ? 'Neuen Startcode' : 'Startcode erzeugen') + '</button>' +
      '<button type="button" class="btn-sm" data-link="' + esc(q.id) + '">Profil-Link kopieren</button></div>';
  }
  function accCard(q) {
    var pm = permsOf(q);
    return '<details class="adm-acc" data-id="' + esc(q.id) + '"' + (openIds[q.id] ? ' open' : '') + '><summary><b>' + esc(q.name || '?') + '</b>' +
      (q.func ? ' <small>' + esc(q.func) + '</small>' : '') + ' <span class="adm-st">' + status(q) + '</span></summary>' +
      '<div class="adm-body" data-id="' + esc(q.id) + '">' +
      '<input class="full-in" data-f="name" value="' + esc(q.name || '') + '" maxlength="40" placeholder="Name">' +
      (q.guest ? '' : '<input class="full-in" data-f="func" value="' + esc(q.func || '') + '" maxlength="40" placeholder="Funktion">' +
        '<select class="full-in" data-preset><option value="">Vorlage anwenden …</option>' + presetOpts('') + '</select>' +
        '<div class="perms">' + PERM_LABELS.map(function (p) { return '<label><input type="checkbox" data-perm="' + p[0] + '"' + (pm[p[0]] ? ' checked' : '') + '>' + esc(p[1]) + '</label>'; }).join('') + '</div>') +
      codeLine(q) + devs(q) +
      '<div class="qr-add"><button type="button" class="btn-sm btn-warn" data-del="' + esc(q.id) + '">Löschen</button></div></div></details>';
  }
  function render(root, state) {
    if (!root) return;
    if (root.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;   // Eingabe nicht unterbrechen
    bind(root);
    var list = Object.keys(state.qrs || {}).map(function (id) { return Object.assign({ id: id }, state.qrs[id]); });
    var acc = list.filter(function (q) { return !q.guest; }).sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    var guests = list.filter(function (q) { return q.guest; });
    var noCode = acc.filter(function (q) { return !Account.usable(q); }).length, rc = (state.settings || {}).regcode || '';
    root.innerHTML = '<div class="box"><b>Account anlegen</b><form id="admNew" class="form" style="margin-top:8px">' +
      '<input class="full-in" id="admName" maxlength="40" placeholder="Name" autocomplete="off" required>' +
      '<input class="full-in" id="admFunc" maxlength="40" placeholder="Funktion (optional)" autocomplete="off">' +
      '<select class="full-in" id="admPre">' + presetOpts('standard') + '</select>' +
      '<button class="btn-main big">Anlegen</button></form></div>' +
      '<div class="box"><b>Zugangscode des Betriebs</b><div class="empty">Neue Geräte brauchen ihn zusätzlich zum Account-Code. Leer = aus.</div>' +
      '<div class="qr-add"><input id="admReg" class="full-in" style="margin:0;flex:1" value="' + esc(rc) + '" maxlength="40" placeholder="Code" autocomplete="off"><button type="button" class="btn-sm" id="admRegSave">Speichern</button></div></div>' +
      '<div class="qr-add" style="margin:8px 0"><b style="flex:1">Accounts (' + acc.length + ')</b>' + (noCode ? '<button type="button" class="btn-sm" id="admAllCodes">Codes erzeugen (' + noCode + ')</button>' : '') + '</div>' +
      (acc.length ? acc.map(accCard).join('') : '<div class="empty">Noch keine Accounts.</div>') +
      (guests.length ? '<div class="qr-add" style="margin:14px 0 8px"><b>Gäste (' + guests.length + ')</b></div>' + guests.map(accCard).join('') : '');
  }
  function save(id, patch) {
    var q = Store.get().qrs[id];
    if (!q) return Promise.resolve();
    var upd = { name: q.name, func: q.func || '', t: q.t, perms: permsOf(q) };
    Object.keys(patch).forEach(function (k) { upd[k] = patch[k]; });
    return Store.updateQr(id, upd).catch(function () { toastFn('Speichern fehlgeschlagen', true); });
  }
  function bind(root) {
    if (bound === root) return;
    bound = root;
    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'admNew') return;
      e.preventDefault();
      var name = document.getElementById('admName').value.trim();
      if (!name) return;
      var pre = PRESETS.filter(function (p) { return p[0] === document.getElementById('admPre').value; })[0] || PRESETS[0];
      var func = document.getElementById('admFunc').value.trim() || pre[2], id = Util.uid(), code = Account.gen();
      Store.setQr(id, { name: name, func: func, t: Date.now(), perms: Object.assign({}, pre[3]) }).then(function () { return Account.setStartCode(id, code); }).then(function () {
        Account.rememberCode(id, code); openIds[id] = true;
        toastFn('Account angelegt, Startcode: ' + code);
        render(root, Store.get());
      }).catch(function () { toastFn('Speichern fehlgeschlagen', true); });
    });
    root.addEventListener('toggle', function (e) { var d = e.target; if (d.matches && d.matches('details.adm-acc')) openIds[d.dataset.id] = d.open; }, true);
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'admRegSave') {
        var v = document.getElementById('admReg').value.trim();
        Store.setSetting('regcode', v || null).then(function () { toastFn(v ? 'Code gespeichert' : 'Code entfernt'); }).catch(function () { toastFn('Speichern fehlgeschlagen', true); });
      } else if (t.id === 'admAllCodes') {
        var st = Store.get(), todo = Object.keys(st.qrs).filter(function (id) { return !st.qrs[id].guest && !Account.usable(st.qrs[id]); });
        Promise.all(todo.map(function (id) {
          var code = Account.gen();
          return Account.setStartCode(id, code).then(function () { Account.rememberCode(id, code); return st.qrs[id].name + ': ' + code; });
        })).then(function (lines) { render(root, Store.get()); window.alert('Startcodes (nur jetzt sichtbar):\n\n' + lines.join('\n')); })
          .catch(function () { toastFn('Speichern fehlgeschlagen', true); });
      } else if (t.dataset.gen) {
        var q = Store.get().qrs[t.dataset.gen];
        if (q && Account.usable(q) && !confirm('Neuen Startcode erzeugen? Der bisherige Code gilt dann nicht mehr.')) return;
        var code2 = Account.gen(), id2 = t.dataset.gen;
        Account.setStartCode(id2, code2).then(function () { Account.rememberCode(id2, code2); toastFn('Neuer Startcode: ' + code2); render(root, Store.get()); })
          .catch(function () { toastFn('Speichern fehlgeschlagen', true); });
      } else if (t.dataset.link) {
        var lq = Store.get().qrs[t.dataset.link];
        if (!lq) return;
        var url = link(Object.assign({ id: t.dataset.link }, lq));
        try { navigator.clipboard.writeText(url).then(function () { toastFn('Link kopiert'); }, function () { window.prompt('Link kopieren:', url); }); } catch (x) { window.prompt('Link kopieren:', url); }
      } else if (t.dataset.devrm) {
        var pr = t.dataset.devrm.split('|');
        if (confirm('Dieses Gerät zurücksetzen? Es verliert den Zugang und muss sich neu mit dem Code anmelden.')) Account.removeDevice(Store.get(), pr[0], pr[1]).catch(function () { toastFn('Zurücksetzen fehlgeschlagen', true); });
      } else if (t.dataset.del) {
        if (confirm('Account löschen? Seine Geräte verlieren den Zugang.')) Account.remove(Store.get(), t.dataset.del).catch(function () { toastFn('Löschen fehlgeschlagen', true); });
      }
    });
    root.addEventListener('change', function (e) {
      var body = e.target.closest('.adm-body'), t = e.target;
      if (!body) return;
      var id = body.dataset.id;
      if (t.matches('input[data-f]')) save(id, (function () { var o = {}; o[t.dataset.f] = t.value.trim(); return o; })());
      else if (t.matches('input[data-perm]')) {
        var p = {};
        Array.prototype.forEach.call(body.querySelectorAll('input[data-perm]'), function (c) { if (c.checked) p[c.dataset.perm] = 1; });
        save(id, { perms: p });
      } else if (t.matches('select[data-preset]')) {
        var pre = PRESETS.filter(function (x) { return x[0] === t.value; })[0];
        if (!pre) return;
        var patch = { perms: Object.assign({}, pre[3]) };
        if (pre[2]) patch.func = pre[2];
        save(id, patch).then(function () { t.value = ''; render(root, Store.get()); });
      }
    });
  }
  return { render: render, setToast: function (f) { toastFn = f; } };
})();
