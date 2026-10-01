// Push notification handling, spliced into the Workbox-generated service worker via
// VitePWA's `workbox.importScripts` (see vite.config.ts) so it coexists with Workbox's own
// install/fetch/cache handlers instead of replacing them.
//
// Subscription rotation (the `pushsubscriptionchange` event) is deliberately NOT handled here:
// re-upserting a rotated subscription needs the app's grit-session auth (src/lib/supabase.ts),
// which this worker has no access to without duplicating that logic. Instead, src/lib/push.ts
// re-syncs the current subscription with the server on every app load when notifications are
// enabled, which covers the same case (a rotation while the app was closed) just as well in
// practice, since nothing can be delivered to a closed app regardless.

self.addEventListener('push', (event) => {
  let data = { title: 'GritFitness', body: '', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* malformed payload: fall back to the default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-64x64.png',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = clientsList.find((c) => new URL(c.url).pathname === url)
      if (existing) return existing.focus()
      const same = clientsList.find((c) => new URL(c.url).origin === self.location.origin)
      if (same) {
        await same.focus()
        return same.navigate(url)
      }
      return self.clients.openWindow(url)
    })(),
  )
})
