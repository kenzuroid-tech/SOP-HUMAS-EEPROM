const CACHE_NAME = 'she-cache-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './offline.html',
  './style.css',
  './manifest.json',
  './images/eeprom no bg.png',
  './js/pwa.js',
  './js/auth.js',
  './js/config.js',
  './js/router.js',
  './js/store.js',
  './js/utils.js',
  './js/components/header.js',
  './js/components/sidebar.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Routing Strategies
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Network First for Supabase API
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Stale While Revalidate for Images
  if (requestUrl.pathname.includes('/images/') || event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => null);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Cache First for Static Assets (CSS, JS, Fonts, App HTML)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // Fallback to offline.html if navigation request fails
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
    })
  );
});

// Handle messages from PWA (e.g. skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Push Notification - Prepare Structure
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  let data = { title: 'New Notification', content: 'SOP HUMAS EEPROM has a new update!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.content = event.data.text();
    }
  }

  const title = data.title;
  const options = {
    body: data.content,
    icon: './images/eeprom no bg.png',
    badge: './images/eeprom no bg.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});
