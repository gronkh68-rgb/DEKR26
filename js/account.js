// Accounts: Der Admin legt Accounts an. Jeder Account bekommt einen Startcode (Format XXXX-XXXX) und einen QR-Code zum Profil.
// Beim ersten Anmelden legt die Person einen eigenen 6-stelligen Code fest. Der Code wird nur als Prüfwert (SHA-256) gespeichert.
// Das ist eine Kennung, kein starkes Passwort: Gegen Fremde schützt die Geräte-Freigabe, Admin-Zugang läuft über E-Mail und Passwort.
window.Account = (function () {
  'use strict';
  var SESSION = 'dekr26_account', NEWCODES = 'dekr26_newcodes', FAILS = 'dekr26_loginfails', CODEV = 2;
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // ohne 0/O/1/I/L

  // Dashboard: nur zwei Stufen. Ohne Haken wird es nur angesehen, mit Haken „dashEdit“ darf man alles bearbeiten (die Chats gehören nicht dazu).
  var DPERMS = [['dashEdit', 'Dashboard bearbeiten (ohne Haken: nur ansehen)']];
  var GATES = ['d_status', 'd_close', 'd_plan', 'd_orders', 'd_problems', 'd_send'];   // Kennungen der geschützten Bedienelemente im Dashboard
  // Alles, was zur Person gehört und auf jedem Gerät gleich sein soll (Ton, Ansicht, Karte, Design, Farben, Filter, „Zuletzt“-Liste am Handy)
  var PREF_KEYS = ['dekr26_soundcfg', 'dekr26_days', 'dekr26_showclosed', 'dekr26_mapfont', 'dekr26_mapzoom', 'dekr-theme', 'dekr-colors', 'dekr26_khide', 'dekr26_wake', 'dekr26_impmap'];
  function recentKey() { var s = session(); return s && s.id ? 'dekr26_recent_' + s.id : ''; }

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
  function uid() { return (window.Auth && Auth.uid && Auth.uid()) || ''; }
  function me(state) {
    var s = session(), q = s && state && state.qrs && state.qrs[s.id];
    if (!q) return null;
    // Gast (anonymer Account): gehört zu genau diesem Gerät, hat keinen Code
    if (s.guest) return q.guest && s.id === 'g' + uid() ? Object.assign({ id: s.id }, q) : null;
    if (!usable(q) || q.codeHash !== s.h) return null;
    return Object.assign({ id: s.id }, q);
  }
  function isAdmin() { return !!(window.Auth && Auth.isAdmin && Auth.isAdmin()); }
  function can(state, perm) {
    if (isAdmin()) return true;
    var a = me(state);
    return !!(a && a.perms && a.perms.dashEdit);   // jede geschützte Aktion verlangt nur „bearbeiten“
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

  // Der Code-Prüfwert steht zusätzlich unter logins/<Prüfwert> = { id }. Damit kann ein neues Gerät mit dem Code eintreten (Freigabe durch den Code),
  // ohne dass es Accounts lesen darf. Beim Wechsel des Codes wird der alte Eintrag entfernt.
  function writeCode(id, newHash, oldHash, init) {
    var ops = [{ coll: 'logins', id: newHash, val: { id: id } }, { coll: 'qrs', id: id, val: { codeHash: newHash, codeV: CODEV, codeInit: init }, patch: true }];
    if (oldHash && oldHash !== newHash) ops.push({ coll: 'logins', id: oldHash, val: null });
    return Store.batch(ops).then(function () { return newHash; });
  }
  // Admin: Startcode setzen (Person muss ihn beim ersten Anmelden durch einen eigenen ersetzen)
  function setStartCode(id, code) {
    var q = (Store.get().qrs || {})[id] || {};
    return hash(code).then(function (h) { return writeCode(id, h, q.codeHash, true); });
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
      var q = state.qrs[id] || {};
      var s = session(); if (s && s.id === id) lsSet(SESSION, JSON.stringify({ id: id, h: h }));   // Anmeldung bleibt gültig
      return writeCode(id, h, q.codeHash, false);
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

  // ---- Eintritt mit Code: der Code ist die Freigabe ----
  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);
  }
  function deviceLabel() {
    var ua = String(navigator.userAgent || ''), os = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
    var br = /Edg\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
    return (os + (br ? ' · ' + br : '')).slice(0, 40);
  }
  function failNote() {
    var f = null; try { f = JSON.parse(lsGet(FAILS)); } catch (e) { f = null; }
    lsSet(FAILS, JSON.stringify({ n: ((f && Date.now() - f.t < 60000) ? f.n : 0) + 1, t: Date.now() }));
  }
  // Neues oder gesperrtes Gerät: Der Prüfwert des Codes steht unter logins/<Prüfwert>. Passt er, trägt sich das Gerät selbst als freigegeben ein
  // (mit Account und Platz PC oder Handy). Pro Account ist je ein PC und ein Handy vorgesehen.
  // zugang: optionaler Zugangscode des Betriebs (nur nötig, wenn der Admin einen gesetzt hat)
  function claim(state, code, zugang) {
    var w = wait();
    if (w) return Promise.reject(new Error('Zu viele Versuche, bitte ' + w + ' s warten.'));
    if (!Store.remote || !Store.secure) return login(state, code, '');   // Demo ohne gemeinsame Datenbank: Prüfung lokal
    var h, id, slot = isMobileDevice() ? 'mobile' : 'pc', myUid = uid();
    return hash(code).then(function (hh) {
      h = hh;
      return Store.raw('/logins/' + h).then(function (r) {
        if (!r.ok) throw new Error('Keine Verbindung, bitte erneut versuchen.');
        return r.json();
      });
    }).then(function (j) {
      if (!j || !j.id) { failNote(); throw new Error('Code nicht gefunden.'); }
      id = j.id;
      return Store.raw('/qrs/' + id + '/dev/' + slot).then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (d) {
      if (d && d.uid && d.uid !== myUid) throw new Error('Dieser Account ist schon an einem anderen ' + (slot === 'pc' ? 'PC' : 'Handy') + ' angemeldet' + (d.label ? ' (' + d.label + ')' : '') + '. Der Admin kann das Gerät zurücksetzen.');
      return Store.deviceInfo();
    }).then(function (info) {
      var body = Object.assign({}, info, { ok: true, acc: id, lh: h, slot: slot, code: String(zugang || '').trim().slice(0, 40), n: 'Konto' });
      return Store.raw('/devices/' + myUid, { method: 'PATCH', body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('Anmeldung abgelehnt. Der Zugangscode des Betriebs fehlt oder ist falsch, oder dieser Account ist gerade auf einem anderen Gerät angemeldet.');
      if (!r.ok) throw new Error('Keine Verbindung, bitte erneut versuchen.');
      return Store.raw('/qrs/' + id + '/dev/' + slot, { method: 'PUT', body: JSON.stringify({ uid: myUid, label: deviceLabel(), t: Date.now() }) });
    }).then(function (r) {
      if (!r.ok) throw new Error('Platz konnte nicht belegt werden, bitte erneut versuchen.');
      return Store.reconnect();
    }).then(function () { return login(Store.get(), code, id); });
  }
  // Gast (anonymer Account): Gerät wurde freigegeben, die Person wählt einen Namen
  function guestId() { return 'g' + uid(); }
  function becomeGuest(state, name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return Promise.reject(new Error('Bitte einen Namen eingeben.'));
    var id = guestId();
    var q = { name: name, guest: true, t: Date.now(), perms: { report: 1, order: 1 } };
    var p = (state.qrs && state.qrs[id]) ? Store.updateQr(id, { name: name }) : Store.setQr(id, q);
    return p.then(function () { lsSet(SESSION, JSON.stringify({ id: id, guest: true })); return id; });
  }
  // Gerät hat schon einen Gast-Account (z.B. nach Neuladen): wieder anmelden
  function resumeGuest(state) {
    var id = guestId(), q = state.qrs && state.qrs[id];
    if (q && q.guest && uid()) { lsSet(SESSION, JSON.stringify({ id: id, guest: true })); return true; }
    return false;
  }
  // Admin: Account löschen samt Anmelde-Eintrag und gemerkter Geräte
  function remove(state, id) {
    var q = (state.qrs || {})[id] || {}, ops = [{ coll: 'qrs', id: id, val: null }];
    if (q.codeHash) ops.push({ coll: 'logins', id: q.codeHash, val: null });
    ['pc', 'mobile'].forEach(function (sl) { if (q.dev && q.dev[sl] && q.dev[sl].uid) ops.push({ coll: 'devices', id: q.dev[sl].uid, val: null }); });
    return Store.batch(ops);
  }
  // Admin: gemerktes Gerät eines Accounts entfernen (Platz frei, Gerät verliert den Zugang)
  function removeDevice(state, id, slot) {
    var d = ((state.qrs[id] || {}).dev || {})[slot], ops = [{ coll: 'qrs', id: id, val: (function () { var o = {}; o['dev/' + slot] = null; return o; })(), patch: true }];
    if (d && d.uid) ops.push({ coll: 'devices', id: d.uid, val: null });
    return Store.batch(ops);
  }
  // Admin: fehlende Anmelde-Einträge nachtragen (Accounts aus der Zeit vor dieser Umstellung)
  function syncLogins(state) {
    var ops = [];
    accounts(state).forEach(function (a) {
      if (usable(a) && !(state.logins && state.logins[a.codeHash])) ops.push({ coll: 'logins', id: a.codeHash, val: { id: a.id } });
    });
    return ops.length ? Store.batch(ops) : Promise.resolve();
  }

  // Frisch erzeugte Startcodes merkt sich nur der Admin-Browser (Karte und Liste); in der Datenbank steht nur der Prüfwert
  function newCodes() { try { return JSON.parse(sessionStorage.getItem(NEWCODES)) || {}; } catch (e) { return {}; } }
  function rememberCode(id, code) {
    var m = newCodes(); m[id] = code;
    try { sessionStorage.setItem(NEWCODES, JSON.stringify(m)); } catch (e) { /* ignorieren */ }
  }

  // Persönliche Einstellungen: folgen dem Account auf jedes Gerät
  var lastPrefs = '', prefsApplied = false;   // erst nach dem Laden der Profil-Einstellungen wird hochgeladen, sonst überschreibt ein neues Gerät sie mit seinen Standardwerten
  function collectPrefs() {
    var o = {}, rk = recentKey();
    PREF_KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) o[k] = v; });
    if (rk && lsGet(rk) != null) o['recent'] = lsGet(rk);
    return o;
  }
  function applyPrefs(prefs) {
    var changed = false;
    PREF_KEYS.forEach(function (k) {
      if (prefs && prefs[k] != null && lsGet(k) !== prefs[k]) { lsSet(k, prefs[k]); changed = true; }
    });
    var rk = recentKey();
    if (rk && prefs && prefs.recent != null && lsGet(rk) !== prefs.recent) { lsSet(rk, prefs.recent); changed = true; }
    prefsApplied = true;
    lastPrefs = prefs ? JSON.stringify(collectPrefs()) : '';   // ohne gespeicherte Einstellungen: die dieses Geräts hochladen
    return changed;
  }
  function pushPrefs(id) {
    var now = JSON.stringify(collectPrefs());
    if (!id || !prefsApplied || now === lastPrefs) return;
    lastPrefs = now;
    Store.updateQr(id, { prefs: collectPrefs() }).catch(function () { lastPrefs = ''; });
  }

  return { DPERMS: DPERMS, CODEV: CODEV, norm: norm, format: format, gen: gen, hash: hash, accounts: accounts, usable: usable, me: me, session: session,
    GATES: GATES, can: can, isAdmin: isAdmin, login: login, logout: logout, setStartCode: setStartCode, setPin: setPin, changePin: changePin,
    rename: rename, validPin: validPin, claim: claim, becomeGuest: becomeGuest, resumeGuest: resumeGuest, guestId: guestId, remove: remove, removeDevice: removeDevice, syncLogins: syncLogins, isMobileDevice: isMobileDevice, newCodes: newCodes, rememberCode: rememberCode, applyPrefs: applyPrefs, pushPrefs: pushPrefs, wait: wait };
})();
