// Offline-first data layer for the tracker: local state + a queue of pending writes (the "outbox").
// Pure functions (no Vue, no network) so the merge/coalesce rules can be unit-tested with plain Node.
import type { Settings, Visit } from './tracker'

export interface Metric {
  measured_on: string // YYYY-MM-DD, one row per day
  weight_kg?: number | null
  waist_cm?: number | null
  body_fat_pct?: number | null
  note?: string | null
}
export interface Signup {
  schedule_id: number
  class_name: string
  scheduled_on: string
  start_time?: string | null
  status: 'planned' | 'attended' | 'cancelled'
}
export interface BadgeRow {
  badge_key: string
  unlocked_at: string
}

export type Table = 'visits' | 'body_metrics' | 'members' | 'class_signups' | 'badges'

export interface Op {
  table: Table
  kind: 'upsert' | 'delete'
  /** identifies the row: the unique column(s) value */
  key: string
  /** columns to send (upsert) */
  row?: Record<string, unknown>
}

export interface LocalData {
  visits: Visit[]
  metrics: Metric[]
  settings: Settings
  signups: Signup[]
  badges: BadgeRow[]
}

export const keyOf = {
  visits: (v: Visit) => v.client_id,
  body_metrics: (m: Metric) => m.measured_on,
  class_signups: (s: Signup) => String(s.schedule_id),
  badges: (b: BadgeRow) => b.badge_key,
} as const

/** PostgREST on_conflict columns; member_id comes from the token on the server. */
export const CONFLICT: Record<Table, string> = {
  visits: 'member_id,client_id',
  body_metrics: 'member_id,measured_on',
  members: 'member_id',
  class_signups: 'member_id,schedule_id',
  badges: 'member_id,badge_key',
}

/** Add an op to the queue, coalescing with a pending op on the same row (the newest intent wins). */
export function enqueue(outbox: Op[], op: Op): Op[] {
  const i = outbox.findIndex((o) => o.table === op.table && o.key === op.key)
  if (i < 0) return [...outbox, op]
  const prev = outbox[i]
  const next: Op =
    op.kind === 'upsert' && prev.kind === 'upsert' ? { ...op, row: { ...prev.row, ...op.row } } : op
  return [...outbox.slice(0, i), ...outbox.slice(i + 1), next] // keep chronological order
}

function overlay<T>(rows: T[], pending: Op[], table: Table, key: (r: T) => string): T[] {
  const map = new Map(rows.map((r) => [key(r), r]))
  for (const op of pending.filter((o) => o.table === table)) {
    if (op.kind === 'delete') map.delete(op.key)
    else map.set(op.key, { ...(map.get(op.key) as object), ...(op.row as object) } as T)
  }
  return [...map.values()]
}

/**
 * Local view = server rows + pending writes on top. Used after a pull so a write that has not
 * reached the server yet is never lost or shown twice.
 */
export function mergeServer(server: LocalData, outbox: Op[]): LocalData {
  const settingsOps = outbox.filter((o) => o.table === 'members' && o.kind === 'upsert')
  const settings = settingsOps.reduce((s, o) => ({ ...s, ...(o.row as Partial<Settings>) }), server.settings)
  return {
    visits: overlay(server.visits, outbox, 'visits', keyOf.visits),
    metrics: overlay(server.metrics, outbox, 'body_metrics', keyOf.body_metrics),
    signups: overlay(server.signups, outbox, 'class_signups', keyOf.class_signups),
    badges: overlay(server.badges, outbox, 'badges', keyOf.badges),
    settings,
  }
}

export const sortVisits = (v: Visit[]) =>
  [...v].sort((a, b) => b.visited_on.localeCompare(a.visited_on) || (b.visited_at ?? '').localeCompare(a.visited_at ?? ''))
export const sortMetrics = (m: Metric[]) => [...m].sort((a, b) => b.measured_on.localeCompare(a.measured_on))

/** Weight trend helper: newest value minus the oldest value in the last `days` days (null without 2 points). */
export function weightChange(metrics: Metric[], days: number, now: Date): number | null {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
  const f = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
  const pts = sortMetrics(metrics).filter((m) => m.weight_kg != null && m.measured_on >= f)
  if (pts.length < 2) return null
  return +(pts[0].weight_kg! - pts[pts.length - 1].weight_kg!).toFixed(1)
}
