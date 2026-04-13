const CACHE_NAME = 'bisame-shell-v1'
const APP_SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) {
          return cached
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html')
        }
        throw new Error('Offline and no cached response available')
      })
  )
})
