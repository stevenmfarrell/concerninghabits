self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function() {
  // A completely passive fetch handler to satisfy PWA requirements
  // We do not call event.respondWith() so the browser handles all requests natively.
  // This prevents any accidental SW-level network failures from corrupting JS bundles.
});
