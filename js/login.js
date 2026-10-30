// Anmeldeseite (Cyberpunk) und Profil. Beim Besuch der Seite fragt eine Vollbild-Anmeldung zuerst nach dem Code.
// Ablauf: Gerät freigegeben (Admin) → Code eingeben → beim ersten Mal eigenen 6-stelligen Code festlegen → Dashboard (PC) oder Handyseite (Handy).
// Admin meldet sich hier mit E-Mail und Passwort an. Alle Texte stehen im Quelltext, keine Daten verlassen den Browser außer an Firebase.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = Util.esc;
  var params = new URLSearchParams(location.search);
  var hint = (params.get('p') || params.get('q') || '').trim();   // Account aus dem QR-Code
  var urlKey = (params.get('k') || '').trim();
  var isScan = /scan\.html$/.test(location.pathname);

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);
  }
  // Wer schon angemeldet ist und mit dem Handy die Startseite öffnet, geht direkt zur Handyseite
  if (!isScan && isMobile() && (Account.session() || Account.isAdmin())) { location.replace('scan.html'); return; }

  var root = document.createElement('div');
  root.id = 'lgn';
  root.className = 'lgn';
  root.innerHTML = '<div class="lgn-grid"></div><div class="lgn-scan"></div>' +
    '<div class="lgn-box"><div class="lgn-haz"></div>' +
    '<div class="lgn-logo"><b data-t="DEUKRO26">DEUKRO26</b><small>BEIPACK-ABHOLUNG // ZUGANG</small></div>' +
    '<div id="lgnStep" class="lgn-step"></div>' +
    '<div class="lgn-foot"><span id="lgnNet">● VERBINDE</span><span>NIGHT CITY EDITION</span></div>' +
    '<i class="lgn-c c1"></i><i class="lgn-c c2"></i><i class="lgn-c c3"></i><i class="lgn-c c4"></i></div>' +
    '<div class="lgn-ok" id="lgnOk" hidden><b>ZUGRIFF GEWÄHRT</b><small id="lgnOkName"></small></div>';
  // Ohne gespeicherte Anmeldung sofort zeigen (kein Aufblitzen des Dashboards), sonst erst nach dem Prüfen
  root.hidden = !!(Account.session() || Account.isAdmin());
  document.body.appendChild(root);
  document.documentElement.classList.toggle('lgn-open', !root.hidden);

  var step = '', guestName = false, adminMode = false, autoAsked = false, busy = false, leaving = false;
  function setStep(key, html, after) {
    if (step === key) return;
    step = key;
    $('lgnStep').innerHTML = html;
    if (after) after();
  }
  function show(on) {
    root.hidden = !on;
    document.documentElement.classList.toggle('lgn-open', on);
  }
  function err(t) { var e = $('lgnErr'); if (e) e.textContent = t || ''; }
  function leave(name) {
    if (leaving) return;
    leaving = true;
    $('lgnOkName').textContent = name ? '> ' + name : '';
    $('lgnOk').hidden = false;
    setTimeout(function () {
      if (!isScan && isMobile()) location.replace('scan.html'); else location.reload();
    }, 900);
  }

  // ---- Schritte ----
  function stepWait() { setStep('wait', '<div class="lgn-prompt">&gt; VERBINDUNG WIRD HERGESTELLT<span class="lgn-cur"></span></div><a href="#" id="lgnAdm" class="lgn-link">ADMIN-ANMELDUNG</a>', bindAdminLink); }
  var GUEST = 'dekr26_wantguest';
  function stepDevice() { stepCode(Store.get()); }
  function stepPending() {
    setStep('pending', '<div class="lgn-prompt">&gt; ANFRAGE GESENDET<span class="lgn-cur"></span></div>' +
      '<p class="lgn-p">Der Admin gibt dieses Gerät frei. Diese Seite wartet und geht von selbst weiter. Gerätecode: <b>' + esc(Auth.code()) + '</b></p>' +
      '<a href="#" id="lgnAdm" class="lgn-link">ADMIN-ANMELDUNG</a>', bindAdminLink);
  }
  function stepCode(state) {
    var acc = hint && state && state.qrs && state.qrs[hint];
    var who = acc && Account.usable(acc) ? acc.name : '';
    var locked = Store.isLocked();
    var none = !locked && !Account.accounts(state).some(Account.usable);
    setStep('code:' + who + ':' + none + ':' + locked, '<div class="lgn-prompt">&gt; ' + (who ? 'KONTO: ' + esc(who.toUpperCase()) : 'ZUGANGSCODE') + '<span class="lgn-cur"></span></div>' +
      (none ? '<p class="lgn-p">Es gibt noch keine Accounts. Der Admin legt sie an.</p>' : '') +
      '<form id="lgnF" autocomplete="off"><input id="lgnCode" class="lgn-code" autocomplete="off" inputmode="numeric" pattern="[0-9]*" spellcheck="false" maxlength="12" placeholder="________" aria-label="Code">' +
      '<input id="lgnZg" class="lgn-in" placeholder="Zugangscode des Betriebs" autocomplete="off" value="' + esc(urlKey) + '"' + (urlKey ? '' : ' hidden') + '>' +
      '<button class="lgn-btn">ANMELDEN</button></form><div class="lgn-err" id="lgnErr"></div>' +
      '<div class="lgn-links"><a href="#" id="lgnZgL" class="lgn-link"' + (urlKey ? ' hidden' : '') + '>ZUGANGSCODE DES BETRIEBS</a><a href="#" id="lgnGuest" class="lgn-link">OHNE CODE: ALS GAST ANFRAGEN</a><a href="#" id="lgnAdm" class="lgn-link">ADMIN-ANMELDUNG</a></div>', function () {
        $('lgnF').onsubmit = function (e) {
          e.preventDefault();
          if (busy) return;
          busy = true; err('');
          breach($('lgnCode').value, Account.claim(Store.get(), $('lgnCode').value, $('lgnZg').value || urlKey)).then(function (a) { leaveOrPin(a); })
            .catch(function (x) { err(x.message || 'Anmeldung fehlgeschlagen'); $('lgnCode').value = ''; if (/Zugangscode/.test(x.message || '')) { $('lgnZg').hidden = false; } shake(); })
            .then(function () { busy = false; });
        };
        $('lgnZgL').onclick = function (e) { e.preventDefault(); $('lgnZg').hidden = false; $('lgnZg').focus(); };
        $('lgnGuest').onclick = function (e) {
          e.preventDefault(); err('');
          try { localStorage.setItem(GUEST, '1'); } catch (x) { /* ignorieren */ }
          if (!Store.isLocked()) { step = ''; guestName = true; update(Store.get()); return; }
          Store.requestAccess($('lgnZg').value || urlKey).catch(function (x) { err(x && x.message === 'code' ? 'Zugangscode des Betriebs falsch oder fehlt.' : 'Keine Verbindung, bitte erneut versuchen.'); });
        };
        bindAdminLink();
        try { $('lgnCode').focus(); } catch (e) { /* ignorieren */ }
      });
  }
  // Breach-Protocol: ein Raster aus Hex-Codes läuft durch, die Zeichen des Codes leuchten auf (mindestens ~1,2 s, solange die Prüfung läuft)
  function breach(code, work) {
    if (document.documentElement.classList.contains('fx-low')) return work;
    var f = $('lgnF'), box = $('lgnBreach');
    if (box) box.remove();
    box = document.createElement('div'); box.id = 'lgnBreach'; box.className = 'lgn-breach'; f.appendChild(box);
    var hex = ['1C', 'BD', '55', 'E9', '7A', 'FF'], h = '';
    for (var i = 0; i < 28; i++) h += '<i>' + hex[Math.floor(Math.random() * hex.length)] + '</i>';
    box.innerHTML = h;
    var cells = box.children, chars = Account.norm(code).split('').slice(0, 8), k = 0, tick = 0;
    var iv = setInterval(function () {
      Array.prototype.forEach.call(cells, function (c) { c.classList.remove('scan'); });
      var row = tick % 4; for (var j = 0; j < 7; j++) cells[row * 7 + j].classList.add('scan');
      if (tick % 2 === 1 && k < chars.length) { var c = cells[Math.floor(Math.random() * 28)]; c.textContent = chars[k] + chars[k]; c.classList.add('hit'); k++; }
      tick++;
    }, 110);
    var wait = new Promise(function (res) { setTimeout(res, 1300); });
    function done(ok) { clearInterval(iv); Array.prototype.forEach.call(cells, function (c) { c.classList.remove('scan'); }); box.classList.add(ok ? 'good' : 'bad'); }
    return Promise.all([work.then(function (v) { return { v: v }; }, function (e) { return { e: e }; }), wait]).then(function (r) {
      done(!r[0].e);
      if (r[0].e) { setTimeout(function () { if (box.parentNode) box.remove(); }, 900); throw r[0].e; }
      return r[0].v;
    });
  }
  function stepName() {
    setStep('name', '<div class="lgn-prompt">&gt; GERÄT FREIGEGEBEN<span class="lgn-cur"></span></div>' +
      '<p class="lgn-p">Wie sollen wir dich nennen? Dein Name erscheint bei Meldungen und im Chat.</p>' +
      '<form id="lgnNameF" autocomplete="off"><input id="lgnName" class="lgn-in" maxlength="40" placeholder="Dein Name" autocomplete="off" required>' +
      '<button class="lgn-btn">WEITER</button></form><div class="lgn-err" id="lgnErr"></div>', function () {
        $('lgnNameF').onsubmit = function (e) {
          e.preventDefault();
          if (busy) return;
          busy = true; err('');
          Account.becomeGuest(Store.get(), $('lgnName').value).then(function () { try { localStorage.removeItem(GUEST); } catch (x) { /* ignorieren */ } leave($('lgnName').value.trim()); })
            .catch(function (x) { err(x.message || 'Speichern fehlgeschlagen'); shake(); })
            .then(function () { busy = false; });
        };
        try { $('lgnName').focus(); } catch (e) { /* ignorieren */ }
      });
  }
  function leaveOrPin(a) {
    if (a && a.codeInit) { update(Store.get()); return; }
    leave(a && a.name);
  }
  function stepPin(a) {
    setStep('pin:' + a.id, '<div class="lgn-prompt">&gt; WILLKOMMEN, ' + esc(String(a.name).toUpperCase()) + '<span class="lgn-cur"></span></div>' +
      '<p class="lgn-p">Lege jetzt deinen <b>eigenen Code</b> fest: genau 6 Ziffern. Mit ihm meldest du dich ab jetzt an.</p>' +
      '<form id="lgnPinF" autocomplete="off" novalidate><input id="lgnPin1" class="lgn-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="neuer Code" aria-label="Neuer Code">' +
      '<input id="lgnPin2" class="lgn-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="wiederholen" aria-label="Code wiederholen">' +
      '<button class="lgn-btn">CODE SPEICHERN</button></form><div class="lgn-err" id="lgnErr"></div>', function () {
        $('lgnPinF').onsubmit = function (e) {
          e.preventDefault();
          if (busy) return;
          var p1 = $('lgnPin1').value.trim(), p2 = $('lgnPin2').value.trim();
          if (!Account.validPin(p1)) { err('Der Code braucht genau 6 Ziffern.'); shake(); return; }
          if (p1 !== p2) { err('Die beiden Codes sind nicht gleich.'); shake(); return; }
          busy = true; err('');
          Account.setPin(Store.get(), a.id, p1).then(function () { leave(a.name); })
            .catch(function (x) { err(x.message || 'Speichern fehlgeschlagen'); shake(); })
            .then(function () { busy = false; });
        };
        try { $('lgnPin1').focus(); } catch (e) { /* ignorieren */ }
      });
  }
  function stepAdmin() {
    setStep('admin', '<div class="lgn-prompt">&gt; ADMIN-ZUGANG<span class="lgn-cur"></span></div>' +
      '<form id="lgnAdmF" autocomplete="on"><input id="lgnMail" class="lgn-in" type="email" placeholder="E-Mail" autocomplete="username" required>' +
      '<input id="lgnPw" class="lgn-in" type="password" placeholder="Passwort" autocomplete="current-password" required>' +
      '<button class="lgn-btn">ANMELDEN</button></form><div class="lgn-err" id="lgnErr"></div><a href="#" id="lgnBack" class="lgn-link">ZURÜCK ZUM CODE</a>', function () {
        $('lgnBack').onclick = function (e) { e.preventDefault(); adminMode = false; step = ''; update(Store.get()); };
        $('lgnAdmF').onsubmit = function (e) {
          e.preventDefault();
          if (busy) return;
          busy = true; err('');
          var oldUid = '';
          Auth.login($('lgnMail').value.trim(), $('lgnPw').value).then(function (old) { oldUid = old; $('lgnPw').value = ''; return Store.reconnect(); })
            .then(function () {
              if (oldUid) Store.setDevice(oldUid, null).catch(function () { /* nicht schlimm */ });
              leave('ADMIN');
            }).catch(function (x) { err('Anmeldung fehlgeschlagen' + (x && x.message ? ' (' + x.message + ')' : '')); shake(); })
            .then(function () { busy = false; });
        };
        try { $('lgnMail').focus(); } catch (e) { /* ignorieren */ }
      });
  }
  function bindAdminLink() {
    var a = $('lgnAdm');
    if (a) a.onclick = function (e) { e.preventDefault(); adminMode = true; step = ''; update(Store.get()); };
  }
  function shake() {
    var b = root.querySelector('.lgn-box');
    b.classList.remove('lgn-shake'); void b.offsetWidth; b.classList.add('lgn-shake');
  }

  function update(state) {
    var admin = Account.isAdmin(), a = Account.me(state), nm = admin ? 'Admin' : a ? a.name : '';
    var pb = $('profileBtn');
    if (pb) { pb.hidden = !(admin || a); pb.textContent = '👤 ' + nm; }
    $('lgnNet').textContent = Store.isOffline() ? '● OFFLINE' : '● ONLINE';
    $('lgnNet').className = Store.isOffline() ? 'bad' : 'good';
    if (admin || (a && !a.codeInit)) { if (!leaving) show(false); return; }
    if (a && a.codeInit) { show(true); stepPin(a); return; }
    // Keine gültige Anmeldung: Anmeldeseite zeigen
    if (Account.session() && Store.isLoaded()) Account.logout();   // Code wurde geändert oder Account gelöscht
    show(true);
    if (adminMode) { stepAdmin(); return; }
    if (Store.isLocked()) {
      var wantGuest = false;
      try { wantGuest = !!localStorage.getItem(GUEST); } catch (e) { /* ignorieren */ }
      if (urlKey && wantGuest && !Store.isRequested() && !autoAsked) { autoAsked = true; Store.requestAccess(urlKey).catch(function () { /* der Schritt zeigt den Fehler */ }); }
      if (Store.isRequested()) stepPending(); else stepCode(state);
      return;
    }
    if (!Store.isLoaded()) { stepWait(); return; }
    // Freigegebenes Gerät ohne Anmeldung: eigener Gast-Account dieses Geräts, oder Namen wählen, oder Code eingeben
    if (Account.resumeGuest(state)) { leave(((state.qrs || {})[Account.guestId()] || {}).name); return; }
    var wg = false;
    try { wg = !!localStorage.getItem(GUEST); } catch (e) { /* ignorieren */ }
    if (guestName || wg) { stepName(); return; }
    stepCode(state);
  }

  // ---- Profil ----
  var pm = null;
  function openProfile() {
    var state = Store.get(), admin = Account.isAdmin(), a = admin ? null : Account.me(state);
    if (!admin && !a) return;
    if (pm) { pm.remove(); pm = null; }
    pm = document.createElement('div');
    pm.className = 'prf-wrap';
    var name = admin ? Util.getName() : a.name, role = admin ? 'Admin · alle Rechte, Freigaben und Accounts' : a.guest ? 'Gast (ohne Code)' : (a.func || 'Account');
    pm.innerHTML = '<div class="prf"><div class="prf-head"><span class="prf-av">' + esc(String(name).trim().charAt(0).toUpperCase() || '?') + '</span>' +
      '<div><b>' + esc(name) + '</b><small>' + esc(role) + '</small></div><button type="button" class="btn-sm" id="prfClose">Schließen</button></div>' +
      '<div class="prf-sec"><div class="prf-t">Name</div><form id="prfName" class="prf-row"><input id="prfNameIn" maxlength="40" value="' + esc(name) + '" required><button class="btn-main">Speichern</button></form></div>' +
      (a && a.guest ? '<div class="prf-sec"><div class="empty">Du bist als Gast angemeldet. Für einen eigenen Code und mehr Rechte wende dich an den Admin.</div></div>' : admin ? '<div class="prf-sec"><div class="prf-t">Anmeldung</div><div class="empty">Der Admin meldet sich mit E-Mail und Passwort an. Geräte-Freigaben und Accounts verwaltest du unter „Admin“ und „Accounts“ oben.</div></div>' :
        '<div class="prf-sec"><div class="prf-t">Eigenen Code ändern (6 Ziffern)</div><form id="prfCode" class="prf-col" autocomplete="off" novalidate>' +
        '<input id="prfOld" placeholder="Alter Code" autocomplete="off" required><input id="prfNew" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Neuer Code" autocomplete="off" required>' +
        '<input id="prfNew2" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Neuen Code wiederholen" autocomplete="off" required><button class="btn-main">Code speichern</button></form></div>') +
      '<div class="note" id="prfMsg"></div><div class="empty">Version ' + esc(window.DekrVersion ? DekrVersion.label() : '') + (window.DEKR_VERSION ? ' · ' + esc(DEKR_VERSION.d) : '') + '</div>' +
      '<div class="prf-sec"><button type="button" class="btn-warn" id="prfOut">Abmelden</button></div></div>';
    document.body.appendChild(pm);
    var msg = function (t, ok) { var e = $('prfMsg'); e.textContent = t; e.style.color = ok ? 'var(--green)' : ''; };
    pm.addEventListener('click', function (e) { if (e.target === pm || e.target.id === 'prfClose') { pm.remove(); pm = null; } });
    $('prfName').onsubmit = function (e) {
      e.preventDefault();
      var n = $('prfNameIn').value.trim();
      if (!n) return;
      if (admin) {
        Util.setName(n);
        if ($('me')) $('me').value = n;
        if ($('mName')) $('mName').value = n;
        msg('✔ Name gespeichert.', true); update(Store.get());
      } else {
        Account.rename(a.id, n).then(function () { msg('✔ Name gespeichert.', true); }).catch(function (x) { msg(x.message || 'Speichern fehlgeschlagen'); });
      }
    };
    if (!admin && !a.guest) {
      $('prfCode').onsubmit = function (e) {
        e.preventDefault();
        var n1 = $('prfNew').value.trim();
        if (n1 !== $('prfNew2').value.trim()) { msg('Die beiden neuen Codes sind nicht gleich.'); return; }
        Account.changePin(Store.get(), a.id, $('prfOld').value, n1).then(function () { msg('✔ Code geändert. Dieses Gerät bleibt angemeldet.', true); $('prfCode').reset(); })
          .catch(function (x) { msg(x.message || 'Speichern fehlgeschlagen'); });
      };
    }
    $('prfOut').onclick = function () {
      var id = a && a.id;
      if (id && window.Account.pushPrefs) { try { Account.pushPrefs(id); } catch (e) { /* ignorieren */ } }
      Account.logout();
      if (admin) Auth.logout();
      location.replace('index.html');
    };
  }
  window.Profile = { open: openProfile };

  var pb0 = $('profileBtn');
  if (pb0) pb0.onclick = openProfile;
  Store.subscribe(update);
  update(Store.get());
})();
