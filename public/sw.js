// Registered only on devices that turn reminders on (see ServiceWorkerSetup), to receive them.
// It deliberately doesn't cache or serve anything.

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

// A reminder (see src/lib/reminderScheduler.ts). They share a tag, so a newer one replaces any
// still showing. One for a habit with nothing to fill in gets a Done button that logs it.
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  var options = {
    body: data.body || '',
    tag: data.tag || 'habit-reminder',
    renotify: true,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: data.url || '/', habitId: data.habitId || null },
    actions: data.habitId ? [{ action: 'log', title: 'Done' }] : [],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Concerning Habits', options));
});

// Opens (or focuses) the app at the reminder's page
function openPage(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windows) {
    for (var i = 0; i < windows.length; i++) {
      if ('focus' in windows[i] && 'navigate' in windows[i]) {
        return windows[i].navigate(url).then(function(client) { return (client || windows[i]).focus(); });
      }
    }
    return self.clients.openWindow(url);
  });
}

self.addEventListener('notificationclick', function(event) {
  var data = event.notification.data || {};
  event.notification.close();

  if (event.action === 'log' && data.habitId) {
    // Logged in the background; if that fails (e.g. signed out), open the habit to log it there
    event.waitUntil(
      fetch('/api/reminders/log', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId: data.habitId }),
      }).then(function(response) {
        if (!response.ok) return openPage(data.url);
      }, function() {
        return openPage(data.url);
      })
    );
    return;
  }
  event.waitUntil(openPage(data.url || '/'));
});
