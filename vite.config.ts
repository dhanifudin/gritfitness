import { execSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'

// Build identity shown in Profil, so anyone can tell which version they are running.
const sha = (() => {
  try {
    return (process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()).trim().slice(0, 7)
  } catch {
    return 'dev'
  }
})()
const APP_VERSION = { sha, date: new Date().toISOString().slice(0, 10) }

// GitHub Pages has no SPA fallback: serve index.html for unknown deep links.
const spa404 = (): Plugin => ({
  name: 'spa-404',
  apply: 'build',
  writeBundle() {
    copyFileSync('dist/index.html', 'dist/404.html')
  },
})

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon-180x180.png', 'logo.png'],
      manifest: {
        name: 'GritFitness',
        short_name: 'GritFit',
        description: 'Aplikasi member GritFitness Malang: QR check-in, jadwal kelas, paket & tagihan.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#14123a',
        background_color: '#14123a',
        icons: [
          { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'QR Check-in', url: '/qr', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'QR Tersimpan', url: '/saved-qr', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Jadwal Kelas', url: '/classes', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // additive push/notificationclick handling, spliced in rather than replacing the
        // generated SW (see public/push-sw.js for why)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          // /api/* is deliberately not cached here: the app keeps its own per-user cache (src/lib/dataCache.ts)
          {
            urlPattern: ({ url }) => url.origin === 'https://gritfitness.id' && url.pathname.startsWith('/storage/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
    spa404(),
  ],
})
