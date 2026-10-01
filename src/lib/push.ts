// Web Push subscribe/unsubscribe. Needs cloud sync already consented to (push subscriptions live in
// grit.push_subscriptions, reachable only via the same grit session as the rest of the tracker data).
import { remote, trackerConfigured } from './supabase'

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''
const ENABLED_KEY = 'grit.push.enabled'

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/** iOS Safari only supports PWA push when launched from an installed home-screen icon, not a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY && trackerConfigured
}

export function permissionState(): PermissionState {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission as PermissionState
}

/** Was push ever turned on from this device (survives reload so we know to re-sync on load). */
export const wasEnabled = () => localStorage.getItem(ENABLED_KEY) === '1'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function subRow(sub: PushSubscription): Record<string, unknown> {
  const json = sub.toJSON()
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }
}

/** Request permission (if needed) and subscribe this device, upserting the subscription to the server. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: 'Notifikasi tidak didukung di perangkat/browser ini.' }
  if (!isStandalone()) return { ok: false, reason: 'Pasang aplikasi ke layar utama dulu (lihat tombol di Beranda), lalu buka dari sana.' }
  if (Notification.permission === 'denied') return { ok: false, reason: 'Izin notifikasi diblokir. Aktifkan lewat pengaturan browser/perangkat.' }

  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'Izin notifikasi tidak diberikan.' }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource }))
    await remote.upsert('push_subscriptions', subRow(sub))
    localStorage.setItem(ENABLED_KEY, '1')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Gagal mengaktifkan notifikasi.' }
  }
}

export async function disablePush(): Promise<void> {
  localStorage.removeItem(ENABLED_KEY)
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await remote.remove('push_subscriptions', 'endpoint', sub.endpoint).catch(() => {})
      await sub.unsubscribe()
    }
  } catch {
    /* best effort */
  }
}

/** Re-upsert the current subscription on app load when previously enabled — covers a browser-rotated
 *  endpoint while the app was closed (see public/push-sw.js for why this isn't done from the worker). */
export async function syncPushSubscription(): Promise<void> {
  if (!wasEnabled() || !pushSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await remote.upsert('push_subscriptions', subRow(sub))
  } catch {
    /* best effort; next app open retries */
  }
}
