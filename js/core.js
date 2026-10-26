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
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(st.refresh), true).then(adopt).catch(function () {
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

window.Store = (function () {
  var cfg = window.DEKR_CONFIG || {};
  var base = (cfg.firebaseUrl || '').replace(/\/$/, '');
  var remote = !!base;
  var LS = 'dekr26_state';
  var state = norm(null);
  var subs = [];
  var timer = null, es = null, esTimer = null, lockTimer = null;
  var locked = false, label = '';

  function norm(s) {
    return { tasks: (s && s.tasks) || {}, msgs: (s && s.msgs) || {}, layout: (s && s.layout) || {}, qrs: (s && s.qrs) || {},
      orders: (s && s.orders) || {}, problems: (s && s.problems) || {}, podests: (s && s.podests) || {} };
  }
  function emit() { subs.forEach(function (f) { f(state); }); }
  function loadLocal() {
    try { state = norm(JSON.parse(localStorage.getItem(LS))); } catch (e) { state = norm(null); }
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
    if (v) { registerDevice(); startLockPoll(); } else { clearInterval(lockTimer); startStream(); }
    emit();
  }
  // Neues Gerät meldet sich zur Freigabe an; danach wird regelmäßig geprüft, ob es freigegeben wurde
  function registerDevice() {
    var uid = Auth.uid();
    if (!uid) return;
    api('/devices/' + uid, { method: 'PUT', body: JSON.stringify({ t: Date.now(), n: label || '', ua: String(navigator.userAgent || '').slice(0, 160) }) })
      .catch(function () { /* wurde schon angemeldet */ });
  }
  function startLockPoll() {
    clearInterval(lockTimer);
    lockTimer = setInterval(function () {
      api('/devices/' + Auth.uid()).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.ok === true) refresh().catch(function () {});
      }).catch(function () { /* nächster Versuch */ });
    }, 4000);
  }

  function refresh() {
    if (!remote) { loadLocal(); emit(); return Promise.resolve(); }
    return api('/').then(function (r) {
      if (r.status === 401 || r.status === 403) { setLocked(true); return undefined; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (data) { setLocked(false); state = norm(data); emit(); });
    });
  }

  function write(coll, id, val) {
    if (!remote) {
      loadLocal();
      if (val === null) delete state[coll][id]; else state[coll][id] = val;
      try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { return Promise.reject(e); }
      emit();
      return Promise.resolve();
    }
    if (val === null) delete state[coll][id]; else state[coll][id] = val;
    emit();
    return api('/' + coll + '/' + id, {
      method: val === null ? 'DELETE' : 'PUT',
      body: JSON.stringify(val)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }).catch(function (e) { refresh().catch(function () {}); throw e; });
  }

  // Live-Stream der Datenbank; bei abgelaufenem Token wird neu verbunden
  function startStream() {
    if (!remote || locked) return;
    if (es) { try { es.close(); } catch (e) { /* ignorieren */ } es = null; }
    clearTimeout(esTimer);
    Auth.token().then(function (t) {
      try {
        es = new EventSource(base + '/.json' + (t ? '?auth=' + encodeURIComponent(t) : ''));
        var kick = function () {
          clearTimeout(timer);
          timer = setTimeout(function () { refresh().catch(function () {}); }, 150);
        };
        es.addEventListener('put', kick);
        es.addEventListener('patch', kick);
        es.addEventListener('auth_revoked', function () { esTimer = setTimeout(startStream, 500); });
        es.onerror = function () { if (es && es.readyState === 2) esTimer = setTimeout(startStream, 5000); };
        esTimer = setTimeout(startStream, 40 * 60 * 1000);   // vor Ablauf des Tokens neu verbinden
      } catch (e) { /* Polling reicht als Fallback */ }
    }).catch(function () { esTimer = setTimeout(startStream, 10000); });
  }

  return {
    remote: remote,
    secure: remote && Auth.enabled,
    isLocked: function () { return locked; },
    setDeviceLabel: function (n) { label = String(n || '').slice(0, 40); },
    subscribe: function (f) { subs.push(f); },
    start: function () {
      refresh().then(startStream).catch(function () { startStream(); });
      if (remote) {
        setInterval(function () { if (!locked) refresh().catch(function () {}); }, 15000);
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
    setTask: function (id, t) { return write('tasks', id, t); },
    removeTask: function (id) { return write('tasks', id, null); },
    // Spalten-/Zeilenverschiebung einer Halle: { cols: {c14: dx}, rows: {rA: dy} } oder null
    setLayout: function (hallId, ov) { return write('layout', hallId, ov); },
    setOrder: function (id, o) { return write('orders', id, o); },
    setProblem: function (id, p) { return write('problems', id, p); },
    setPodest: function (id, p) { return write('podests', id, p); },
    setQr: function (id, q) { return write('qrs', id, q); },
    // Gibt die ID der Nachricht zurück
    addMsg: function (m) {
      m.t = Date.now();
      var id = Util.uid();
      return write('msgs', id, m).then(function () { return id; });
    },
    setMsg: function (id, m) { return write('msgs', id, m); },
    get: function () { return state; }
  };
})();

// Sichtbare Fehlermeldung statt stillem Ausfall (z.B. bei veraltetem Browser-Cache)
window.addEventListener('error', function (e) {
  var bar = document.getElementById('errbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'errbar';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:6px 12px;background:#e5534b;color:#fff;font-size:12px';
    document.body.appendChild(bar);
  }
  bar.textContent = 'Fehler: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ') – Seite mit Strg+F5 neu laden';
});
