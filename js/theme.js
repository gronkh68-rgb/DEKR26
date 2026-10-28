// Cyberpunk-Theme: Umschalter (Auswahl im Browser gespeichert) und Klick-Effekt
(function () {
  'use strict';
  var link = document.getElementById('cpCss');
  var KEY = 'dekr-theme';
  function get() { try { return localStorage.getItem(KEY) || 'cp'; } catch (e) { return 'cp'; } }
  function apply(t) {
    if (link) link.disabled = (t === 'plain');
    document.documentElement.setAttribute('data-theme', t);
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
    function label() { b.textContent = get() === 'cp' ? 'CP an' : 'CP aus'; }
    label();
    b.onclick = function () {
      var t = get() === 'cp' ? 'plain' : 'cp';
      try { localStorage.setItem(KEY, t); } catch (e) { /* ohne Speicher nur für diese Sitzung */ }
      apply(t); label();
    };
    host.appendChild(b);
  });
  document.addEventListener('pointerdown', function (e) {
    if (get() !== 'cp') return;
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
      var act = on() && (n > 0 || open > 0);
      document.body.classList.toggle('cp-alert', act);
      band.hidden = !act;
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
          if (seen[id]) return;
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
    function fit() {
      ov.style.left = map.offsetLeft + 'px'; ov.style.top = map.offsetTop + 'px';
      ov.style.width = map.offsetWidth + 'px'; ov.style.height = map.offsetHeight + 'px';
    }
    fit();
    if (window.ResizeObserver) { var ro = new ResizeObserver(fit); ro.observe(map); ro.observe(par); }
    window.addEventListener('resize', fit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot(); watchMsgs(); countUp($('hallStat')); alertMode(); pings(); statusBar(); hud();
  });
})();
