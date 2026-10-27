import * as ep from '@/api/endpoints'
import { CK, read, write } from '@/lib/dataCache'
import { localDay, pruneClassQrs, syncClassQr, syncQr } from '@/lib/qrCache'

let running = false

/** Warm the caches for every tab so they open instantly (and work offline) after one session start. Also
 *  keeps the offline-QR cache fresh (Home is the only caller of this, so this is the one place that matters). */
export async function prefetchAll(user: { id: number; nama: string }) {
  if (running || !navigator.onLine) return
  running = true
  const jobs: [string, () => Promise<unknown>][] = [
    [CK.schedule(localDay()), () => ep.schedule(localDay())],
    [CK.bills, ep.invoices],
    [CK.memberships, ep.memberships],
    [CK.leave, ep.cutiList],
    [CK.packages('membership'), ep.paketList],
    [CK.packages('pt'), ep.ptPaketList],
    [CK.packages('class'), ep.classCatalog],
    [
      CK.memberGym,
      async () => {
        const r = await ep.membershipActive()
        syncQr(user, r)
        return r
      },
    ],
    [
      CK.myClasses,
      async () => {
        const r = await ep.myClasses()
        // refresh the offline per-class QRs for every upcoming booking
        pruneClassQrs(user, r.mendatang.map((m) => m.schedule_id))
        for (const m of r.mendatang) {
          try {
            syncClassQr(user, m.schedule_id, await ep.myClassDetail(m.schedule_id))
          } catch {
            /* that one stays stale */
          }
        }
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
