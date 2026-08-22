const VIDEO_CACHE_NAME = 'akio-pach-videos-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)

  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith('/Movie/')) {
    return
  }

  event.respondWith(
    caches.open(VIDEO_CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(requestUrl.pathname)
      if (cachedResponse) {
        return cachedResponse
      }

      const networkResponse = await fetch(event.request)
      if (networkResponse.ok && event.request.method === 'GET') {
        await cache.put(requestUrl.pathname, networkResponse.clone())
      }
      return networkResponse
    }),
  )
})
