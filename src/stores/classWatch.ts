// A member's watched class slots (weekday+time+class, from the predicted timetable) and the
// check that fires on app open to auto-register the instant the gym opens registration for one of
// them. See src/lib/classWatch.ts for why this can only ever run while the app is actually open.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { jadwalKelas, classDetail, classRegister, classWaiting } from '@/api/endpoints'
import { classActionFor } from '@/lib/classAction'
import { parsePrice } from '@/lib/classValue'
import { matchOpenRow, type WatchEntry } from '@/lib/classWatch'
import { remote, trackerConfigured } from '@/lib/supabase'
import { parseDmy } from '@/lib/timetable'
import { ymd } from '@/lib/tracker'
import { useAuth } from './auth'
import { useTracker } from './tracker'

export interface WatchRow extends WatchEntry {
  last_attempt_result: string | null
}

export interface AttemptResult {
  entry: WatchRow
  result: 'registered' | 'waiting' | 'failed' | 'full' | 'already'
  message?: string
}

const COLS = 'id,weekday,start_time,class_name,package_id,active,last_attempt_date,last_attempt_result'

export const useClassWatch = defineStore('classWatch', () => {
  const entries = ref<WatchRow[]>([])
  const loaded = ref(false)
  const checking = ref(false)
  const lastResults = ref<AttemptResult[]>([])

  const activeFor = (weekday: number, start_time: string, class_name: string) =>
    entries.value.find((e) => e.weekday === weekday && e.start_time === start_time && e.class_name === class_name && e.active)

  async function load(): Promise<void> {
    if (!trackerConfigured) return
    try {
      entries.value = await remote.select<WatchRow>('class_watchlist', `select=${COLS}`)
    } finally {
      loaded.value = true
    }
  }

  /** Create (or re-activate) a watchlist entry for a predicted slot. */
  async function watch(weekday: number, start_time: string, class_name: string, package_id: number | null): Promise<void> {
    await remote.upsert('class_watchlist', { weekday, start_time, class_name, package_id, active: true })
    await load()
  }

  async function unwatch(weekday: number, start_time: string, class_name: string): Promise<void> {
    const e = activeFor(weekday, start_time, class_name)
    if (!e) return
    await remote.upsert('class_watchlist', { weekday, start_time, class_name, package_id: e.package_id, active: false })
    await load()
  }

  /** For an active watchlist entry whose row just opened, decide and fire the registration call. */
  async function attempt(entry: WatchRow, row: { id: number }, now: Date): Promise<AttemptResult> {
    try {
      const detail = await classDetail(row.id)
      const action = classActionFor(detail.daftar)
      let result: AttemptResult['result']
      let message: string | undefined
      if (action?.kind === 'register') {
        const res = await classRegister(row.id)
        result = 'registered'
        message = res.message
        // same bookkeeping as a manual registration: shows under "Kelas terdaftar" and counts toward the savings
        useTracker().trackSignup({ schedule_id: row.id, class_name: detail.nama_jadwal_kelas, scheduled_on: ymd(parseDmy(detail.tanggal)), start_time: detail.jam_awal, status: 'planned', price: parsePrice(detail.harga) })
      } else if (action?.kind === 'waiting') {
        const res = await classWaiting(row.id)
        result = 'waiting'
        message = res.message
      } else if (detail.daftar === 'PESERTA') {
        result = 'already'
      } else {
        result = 'full'
      }
      await remote.upsert('class_watchlist', { weekday: entry.weekday, start_time: entry.start_time, class_name: entry.class_name, package_id: entry.package_id, active: true, last_attempt_date: ymd(now), last_attempt_result: result })
      return { entry, result, message }
    } catch {
      await remote.upsert('class_watchlist', { weekday: entry.weekday, start_time: entry.start_time, class_name: entry.class_name, package_id: entry.package_id, active: true, last_attempt_date: ymd(now), last_attempt_result: 'failed' })
      return { entry, result: 'failed' }
    }
  }

  /** Run on app open/resume: check today's real rows against every active watched entry. */
  async function checkAndRegister(): Promise<AttemptResult[]> {
    const auth = useAuth()
    const tracker = useTracker()
    if (!auth.loggedIn || !tracker.consented || !trackerConfigured) return []
    if (checking.value) return []
    checking.value = true
    try {
      if (!loaded.value) await load()
      const active = entries.value.filter((e) => e.active)
      if (!active.length) return []
      const now = new Date()
      const rows = await jadwalKelas()
      const results: AttemptResult[] = []
      for (const entry of active) {
        const row = matchOpenRow(entry, rows, now)
        if (row) results.push(await attempt(entry, row, now))
      }
      if (results.length) lastResults.value = [...lastResults.value, ...results]
      return results
    } finally {
      checking.value = false
    }
  }

  function clearResults() {
    lastResults.value = []
  }

  return { entries, loaded, lastResults: computed(() => lastResults.value), activeFor, load, watch, unwatch, checkAndRegister, clearResults }
})
