self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // A minimum fetch handler to satisfy PWA requirements
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Offline mode not implemented");
    })
  );
});
