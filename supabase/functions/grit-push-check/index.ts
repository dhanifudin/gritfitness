// grit-push-check: scheduled (pg_cron) sweep that sends three kinds of Web Push notification:
//   'favclass'   — the member's favourite class (by real attendance) is predicted today and they
//                  haven't signed up or attended it yet.
//   'notracking' — the member hasn't logged anything in a while.
//   'classopen'  — a watched class's registration window is probably opening soon; a nudge to open
//                  the app, which then attempts the real registration itself (src/stores/classWatch.ts).
//                  The nudge time here (19:00 the day before for a morning class, 07:00 the same day
//                  for an afternoon one) is only the member's own observed heuristic, never authoritative
//                  — the app always decides against the row's real tanggal_mulai_daftar/tutup_daftar.
// The decision logic is the exact same pure functions the in-app Home nudges use
// (src/lib/insight.ts), imported directly so the two can never disagree.
//
//   POST /functions/v1/grit-push-check      Header: x-cron-secret: <GRIT_CRON_SECRET>
//   -> 200 { checked, sent, pruned }
//
// Deployed with --no-verify-jwt (like grit-auth/grit-refresh): the caller is pg_cron, not a browser,
// so authorization is a shared secret header instead of a Supabase JWT. That header is abuse-resistance,
// not the real safety boundary — this function already bypasses RLS via the service role, so what
// actually protects members is that it only ever *reads* their own already-stored data to decide
// whether to push, same as any other scheduled job would.
// Secrets: GRIT_CRON_SECRET, GRIT_VAPID_PUBLIC_KEY, GRIT_VAPID_PRIVATE_KEY, GRIT_VAPID_SUBJECT.
import webpush from 'npm:web-push@3'
import { favouriteClassToday, noTrackingNudge } from '../../../src/lib/insight.ts'
import { daysSinceLastVisit, type Visit } from '../../../src/lib/tracker.ts'
import type { Slot } from '../../../src/lib/timetable.ts'
import type { Signup } from '../../../src/lib/trackerData.ts'
import { gritServiceRequest } from '../_shared/grit.ts'

const TIMETABLE_URL = 'https://grit.ulfillah.com/timetable.json'
const FAVCLASS_COOLDOWN_DAYS = 1
const NOTRACKING_COOLDOWN_DAYS = 3
const MORNING_NUDGE_HOUR = 19 // evening before, for a class starting before noon
const AFTERNOON_NUDGE_HOUR = 7 // same day, for a class starting at/after noon
const CLASSOPEN_COOLDOWN_DAYS = 0.75 // one nudge per watched occurrence, not one per cron tick

interface SubRow {
  id: string
  member_id: number
  endpoint: string
  p256dh: string
  auth: string
}
interface LogRow {
  member_id: number
  kind: 'favclass' | 'notracking' | 'classopen'
  sent_at: string
  watchlist_id: string | null
}
interface VisitRow extends Omit<Visit, 'client_id'> {
  member_id: number
}
interface SignupRow extends Signup {
  member_id: number
}
interface WatchRow {
  id: string
  member_id: number
  weekday: number
  start_time: string
  class_name: string
}

/** Jakarta has no DST; a fixed +7h offset is exact, not an approximation. */
function jakartaFields(d: Date): { weekday: number; hour: number } {
  const jk = new Date(d.getTime() + 7 * 3600_000)
  return { weekday: (jk.getUTCDay() + 6) % 7, hour: jk.getUTCHours() + jk.getUTCMinutes() / 60 }
}

function groupBy<T extends { member_id: number }>(rows: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (const r of rows) m.set(r.member_id, [...(m.get(r.member_id) ?? []), r])
  return m
}
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const cronSecret = Deno.env.get('GRIT_CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return new Response('unauthorized', { status: 401 })

  const vapidPublic = Deno.env.get('GRIT_VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('GRIT_VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('GRIT_VAPID_SUBJECT')
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return new Response('server not configured', { status: 500 })
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const [subsRes, visitsRes, signupsRes, logRes, watchRes, slots] = await Promise.all([
    gritServiceRequest('push_subscriptions?select=id,member_id,endpoint,p256dh,auth', { method: 'GET' }),
    gritServiceRequest(`visits?select=member_id,visited_on,source,activity,activity_name,class_name,counts_toward_goal&visited_on=gte.${from}`, { method: 'GET' }),
    gritServiceRequest(`class_signups?select=member_id,schedule_id,class_name,scheduled_on,start_time,status&scheduled_on=eq.${today}`, { method: 'GET' }),
    gritServiceRequest(`push_log?select=member_id,kind,sent_at,watchlist_id&sent_at=gte.${new Date(now.getTime() - 7 * 86_400_000).toISOString()}`, { method: 'GET' }),
    gritServiceRequest('class_watchlist?select=id,member_id,weekday,start_time,class_name&active=is.true', { method: 'GET' }),
    fetch(TIMETABLE_URL).then((r) => r.json()).then((j) => j.slots as Slot[]).catch(() => [] as Slot[]),
  ])
  if (!subsRes.ok || !visitsRes.ok || !signupsRes.ok || !logRes.ok || !watchRes.ok) return new Response('upstream read failed', { status: 502 })

  const subs = groupBy(await subsRes.json() as SubRow[])
  const visitsByMember = groupBy(await visitsRes.json() as VisitRow[])
  const signupsByMember = groupBy(await signupsRes.json() as SignupRow[])
  const logByMember = groupBy(await logRes.json() as LogRow[])
  const watchByMember = groupBy(await watchRes.json() as WatchRow[])
  const { weekday: todayWeekday, hour: jakartaHour } = jakartaFields(now)

  let sent = 0
  const pruned = new Set<string>()
  const toLog: { member_id: number; kind: 'favclass' | 'notracking' | 'classopen'; watchlist_id?: string }[] = []

  for (const [memberId, memberSubs] of subs) {
    const visits = visitsByMember.get(memberId) ?? []
    const signups = signupsByMember.get(memberId) ?? []
    const log = logByMember.get(memberId) ?? []
    const lastSent = (kind: 'favclass' | 'notracking') => log.filter((l) => l.kind === kind).sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]

    const payloads: { kind: 'favclass' | 'notracking' | 'classopen'; title: string; body: string; url: string; watchlist_id?: string }[] = []

    const asVisits: Visit[] = visits.map((v) => ({ ...v, client_id: '' }))
    const fav = favouriteClassToday({ visits: asVisits, now, slots, signups: signups as Signup[] })
    const favLast = lastSent('favclass')
    if (fav && (!favLast || daysSince(favLast.sent_at) >= FAVCLASS_COOLDOWN_DAYS)) {
      payloads.push({ kind: 'favclass', title: 'Kelas favoritmu hari ini', body: `${fav.className} jam ${fav.start} — belum daftar.`, url: '/classes' })
    } else {
      const sinceLast = daysSinceLastVisit(asVisits, now)
      const text = noTrackingNudge(sinceLast)
      const notrackLast = lastSent('notracking')
      if (text && (!notrackLast || daysSince(notrackLast.sent_at) >= NOTRACKING_COOLDOWN_DAYS)) {
        payloads.push({ kind: 'notracking', title: 'GritFitness', body: text, url: '/' })
      }
    }

    for (const e of watchByMember.get(memberId) ?? []) {
      const morning = e.start_time < '12:00'
      const dueWeekday = morning ? (todayWeekday + 1) % 7 : todayWeekday
      if (e.weekday !== dueWeekday) continue
      if (jakartaHour < (morning ? MORNING_NUDGE_HOUR : AFTERNOON_NUDGE_HOUR)) continue
      const last = log.filter((l) => l.kind === 'classopen' && l.watchlist_id === e.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]
      if (last && daysSince(last.sent_at) < CLASSOPEN_COOLDOWN_DAYS) continue
      const when = morning ? 'besok' : 'hari ini'
      payloads.push({
        kind: 'classopen',
        title: 'Jadwal kelas mungkin sudah bisa didaftar',
        body: `${e.class_name} ${when} jam ${e.start_time} — buka app untuk coba daftar otomatis.`,
        url: '/classes',
        watchlist_id: e.id,
      })
    }

    for (const payload of payloads) {
      const body = JSON.stringify(payload)
      for (const s of memberSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) pruned.add(s.id)
        }
      }
      toLog.push({ member_id: memberId, kind: payload.kind, watchlist_id: payload.watchlist_id })
    }
  }

  await Promise.all([
    toLog.length ? gritServiceRequest('push_log', { method: 'POST', body: toLog, prefer: 'return=minimal' }) : Promise.resolve(),
    ...[...pruned].map((id) => gritServiceRequest(`push_subscriptions?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' })),
  ])

  return new Response(JSON.stringify({ checked: subs.size, sent, pruned: pruned.size }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
