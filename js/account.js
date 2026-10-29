// Accounts: Der Admin legt Accounts an. Jeder Account bekommt einen Startcode (Format XXXX-XXXX) und einen QR-Code zum Profil.
// Beim ersten Anmelden legt die Person einen eigenen 6-stelligen Code fest. Der Code wird nur als Prüfwert (SHA-256) gespeichert.
// Das ist eine Kennung, kein starkes Passwort: Gegen Fremde schützt die Geräte-Freigabe, Admin-Zugang läuft über E-Mail und Passwort.
window.Account = (function () {
  'use strict';
  var SESSION = 'dekr26_account', NEWCODES = 'dekr26_newcodes', FAILS = 'dekr26_loginfails', CODEV = 2;
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // ohne 0/O/1/I/L

  // Rechte am Dashboard (zusätzlich zu den Handy-Rechten des Accounts)
  var DPERMS = [
    ['d_status', 'Dashboard: Bereit / Nicht bereit setzen'],
    ['d_close', 'Dashboard: KR abschließen, wieder öffnen, löschen'],
    ['d_plan', 'Dashboard: KR importieren und anlegen, Layout ändern'],
    ['d_orders', 'Dashboard: Podest- und Überspielen-Anfragen bearbeiten'],
    ['d_problems', 'Dashboard: Probleme lösen'],
    ['d_send', 'Dashboard: Meldungen bestätigen/löschen, Nachrichten senden']
  ];
  var PREF_KEYS = ['dekr26_soundcfg', 'dekr26_days', 'dekr26_showclosed', 'dekr26_mapfont', 'dekr26_mapzoom'];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } }
  function norm(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function format(c) { c = norm(c); return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; }

  function gen() {
    var out = '', a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 8; i++) out += ALPHA.charAt(a[i] % ALPHA.length);
    return format(out);
  }
  // Prüfwert des Codes. Gleiche Codes ergeben gleiche Werte; deshalb ist jeder Code nur einmal vergebbar.
  function hash(code) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Dieser Browser kann keine sichere Anmeldung.'));
    var bytes = new TextEncoder().encode('dekr26|' + norm(code));
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  function session() { try { return JSON.parse(lsGet(SESSION)) || null; } catch (e) { return null; } }
  function accounts(state) {
    return Object.keys((state && state.qrs) || {}).map(function (id) { return Object.assign({ id: id }, state.qrs[id]); });
  }
  function usable(a) { return !!(a && a.codeHash && a.codeV === CODEV); }
  // Angemeldeter Account (nur gültig, solange sein Code unverändert ist)
  function me(state) {
    var s = session(), q = s && state && state.qrs && state.qrs[s.id];
    if (!usable(q) || q.codeHash !== s.h) return null;
    return Object.assign({ id: s.id }, q);
  }
  function dperms(a) {
    var p = (a && a.perms) || {}, has = DPERMS.some(function (d) { return p[d[0]]; });
    if (has) return p;
    // Älterer Account ohne Dashboard-Rechte: aus den Handy-Rechten ableiten
    return { d_status: p.status || p.report, d_orders: p.podest, d_problems: p.solve, d_send: 1 };
  }
  function isAdmin() { return !!(window.Auth && Auth.isAdmin && Auth.isAdmin()); }
  function can(state, perm) {
    if (isAdmin()) return true;
    var a = me(state);
    return !!(a && dperms(a)[perm]);
  }

  // Anmeldung mit Code. Nach 5 Fehlversuchen kurze Pause.
  function wait() {
    var f = null; try { f = JSON.parse(lsGet(FAILS)); } catch (e) { f = null; }
    return f && f.n >= 5 && Date.now() - f.t < 30000 ? Math.ceil((30000 - (Date.now() - f.t)) / 1000) : 0;
  }
  // hintId: der Account aus dem QR-Code (optional), dann zählt nur dessen Code
  function login(state, code, hintId) {
    var w = wait();
    if (w) return Promise.reject(new Error('Zu viele Versuche, bitte ' + w + ' s warten.'));
    return hash(code).then(function (h) {
      var a = accounts(state).filter(function (x) { return usable(x) && x.codeHash === h && (!hintId || x.id === hintId); })[0];
      if (a) { lsSet(SESSION, JSON.stringify({ id: a.id, h: h })); lsSet(FAILS, ''); return a; }
      var f = null; try { f = JSON.parse(lsGet(FAILS)); } catch (e) { f = null; }
      lsSet(FAILS, JSON.stringify({ n: ((f && Date.now() - f.t < 60000) ? f.n : 0) + 1, t: Date.now() }));
      throw new Error('Code nicht gefunden.');
    });
  }
  function logout() { lsSet(SESSION, ''); }

  // Admin: Startcode setzen (Person muss ihn beim ersten Anmelden durch einen eigenen ersetzen)
  function setStartCode(id, code) {
    return hash(code).then(function (h) {
      return Store.updateQr(id, { codeHash: h, codeV: CODEV, codeInit: true }).then(function () { return h; });
    });
  }
  function validPin(pin) { return /^\d{6}$/.test(String(pin || '')); }
  function taken(state, h, exceptId) {
    return accounts(state).some(function (a) { return a.id !== exceptId && a.codeHash === h; });
  }
  // Eigenen 6-stelligen Code festlegen (Ziffern). Jeder Code ist nur einmal vergebbar.
  function setPin(state, id, pin) {
    if (!validPin(pin)) return Promise.reject(new Error('Der Code braucht genau 6 Ziffern.'));
    return hash(pin).then(function (h) {
      if (taken(state, h, id)) throw new Error('Dieser Code ist schon vergeben, bitte einen anderen wählen.');
      var s = session(); if (s && s.id === id) lsSet(SESSION, JSON.stringify({ id: id, h: h }));   // Anmeldung bleibt gültig
      return Store.updateQr(id, { codeHash: h, codeV: CODEV, codeInit: false }).then(function () { return h; });
    });
  }
  function changePin(state, id, oldCode, newPin) {
    var q = state.qrs[id];
    return hash(oldCode).then(function (h) {
      if (!q || q.codeHash !== h) throw new Error('Der alte Code stimmt nicht.');
      return setPin(state, id, newPin);
    });
  }
  function rename(id, name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return Promise.reject(new Error('Der Name darf nicht leer sein.'));
    return Store.updateQr(id, { name: name });
  }

  // Frisch erzeugte Startcodes merkt sich nur der Admin-Browser (Karte und Liste); in der Datenbank steht nur der Prüfwert
  function newCodes() { try { return JSON.parse(sessionStorage.getItem(NEWCODES)) || {}; } catch (e) { return {}; } }
  function rememberCode(id, code) {
    var m = newCodes(); m[id] = code;
    try { sessionStorage.setItem(NEWCODES, JSON.stringify(m)); } catch (e) { /* ignorieren */ }
  }

  // Persönliche Einstellungen: folgen dem Account auf jedes Gerät
  var lastPrefs = '';
  function collectPrefs() {
    var o = {};
    PREF_KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) o[k] = v; });
    return o;
  }
  function applyPrefs(prefs) {
    var changed = false;
    PREF_KEYS.forEach(function (k) {
      if (prefs && prefs[k] != null && lsGet(k) !== prefs[k]) { lsSet(k, prefs[k]); changed = true; }
    });
    lastPrefs = prefs ? JSON.stringify(collectPrefs()) : '';   // ohne gespeicherte Einstellungen: die dieses Geräts hochladen
    return changed;
  }
  function pushPrefs(id) {
    var now = JSON.stringify(collectPrefs());
    if (!id || now === lastPrefs) return;
    lastPrefs = now;
    Store.updateQr(id, { prefs: collectPrefs() }).catch(function () { lastPrefs = ''; });
  }

  return { DPERMS: DPERMS, CODEV: CODEV, norm: norm, format: format, gen: gen, hash: hash, accounts: accounts, usable: usable, me: me, session: session,
    dperms: dperms, can: can, isAdmin: isAdmin, login: login, logout: logout, setStartCode: setStartCode, setPin: setPin, changePin: changePin,
    rename: rename, validPin: validPin, newCodes: newCodes, rememberCode: rememberCode, applyPrefs: applyPrefs, pushPrefs: pushPrefs, wait: wait };
})();
