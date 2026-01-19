const CACHE_NAME = 'webllm-translate-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/assets/logo.png',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Domains and file extensions to bypass (let browser handle directly)
const BYPASS_DOMAINS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'raw.githubusercontent.com',
];

const BYPASS_EXTENSIONS = [
  '.bin',
  '.wasm',
  '.safetensors',
  '.gguf',
  '.onnx',
];

function shouldBypass(url) {
  // Bypass known model hosting domains
  if (BYPASS_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return true;
  }
  // Bypass large model files by extension
  if (BYPASS_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    return true;
  }
  return false;
}

// Fetch event - cache-first for static assets, bypass for model files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let browser handle model downloads directly (bypass service worker)
  if (shouldBypass(url)) {
    return;
  }

  // For same-origin requests, use cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
  } else {
    // For other external requests (CDN scripts, etc.), use network-first
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
