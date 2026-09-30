import { onMounted, ref, type Ref } from 'vue'

export function useAsync<T>(fn: () => Promise<T>, initial: T) {
  const data = ref(initial) as Ref<T>
  const loading = ref(true)
  const error = ref('')
  async function run() {
    loading.value = true
    error.value = ''
    try {
      data.value = await fn()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
    } finally {
      loading.value = false
    }
  }
  onMounted(run)
  return { data, loading, error, reload: run }
}

// API sends both raw ("75000.00") and pre-formatted ("Rp. 1.491.750") prices.
export const rupiah = (v: string | number | null | undefined) => {
  if (typeof v === 'string' && /^Rp/i.test(v)) return v.replace(/^Rp\.?\s*/i, 'Rp ')
  return 'Rp ' + Math.round(Number(v ?? 0)).toLocaleString('id-ID')
}

/** API returns site-relative asset paths like /storage/kelas/x.jpg */
export const assetUrl = (p: string | null | undefined) =>
  !p ? '' : /^https?:/.test(p) ? p : 'https://gritfitness.id' + (p.startsWith('/') ? p : '/' + p)
