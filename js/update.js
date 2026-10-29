// Zeigt die Version und meldet, wenn eine neue Version veröffentlicht ist (prüft version.json alle 5 Minuten und beim Zurückkehren in die App).
(function () {
  'use strict';
  var V = window.DEKR_VERSION || { n: '?', b: '', d: '' };
  var tag = null, bar = null, newer = null;
  function label() { return 'v' + V.n + (V.b ? ' · ' + V.b : ''); }
  function build() {
    tag = document.createElement('button');
    tag.id = 'verTag'; tag.type = 'button'; tag.textContent = label(); tag.title = 'Version ' + V.n + ' (Build ' + V.b + ', ' + V.d + ') – klicken: nach Updates suchen';
    tag.onclick = function () { check(true); };
    document.body.appendChild(tag);
    bar = document.createElement('div');
    bar.id = 'updBar'; bar.hidden = true;
    bar.innerHTML = '<span id="updTxt"></span><button type="button" id="updGo">Jetzt neu laden</button><button type="button" id="updX" aria-label="Später">×</button>';
    document.body.appendChild(bar);
    document.getElementById('updGo').onclick = function () { location.reload(); };
    document.getElementById('updX').onclick = function () { bar.hidden = true; };
  }
  function show(j) {
    newer = j;
    document.getElementById('updTxt').textContent = 'Neue Version ' + (j.n || '') + ' verfügbar (' + (j.d || '') + ')';
    bar.hidden = false; tag.classList.add('new');
  }
  function check(manual) {
    if (!V.b) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.b && j.b !== V.b) show(j);
      else if (manual) { tag.textContent = 'aktuell ✓'; setTimeout(function () { tag.textContent = label(); }, 1800); }
    }).catch(function () { /* offline: nächster Versuch */ });
  }
  function start() { build(); setTimeout(check, 4000); setInterval(check, 300000); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DekrVersion = { label: label, info: V, newer: function () { return newer; } };
})();
