// Designs: Cyberpunk und schlicht. Umschalter (Auswahl im Browser gespeichert) und Klick-Effekt
(function () {
  'use strict';
  var link = document.getElementById('cpCss');
  var THEMES = ['cp', 'plain'], NAMES = { cp: 'Design: Cyber', plain: 'Design: Schlicht' };
  var KEY = 'dekr-theme';
  function get() { try { var v = localStorage.getItem(KEY); return THEMES.indexOf(v) >= 0 ? v : 'cp'; } catch (e) { return 'cp'; } }
  // Farben des Cyber-Designs: Hauptfarbe (Akzent) und Nebenfarbe, als Vorlage oder frei gewählt (im Browser gemerkt)
  var CKEY = 'dekr-colors';
  var PRESETS = [
    ['gelb', 'Gelb · Cyan', '#fcee09', '#00f0ff'], ['cyan', 'Cyan · Magenta', '#00f0ff', '#ff2a9d'], ['magenta', 'Magenta · Cyan', '#ff2a9d', '#00f0ff'],
    ['gruen', 'Grün · Violett', '#39ff14', '#b14bff'], ['orange', 'Orange · Blau', '#ff7a1a', '#3ea0ff'], ['violett', 'Violett · Cyan', '#b14bff', '#00f0ff'],
    ['rot', 'Rot · Gelb', '#ff2a55', '#fcee09']
  ];
  function rgbOf(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) : '252,238,9';
  }
  function getColors() {
    try { var c = JSON.parse(localStorage.getItem(CKEY)); if (c && /^#[0-9a-f]{6}$/i.test(c.a) && /^#[0-9a-f]{6}$/i.test(c.b)) return c; } catch (e) { /* Standard */ }
    return { a: PRESETS[0][2], b: PRESETS[0][3] };
  }
  function applyColors(on) {
    var st = document.documentElement.style, names = ['--accent', '--acc-rgb', '--cyan', '--cy-rgb'];
    if (!on) { names.forEach(function (n) { st.removeProperty(n); }); return; }
    var c = getColors();
    st.setProperty('--accent', c.a); st.setProperty('--acc-rgb', rgbOf(c.a)); st.setProperty('--cyan', c.b); st.setProperty('--cy-rgb', rgbOf(c.b));
  }
  function apply(t) {
    if (link) link.disabled = (t !== 'cp');
    document.documentElement.setAttribute('data-theme', t);
    applyColors(t === 'cp');
    var cb = document.getElementById('cpColor');
    if (cb) cb.hidden = (t !== 'cp');
    var pn = document.getElementById('cpColorPanel');
    if (pn && t !== 'cp') pn.hidden = true;
  }
  apply(get());
  var bootDue = get() === 'cp' && !!document.documentElement && (function () {
    try { return !sessionStorage.getItem('dekr-boot'); } catch (e) { return false; }
  })();
  if (bootDue) document.documentElement.classList.add('cp-boot');
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.querySelector('.top') || document.querySelector('.sub') || document.body;
    var b = document.createElement('button');
    b.id = 'cpTheme';
    b.type = "button"; b.className = "btn-sm";
    b.title = 'Design umschalten';
    function label() { b.textContent = NAMES[get()]; }
    label();
    b.onclick = function () {
      var t = THEMES[(THEMES.indexOf(get()) + 1) % THEMES.length];
      try { localStorage.setItem(KEY, t); } catch (e) { /* ohne Speicher nur für diese Sitzung */ }
      apply(t); label();
    };
    host.appendChild(b);
    // Farb-Auswahl (nur im Cyber-Design sichtbar)
    var cb = document.createElement('button');
    cb.id = 'cpColor'; cb.type = 'button'; cb.className = 'btn-sm'; cb.textContent = 'Farben'; cb.title = 'Farben des Designs wählen';
    cb.hidden = get() !== 'cp';
    host.appendChild(cb);
    var pn = document.createElement('div');
    pn.id = 'cpColorPanel'; pn.hidden = true;
    pn.innerHTML = '<div class="cc-title">Farben</div><div class="cc-grid">' + PRESETS.map(function (p) {
      return '<button type="button" class="cc-sw" data-a="' + p[2] + '" data-b="' + p[3] + '" title="' + p[1] + '"><i style="background:' + p[2] + '"></i><i style="background:' + p[3] + '"></i><span>' + p[1] + '</span></button>';
    }).join('') + '</div><div class="cc-own"><label>Hauptfarbe <input type="color" id="ccA"></label><label>Nebenfarbe <input type="color" id="ccB"></label></div>' +
      '<button type="button" class="cc-reset" id="ccReset">Zurücksetzen</button>';
    document.body.appendChild(pn);
    function save(a, b) {
      try { localStorage.setItem(CKEY, JSON.stringify({ a: a, b: b })); } catch (e) { /* nur für diese Sitzung */ }
      applyColors(get() === 'cp'); sync();
    }
    function sync() { var c = getColors(); pn.querySelector('#ccA').value = c.a; pn.querySelector('#ccB').value = c.b; }
    cb.onclick = function () { sync(); pn.hidden = !pn.hidden; };
    pn.addEventListener('click', function (e) {
      var sw = e.target.closest('.cc-sw');
      if (sw) { save(sw.dataset.a, sw.dataset.b); return; }
      if (e.target.id === 'ccReset') save(PRESETS[0][2], PRESETS[0][3]);
    });
    pn.addEventListener('input', function (e) {
      if (e.target.id === 'ccA' || e.target.id === 'ccB') save(pn.querySelector('#ccA').value, pn.querySelector('#ccB').value);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!pn.hidden && !pn.contains(e.target) && e.target !== cb) pn.hidden = true;
    }, true);
  });
  document.addEventListener('pointerdown', function (e) {
    if (get() === 'plain') return;
    var el = e.target.closest ? e.target.closest('button') : null;
    if (!el || el.disabled) return;
    var r = el.getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'rip';
    s.style.left = (e.clientX - r.left) + 'px';
    s.style.top = (e.clientY - r.top) + 'px';
    el.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 600);
  }, true);

  // ---- Gimmicks (nur bei aktivem CP-Design) ----
  function on() { return get() === 'cp'; }
  function $(id) { return document.getElementById(id); }

  // 1: Boot-Sequenz
  function boot() {
    var root = document.documentElement;
    if (!bootDue) return;
    try { sessionStorage.setItem('dekr-boot', '1'); } catch (e) { /* ignorieren */ }
    var el = document.createElement('div');
    el.id = 'cpBoot';
    document.body.appendChild(el);
    var lines = ['> DEUKRO26 · SYSTEMSTART', '> VERBINDE MIT DATENBANK ........ OK', '> GERÄT PRÜFEN ................. OK', '> KARTE LADEN .................. OK', '> ZUGRIFF GEWÄHRT'];
    var i = 0;
    (function next() {
      if (i < lines.length) {
        var d = document.createElement('div');
        d.textContent = lines[i++];
        el.appendChild(d);
        setTimeout(next, 170);
      } else {
        setTimeout(function () {
          el.classList.add('out');
          root.classList.remove('cp-boot');
          setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
        }, 250);
      }
    })();
    setTimeout(function () { root.classList.remove('cp-boot'); }, 3000);
  }

  // 2: Scramble-Text für neue Meldungen
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';
  function scramble(node) {
    var txt = node.nodeValue, n = txt.length, step = 0, steps = 14;
    if (!n) return;
    var t = setInterval(function () {
      step++;
      var keep = Math.floor(n * step / steps), out = '';
      for (var i = 0; i < n; i++) out += (i < keep || txt[i] === ' ') ? txt[i] : CH[Math.floor(Math.random() * CH.length)];
      node.nodeValue = out;
      if (step >= steps) { clearInterval(t); node.nodeValue = txt; }
    }, 40);
  }
  function watchMsgs() {
    var box = $('msgs');
    if (!box) return;
    var first = true;
    new MutationObserver(function () {
      if (first) { first = false; return; }
      if (!on()) return;
      var fresh = box.querySelectorAll('.msg.fresh:not([data-sc])');
      Array.prototype.forEach.call(fresh, function (m) {
        m.setAttribute('data-sc', '1');
        var n = m.firstChild;
        if (n && n.nodeType === 3) scramble(n);
      });
    }).observe(box, { childList: true, subtree: true });
    first = false;
  }

  // 3: Zähler zählen hoch
  function countUp(el) {
    if (!el) return;
    var last = '';
    var busy = false;
    new MutationObserver(function () {
      if (busy) return;
      var txt = el.textContent;
      if (txt === last) return;
      var m = /^(\d+)\/(\d+)(.*)$/.exec(txt);
      var old = /^(\d+)\//.exec(last);
      last = txt;
      if (!m || !on()) return;
      var from = old ? +old[1] : 0, to = +m[1];
      if (from === to) return;
      var t0 = Date.now();
      busy = true;
      var iv = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / 450);
        el.textContent = Math.round(from + (to - from) * k) + '/' + m[2] + m[3];
        if (k >= 1) { clearInterval(iv); busy = false; last = el.textContent; }
      }, 30);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  // 4: Alarm-Modus bei offenen Problemen
  function alertMode() {
    var top = document.querySelector('.top');
    var cp = $('cProb');
    if (!top || !cp) return;
    var band = document.createElement('div');
    band.id = 'cpAlert';
    band.hidden = true;
    top.parentNode.insertBefore(band, top.nextSibling);
    function upd() {
      var n = parseInt(cp.textContent, 10) || 0;
      var open = document.querySelectorAll('#msgs .msg.problem.pulse').length;
      var act = n > 0 || open > 0;
      document.body.classList.toggle('cp-alert', act);   // Seite färbt sich rot (in beiden Designs, stärker im CP-Design)
      band.hidden = !(act && on());
      band.textContent = '⚠ ALERT · ' + (n || open) + ' OFFENE' + ((n || open) === 1 ? 'S PROBLEM' : ' PROBLEME');
    }
    new MutationObserver(upd).observe(cp, { childList: true, characterData: true, subtree: true });
    if ($('msgs')) new MutationObserver(upd).observe($('msgs'), { childList: true, subtree: true });
    upd();
  }

  // 5: Sonar-Ping bei neu bereiten Positionen
  function pings() {
    var map = $('map');
    if (!map) return;
    var seen = null;
    function scan() {
      var now = {};
      Array.prototype.forEach.call(map.querySelectorAll('g[data-pos] > rect.done'), function (r) {
        var id = r.parentNode.getAttribute('data-pos');
        now[id] = r;
      });
      if (seen && on()) {
        Object.keys(now).forEach(function (id) {
          if (seen[id] || now[id].classList.contains('wave')) return;
          var r = now[id], svg = r.ownerSVGElement;
          if (!svg) return;
          var cx = +r.getAttribute('x') + +r.getAttribute('width') / 2, cy = +r.getAttribute('y') + +r.getAttribute('height') / 2;
          for (var k = 0; k < 3; k++) {
            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 10);
            c.setAttribute('class', 'cp-ping');
            c.style.animationDelay = (k * 0.35) + 's';
            svg.appendChild(c);
            (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 2200); })(c);
          }
        });
      }
      seen = now;
    }
    new MutationObserver(scan).observe(map, { childList: true, subtree: true });
    scan();
  }

  // 6: Statusleiste unten
  function statusBar() {
    if (!$('week-list')) return;
    var bar = document.createElement('div');
    bar.id = 'cpBar';
    document.body.appendChild(bar);
    document.body.classList.add('cp-sb');
    var sync = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function upd() {
      var S = window.Store, st = S && S.get ? S.get() : null;
      var mode = $('mode') ? $('mode').textContent.trim() : '';
      var off = (S && S.isOffline && S.isOffline()) || navigator.onLine === false;
      var open = st ? Object.keys(st.problems || {}).filter(function (k) { return st.problems[k].status === 'offen'; }).length : 0;
      var ord = st ? Object.keys(st.orders || {}).filter(function (k) { return st.orders[k].status === 'offen'; }).length : 0;
      bar.innerHTML = '<span class="' + (off ? 'bad' : 'good') + '">● ' + (off ? 'OFFLINE' : 'ONLINE') + '</span>' +
        '<span>' + (mode || '—') + '</span><span>SYNC ' + pad(sync.getHours()) + ':' + pad(sync.getMinutes()) + ':' + pad(sync.getSeconds()) + '</span>' +
        '<span>OFFENE PROBLEME ' + open + '</span><span>OFFENE BESTELLUNGEN ' + ord + '</span><span class="sp"></span><span>DEUKRO26 // NIGHT CITY EDITION</span>';
    }
    if (window.Store && Store.subscribe) Store.subscribe(function () { sync = new Date(); upd(); });
    window.addEventListener('online', upd); window.addEventListener('offline', upd);
    upd();
  }

  // 7: Glitch beim Hallenwechsel, 8/9: Scan-Linie und HUD-Ecken
  function hud() {
    var sw = $('hallSwitch'), map = $('map');
    if (sw) sw.addEventListener('click', function (e) {
      if (!on() || !e.target.closest('button')) return;
      [map, $('hallName')].forEach(function (el) {
        if (!el) return;
        el.classList.remove('cp-glitch');
        void el.offsetWidth;
        el.classList.add('cp-glitch');
        setTimeout(function () { el.classList.remove('cp-glitch'); }, 500);
      });
    });
    if (!map || !map.parentNode) return;
    var par = map.parentNode;
    if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
    var ov = document.createElement('div');
    ov.id = 'cpHud';
    ov.innerHTML = '<i class="scan"></i><b class="c1"></b><b class="c2"></b><b class="c3"></b><b class="c4"></b>';
    par.appendChild(ov);
    var last = '';
    function fit() {
      var v = map.offsetLeft + ',' + map.offsetTop + ',' + map.offsetWidth + ',' + map.offsetHeight;
      if (v === last) return;
      last = v;
      ov.style.left = map.offsetLeft + 'px'; ov.style.top = map.offsetTop + 'px';
      ov.style.width = map.offsetWidth + 'px'; ov.style.height = map.offsetHeight + 'px';
    }
    fit();
    // Größe und Lage prüfen: Layout kann sich ohne Größenänderung verschieben (Alarm-Band, Schriften, Zoom)
    if (window.ResizeObserver) { var ro = new ResizeObserver(fit); ro.observe(map); ro.observe(par); }
    window.addEventListener('resize', fit);
    setInterval(fit, 300);
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot(); watchMsgs(); countUp($('hallStat')); alertMode(); pings(); statusBar(); hud();
  });
})();
