import * as ep from '@/api/endpoints'
import { CK, read, write } from '@/lib/dataCache'

let running = false

/** Warm the caches for every tab so they open instantly (and work offline) after one session start. */
export async function prefetchAll(userId: number) {
  if (running || !navigator.onLine) return
  running = true
  const jobs: [string, () => Promise<unknown>][] = [
    [CK.classes, ep.jadwalKelas],
    [CK.bills, ep.tagihan],
    [CK.memberships, () => ep.memberships(userId)],
    [CK.leave, () => ep.cutiList(userId)],
    [CK.packages('membership'), ep.paketMemberships],
    [CK.packages('pt'), ep.paketPt],
    [CK.packages('class'), ep.paketKelas],
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
