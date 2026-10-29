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
// Bewusst kein 'fetch'-Handler: Seitenaufrufe sollen nie auf den Service Worker warten (Firmen-Proxys bremsen das aus).
