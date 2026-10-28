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
})();
