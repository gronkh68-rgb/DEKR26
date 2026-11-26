// Zeigt die Version und meldet, wenn eine neue Version veröffentlicht ist (prüft version.json alle 5 Minuten und beim Zurückkehren in die App).
(function () {
  'use strict';
  var V = window.DEKR_VERSION || { n: '?', b: '', d: '' };
  var tag = null, bar = null, newer = null;
  function label() { return 'v' + V.n + (V.b ? ' · ' + V.b : ''); }
  function build() {
    tag = document.createElement('button');
    tag.id = 'verTag'; tag.type = 'button'; tag.textContent = label(); tag.title = 'Version ' + V.n + ' (Build ' + V.b + ', ' + V.d + ') – klicken: Patchnotes anzeigen';
    tag.onclick = function () { openLog(); };
    document.body.appendChild(tag);
    bar = document.createElement('div');
    bar.id = 'updBar'; bar.hidden = true;
    bar.innerHTML = '<span id="updTxt"></span><button type="button" id="updGo">Jetzt neu laden</button><button type="button" id="updX" aria-label="Später">×</button>';
    document.body.appendChild(bar);
    document.getElementById('updGo').onclick = function () { location.reload(); };
    document.getElementById('updX').onclick = function () { bar.hidden = true; };
  }
  // Patchnotes-Fenster: wird erst beim ersten Öffnen aufgebaut, nutzt die im Rest der Seite vorhandenen Modal-Stile
  var logBox = null, logChk = null;
  function esc(s) { return (window.Util && Util.esc) ? Util.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function buildLog() {
    var modal = document.createElement('div');
    modal.className = 'modal'; modal.id = 'logModal'; modal.hidden = true;
    var list = window.DEKR_CHANGELOG || [];
    modal.innerHTML = '<div class="modal-box" style="max-width:560px">' +
      '<div class="col-title orb"><span>Patchnotes</span><button type="button" class="btn-sm" id="logClose">Schließen</button></div>' +
      '<div id="logChk" class="empty" style="margin:4px 0 10px"></div>' +
      '<div id="logList" style="max-height:60vh;overflow-y:auto;display:grid;gap:10px">' +
      list.map(function (g) {
        return '<div><b class="orb" style="color:var(--accent)">' + esc(g.v) + (g.d ? ' <small style="color:var(--dim);font-weight:400">· ' + esc(g.d) + '</small>' : '') + '</b>' +
          '<ul style="margin:4px 0 0;padding-left:18px">' + g.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div>' +
      '<div class="qr-add" style="margin-top:10px"><button type="button" class="btn-sm" id="logCheckBtn">Nach Updates suchen</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    logBox = modal; logChk = modal.querySelector('#logChk');
    modal.querySelector('#logClose').onclick = function () { modal.hidden = true; };
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
    modal.querySelector('#logCheckBtn').onclick = function () { check(true); };
  }
  function openLog() {
    if (!logBox) buildLog();
    logChk.textContent = newer ? 'Neue Version ' + (newer.n || '') + ' verfügbar (' + (newer.d || '') + ') – oben in der Leiste „Jetzt neu laden“.' : '';
    logBox.hidden = false;
  }
  function show(j) {
    newer = j;
    document.getElementById('updTxt').textContent = 'Neue Version ' + (j.n || '') + ' verfügbar (' + (j.d || '') + ')';
    bar.hidden = false; tag.classList.add('new');
  }
  function check(manual) {
    if (!V.b) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.b && j.b !== V.b) {
        show(j);
        if (logChk) logChk.textContent = 'Neue Version ' + (j.n || '') + ' verfügbar (' + (j.d || '') + ') – oben in der Leiste „Jetzt neu laden“.';
      } else if (manual) {
        if (logChk && logBox && !logBox.hidden) { logChk.textContent = 'Das ist die aktuelle Version.'; }
        else { tag.textContent = 'aktuell ✓'; setTimeout(function () { tag.textContent = label(); }, 1800); }
      }
    }).catch(function () { /* offline: nächster Versuch */ });
  }
  function start() { build(); setTimeout(check, 4000); setInterval(check, 300000); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DekrVersion = { label: label, info: V, newer: function () { return newer; } };
})();
