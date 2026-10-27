// A member's watched class slots (weekday+time+class, from the weekly timetable) and the check
// that fires on app open to auto-book the moment the gym publishes the matching schedule row.
// See src/lib/classWatch.ts for why this can only ever run while the app is actually open.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { book, myClassDetail, schedule } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import { matchOpenRow, occurrenceYmd, nextOccurrence, WATCH_HORIZON_DAYS, type WatchEntry } from '@/lib/classWatch'
import { syncClassQr } from '@/lib/qrCache'
import { remote, trackerConfigured } from '@/lib/supabase'
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

  /** Create (or re-activate) a watchlist entry for a weekly slot. */
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

  /** For an active watchlist entry whose row just got published, decide and fire the booking call. */
  async function attempt(entry: WatchRow, date: string, row: ScheduleRow): Promise<AttemptResult> {
    try {
      let result: AttemptResult['result']
      let message: string | undefined
      if (row.sudah_booking) {
        result = 'already'
      } else {
        const res = await book(row.id)
        result = row.penuh ? 'waiting' : 'registered'
        message = res.message
        if (result === 'registered') {
          // same bookkeeping as a manual booking: shows under "Kelas terdaftar" and counts toward the savings
          const saved = row.harga_normal - row.harga_akhir
          useTracker().trackSignup({ schedule_id: row.id, class_name: row.kelas, scheduled_on: date, start_time: row.jam_mulai, status: 'planned', price: saved > 0 ? saved : null })
          const u = useAuth().user
          if (u) void myClassDetail(row.id).then((d) => syncClassQr({ id: u.id, nama: u.nama }, row.id, d)).catch(() => {})
        }
      }
      await remote.upsert('class_watchlist', { weekday: entry.weekday, start_time: entry.start_time, class_name: entry.class_name, package_id: entry.package_id, active: true, last_attempt_date: date, last_attempt_result: result })
      return { entry, result, message }
    } catch {
      await remote.upsert('class_watchlist', { weekday: entry.weekday, start_time: entry.start_time, class_name: entry.class_name, package_id: entry.package_id, active: true, last_attempt_date: date, last_attempt_result: 'failed' })
      return { entry, result: 'failed' }
    }
  }

  /** Run on app open/resume: check the published schedule against every active watched entry. */
  async function checkAndRegister(): Promise<AttemptResult[]> {
    const auth = useAuth()
    const tracker = useTracker()
    if (!auth.loggedIn || !tracker.consented || !trackerConfigured) return []
    if (checking.value) return []
    checking.value = true
    try {
      if (!loaded.value) await load()
      const now = new Date()
      const due = entries.value.filter((e) => e.active && nextOccurrence(e, now) < WATCH_HORIZON_DAYS && e.last_attempt_date !== occurrenceYmd(e, now))
      if (!due.length) return []
      const dates = [...new Set(due.map((e) => occurrenceYmd(e, now)))]
      const byDate = new Map<string, ScheduleRow[]>()
      for (const d of dates) {
        try {
          byDate.set(d, await schedule(d))
        } catch {
          /* that day stays unknown; retried on the next app open */
        }
      }
      const results: AttemptResult[] = []
      for (const entry of due) {
        const hit = matchOpenRow(entry, (d) => byDate.get(d), now)
        if (hit) results.push(await attempt(entry, hit.date, byDate.get(hit.date)!.find((r) => r.id === hit.row.id)!))
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
