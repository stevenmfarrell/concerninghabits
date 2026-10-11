// The app's service worker (registered by ServiceWorkerSetup, and by ReminderSettings for reminders).
// It receives reminders, and when registered with `?offline=1` (a production build), keeps what it
// takes to open the app offline:
//
// - Pages (navigations) come from the network first, as if this weren't here, and a copy of each is
//   kept. Only when the network fails is the kept copy served, or with none, offline.html. So online,
//   a page is never stale, and never refers to an older build's files.
// - Next's build files (/_next/static) are named by their contents, so each is kept on first use and
//   served from then on.
// - Other files (icons, the manifest, fonts) are served as kept while a fresh copy is fetched.
// - Nothing else is touched: no /api route, nothing but GET, and no RSC request (a client-side
//   navigation's data), which, failing offline, makes Next load the page in full instead, which is
//   then served from here. Changes made offline wait in the page's outbox (see src/lib/offline).
//
// Without the flag (in development), it caches nothing, and every request goes to the network.

var OFFLINE = new URL(self.location).searchParams.has('offline');
// Changed only when what's kept changes shape, so the old caches are cleared. Not for an update to
// this file: its caches carry over, since build files are named by their contents and a page's copy
// is just its last copy. Clearing them while a new version takes over would leave nothing to open
// offline until the next visit online.
var VERSION = 'v1';
// "pages-" caches are also cleared on signing out (see ServiceWorkerSetup), since they hold what
// the signed-in user saw
var PAGES = 'pages-' + VERSION;
var FILES = 'files-' + VERSION;
var OFFLINE_PAGE = '/offline.html';
// The most of each kept, oldest dropped first
var MAX_PAGES = 60;
var MAX_FILES = 400;

self.addEventListener('install', function(event) {
  if (OFFLINE) {
    event.waitUntil(caches.open(FILES).then(function(cache) { return cache.addAll([OFFLINE_PAGE, '/icon-192x192.png']); }).catch(function() {}));
  }
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(key) { return !OFFLINE || (key !== PAGES && key !== FILES); }).map(function(key) { return caches.delete(key); }));
      })
      .then(function() { return self.clients.claim(); })
      .then(keepOpenPages)
  );
});

// Keeps the pages open in the app's windows, with their files: a page loaded while an older version
// of this worker (or none) was in charge wasn't kept here
function keepOpenPages() {
  if (!OFFLINE) return;
  return self.clients.matchAll({ type: 'window' }).then(function(windows) {
    return Promise.all(windows.map(function(client) { return warm(client.url); }));
  });
}

// Drops the oldest of a cache's entries beyond `max`
function trim(cacheName, max) {
  return caches.open(cacheName).then(function(cache) {
    return cache.keys().then(function(keys) {
      return Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(function(key) { return cache.delete(key); }));
    });
  });
}

// Whether a response is worth keeping: this app's own, whole, and not a redirect (e.g. to sign in)
function keepable(response) {
  return response && response.ok && response.type === 'basic' && !response.redirected;
}

// Keeps every build file a page refers to that isn't kept yet: its scripts and styles, and the
// chunks its components load later, which Next names in the page's inline data. Without them, a page
// opened offline would show but never come alive, waiting on a file it can't get.
var BUILD_FILE = /\/_next\/static\/[A-Za-z0-9_\-.\/]+\.(?:js|css|woff2)/g;
function keepFilesOf(html) {
  var paths = Array.from(new Set(html.match(BUILD_FILE) || []));
  return caches.open(FILES).then(function(cache) {
    return Promise.all(paths.map(function(path) {
      return cache.match(path).then(function(kept) {
        if (kept) return;
        return fetch(path).then(function(response) {
          if (keepable(response)) return cache.put(path, response);
        }).catch(function() {});
      });
    }));
  }).then(function() { return trim(FILES, MAX_FILES); });
}

// Keeps a page's copy, and the build files it needs
function keepPage(url, response) {
  var copy = response.clone();
  return Promise.all([
    caches.open(PAGES).then(function(cache) { return cache.put(url, copy); }).then(function() { return trim(PAGES, MAX_PAGES); }),
    response.clone().text().then(keepFilesOf),
  ]);
}

// A page from the network, keeping a copy, or when that fails, the copy kept last
function page(event) {
  var request = event.request;
  return fetch(request)
    .then(function(response) {
      if (keepable(response)) event.waitUntil(keepPage(request.url, response).catch(function() {}));
      return response;
    })
    .catch(function() {
      return caches.open(PAGES).then(function(cache) {
        return cache.match(request.url).then(function(kept) {
          // Another view of the same page (e.g. another page of its entries) will do
          return kept || cache.match(request.url, { ignoreSearch: true });
        });
      }).then(function(kept) {
        return kept || caches.match(OFFLINE_PAGE);
      });
    });
}

// A build file: as kept, or fetched and kept
function buildFile(request) {
  return caches.open(FILES).then(function(cache) {
    return cache.match(request).then(function(kept) {
      if (kept) return kept;
      return fetch(request).then(function(response) {
        if (keepable(response)) cache.put(request, response.clone()).then(function() { return trim(FILES, MAX_FILES); });
        return response;
      });
    });
  });
}

// Another file: as kept, if it is, while a fresh copy is fetched and kept for next time
function otherFile(request) {
  return caches.open(FILES).then(function(cache) {
    return cache.match(request).then(function(kept) {
      var fresh = fetch(request).then(function(response) {
        if (keepable(response)) cache.put(request, response.clone());
        return response;
      });
      if (!kept) return fresh;
      fresh.catch(function() {});
      return kept;
    });
  });
}

self.addEventListener('fetch', function(event) {
  if (!OFFLINE) return;
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  // A client-side navigation's data, or a prefetch of it
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(event));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(buildFile(request));
  } else if (!url.pathname.startsWith('/_next/')) {
    event.respondWith(otherFile(request));
  }
});

// Fetches a page of the app and keeps it, with its files, if it can be fetched and is worth keeping.
// Resolves with its HTML, or '' when it wasn't kept.
function warm(path) {
  var url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.endsWith('.html')) return Promise.resolve('');
  return fetch(url.toString(), { credentials: 'same-origin' }).then(function(response) {
    if (!keepable(response)) return '';
    return keepPage(url.toString(), response).then(function() { return response.clone().text(); });
  }).catch(function() { return ''; });
}

// The habits' and categories' pages a page links to
var LINKED_PAGE = /href="(\/(?:log|categories)\/[^"?#]+)"/g;
var MAX_LINKED_PAGES = 40;
function linkedPages(html) {
  var paths = [];
  var match;
  LINKED_PAGE.lastIndex = 0;
  while ((match = LINKED_PAGE.exec(html))) paths.push(match[1]);
  return paths;
}

// Messages from the app: `warm` fetches and keeps pages (the tabs, see ServiceWorkerSetup), so they
// open offline before they've been visited, and with `followLinks`, the habits' and categories'
// pages they link to
self.addEventListener('message', function(event) {
  var data = event.data || {};
  if (data.type !== 'warm' || !OFFLINE || !Array.isArray(data.urls)) return;
  event.waitUntil(Promise.all(data.urls.map(warm)).then(function(pages) {
    if (!data.followLinks) return;
    var linked = Array.from(new Set(pages.map(linkedPages).reduce(function(all, paths) { return all.concat(paths); }, [])))
      .filter(function(path) { return data.urls.indexOf(path) === -1; })
      .slice(0, MAX_LINKED_PAGES);
    return Promise.all(linked.map(warm));
  }));
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
    // Logged in the background; if that fails (e.g. signed out, or offline), open the habit to log it
    // there, where it's kept for later when offline
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
