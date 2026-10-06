import { computed } from 'vue'
import { useTracker } from '@/stores/tracker'

/** One-line cloud-sync state, shared by Progres, the settings hub and the data page. */
export function useSyncLabel() {
  const tracker = useTracker()
  return computed(() =>
    tracker.localOnly ? 'Hanya di perangkat ini'
    : !tracker.consented ? 'Belum disinkronkan'
    : tracker.pending ? `Menunggu sinkron (${tracker.pending})`
    : tracker.lastSyncAt ? `Tersinkron ${new Date(tracker.lastSyncAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    : 'Menunggu sinkron',
  )
}
