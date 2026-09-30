import { onMounted, ref, type Ref } from 'vue'
import * as cache from '@/lib/dataCache'

const FRESH_MS = 30_000

interface Options {
  /** Enables stale-while-revalidate: cached data paints instantly, then is refreshed. */
  key?: string | (() => string)
}

export function useAsync<T>(fn: () => Promise<T>, initial: T, opts: Options = {}) {
  const keyOf = () => (typeof opts.key === 'function' ? opts.key() : opts.key)
  const data = ref(initial) as Ref<T>
  const loading = ref(true)
  const error = ref('')
  const savedAt = ref(0)
  /** true when a refresh failed (offline/server error) and older data is on screen */
  const stale = ref(false)

  const k0 = keyOf()
  const hit = k0 ? cache.read<T>(k0) : null
  if (hit) {
    data.value = hit.data
    savedAt.value = hit.savedAt
    loading.value = false
  }

  async function run(force = true) {
    if (!force && savedAt.value && Date.now() - savedAt.value < FRESH_MS) return
    if (!savedAt.value) loading.value = true
    error.value = ''
    stale.value = false
    try {
      const res = await fn()
      data.value = res
      const key = keyOf()
      savedAt.value = key ? cache.write(key, res) : Date.now()
    } catch (e) {
      if (savedAt.value) stale.value = true
      else error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
    } finally {
      loading.value = false
    }
  }
  onMounted(() => run(false))
  return { data, loading, error, savedAt, stale, reload: () => run(true) }
}

// API sends both raw ("75000.00") and pre-formatted ("Rp. 1.491.750") prices.
export const rupiah = (v: string | number | null | undefined) => {
  if (typeof v === 'string' && /^Rp/i.test(v)) return v.replace(/^Rp\.?\s*/i, 'Rp ')
  return 'Rp ' + Math.round(Number(v ?? 0)).toLocaleString('id-ID')
}

/** API returns site-relative asset paths like /storage/kelas/x.jpg */
export const assetUrl = (p: string | null | undefined) =>
  !p ? '' : /^https?:/.test(p) ? p : 'https://gritfitness.id' + (p.startsWith('/') ? p : '/' + p)
