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
    getName: function () { try { return localStorage.getItem('dekr26_name') || ''; } catch (e) { return ''; } },
    setName: function (n) { try { localStorage.setItem('dekr26_name', n); } catch (e) { /* ignorieren */ } }
  };
})();

window.Store = (function () {
  var cfg = window.DEKR_CONFIG || {};
  var base = (cfg.firebaseUrl || '').replace(/\/$/, '');
  var remote = !!base;
  var LS = 'dekr26_state';
  var state = norm(null);
  var subs = [];
  var timer = null;

  function norm(s) {
    return { tasks: (s && s.tasks) || {}, msgs: (s && s.msgs) || {}, layout: (s && s.layout) || {}, qrs: (s && s.qrs) || {} };
  }
  function emit() { subs.forEach(function (f) { f(state); }); }
  function loadLocal() {
    try { state = norm(JSON.parse(localStorage.getItem(LS))); } catch (e) { state = norm(null); }
  }

  function refresh() {
    if (!remote) { loadLocal(); emit(); return Promise.resolve(); }
    return fetch(base + '/.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) { state = norm(data); emit(); });
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
    return fetch(base + '/' + coll + '/' + id + '.json', {
      method: val === null ? 'DELETE' : 'PUT',
      body: JSON.stringify(val)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }).catch(function (e) { refresh().catch(function () {}); throw e; });
  }

  return {
    remote: remote,
    subscribe: function (f) { subs.push(f); },
    start: function () {
      refresh().catch(function () {});
      if (remote) {
        try {
          var es = new EventSource(base + '/.json');
          var kick = function () {
            clearTimeout(timer);
            timer = setTimeout(function () { refresh().catch(function () {}); }, 150);
          };
          es.addEventListener('put', kick);
          es.addEventListener('patch', kick);
        } catch (e) { /* Polling reicht als Fallback */ }
        setInterval(function () { refresh().catch(function () {}); }, 15000);
      } else {
        window.addEventListener('storage', function (e) { if (e.key === LS) refresh(); });
      }
    },
    setTask: function (id, t) { return write('tasks', id, t); },
    removeTask: function (id) { return write('tasks', id, null); },
    // Spalten-/Zeilenverschiebung einer Halle: { cols: {c14: dx}, rows: {rA: dy} } oder null
    setLayout: function (hallId, ov) { return write('layout', hallId, ov); },
    setQr: function (id, q) { return write('qrs', id, q); },
    addMsg: function (m) {
      m.t = Date.now();
      return write('msgs', Util.uid(), m);
    },
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
