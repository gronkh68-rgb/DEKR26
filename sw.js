// Minimaler Service Worker: ermöglicht Benachrichtigungen auf dem Handy (kein Offline-Cache)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (cs) {
    // Beim Tippen auf die Meldung die Seite in den Vordergrund holen; sie lädt dann selbst nach
    return cs.length ? cs[0].focus() : self.clients.openWindow('./scan.html');
  }));
});
// Ohne Zwischenspeicher: Anfragen gehen unverändert ins Netz (nötig, damit Browser die App als installierbar erkennen)
self.addEventListener('fetch', function () {});
