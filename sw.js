// Service worker for NASA Space Explorer.
// It sits between the page and the network. It has two jobs:
// 1. Keep a copy of the app files (the "app shell") so the app opens with no internet.
// 2. Keep a copy of NASA's answers, so photos you already looked at still show offline.
//
// When you change any app file, change VERSION too. That makes phones fetch the new files.
const VERSION = 'v3';
const SHELL_CACHE = `space-explorer-shell-${VERSION}`;
const API_CACHE = `space-explorer-api-${VERSION}`;
const IMAGE_CACHE = `space-explorer-images-${VERSION}`;
const ALL_CACHES = [SHELL_CACHE, API_CACHE, IMAGE_CACHE];

// Never keep more than this many NASA photos, so the phone's storage stays small
const MAX_IMAGES = 60;

// The files the app needs to open. All paths are relative so they work inside a GitHub Pages folder.
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'js/dateRange.js',
  'js/script.js',
  'js/pwa.js',
  'img/favicon.svg',
  'img/favicon.png',
  'img/header-dragon.jpg',
  'img/nasa-worm-logo.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png'
];

// ----- Install: save the app shell -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // start working right away
  );
});

// ----- Activate: throw away copies from older versions -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('space-explorer-') && !ALL_CACHES.includes(name))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim()) // take over pages that are already open
  );
});

// ----- Fetch: decide where every request gets its answer -----
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle plain GET requests. Leave everything else alone.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Our own files: cache first
    event.respondWith(cacheFirst(request));
  } else if (url.hostname === 'science.nasa.gov') {
    // NASA's data: network first
    event.respondWith(networkFirst(request));
  } else if (request.destination === 'image') {
    // NASA's photos: cache first, with a limit
    event.respondWith(cachedImage(request));
  }
});

// Cache first: use the saved copy if there is one, and only ask the network if there is not.
async function cacheFirst(request) {
  // ignoreSearch makes a shared link like index.html?start=2026-10-26 find the saved page
  const saved = await caches.match(request, { ignoreSearch: true });
  if (saved) {
    return saved;
  }

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    // Offline and never saved. A page open falls back to the main page.
    if (request.mode === 'navigate') {
      return caches.match('index.html');
    }
    return Response.error();
  }
}

// Network first: try the internet so the data is fresh, and fall back to the saved copy when offline.
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const fresh = await fetch(request);
    // Only save good answers. A 404 just means NASA has no entry for that day.
    if (fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    const saved = await cache.match(request);
    return saved || Response.error();
  }
}

// Photos: use the saved copy if there is one, otherwise download it and save it.
// NASA's photo server allows cross-site reads, so we ask for a normal (cors) copy.
async function cachedImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const saved = await cache.match(request);
  if (saved) {
    return saved;
  }

  try {
    const fresh = await fetch(request.url, { mode: 'cors' });
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
      trimImages(cache);
    }
    return fresh;
  } catch (error) {
    return Response.error();
  }
}

// Delete the oldest saved photos once there are more than MAX_IMAGES
async function trimImages(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_IMAGES;
  for (let i = 0; i < extra; i++) {
    await cache.delete(keys[i]); // keys come back oldest first
  }
}

// ----- Notifications: tapping one opens the app -----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      if (windows.length > 0) {
        return windows[0].focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
