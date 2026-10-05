import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hasSyncCredential, remote, revokeTrackerSession, setActiveMember, SyncError, trackerConfigured } from '@/lib/supabase'
import { cachedQrOwner } from '@/lib/qrCache'
import motivationData from '@/data/motivation.json'
import { defaultCounts, type Activity } from '@/lib/activities'
import {
  badgesFor,
  computeStats,
  counts,
  missingDays,
  DEFAULT_SETTINGS,
  motivation as pickMotivation,
  reminder as pickReminder,
  visitedToday,
  addDays,
  ymd,
  type Messages,
  type Settings,
  type Visit,
} from '@/lib/tracker'
import {
  enqueue,
  mergeServer,
  sortMetrics,
  sortVisits,
  type BadgeRow,
  type LocalData,
  type Metric,
  type Op,
  type Signup,
  type Table,
} from '@/lib/trackerData'
import { useAuth } from './auth'

const storageKey = (id: number) => `grit.t.v1.${id}`
const DELETE_COLUMN: Record<Table, string> = {
  visits: 'client_id',
  body_metrics: 'measured_on',
  class_signups: 'schedule_id',
  badges: 'badge_key',
  members: 'member_id',
  push_subscriptions: 'endpoint', // not used via the outbox (see trackerData.ts's CONFLICT comment); kept for type completeness
  class_watchlist: 'id', // ditto
}
const VISIT_COLS = 'client_id,visited_on,visited_at,source,class_name,note,energy,activity,activity_name,counts_toward_goal,duration_min,class_id,cost'

/** Rows from older versions (or the server defaults) get explicit activity fields. */
const normalizeVisit = (v: Visit): Visit => ({ ...v, activity: v.activity ?? (v.source === 'class' ? 'class' : 'gym'), counts_toward_goal: v.counts_toward_goal ?? true })
const visitRow = (v: Visit): Record<string, unknown> => ({
  client_id: v.client_id,
  visited_on: v.visited_on,
  visited_at: v.visited_at ?? null,
  source: v.source,
  class_name: v.class_name ?? null,
  note: v.note ?? null,
  energy: v.energy ?? null,
  activity: v.activity ?? 'gym',
  activity_name: v.activity_name ?? null,
  counts_toward_goal: v.counts_toward_goal ?? true,
  duration_min: v.duration_min ?? null,
  class_id: v.class_id ?? null,
  cost: v.cost ?? null,
})
const metricRow = (m: Metric): Record<string, unknown> => ({
  measured_on: m.measured_on,
  weight_kg: m.weight_kg ?? null,
  waist_cm: m.waist_cm ?? null,
  body_fat_pct: m.body_fat_pct ?? null,
  note: m.note ?? null,
})
const settingsRow = (s: Settings): Record<string, unknown> => ({
  goal_per_week: s.goal_per_week,
  goal_weight_kg: s.goal_weight_kg ?? null,
  reminder_hour: s.reminder_hour ?? null,
  consented_at: s.consented_at ?? null,
})
const signupRow = (s: Signup): Record<string, unknown> => ({
  schedule_id: s.schedule_id,
  class_name: s.class_name,
  scheduled_on: s.scheduled_on,
  start_time: s.start_time ?? null,
  status: s.status,
})

/**
 * Self-tracker state. Offline-first: every change is applied locally and persisted at once, then queued in an
 * outbox and pushed to Supabase (schema grit) when online with a valid gym session and the member's consent.
 */
export const useTracker = defineStore('tracker', () => {
  const memberId = ref<number | null>(null)
  const visits = ref<Visit[]>([])
  const metrics = ref<Metric[]>([])
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const signups = ref<Signup[]>([])
  const badges = ref<BadgeRow[]>([])
  const outbox = ref<Op[]>([])
  const localOnly = ref(false)
  const dismissedMissing = ref<string[]>([])
  const lastSyncAt = ref(0)
  const syncing = ref(false)
  const syncError = ref('')
  const now = ref(new Date())
  // false until we know whether this member already agreed to cloud sync on another device
  const bootstrapDone = ref(true)
  let timer: ReturnType<typeof setInterval> | undefined

  const consented = computed(() => !!settings.value.consented_at)
  /** show the first-use sheet until the member chose cloud sync or device-only */
  const needsConsent = computed(() => !consented.value && !localOnly.value && bootstrapDone.value)
  const stats = computed(() => computeStats(visits.value, settings.value.goal_per_week, now.value))
  const badgeList = computed(() => badgesFor(visits.value, settings.value.goal_per_week, now.value))
  const newBadges = computed(() => badgeList.value.filter((b) => b.unlocked && !badges.value.some((x) => x.badge_key === b.key)))
  const motivation = computed(() => pickMotivation(stats.value, now.value, motivationData as Messages))
  const reminder = computed(() => pickReminder(visits.value, settings.value, now.value))
  const checkedInToday = computed(() => visitedToday(visits.value, now.value))
  const todayVisit = computed(() => visits.value.find((v) => v.visited_on === ymd(now.value) && counts(v)) ?? null)
  /** past days (up to 7) with nothing recorded that the member has not dismissed; only yesterday is nudged on Home */
  const missing = computed(() => missingDays(visits.value, now.value, 7).filter((d) => !dismissedMissing.value.includes(d)))
  const pastSignups = computed(() => {
    const from = ymd(addDays(now.value, -7))
    const today = ymd(now.value)
    return signups.value.filter((x) => x.status === 'planned' && x.scheduled_on >= from && x.scheduled_on < today)
  })
  const pending = computed(() => outbox.value.length)

  function persist() {
    if (memberId.value == null) return
    try {
      localStorage.setItem(
        storageKey(memberId.value),
        JSON.stringify({ visits: visits.value, metrics: metrics.value, settings: settings.value, signups: signups.value, badges: badges.value, outbox: outbox.value, localOnly: localOnly.value, lastSyncAt: lastSyncAt.value, dismissedMissing: dismissedMissing.value }),
      )
    } catch {
      /* storage full or blocked: the in-memory state still works for this session */
    }
  }

  function reset() {
    visits.value = []
    metrics.value = []
    settings.value = { ...DEFAULT_SETTINGS }
    signups.value = []
    badges.value = []
    outbox.value = []
    localOnly.value = false
    lastSyncAt.value = 0
    syncError.value = ''
    dismissedMissing.value = []
  }

  /** Load the local copy for this member (call with the gym member id). Safe to call repeatedly. */
  function init(id: number | null = null) {
    const target = id ?? useAuth().user?.id ?? cachedQrOwner()?.userId ?? null
    if (target == null) return false
    if (!timer) timer = setInterval(() => (now.value = new Date()), 60_000)
    now.value = new Date()
    if (memberId.value === target) return true
    memberId.value = target
    setActiveMember(target) // scopes the grit session + cached access token to this member from here on
    reset()
    bootstrapDone.value = !trackerConfigured || !navigator.onLine
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey(target)) ?? 'null')
      if (raw) {
        visits.value = (raw.visits ?? []).map(normalizeVisit)
        metrics.value = raw.metrics ?? []
        settings.value = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) }
        signups.value = raw.signups ?? []
        badges.value = raw.badges ?? []
        outbox.value = raw.outbox ?? []
        localOnly.value = !!raw.localOnly
        lastSyncAt.value = raw.lastSyncAt ?? 0
        dismissedMissing.value = raw.dismissedMissing ?? []
      }
    } catch {
      /* corrupt local copy: start empty, the server copy comes back on the next sync */
    }
    return true
  }

  function queue(op: Op) {
    outbox.value = enqueue(outbox.value, op)
    persist()
    void sync()
  }

  // ---- writes (local first) ------------------------------------------------------------------------------
  function checkIn(o: { source?: Visit['source']; class_name?: string | null; energy?: number | null; note?: string | null; onlyOnce?: boolean } = {}): Visit {
    const source = o.source ?? 'checkin'
    const existing = todayVisit.value
    if (existing && (o.onlyOnce ?? source === 'checkin')) return existing
    const t = new Date()
    const activity: Activity = source === 'class' ? 'class' : 'gym'
    const v: Visit = { client_id: crypto.randomUUID(), visited_on: ymd(t), visited_at: t.toISOString(), source, class_name: o.class_name ?? null, note: o.note ?? null, energy: o.energy ?? null, activity, counts_toward_goal: true }
    visits.value = sortVisits([v, ...visits.value])
    queue({ table: 'visits', kind: 'upsert', key: v.client_id, row: visitRow(v) })
    return v
  }

  /** Any activity on any (past) day, entered by hand: the backfill path. */
  function addActivity(o: {
    date: string
    activity: Activity
    activity_name?: string | null
    class_id?: number | null
    class_name?: string | null
    counts?: boolean
    duration_min?: number | null
    time?: string | null // 'HH:MM' local
    energy?: number | null
    note?: string | null
    cost?: number | null
  }): Visit {
    const v: Visit = {
      client_id: crypto.randomUUID(),
      visited_on: o.date,
      visited_at: o.time ? new Date(`${o.date}T${o.time}:00`).toISOString() : null,
      source: 'manual',
      activity: o.activity,
      activity_name: o.activity === 'other' ? o.activity_name?.trim() || null : null,
      class_id: o.activity === 'class' ? o.class_id ?? null : null,
      class_name: o.activity === 'class' ? o.class_name ?? null : null,
      counts_toward_goal: o.counts ?? defaultCounts(o.activity),
      duration_min: o.duration_min ?? null,
      note: o.note?.trim() || null,
      energy: o.energy ?? null,
      cost: o.activity === 'other' ? o.cost ?? null : null,
    }
    visits.value = sortVisits([v, ...visits.value])
    queue({ table: 'visits', kind: 'upsert', key: v.client_id, row: visitRow(v) })
    return v
  }

  /** Kept for callers that only know a date and a note. */
  function addManualVisit(date: string, o: { class_name?: string | null; energy?: number | null; note?: string | null } = {}): Visit {
    return addActivity({ date, activity: 'gym', energy: o.energy, note: o.note })
  }

  function updateVisit(clientId: string, patch: Partial<Omit<Visit, 'client_id' | 'source'>>) {
    const i = visits.value.findIndex((v) => v.client_id === clientId)
    if (i < 0) return
    const next = { ...visits.value[i], ...patch }
    visits.value = sortVisits(visits.value.map((v, j) => (j === i ? next : v)))
    queue({ table: 'visits', kind: 'upsert', key: clientId, row: visitRow(next) })
  }

  function removeVisit(clientId: string) {
    visits.value = visits.value.filter((v) => v.client_id !== clientId)
    queue({ table: 'visits', kind: 'delete', key: clientId })
  }

  function saveMetric(m: Metric) {
    metrics.value = sortMetrics([m, ...metrics.value.filter((x) => x.measured_on !== m.measured_on)])
    queue({ table: 'body_metrics', kind: 'upsert', key: m.measured_on, row: metricRow(m) })
  }

  function removeMetric(date: string) {
    metrics.value = metrics.value.filter((m) => m.measured_on !== date)
    queue({ table: 'body_metrics', kind: 'delete', key: date })
  }

  function setSettings(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    if (consented.value) queue({ table: 'members', kind: 'upsert', key: 'me', row: settingsRow(settings.value) })
    else persist()
  }

  /** Member agreed to cloud sync (and chose the weekly goal). */
  function consent(goal: number) {
    localOnly.value = false
    settings.value = { ...settings.value, goal_per_week: goal, consented_at: new Date().toISOString() }
    queue({ table: 'members', kind: 'upsert', key: 'me', row: settingsRow(settings.value) })
    // everything recorded before consent goes up with it
    for (const v of visits.value) queue({ table: 'visits', kind: 'upsert', key: v.client_id, row: visitRow(v) })
    for (const m of metrics.value) queue({ table: 'body_metrics', kind: 'upsert', key: m.measured_on, row: metricRow(m) })
  }

  function stayLocal(goal: number) {
    localOnly.value = true
    settings.value = { ...settings.value, goal_per_week: goal }
    persist()
  }

  function ackBadges(keys: string[]) {
    const at = new Date().toISOString()
    for (const k of keys) {
      if (badges.value.some((b) => b.badge_key === k)) continue
      badges.value = [...badges.value, { badge_key: k, unlocked_at: at }]
      if (consented.value) queue({ table: 'badges', kind: 'upsert', key: k, row: { badge_key: k, unlocked_at: at } })
    }
    persist()
  }

  function trackSignup(s: Signup) {
    signups.value = [...signups.value.filter((x) => x.schedule_id !== s.schedule_id), s]
    if (consented.value) queue({ table: 'class_signups', kind: 'upsert', key: String(s.schedule_id), row: signupRow(s) })
    else persist()
  }

  function setSignupStatus(scheduleId: number, status: Signup['status']) {
    const s = signups.value.find((x) => x.schedule_id === scheduleId)
    if (s) trackSignup({ ...s, status })
  }

  /** "Jadi ikut kelas?" -> yes: log the visit and mark the signup attended. */
  function attendClass(scheduleId: number) {
    const s = signups.value.find((x) => x.schedule_id === scheduleId)
    if (!s) return
    if (s.scheduled_on === ymd(new Date())) checkIn({ source: 'class', class_name: s.class_name, onlyOnce: false })
    else addActivity({ date: s.scheduled_on, activity: 'class', class_name: s.class_name, time: s.start_time?.slice(0, 5) ?? null })
    setSignupStatus(scheduleId, 'attended')
  }

  function dismissMissing(date: string) {
    if (!dismissedMissing.value.includes(date)) dismissedMissing.value = [...dismissedMissing.value, date].slice(-60)
    persist()
  }

  // ---- sync -------------------------------------------------------------------------------------------------
  async function pull(): Promise<LocalData> {
    const since = ymd(new Date(Date.now() - 60 * 86_400_000))
    const [v, m, s, c, b] = await Promise.all([
      remote.select<Visit>('visits', `select=${VISIT_COLS}&order=visited_on.desc&limit=3000`),
      remote.select<Metric>('body_metrics', 'select=measured_on,weight_kg,waist_cm,body_fat_pct,note&order=measured_on.desc&limit=1000'),
      remote.select<Settings>('members', 'select=goal_per_week,goal_weight_kg,reminder_hour,consented_at&limit=1'),
      remote.select<Signup>('class_signups', `select=schedule_id,class_name,scheduled_on,start_time,status&scheduled_on=gte.${since}`),
      remote.select<BadgeRow>('badges', 'select=badge_key,unlocked_at'),
    ])
    return { visits: v, metrics: m, signups: c, badges: b, settings: s[0] ? { ...DEFAULT_SETTINGS, ...s[0] } : settings.value }
  }

  /** New device: has this member already agreed to cloud sync elsewhere? (a members row exists only after consent) */
  async function bootstrap() {
    try {
      const r = await remote.select<Settings>('members', 'select=goal_per_week,goal_weight_kg,reminder_hour,consented_at&limit=1')
      if (r[0]?.consented_at) {
        settings.value = { ...DEFAULT_SETTINGS, ...r[0] }
        persist()
      }
    } catch {
      /* offline or not reachable: fall back to asking */
    } finally {
      bootstrapDone.value = true
    }
  }

  async function sync() {
    if (!trackerConfigured || syncing.value || memberId.value == null) return
    if (!navigator.onLine) return
    // a live gym session is not required: a stored grit session keeps syncing on its own, independent
    // of the gym's 5-hour token (which has no refresh of its own)
    if (!hasSyncCredential(memberId.value)) return
    if (!consented.value && !localOnly.value && !bootstrapDone.value) {
      syncing.value = true
      await bootstrap()
      syncing.value = false
    }
    if (!consented.value || syncing.value) return
    syncing.value = true
    syncError.value = ''
    try {
      while (outbox.value.length) {
        const op = outbox.value[0]
        if (op.kind === 'upsert') await remote.upsert(op.table, op.row ?? {})
        else await remote.remove(op.table, DELETE_COLUMN[op.table], op.key)
        // a newer write to the same row may have replaced it while we were sending: keep that one
        if (outbox.value[0] === op) outbox.value = outbox.value.slice(1)
        persist()
      }
      const merged = mergeServer(await pull(), outbox.value)
      visits.value = sortVisits(merged.visits.map(normalizeVisit))
      metrics.value = sortMetrics(merged.metrics)
      signups.value = merged.signups
      badges.value = merged.badges
      settings.value = merged.settings
      lastSyncAt.value = Date.now()
      persist()
    } catch (e) {
      syncError.value = e instanceof SyncError ? `${e.status}` : 'offline'
    } finally {
      syncing.value = false
    }
  }

  /** Best effort before a deliberate logout so nothing queued is lost. */
  async function flushBeforeLogout() {
    await Promise.race([sync(), new Promise((r) => setTimeout(r, 4000))])
  }

  /** Remove this member's local copy (logout): revokes the grit session server-side (best effort) too. */
  async function wipe() {
    if (memberId.value != null) {
      await revokeTrackerSession(memberId.value)
      try {
        localStorage.removeItem(storageKey(memberId.value))
      } catch {
        /* ignore */
      }
    }
    memberId.value = null
    setActiveMember(null)
    reset()
  }

  return {
    memberId, visits, metrics, settings, signups, badges, outbox, syncing, syncError, lastSyncAt, now,
    consented, needsConsent, localOnly, stats, badgeList, newBadges, motivation, reminder, checkedInToday, todayVisit, pending, missing, pastSignups,
    init, checkIn, addActivity, addManualVisit, updateVisit, dismissMissing, removeVisit, saveMetric, removeMetric, setSettings, consent, stayLocal,
    ackBadges, trackSignup, setSignupStatus, attendClass, sync, flushBeforeLogout, wipe,
  }
})
