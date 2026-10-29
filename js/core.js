// Gemeinsame Helfer + Datenspeicher (Firebase Realtime DB per REST oder lokal).
window.Util = (function () {
  var DAYS = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  return {
    DAYS: DAYS,
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    // Mo-Fr -> 1..5, Wochenende -> 5 (Freitag)
    todayIdx: function () {
      var d = new Date().getDay();
      return d === 0 ? 5 : Math.min(d, 5);
    },
    isoWeek: function (date) {
      var d = date || new Date();
      var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      var y = t.getUTCFullYear();
      var w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
      return y + '-W' + (w < 10 ? '0' : '') + w;
    },
    // Wochenschlüssel "2026-W44" <-> Montag dieser Woche
    mondayOf: function (key) {
      var m = /^(\d{4})-W(\d{2})$/.exec(key);
      var jan4 = new Date(+m[1], 0, 4);
      var d = new Date(+m[1], 0, 4 - ((jan4.getDay() || 7) - 1) + 7 * (+m[2] - 1));
      return d;
    },
    addWeeks: function (key, n) {
      var d = this.mondayOf(key);
      d.setDate(d.getDate() + 7 * n);
      return this.isoWeek(d);
    },
    dayDate: function (key, day) {
      var d = this.mondayOf(key);
      d.setDate(d.getDate() + day - 1);
      var p = function (x) { return (x < 10 ? '0' : '') + x; };
      return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.';
    },
    key: function (s) { return String(s).replace(/[^A-Za-z0-9_-]/g, '_'); },
    // KR-Nummer: nur die Nummer speichern, ein getipptes "KR" am Anfang entfällt
    normKr: function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^KR/, ''); },
    // Eingabe wie "7 42 Z", "42 Z" oder "Z42" -> { hall: '7'|'', pos: 'Z42' }, sonst null
    parsePos: function (raw) {
      var tk = String(raw).toUpperCase().match(/[A-Z]|\d+(?:\.\d)?/g) || [];
      var letters = tk.filter(function (t) { return /^[A-Z]$/.test(t); });
      var nums = tk.filter(function (t) { return !/^[A-Z]$/.test(t); });
      if (letters.length !== 1 || nums.length < 1 || nums.length > 2) return null;
      var num = nums[nums.length - 1];
      if (!/^\d+$/.test(num)) return null;
      return { hall: nums.length === 2 ? nums[0] : '', pos: letters[0] + num };
    },
    normPos: function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); },
    taskId: function (week, kr, hall, pos) {
      return [week, this.key(kr), hall, pos].join('_');
    },
    time: function (ts) {
      var d = new Date(ts), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes());
    },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
    // Standardname, solange keiner eingetragen ist
    getName: function () { try { return localStorage.getItem('dekr26_name') || 'Deufol'; } catch (e) { return 'Deufol'; } },
    setName: function (n) { try { localStorage.setItem('dekr26_name', n); } catch (e) { /* ignorieren */ } }
  };
})();

// Anmeldung (optional): jedes Gerät meldet sich anonym bei Firebase an und braucht die Freigabe eines Admins.
// Aktiv nur, wenn in js/config.js ein authApiKey steht (siehe README und firebase-rules.json).
window.Auth = (function () {
  var cfg = window.DEKR_CONFIG || {};
  var key = cfg.authApiKey || '';
  var KEY = 'dekr26_auth';
  var st = {};
  try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { st = {}; }
  var idToken = '', exp = 0, pending = null;
  // Speicher dauerhaft anfordern: der Browser soll die Geräte-Anmeldung nicht von sich aus löschen
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignorieren */ }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignorieren */ } }
  function post(url, body, form) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? body : JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function adopt(j) {
    idToken = j.idToken || j.id_token;
    exp = Date.now() + (+(j.expiresIn || j.expires_in || 3600)) * 1000 - 120000;
    st.refresh = j.refreshToken || j.refresh_token;
    st.uid = j.localId || j.user_id;
    save();
    return idToken;
  }
  function fresh() {
    if (st.refresh) {
      return post('https://securetoken.googleapis.com/v1/token?key=' + key,
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(st.refresh), true).then(adopt).catch(function (e) {
        // Nur wenn Firebase das Token ausdrücklich ablehnt, entsteht ein neues Gerät (neue Freigabe nötig).
        // Netzfehler (z.B. morgens beim Aufwachen ohne Verbindung) oder Serverfehler behalten das Gerät: später erneut versuchen.
        if (!/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED|MISSING_REFRESH_TOKEN/.test(String(e && e.message))) throw e;
        st = {}; save();
        return post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + key, { returnSecureToken: true }).then(adopt);
      });
    }
    return post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + key, { returnSecureToken: true }).then(adopt);
  }

  return {
    enabled: !!key,
    // Gültiges Token (leer, wenn die Anmeldung aus ist)
    token: function () {
      if (!key) return Promise.resolve('');
      if (idToken && Date.now() < exp) return Promise.resolve(idToken);
      if (!pending) pending = fresh().then(function (t) { pending = null; return t; }, function (e) { pending = null; throw e; });
      return pending;
    },
    uid: function () { return st.uid || ''; },
    code: function () { return (st.uid || '').slice(-6).toUpperCase(); },
    isAdmin: function () { return !!st.admin; },
    email: function () { return st.email || ''; },
    // Gibt die bisherige Geräte-ID zurück (deren Freigabeanfrage danach überflüssig ist)
    login: function (email, pw) {
      var old = st.uid;
      return post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + key,
        { email: email, password: pw, returnSecureToken: true }).then(function (j) {
        adopt(j); st.admin = true; st.email = email; save();
        return old && old !== st.uid ? old : '';
      });
    },
    logout: function () { st = {}; idToken = ''; exp = 0; save(); }
  };
})();

// Töne bei neuen Meldungen (mit dem Browser erzeugt, keine Dateien). Der Browser erlaubt Ton erst nach dem ersten Tippen/Klicken.
window.Sound = (function () {
  var ctx = null, KEY = 'dekr26_soundcfg';
  var cfg = { on: true, vol: 0.7, style: 'standard', kinds: { done: 1, problem: 1, order: 1, ding: 1 } };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) cfg = Object.assign(cfg, saved, { kinds: Object.assign(cfg.kinds, saved.kinds || {}) });
  } catch (e) { /* ignorieren */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignorieren */ } document.dispatchEvent(new Event('dekr-sound')); }
  function ac() {
    if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
    return ctx;
  }
  function unlock() { var c = ac(); if (c && c.state === 'suspended') c.resume().catch(function () { /* ignorieren */ }); }
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
  var STYLES = {
    standard: { name: 'Standard', mult: 1, type: 'sine', bell: false },
    hell: { name: 'Hell', mult: 1.5, type: 'sine', bell: false },
    tief: { name: 'Tief', mult: 0.6, type: 'triangle', bell: false },
    glocke: { name: 'Glocke', mult: 1, type: 'sine', bell: true }
  };
  function beep(f, t0, dur, type, vol, st) {
    var c = ac(); if (!c) return;
    var peak = Math.min(0.9, (vol || 0.25) * cfg.vol * 1.6);
    var tone = function (freq, level, d, wave) {
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
      o.type = wave; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + d + 0.05);
    };
    var wave = st.type === 'sine' && type ? type : st.type;
    tone(f * st.mult, peak, st.bell ? dur * 2.2 : dur, wave);
    if (st.bell) tone(f * st.mult * 2.76, peak * 0.35, dur * 1.4, 'sine');   // Oberton für Glockenklang
  }
  // Frequenz, Start, Dauer, Wellenform, Lautstärke
  var tunes = {
    done: [[523, 0, 0.14], [659, 0.16, 0.14], [784, 0.32, 0.26]],            // fertig: aufsteigend, freundlich
    problem: [[440, 0, 0.2, 'triangle', 0.32], [311, 0.24, 0.2, 'triangle', 0.32], [440, 0.48, 0.3, 'triangle', 0.32]], // Problem: tiefer Wechselton
    order: [[880, 0, 0.12], [880, 0.2, 0.2]],                                // Bestellung/Anfrage: Doppel-Ping
    ding: [[659, 0, 0.3]]                                                    // Rückmeldung: sanfter Ton
  };
  var KIND_NAMES = { done: 'Beipack bereit', problem: 'Probleme', order: 'Bestellungen und Anfragen', ding: 'Rückmeldungen und Nachrichten' };
  function play(kind, force) {
    if (!cfg.on && !force) return;
    if (!force && cfg.kinds[kind] === 0) return;
    var t = tunes[kind] || tunes.ding, st = STYLES[cfg.style] || STYLES.standard;
    unlock();
    t.forEach(function (n) { beep(n[0], n[1], n[2], n[3], n[4], st); });
  }

  // Push über ntfy (optional): die Themen dieses Geräts zum Abonnieren in der ntfy-App. Die Seite liefert sie über window.DEKR_NTFY.
  function ntfyBlock() {
    var P = window.Push, list = (window.DEKR_NTFY && window.DEKR_NTFY()) || [];
    if (!P || !P.enabled || !list.length) return '';
    var esc = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
    return '<details class="chk" style="display:block"><summary>Push aufs Handy (ntfy)</summary>' +
      '<div class="empty" style="margin:6px 0">Kostenlose App <b>ntfy</b> installieren und die Themen unten abonnieren. So kommen Meldungen auch bei geschlossener Seite. ' +
      'Wer ein Thema kennt, kann mitlesen – nicht weitergeben.</div>' +
      list.map(function (x) {
        var t = P.topic(x.sub);
        return '<div class="item"><b>' + esc(x.label) + '</b><span style="word-break:break-all">' + esc(t) + '</span><span class="acts">' +
          '<button type="button" class="btn-sm" data-ncopy="' + esc(t) + '">Kopieren</button> ' +
          '<a class="btn-sm" style="text-decoration:none;padding:4px 8px" href="ntfy://ntfy.sh/' + encodeURIComponent(t) + '">In ntfy-App öffnen</a> ' +
          '<a class="btn-sm" style="text-decoration:none;padding:4px 8px" target="_blank" rel="noopener" href="' + P.url(x.sub) + '">Im Browser</a></span></div>';
      }).join('') + '</details>';
  }

  // Einstellungsfenster (wird bei Bedarf erzeugt)
  function panel() {
    var box = document.getElementById('soundPanel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'soundPanel'; box.className = 'modal';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box) box.hidden = true; });
    }
    var h = '<div class="modal-box" style="max-width:420px"><div class="col-title orb"><span>Töne</span><button type="button" class="btn-sm" id="spClose">Schließen</button></div>' +
      '<label class="chk"><input type="checkbox" id="spOn"' + (cfg.on ? ' checked' : '') + '> Ton bei neuen Meldungen</label>' +
      '<label class="chk" style="display:grid;gap:4px">Lautstärke <input type="range" id="spVol" min="0.1" max="1" step="0.05" value="' + cfg.vol + '"></label>' +
      '<label class="chk" style="display:grid;gap:4px">Klang <select id="spStyle">' + Object.keys(STYLES).map(function (k) {
        return '<option value="' + k + '"' + (cfg.style === k ? ' selected' : '') + '>' + STYLES[k].name + '</option>';
      }).join('') + '</select></label>' +
      '<div class="empty">Welche Meldungen einen Ton machen (Knopf „Test" spielt ihn ab):</div>' +
      Object.keys(KIND_NAMES).map(function (k) {
        return '<div class="chk"><label style="display:flex;gap:8px;align-items:center;flex:1"><input type="checkbox" data-k="' + k + '"' + (cfg.kinds[k] === 0 ? '' : ' checked') + '> ' + KIND_NAMES[k] +
          '</label><button type="button" class="btn-sm" data-test="' + k + '">Test</button></div>';
      }).join('') + ntfyBlock() + '</div>';
    box.innerHTML = h;
    box.hidden = false;
    box.querySelector('#spClose').onclick = function () { box.hidden = true; };
    box.querySelector('#spOn').onchange = function (e) { cfg.on = e.target.checked; save(); if (cfg.on) play('ding'); };
    box.querySelector('#spVol').onchange = function (e) { cfg.vol = +e.target.value; save(); play('ding', true); };
    box.querySelector('#spStyle').onchange = function (e) { cfg.style = e.target.value; save(); play('ding', true); };
    box.onchange = function (e) {
      if (e.target.dataset && e.target.dataset.k) { cfg.kinds[e.target.dataset.k] = e.target.checked ? 1 : 0; save(); }
    };
    box.onclick = function (e) {
      if (e.target === box) { box.hidden = true; return; }
      var t = e.target.closest('button[data-test]');
      if (t) play(t.dataset.test, true);
      var c = e.target.closest('button[data-ncopy]');
      if (c) {
        try { navigator.clipboard.writeText(c.dataset.ncopy).then(function () { c.textContent = 'Kopiert'; }); } catch (err) { c.textContent = 'Markieren und kopieren'; }
      }
    };
  }

  return {
    enabled: function () { return cfg.on; },
    label: function () { return cfg.on ? '🔔 Ton' : '🔕 Ton aus'; },
    set: function (v) { cfg.on = !!v; save(); if (cfg.on) play('ding'); },
    panel: panel,
    play: function (kind) { play(kind, false); }
  };
})();

// Push aufs Handy über ntfy.sh (nur wenn in js/config.js ein Thema eingetragen ist).
// Themen: <Basis> = Dashboard-Meldungen, <Basis>-podest = Podest-Bestellungen, <Basis>-q<QR-ID> = Rückmeldungen an ein Handy.
window.Push = (function () {
  var base = String((window.DEKR_CONFIG || {}).ntfyTopic || '');
  function topic(sub) { return sub ? base + '-' + sub : base; }
  function send(sub, title, text, prio, tags) {
    if (!base) return;
    try {
      // JSON im Text-Format: einfache Anfrage ohne Vorabprüfung, Umlaute bleiben erhalten
      fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic: topic(sub), title: title, message: text, priority: prio || 3, tags: tags || [] }) })
        .catch(function () { /* Push ist optional */ });
    } catch (e) { /* ignorieren */ }
  }
  return {
    enabled: !!base,
    topic: topic,
    url: function (sub) { return 'https://ntfy.sh/' + encodeURIComponent(topic(sub)); },
    send: send,
    // Rückmeldung an das Handy mit dem QR-Code qid
    toQr: function (qid, title, text) { if (qid) send('q' + qid, title, text, 3, ['white_check_mark']); },
    // Status einer Bestellung/Anfrage geändert (angenommen, erledigt)
    orderStatus: function (o, status, by) {
      var ue = o.kind === 'ueber';
      this.toQr(o.qid, ue ? 'Überspielen ' + (status === 'erledigt' ? 'fertig' : status) : 'Podest ' + status,
        ue ? '✔ Anfrage Überspielen (' + o.where + ') ' + (status === 'erledigt' ? 'fertig' : status) + ' von ' + by
          : '✔ Podest-Bestellung (' + o.items.join(', ') + (o.where ? ' · ' + o.where : '') + ') ' + status + ' von ' + by);
    },
    // Empfang einer Meldung bestätigt
    ack: function (m, by) {
      this.toQr(m.qid, 'Bestätigt', m.type === 'problem' ? '✔ Problem KR ' + m.kr + ': Empfang bestätigt von ' + by
        : '✔ ' + (m.kr ? 'KR ' + m.kr + ' ' : '') + 'bestätigt von ' + by);
    }
  };
})();

window.Store = (function () {
  var cfg = window.DEKR_CONFIG || {};
  var base = (cfg.firebaseUrl || '').replace(/\/$/, '');
  var remote = !!base;
  var LS = 'dekr26_state';
  var raw = {};                 // Rohdaten der Datenbank (Stream-Änderungen werden hier eingearbeitet)
  var state = norm(null);
  var subs = [];
  var es = null, esTimer = null, lockTimer = null;
  var locked = false, offline = false, connected = false, label = '', requested = false, lastBeat = Date.now(), loaded = false;

  function norm(s) {
    return { tasks: (s && s.tasks) || {}, msgs: (s && s.msgs) || {}, layout: (s && s.layout) || {}, qrs: (s && s.qrs) || {},
      orders: (s && s.orders) || {}, problems: (s && s.problems) || {}, podests: (s && s.podests) || {},
      settings: (s && s.settings) || {}, logins: (s && s.logins) || {} };
  }
  function emit() { subs.forEach(function (f) { f(state); }); }
  function loadLocal() {
    try { state = norm(JSON.parse(localStorage.getItem(LS))); } catch (e) { state = norm(null); }
  }
  function isObj(x) { return x !== null && typeof x === 'object'; }
  // Schlüssel wie "reads/abc" setzen/löschen einen verschachtelten Wert (wie bei Firebase-Teil-Updates)
  function setDeep(obj, path, val) {
    var parts = path.split('/'), o = obj, i;
    for (i = 0; i < parts.length - 1; i++) { if (!isObj(o[parts[i]])) o[parts[i]] = {}; o = o[parts[i]]; }
    if (val === null) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = val;
  }

  // Änderung am Pfad einarbeiten (Stream: "put" ersetzt, "patch" mischt)
  function applyAt(path, data, merge) {
    var parts = String(path).split('/').filter(Boolean), o = raw, i, k;
    if (!parts.length) {
      if (merge && isObj(data)) { for (k in data) { if (data[k] === null) delete raw[k]; else raw[k] = data[k]; } }
      else raw = isObj(data) ? data : {};
    } else {
      for (i = 0; i < parts.length - 1; i++) { if (!isObj(o[parts[i]])) o[parts[i]] = {}; o = o[parts[i]]; }
      var last = parts[parts.length - 1];
      if (merge && isObj(data)) {
        if (!isObj(o[last])) o[last] = {};
        for (k in data) { if (data[k] === null) delete o[last][k]; else o[last][k] = data[k]; }
      } else if (data === null) delete o[last];
      else o[last] = data;
    }
    state = norm(raw);
    emit();
  }

  // Anfrage an die Datenbank, mit Token falls die Anmeldung aktiv ist
  function api(path, opts) {
    return Auth.token().then(function (t) {
      return fetch(base + path + '.json' + (t ? '?auth=' + encodeURIComponent(t) : ''), opts);
    });
  }

  function setLocked(v) {
    if (locked === v) return;
    locked = v;
    // Gesperrt: es wird nichts automatisch angemeldet. Das Gerät fragt erst auf Tippen (und mit Code) um Freigabe an.
    if (v) { checkRequested(); } else { clearInterval(lockTimer); requested = false; startStream(); }
    emit();
  }
  // Neues Gerät meldet sich zur Freigabe an; danach wird regelmäßig geprüft, ob es freigegeben wurde
  // Gerätedaten, die der Browser ohnehin preisgibt (Modell, Betriebssystem, Browser, Bildschirm, Sprache, Zeitzone).
  // Sie gehen nur an den Admin zur Freigabe; Standort und Netzwerkadresse werden nicht erfasst.
  function deviceInfo() {
    var info = { t: Date.now(), n: label || '', ua: String(navigator.userAgent || '').slice(0, 200) };
    try {
      info.scr = screen.width + '×' + screen.height;
      info.lang = navigator.language || '';
      info.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) { /* ignorieren */ }
    var uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) {
      return uad.getHighEntropyValues(['model', 'platform', 'platformVersion']).then(function (h) {
        if (h.model) info.model = String(h.model).slice(0, 60);
        if (h.platform) info.os = (h.platform + ' ' + (h.platformVersion || '')).trim().slice(0, 40);
        return info;
      }, function () { return info; });
    }
    return Promise.resolve(info);
  }
  // Hat dieses Gerät schon um Freigabe gebeten? Dann wartet es nur noch (und prüft regelmäßig).
  function checkRequested() {
    var uid = Auth.uid();
    if (!uid) { emit(); return; }
    api('/devices/' + uid).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      requested = !!d;
      if (requested) startLockPoll();
      emit();
    }).catch(function () { emit(); });
  }
  // Freigabe anfragen (auf Tippen des Nutzers). Mit gesetztem Anmelde-Code verlangen die Regeln den passenden Code.
  function requestAccess(code) {
    var uid = Auth.uid();
    if (!uid) return Promise.reject(new Error('net'));
    return deviceInfo().then(function (info) {
      if (code) info.code = String(code).trim().slice(0, 40);
      return api('/devices/' + uid, { method: 'PUT', body: JSON.stringify(info) });
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) {
        // Eintrag schon vorhanden (dann wartet das Gerät) oder Code falsch
        return api('/devices/' + uid).then(function (g) { return g.ok ? g.json() : null; }).then(function (d) {
          if (d) { requested = true; startLockPoll(); emit(); return; }
          throw new Error('code');
        });
      }
      if (!r.ok) throw new Error('net');
      requested = true; startLockPoll(); emit();
    });
  }
  function startLockPoll() {
    clearInterval(lockTimer);
    lockTimer = setInterval(function () {
      api('/devices/' + Auth.uid()).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.ok === true) refresh().catch(function () {});
      }).catch(function () { /* nächster Versuch */ });
    }, 4000);
  }

  // Vollständiges Laden (Start, nach Fehlern, nach Freigabe)
  function refresh() {
    if (!remote) { loadLocal(); loaded = true; emit(); return Promise.resolve(); }
    return api('/').then(function (r) {
      if (r.status === 401 || r.status === 403) { setLocked(true); return undefined; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (data) {
        raw = isObj(data) ? data : {};
        state = norm(raw);
        offline = false;
        loaded = true;
        setLocked(false);
        emit();
      });
    }).catch(function (e) { if (!offline) { offline = true; emit(); } throw e; });
  }

  // Schreiben: erst lokal (sofort sichtbar), dann zur Datenbank. ops = [{ coll, id, val, patch }]:
  // val null löscht den Eintrag; patch:true mischt nur die angegebenen Felder in den bestehenden Eintrag.
  // Mehrere Änderungen gehen in einer einzigen Anfrage raus.
  function commit(ops) {
    if (!remote) { loadLocal(); raw = state; }   // lokal: aktuellen Stand aus dem Speicher nehmen (andere Tabs)
    ops.forEach(function (o) {
      if (!isObj(raw[o.coll])) raw[o.coll] = {};
      var cur = raw[o.coll][o.id];
      if (o.val === null) delete raw[o.coll][o.id];
      else if (o.patch) {
        var m = isObj(cur) ? JSON.parse(JSON.stringify(cur)) : {};
        Object.keys(o.val).forEach(function (k) { setDeep(m, k, o.val[k]); });
        raw[o.coll][o.id] = m;
      } else raw[o.coll][o.id] = o.val;
    });
    if (!remote) {
      try { localStorage.setItem(LS, JSON.stringify(norm(raw))); } catch (e) { return Promise.reject(e); }
      state = norm(raw); emit();
      return Promise.resolve();
    }
    state = norm(raw); emit();
    var req, o0 = ops[0];
    if (ops.length === 1 && !o0.patch) {
      req = api('/' + o0.coll + '/' + o0.id, { method: o0.val === null ? 'DELETE' : 'PUT', body: JSON.stringify(o0.val) });
    } else {
      var body = {};
      ops.forEach(function (o) {
        if (o.patch) Object.keys(o.val).forEach(function (k) { body[o.coll + '/' + o.id + '/' + k] = o.val[k]; });
        else body[o.coll + '/' + o.id] = o.val;
      });
      req = api('/', { method: 'PATCH', body: JSON.stringify(body) });
    }
    return req.then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }).catch(function (e) { refresh().catch(function () {}); throw e; });
  }
  function one(coll, id, val) { return commit([{ coll: coll, id: id, val: val }]); }
  function upd(coll, id, fields) { return commit([{ coll: coll, id: id, val: fields, patch: true }]); }

  // Live-Stream: schickt nur Änderungen. Bei abgelaufenem Token oder Fehler wird neu verbunden.
  function startStream() {
    if (!remote || locked) return;
    if (es) { try { es.close(); } catch (e) { /* ignorieren */ } es = null; }
    connected = false;
    clearTimeout(esTimer);
    Auth.token().then(function (t) {
      try {
        es = new EventSource(base + '/.json' + (t ? '?auth=' + encodeURIComponent(t) : ''));
        var handler = function (merge) {
          return function (ev) {
            var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
            lastBeat = Date.now();
            if (!connected) { connected = true; offline = false; }
            applyAt(m.path, m.data, merge);
          };
        };
        es.addEventListener('keep-alive', function () { lastBeat = Date.now(); });
        es.addEventListener('put', handler(false));
        es.addEventListener('patch', handler(true));
        es.addEventListener('auth_revoked', function () { esTimer = setTimeout(startStream, 500); });
        es.addEventListener('cancel', function () { connected = false; refresh().catch(function () {}); });
        es.onerror = function () {
          connected = false;
          if (es && es.readyState === 2) esTimer = setTimeout(function () { refresh().catch(function () {}).then(startStream); }, 5000);
        };
        esTimer = setTimeout(startStream, 40 * 60 * 1000);   // vor Ablauf des Tokens neu verbinden
      } catch (e) { /* Polling reicht als Fallback */ }
    }).catch(function () { esTimer = setTimeout(startStream, 10000); });
  }

  return {
    remote: remote,
    secure: remote && Auth.enabled,
    // Rohzugriff auf die Datenbank mit der Anmeldung dieses Geräts (für die Anmeldung mit Account-Code)
    raw: function (path, opts) { return api(path, opts); },
    deviceInfo: deviceInfo,
    isLocked: function () { return locked; },
    isLoaded: function () { return loaded; },
    isRequested: function () { return requested; },
    requestAccess: requestAccess,
    setSetting: function (k, v) { return one('settings', k, v); },
    // Kisten je KR (K2/K5): Zähler am Eintrag der KR. field 'k2' | 'k5', delta +1/-1, nie unter 0.
    // Die Änderung geht als Server-Zähler raus, so können mehrere Handys gleichzeitig zählen.
    addTaskKisten: function (taskId, field, delta) {
      if (!remote) { loadLocal(); raw = state; }
      var t = isObj(raw.tasks) ? raw.tasks[taskId] : null;
      if (!isObj(t)) return Promise.reject(new Error('KR nicht gefunden'));
      var before = +t[field] || 0, next = Math.max(0, before + delta);
      if (next === before) return Promise.resolve();
      t[field] = next;
      state = norm(raw); emit();
      if (!remote) {
        try { localStorage.setItem(LS, JSON.stringify(norm(raw))); } catch (e) { return Promise.reject(e); }
        return Promise.resolve();
      }
      var body = {};
      body[field] = { '.sv': { increment: next - before } };
      return api('/tasks/' + taskId, { method: 'PATCH', body: JSON.stringify(body) }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
      }).catch(function (e) { refresh().catch(function () {}); throw e; });
    },
    // Admin: mehrere Geräteeinträge auf einmal löschen
    clearDevices: function (uids) {
      var body = {};
      uids.forEach(function (u) { body['devices/' + u] = null; });
      return api('/', { method: 'PATCH', body: JSON.stringify(body) }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
    },
    isOffline: function () { return offline; },
    setDeviceLabel: function (n) { label = String(n || '').slice(0, 40); },
    subscribe: function (f) { subs.push(f); },
    start: function () {
      refresh().then(startStream).catch(function () { startStream(); });
      if (remote) {
        // Handy/App im Hintergrund: Der Live-Stream wird dort vom System angehalten. Beim Zurückkehren (z.B. nach einer ntfy-Meldung)
        // sofort alles nachladen und neu verbinden; zusätzlich merkt ein Wächter einen stillen Abbruch.
        var lastWake = 0;
        var wake = function () {
          if (locked || Date.now() - lastWake < 3000) return;
          lastWake = Date.now();
          refresh().catch(function () {}).then(startStream);
        };
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') wake(); });
        window.addEventListener('focus', wake);
        window.addEventListener('pageshow', wake);
        window.addEventListener('online', wake);
        setInterval(function () {
          if (document.visibilityState === 'visible' && !locked && Date.now() - lastBeat > 75000) { lastBeat = Date.now(); wake(); }
        }, 20000);
        // Nur wenn der Live-Stream nicht läuft, wird gelegentlich komplett nachgeladen
        setInterval(function () { if (!locked && !connected) refresh().catch(function () {}); }, 30000);
      } else {
        window.addEventListener('storage', function (e) { if (e.key === LS) refresh(); });
      }
    },
    // Nach dem Admin-Login: neu verbinden
    reconnect: function () { locked = false; clearInterval(lockTimer); return refresh().then(startStream); },
    // Admin: Geräteliste und Freigabe
    devices: function () {
      return api('/devices').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) { return d || {}; });
    },
    setDevice: function (uid, d) {
      return api('/devices/' + uid, { method: d === null ? 'DELETE' : 'PUT', body: JSON.stringify(d) }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
      });
    },
    // Mehrere Änderungen auf einmal: [{ coll, id, val }]
    batch: function (ops) { return ops.length ? commit(ops) : Promise.resolve(); },
    batchUpdate: function (ops) { return ops.length ? commit(ops) : Promise.resolve(); },
    // Nur einzelne Felder ändern (überschreibt keine gleichzeitigen Änderungen anderer Felder)
    updateTask: function (id, f) { return upd('tasks', id, f); },
    updateMsg: function (id, f) { return upd('msgs', id, f); },
    updateQr: function (id, f) { return upd('qrs', id, f); },
    updateOrder: function (id, f) { return upd('orders', id, f); },
    updateProblem: function (id, f) { return upd('problems', id, f); },
    setTask: function (id, t) { return one('tasks', id, t); },
    removeTask: function (id) { return one('tasks', id, null); },
    // Spalten-/Zeilenverschiebung einer Halle: { cols: {c14: dx}, rows: {rA: dy} } oder null
    setLayout: function (hallId, ov) { return one('layout', hallId, ov); },
    setOrder: function (id, o) { return one('orders', id, o); },
    setProblem: function (id, p) { return one('problems', id, p); },
    setPodest: function (id, p) { return one('podests', id, p); },
    setQr: function (id, q) { return one('qrs', id, q); },
    // Gibt die ID der Nachricht zurück
    addMsg: function (m) {
      m.t = Date.now();
      var id = Util.uid();
      return one('msgs', id, m).then(function () { return id; });
    },
    setMsg: function (id, m) { return one('msgs', id, m); },
    get: function () { return state; }
  };
})();

// Sichtbare Fehlermeldung statt stillem Ausfall (z.B. bei veraltetem Browser-Cache)
window.addEventListener('error', function (e) {
  if (/^ResizeObserver loop/.test(String(e.message))) return;   // harmlose Browser-Meldung, kein Fehler der Seite
  var bar = document.getElementById('errbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'errbar';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:6px 12px;background:#e5534b;color:#fff;font-size:12px';
    document.body.appendChild(bar);
  }
  bar.textContent = 'Fehler: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ') – Seite mit Strg+F5 neu laden';
});
