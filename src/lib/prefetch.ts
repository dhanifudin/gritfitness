import * as ep from '@/api/endpoints'
import { CK, read, write } from '@/lib/dataCache'
import { syncQr } from '@/lib/qrCache'

let running = false

/** Warm the caches for every tab so they open instantly (and work offline) after one session start. Also
 *  keeps the offline-QR cache fresh (Home is the only caller of this, so this is the one place that matters). */
export async function prefetchAll(user: { id: number; nama: string }) {
  if (running || !navigator.onLine) return
  running = true
  const userId = user.id
  const jobs: [string, () => Promise<unknown>][] = [
    [CK.classes, ep.jadwalKelas],
    [CK.bills, ep.tagihan],
    [CK.memberships, () => ep.memberships(userId)],
    [CK.leave, () => ep.cutiList(userId)],
    [CK.packages('membership'), ep.paketMemberships],
    [CK.packages('pt'), ep.paketPt],
    [CK.packages('class'), ep.paketKelas],
    [
      CK.memberGym,
      async () => {
        const r = await ep.memberAktif(userId)
        syncQr(user, 'gym', r)
        return r
      },
    ],
    [
      CK.memberPt,
      async () => {
        const r = await ep.memberPtAktif(userId)
        syncQr(user, 'pt', r)
        return r
      },
    ],
  ]
  try {
    for (const [key, fn] of jobs) {
      const hit = read(key)
      if (hit && Date.now() - hit.savedAt < 60_000) continue
      try {
        write(key, await fn())
      } catch {
        /* prefetch is best effort; the screen will retry on visit */
      }
    }
  } finally {
    running = false
  }
}
