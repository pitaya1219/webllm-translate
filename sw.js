const CACHE_NAME = 'webllm-translate-v5';
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

// Check if this is a share target request
function isShareTargetRequest(url) {
  return url.origin === self.location.origin &&
         url.pathname === '/' &&
         (url.searchParams.has('text') || url.searchParams.has('title') || url.searchParams.has('url'));
}

// Extract shared content from URL
function extractSharedContent(url) {
  const text = url.searchParams.get('text') || '';
  const title = url.searchParams.get('title') || '';
  const sharedUrl = url.searchParams.get('url') || '';

  let content = text;
  if (title && !content.includes(title)) {
    content = title + (content ? '\n\n' + content : '');
  }
  if (sharedUrl && !content.includes(sharedUrl)) {
    content = content + (content ? '\n\n' : '') + sharedUrl;
  }
  return content;
}

// Handle share target by sending to existing client or opening new window
async function handleShareTarget(url) {
  const sharedContent = extractSharedContent(url);

  // Try to find an existing client (open tab/window)
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Find a client that's not at the share URL (i.e., already loaded)
  const existingClient = clients.find(client => {
    const clientUrl = new URL(client.url);
    return clientUrl.origin === self.location.origin && !isShareTargetRequest(clientUrl);
  });

  if (existingClient) {
    // Send shared content to existing client
    existingClient.postMessage({
      type: 'SHARE_TARGET',
      content: sharedContent
    });
    // Focus the existing client
    await existingClient.focus();
    // Return a redirect to close the share window/navigate away
    return Response.redirect('/', 303);
  }

  // No existing client, let the normal navigation happen
  // The page will handle shared content via URL params
  return null;
}

// Fetch event - cache-first for static assets, bypass for model files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let browser handle model downloads directly (bypass service worker)
  if (shouldBypass(url)) {
    return;
  }

  // Handle share target requests specially
  if (isShareTargetRequest(url)) {
    event.respondWith(
      handleShareTarget(url).then((response) => {
        if (response) {
          return response;
        }
        // Fall through to normal page load
        return caches.match('/') || fetch(event.request);
      })
    );
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
