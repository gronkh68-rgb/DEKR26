// Accounts: jeder QR-Code ist ein Account (Name, Funktion, Rechte). Am Desktop meldet man sich mit dem Account-Code an.
// Der Code wird nur als Prüfwert (SHA-256 aus Account-ID und Code) in der Datenbank abgelegt. Das ist eine Kennung, kein starkes Passwort:
// Gegen Fremde schützt weiter die Geräte-Freigabe. Die Rechte (d_*) wirken in der Oberfläche, die Datenbank prüft sie nicht je Account.
window.Account = (function () {
  'use strict';
  var SESSION = 'dekr26_account', NEWCODES = 'dekr26_newcodes', FAILS = 'dekr26_loginfails';
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
  function hash(id, code) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Dieser Browser kann keine sichere Anmeldung.'));
    var bytes = new TextEncoder().encode(id + ':' + norm(code));
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  function session() { try { return JSON.parse(lsGet(SESSION)) || null; } catch (e) { return null; } }
  function accounts(state) {
    return Object.keys(state.qrs || {}).map(function (id) { return Object.assign({ id: id }, state.qrs[id]); });
  }
  function hasCodes(state) { return accounts(state).some(function (a) { return a.codeHash; }); }
  // Angemeldeter Account (nur gültig, solange sein Code unverändert ist)
  function me(state) {
    var s = session(), q = s && state.qrs && state.qrs[s.id];
    if (!q || !q.codeHash || q.codeHash !== s.h) return null;
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
    if (isAdmin() || !hasCodes(state)) return true;   // ohne Account-Codes ist das Dashboard offen wie bisher
    var a = me(state);
    return !!(a && dperms(a)[perm]);
  }

  // Anmeldung mit Code. Nach 5 Fehlversuchen kurze Pause.
  function wait() {
    var f = null; try { f = JSON.parse(lsGet(FAILS)); } catch (e) { f = null; }
    return f && f.n >= 5 && Date.now() - f.t < 30000 ? Math.ceil((30000 - (Date.now() - f.t)) / 1000) : 0;
  }
  function login(state, code) {
    var w = wait();
    if (w) return Promise.reject(new Error('Zu viele Versuche, bitte ' + w + ' s warten.'));
    var list = accounts(state).filter(function (a) { return a.codeHash; });
    return Promise.all(list.map(function (a) { return hash(a.id, code); })).then(function (hs) {
      for (var i = 0; i < list.length; i++) {
        if (hs[i] === list[i].codeHash) {
          lsSet(SESSION, JSON.stringify({ id: list[i].id, h: hs[i] }));
          lsSet(FAILS, '');
          return list[i].id;
        }
      }
      var f = null; try { f = JSON.parse(lsGet(FAILS)); } catch (e) { f = null; }
      lsSet(FAILS, JSON.stringify({ n: ((f && Date.now() - f.t < 60000) ? f.n : 0) + 1, t: Date.now() }));
      throw new Error('Code nicht gefunden.');
    });
  }
  function logout() { lsSet(SESSION, ''); }

  // Code setzen/ändern (Admin: ohne alten Code; Account selbst: mit altem Code)
  function setCode(id, code) {
    return hash(id, code).then(function (h) {
      return Store.updateQr(id, { codeHash: h }).then(function () { return h; });
    });
  }
  function changeCode(state, id, oldCode, newCode) {
    var q = state.qrs[id];
    if (norm(newCode).length < 4) return Promise.reject(new Error('Der neue Code braucht mindestens 4 Zeichen oder Ziffern.'));
    return hash(id, oldCode).then(function (h) {
      if (q && q.codeHash && h !== q.codeHash) throw new Error('Der alte Code stimmt nicht.');
      return hash(id, newCode).then(function (nh) {
        // Diese Anmeldung bleibt gültig: zuerst merken, dann speichern (sonst würde die Änderung kurz abmelden)
        var s = session(); if (s && s.id === id) lsSet(SESSION, JSON.stringify({ id: id, h: nh }));
        return Store.updateQr(id, { codeHash: nh }).then(function () { return nh; });
      });
    });
  }

  // Frisch erzeugte Codes merkt sich nur der Admin-Browser (für Karte und Liste); in der Datenbank steht nur der Prüfwert
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

  return { DPERMS: DPERMS, norm: norm, format: format, gen: gen, hash: hash, accounts: accounts, hasCodes: hasCodes, me: me, dperms: dperms,
    can: can, isAdmin: isAdmin, login: login, logout: logout, setCode: setCode, changeCode: changeCode, newCodes: newCodes,
    rememberCode: rememberCode, applyPrefs: applyPrefs, pushPrefs: pushPrefs, wait: wait };
})();
