// ABOUTME: Caches core app shell assets and serves offline fallback responses.
// ABOUTME: Keeps PWA behavior lightweight with navigation-safe cache handling.
const CACHE_NAME = 'smash-matchup-lab-v1'
const BASE_URL = getBaseUrl(self.location.pathname)
const APP_SHELL = [
  BASE_URL,
  `${BASE_URL}index.html`,
  `${BASE_URL}manifest.webmanifest`,
  `${BASE_URL}icons/pwa-icon.svg`,
  `${BASE_URL}icons/pwa-maskable.svg`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        return cache.match(`${BASE_URL}index.html`)
      }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return networkResponse
      })
    }),
  )
})

function getBaseUrl(pathname) {
  const lastSlash = pathname.lastIndexOf('/')
  if (lastSlash === -1) {
    return '/'
  }

  return pathname.slice(0, lastSlash + 1)
}
