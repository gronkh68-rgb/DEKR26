// Designs: Cyberpunk und schlicht. Umschalter (Auswahl im Browser gespeichert) und Klick-Effekt
(function () {
  'use strict';
  var link = document.getElementById('cpCss');
  var THEMES = ['cp', 'plain'], NAMES = { cp: 'Design: Cyber', plain: 'Design: Schlicht' };
  var KEY = 'dekr-theme';
  function flag(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function setFlag(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* nur für diese Sitzung */ } }
  function get() { try { var v = localStorage.getItem(KEY); return THEMES.indexOf(v) >= 0 ? v : 'cp'; } catch (e) { return 'cp'; } }
  // Farben des Cyber-Designs: Hauptfarbe (Akzent) und Nebenfarbe, als Vorlage oder frei gewählt (im Browser gemerkt)
  var CKEY = 'dekr-colors';
  var PRESETS = [
    ['gelb', 'Gelb · Cyan', '#fcee09', '#00f0ff'], ['cyan', 'Cyan · Magenta', '#00f0ff', '#ff2a9d'], ['magenta', 'Magenta · Cyan', '#ff2a9d', '#00f0ff'],
    ['gruen', 'Grün · Violett', '#39ff14', '#b14bff'], ['orange', 'Orange · Blau', '#ff7a1a', '#3ea0ff'], ['violett', 'Violett · Cyan', '#b14bff', '#00f0ff'],
    ['rot', 'Rot · Gelb', '#ff2a55', '#fcee09'], ['offrot', 'Off-Rot (Spiel-HUD)', '#ff4d3a', '#ff9a8a'], ['eier', 'Eierschale (Upgrade-Menü)', '#e9e2c8', '#b9b196']
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
    document.documentElement.classList.toggle('fx-low', !!flag('dekr-fxlow'));
    document.documentElement.classList.toggle('lens-on', t === 'cp' && !!flag('dekr-lens'));
    var cb = document.getElementById('cpColor');
    if (cb) cb.hidden = (t !== 'cp');
    var pn = document.getElementById('cpColorPanel');
    if (pn && t !== 'cp') pn.hidden = true;
  }
  apply(get());
  var bootDue = get() === 'cp' && !flag('dekr-fxlow');   // bei jedem Laden
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
      '<label class="cc-chk"><input type="checkbox" id="ccLens"> Linseneffekt (Farbsäume, leichte Wölbung)</label>' +
      '<label class="cc-chk"><input type="checkbox" id="ccFx"> Weniger Effekte (ruhiger, für schwache Geräte)</label>' +
      '<button type="button" class="cc-reset" id="ccReset">Zurücksetzen</button>';
    document.body.appendChild(pn);
    function save(a, b) {
      try { localStorage.setItem(CKEY, JSON.stringify({ a: a, b: b })); } catch (e) { /* nur für diese Sitzung */ }
      applyColors(get() === 'cp'); sync();
    }
    function sync() { var c = getColors(); pn.querySelector('#ccA').value = c.a; pn.querySelector('#ccB').value = c.b; pn.querySelector('#ccLens').checked = flag('dekr-lens'); pn.querySelector('#ccFx').checked = flag('dekr-fxlow'); }
    cb.onclick = function () { sync(); pn.hidden = !pn.hidden; };
    pn.addEventListener('click', function (e) {
      var sw = e.target.closest('.cc-sw');
      if (sw) { save(sw.dataset.a, sw.dataset.b); return; }
      if (e.target.id === 'ccReset') save(PRESETS[0][2], PRESETS[0][3]);
    });
    pn.addEventListener('input', function (e) {
      if (e.target.id === 'ccLens') { setFlag('dekr-lens', e.target.checked); apply(get()); }
      if (e.target.id === 'ccFx') { setFlag('dekr-fxlow', e.target.checked); apply(get()); }
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
  function on() { return get() === 'cp' && !flag('dekr-fxlow'); }
  function $(id) { return document.getElementById(id); }

  // 1: Hacking-Animation bei jedem Laden (ca. 4,5 s, mit Klick oder Taste überspringbar; „Weniger Effekte“ schaltet sie ab)
  function boot() {
    var root = document.documentElement;
    if (!bootDue) return;
    var cs = getComputedStyle(root), accent = (cs.getPropertyValue('--accent') || '#fcee09').trim(), cyan = (cs.getPropertyValue('--cyan') || '#00f0ff').trim();
    var el = document.createElement('div');
    el.id = 'cpBoot';
    var V = window.DEKR_VERSION || { n: '', b: '' };
    el.innerHTML = '<canvas id="btRain"></canvas><div class="bt-haz top"></div><div class="bt-haz bot"></div><i class="bt-c c1"></i><i class="bt-c c2"></i><i class="bt-c c3"></i><i class="bt-c c4"></i><div class="bt-tear" id="btTear"></div>' +
      '<div class="bt-logo"><b data-t="DEUKRO26">DEUKRO26</b><small>BREACH PROTOCOL // NIGHT CITY EDITION</small></div><div class="bt-term" id="btTerm"></div><div class="bt-hex" id="btHex"></div>' +
      '<div class="bt-mid"><div class="bt-lbl" id="btLbl">ZUGRIFF WIRD ERZWUNGEN</div><div class="bt-pct" id="btPct">0%</div><div class="bt-bar"><i id="btBar"></i></div></div>' +
      '<div class="bt-foot">DEUKRO26 // ICE-BREAKER ' + (V.n ? 'v' + V.n : '') + '<span>KLICK = ÜBERSPRINGEN</span></div>';
    document.body.appendChild(el);
    var cv = document.getElementById('btRain'), cx = cv.getContext('2d'), cols = 0, drops = [], fs = 16, alive = true, t0 = Date.now(), DUR = 3100, fade = 1;
    function size() { cv.width = window.innerWidth; cv.height = window.innerHeight; cols = Math.ceil(cv.width / fs); drops = []; for (var c = 0; c < cols; c++) drops.push(Math.random() * -40); }
    size(); window.addEventListener('resize', size);
    var glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEF#$%&<>/\\|'.split('');
    function rain() {
      if (!alive) return;
      cx.fillStyle = 'rgba(3,4,9,.14)'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.font = fs + 'px "Share Tech Mono", monospace';
      for (var c = 0; c < cols; c++) {
        var y = drops[c] * fs, g = glyphs[Math.floor(Math.random() * glyphs.length)];
        cx.fillStyle = Math.random() < .04 ? '#ffffff' : (c % 5 === 0 ? cyan : accent); cx.globalAlpha = .75 * fade;
        cx.fillText(g, c * fs, y); cx.globalAlpha = 1;
        if (y > cv.height && Math.random() > .975) drops[c] = Math.random() * -12;
        drops[c] += .55 + (c % 7) * .06;
      }
      requestAnimationFrame(rain);
    }
    rain();
    // Terminal
    var term = document.getElementById('btTerm'), ua = navigator.userAgent, os = /Android/.test(ua) ? 'ANDROID' : /iPhone|iPad/.test(ua) ? 'IOS' : /Windows/.test(ua) ? 'WINDOWS' : /Mac/.test(ua) ? 'MACOS' : 'LINUX';
    var hex = function (n) { var s = ''; while (n--) s += Math.floor(Math.random() * 16).toString(16).toUpperCase(); return s; };
    var steps = [
      '> NETRUNNER-VERBINDUNG ....... OK', '> GERÄT: ' + os + ' ................. OK', '> FIREWALL ABTASTEN ........... 3 PORTS',
      '> ICE-SCHICHT 1/3 ... ' + hex(8), '> ICE-SCHICHT 2/3 ... ' + hex(8), '> ICE-SCHICHT 3/3 ... ' + hex(8),
      '> DAEMON HOCHGELADEN .......... OK', '> TRACE UMGELEITET ............ OK', '> ROOT-ZUGRIFF ERHALTEN'
    ];
    var si = 0, ivT = setInterval(function () {
      if (si >= steps.length) { clearInterval(ivT); return; }
      var d = document.createElement('div'); d.textContent = steps[si++]; term.appendChild(d);
      while (term.children.length > 9) term.removeChild(term.firstChild);
    }, DUR / (steps.length + 1));
    // Hex-Strom rechts
    var hx = document.getElementById('btHex'), ivH = setInterval(function () {
      var l = document.createElement('div'); l.textContent = hex(4) + ' ' + hex(4) + ' ' + hex(4) + ' ' + hex(2); hx.appendChild(l);
      while (hx.children.length > 26) hx.removeChild(hx.firstChild);
    }, 55);
    // Fortschritt und Abschluss
    var pct = document.getElementById('btPct'), bar = document.getElementById('btBar'), lbl = document.getElementById('btLbl'), done = false;
    var ivP = setInterval(function () {
      var p = Math.min(100, Math.round(((Date.now() - t0) / (DUR - 550)) * 100 + (Math.random() * 3)));
      if (p >= 100 && !done) { p = 100; done = true; grant(); }
      pct.textContent = p + '%'; bar.style.width = p + '%';
    }, 40);
    function grant() { lbl.textContent = 'ZUGRIFF GEWÄHRT'; el.classList.add('granted'); }
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      clearInterval(ivT); clearInterval(ivH); clearInterval(ivP); fade = 0;
      el.classList.add('out'); root.classList.remove('cp-boot');
      document.removeEventListener('keydown', close); el.removeEventListener('pointerdown', close);
      setTimeout(function () { alive = false; window.removeEventListener('resize', size); if (el.parentNode) el.parentNode.removeChild(el); }, 520);
    }
    el.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    setTimeout(function () { if (!done) { done = true; pct.textContent = '100%'; bar.style.width = '100%'; grant(); } }, DUR - 500);
    setTimeout(close, DUR);
    // Bildrisse: kurze Streifen springen über den Schirm
    var tear = document.getElementById('btTear');
    [600, 1500, 2300].forEach(function (ms) { setTimeout(function () { if (!alive || closed) return; tear.className = 'bt-tear go'; setTimeout(function () { tear.className = 'bt-tear'; }, 260); }, ms); });
    setTimeout(function () { root.classList.remove('cp-boot'); }, DUR + 800);   // Sicherung
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

  // 12: Überschriften entschlüsseln sich beim Laden
  function decodeTitles() {
    setTimeout(function () {
      if (!on()) return;
      Array.prototype.forEach.call(document.querySelectorAll('.top h1, #hallName, .col-title > span:first-child, .mobile h1'), function (el) {
        var n = el.firstChild; if (n && n.nodeType === 3 && n.nodeValue.trim()) scramble(n);
      });
    }, 350);
  }

  // 10: Meldungen (Toast) tippen sich wie ein eingehender Anruf zeichenweise ein
  function typedToast() {
    var el = $('toast'); if (!el || !window.MutationObserver) return;
    var mine = null, iv = null;
    new MutationObserver(function () {
      var txt = el.textContent;
      if (txt === mine || !txt || !on()) return;   // eigene Änderung oder nichts zu tippen
      clearInterval(iv); el.classList.add('typing');
      var i = 0; mine = ''; el.textContent = '';
      iv = setInterval(function () {
        mine = txt.slice(0, ++i); el.textContent = mine;
        if (i >= txt.length) { clearInterval(iv); el.classList.remove('typing'); }
      }, 22);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  // 4: Scanner – Strahl läuft zur gewählten Position, Hologramm-Label mit Linie zeigt die Daten
  var scanEl = null, scanTimer = null;
  function clearScan() { clearTimeout(scanTimer); if (scanEl && scanEl.parentNode) scanEl.parentNode.removeChild(scanEl); scanEl = null; }
  function scanner() {
    var map = $('map'); if (!map) return;
    map.addEventListener('click', function (e) {
      var g = e.target.closest('g[data-pos]');
      if (!g) { clearScan(); return; }
      var id = g.getAttribute('data-pos');
      setTimeout(function () { if (on()) scan(id); }, 40);
    });
    document.addEventListener('pointerdown', function (e) { if (scanEl && !e.target.closest('#map')) clearScan(); });
  }
  function scan(id) {
    clearScan();
    var mapEl = $('map'), rect = mapEl.querySelector('g[data-pos="' + id + '"] rect'); if (!rect) return;
    var r = rect.getBoundingClientRect(), mr = mapEl.getBoundingClientRect();
    var tasks = window.Store ? Store.get().tasks : {}, k2 = 0, k5 = 0, krs = [], n = 0;
    Object.keys(tasks).forEach(function (t) { var x = tasks[t]; if (x.pos === id) { krs.push('KR ' + x.kr); k2 += +x.k2 || 0; k5 += +x.k5 || 0; n++; } });
    var line = document.querySelector('#detail .line > span:first-child');
    var info = (line ? line.textContent.replace(/\s+/g, ' ').trim() : '') || krs.join(', ') || id;
    var d = document.createElement('div'); d.id = 'scanFx'; d.setAttribute('aria-hidden', 'true');
    var cxp = r.left + r.width / 2, cyp = r.top + r.height / 2;
    var lw = 230, lx = cxp + 60 + lw > window.innerWidth - 8 ? cxp - 60 - lw : cxp + 60, ly = cyp - 70 < mr.top + 6 ? cyp + 36 : cyp - 70;
    var lcx = lx + (lx > cxp ? 0 : lw), lcy = ly + 22, dx = lcx - cxp, dy = lcy - cyp;
    d.innerHTML = '<i class="sf-beam" style="left:' + mr.left + 'px;width:' + mr.width + 'px;top:' + mr.top + 'px"></i>' +
      '<i class="sf-ring" style="left:' + cxp + 'px;top:' + cyp + 'px"></i>' +
      '<i class="sf-lead" style="left:' + cxp + 'px;top:' + cyp + 'px;width:' + Math.sqrt(dx * dx + dy * dy) + 'px;transform:rotate(' + Math.atan2(dy, dx) + 'rad)"></i>' +
      '<div class="sf-holo" style="left:' + lx + 'px;top:' + ly + 'px;width:' + lw + 'px"><b>' + Util.esc(info) + '</b>' +
      (n > 1 ? '<br>' + n + ' KR an dieser Position' : '') + ((k2 || k5) ? '<br>Kisten: K2 ' + k2 + ' · K5 ' + k5 : '') + '</div>';
    document.body.appendChild(d); scanEl = d;
    var beam = d.querySelector('.sf-beam');
    if (beam.animate) beam.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(' + (cyp - mr.top) + 'px)', opacity: 1, offset: .85 }, { transform: 'translateY(' + (cyp - mr.top) + 'px)', opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'forwards' });
    scanTimer = setTimeout(clearScan, 5000);
  }

  // 1: Quickhack-Kreismenü (Rechtsklick oder langes Tippen auf eine Position)
  var radEl = null;
  function closeRadial() { if (radEl && radEl.parentNode) radEl.parentNode.removeChild(radEl); radEl = null; }
  function radial() {
    var map = $('map'); if (!map) return;
    function open(g, x, y) {
      if (!on()) return;
      g.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // Position auswählen (zeigt die Details)
      setTimeout(function () {
        closeRadial(); clearScan();
        var det = $('detail'), t1 = det && (det.querySelector('button[data-act="toggle"]') || det.querySelector('button[data-act="reopen"]')), t2 = det && det.querySelector('button[data-act="close"]');
        var items = [
          { l: t1 ? t1.textContent.trim() : '–', f: t1 ? function () { t1.click(); } : null, p: t1 && t1.dataset.p },
          { l: 'Abschließen', f: t2 ? function () { t2.click(); } : null, p: 'd_close' },
          { l: 'Details', f: function () {} },
          { l: 'Chat', f: function () { var c = document.querySelector('[data-tab="chats"]'); if (c) c.click(); } }
        ];
        var w = document.createElement('div'); w.id = 'radialFx'; var cx0 = Math.max(90, Math.min(window.innerWidth - 90, x)), cy0 = Math.max(90, Math.min(window.innerHeight - 90, y));
        w.style.left = cx0 + 'px'; w.style.top = cy0 + 'px';
        w.innerHTML = '<u></u>' + items.map(function (it, i) {
          var dis = !it.f || (it.p && document.body.classList.contains('deny-' + it.p));
          return '<i class="rd rd' + i + (dis ? ' dis' : '') + '" data-i="' + i + '">' + Util.esc(it.l) + '</i>';
        }).join('');
        document.body.appendChild(w); radEl = w;
        setTimeout(function () { w.classList.add('open'); }, 10);
        w.addEventListener('click', function (ev) { var it = ev.target.closest('.rd'); if (!it || it.classList.contains('dis')) return; var a = items[+it.dataset.i]; closeRadial(); if (a.f) a.f(); });
      }, 60);
    }
    map.addEventListener('contextmenu', function (e) { var g = e.target.closest('g[data-pos]'); if (!g) return; e.preventDefault(); open(g, e.clientX, e.clientY); });
    var lp = null;   // langes Tippen
    map.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var g = e.target.closest('g[data-pos]'); if (!g) return;
      var x = e.clientX, y = e.clientY; clearTimeout(lp); lp = setTimeout(function () { open(g, x, y); }, 550);
    });
    ['pointerup', 'pointermove', 'pointercancel'].forEach(function (ev) { map.addEventListener(ev, function () { clearTimeout(lp); }); });
    document.addEventListener('pointerdown', function (e) { if (radEl && !e.target.closest('#radialFx')) closeRadial(); }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRadial(); });
  }

  // 11: Bedien-Töne (Hover, Klick, Bestätigen, Fehler) – ein/aus im Ton-Fenster
  function uiSounds() {
    var last = null;
    document.addEventListener('mouseover', function (e) {
      var b = e.target.closest && e.target.closest('button, .menu-btn, .chat-row'); if (!b || b === last) return; last = b;
      if (window.Sound && Sound.blip) Sound.blip('hover');
    });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest('button, .menu-btn, .chat-row') !== last) last = null; });
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button, .menu-btn, .chat-row'); if (!b || b.disabled || !window.Sound || !Sound.blip) return;
      Sound.blip(b.classList.contains('btn-ok') ? 'ok' : b.classList.contains('btn-warn') ? 'err' : 'click');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot(); watchMsgs(); countUp($('hallStat')); alertMode(); pings(); statusBar(); hud(); decodeTitles(); typedToast(); scanner(); radial(); uiSounds();
  });
})();
