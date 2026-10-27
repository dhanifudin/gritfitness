import { ref } from 'vue'
import type { ActionResult } from '@/api/types'

/** Runs a mutating call, tracks busy/error, and treats {success:false} as an error. */
export function useAction() {
  const busy = ref(false)
  const error = ref('')
  async function run<T extends ActionResult | object | boolean>(fn: () => Promise<T>): Promise<T | null> {
    busy.value = true
    error.value = ''
    try {
      const res = await fn()
      const r = res as ActionResult
      if (typeof res === 'object' && r.success === false) throw new Error(r.message || 'Permintaan gagal')
      return res
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
      return null
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
