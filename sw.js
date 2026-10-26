// Minimaler Service Worker: ermöglicht Benachrichtigungen auf dem Handy (kein Offline-Cache)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (cs) {
    return cs.length ? cs[0].focus() : self.clients.openWindow('./scan.html');
  }));
});
