// Track it — service worker
// Bump CACHE_VERSION on every release. Old caches are removed on activate.
const CACHE_VERSION = 'trackit-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/db.js',
  './js/dates.js',
  './js/notifications.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first for the app shell, so edits you upload always reach the
// device on the next load. Falls back to the cached copy only when there's
// no network — that's what keeps the app usable offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

// ---------- Best-effort background reminder check ----------
// Supported on Chrome/Android when the app is installed and the OS grants
// periodic background sync. Not available on iOS Safari — see README.
const MIN_INTERVAL = 21, MAX_INTERVAL = 45, WINDOW_DAYS = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('trackit-db', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromStr(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); }
function diffDays(a, b) { return Math.round((fromStr(b) - fromStr(a)) / 86400000); }

async function checkAndNotify() {
  try {
    const db = await openDB();
    const periods = await new Promise((res, rej) => {
      const req = db.transaction('periods', 'readonly').objectStore('periods').getAll();
      req.onsuccess = () => res((req.result || []).sort((a, b) => (a.start < b.start ? -1 : 1)));
      req.onerror = () => rej(req.error);
    });
    if (periods.length < 2) return;

    const starts = periods.map((p) => p.start);
    const intervals = [];
    for (let i = 1; i < starts.length; i++) {
      const g = diffDays(starts[i - 1], starts[i]);
      if (g >= MIN_INTERVAL && g <= MAX_INTERVAL) intervals.push(g);
    }
    if (!intervals.length) return;
    const avg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    const clamped = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, avg));
    const estimated = addDays(starts[starts.length - 1], clamped);
    const windowStart = addDays(estimated, -WINDOW_DAYS);
    const windowEnd = addDays(estimated, WINDOW_DAYS);
    const today = toStr(new Date());
    if (today < windowStart || today > windowEnd) return;
    if (periods.some((p) => p.start >= windowStart && p.start <= today)) return;

    const metaReq = await new Promise((res, rej) => {
      const req = db.transaction('profile', 'readonly').objectStore('profile').get('lastReminderShown');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (metaReq && metaReq.value === today) return;

    await self.registration.showNotification('Track it', {
      body: 'Your period may be due around today. If it has started, add your dates.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'trackit-reminder'
    });

    const tx = db.transaction('profile', 'readwrite');
    tx.objectStore('profile').put({ id: 'lastReminderShown', value: today });
  } catch (e) {
    // Fail silently — this is a best-effort background check only.
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'trackit-reminder-check') {
    event.waitUntil(checkAndNotify());
  }
});

// Some browsers support one-off background sync as a lighter-weight fallback.
self.addEventListener('sync', (event) => {
  if (event.tag === 'trackit-reminder-check') {
    event.waitUntil(checkAndNotify());
  }
});
