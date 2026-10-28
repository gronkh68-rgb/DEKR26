// App-Installation (PWA): Manifest, Service Worker, Start über den zuletzt benutzten QR-Link, Installieren-Knopf
(function () {
  'use strict';
  var LAST = 'dekr26_lastqr';
  var onScan = /scan\.html$/.test(location.pathname);
  var q = new URLSearchParams(location.search);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (onScan) {
    try {
      if (q.get('q') || q.get('n')) {
        // QR-Link merken (ohne app=1), damit die installierte App wieder mit diesem Code startet
        q.delete('app');
        localStorage.setItem(LAST, '?' + q.toString());
      } else if (q.get('app')) {
        var last = localStorage.getItem(LAST);
        if (last) { location.replace('scan.html' + last); return; }
      }
    } catch (e) { /* ohne Speicher: normaler Start */ }
  }
  if (navigator.serviceWorker) navigator.serviceWorker.register('sw.js').catch(function () { /* ignorieren */ });
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var b = document.getElementById('installBtn');
    if (b) b.hidden = false;
  });
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('installBtn');
    if (!b) return;
    if (standalone) { b.hidden = true; return; }
    if (deferred) b.hidden = false;
    b.onclick = function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; b.hidden = true; });
    };
    // iPhone/iPad: kein Installieren-Dialog, nur über „Teilen“ → „Zum Home-Bildschirm“
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var hint = document.getElementById('iosHint');
    if (ios && hint) hint.hidden = false;
  });
})();
