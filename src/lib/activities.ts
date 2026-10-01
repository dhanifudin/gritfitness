// Activity types a member can record. Pure data + helpers (no Vue, no I/O) so they can be unit-tested.
import type { ClassInfoData } from './classInfo'

export type Activity = 'gym' | 'class' | 'pt' | 'recovery' | 'other'

export interface ActivityMeta {
  key: Activity
  label: string
  emoji: string
  /** default for "counts toward the weekly goal" (workouts yes, recovery no) */
  counts: boolean
  hint: string
}

export const ACTIVITIES: ActivityMeta[] = [
  { key: 'gym', label: 'Gym', emoji: '🏋️', counts: true, hint: 'Alat, beban, kardio' },
  { key: 'class', label: 'Kelas', emoji: '🧘', counts: true, hint: 'Yoga, Zumba, Body Pump…' },
  { key: 'pt', label: 'Personal Trainer', emoji: '🤝', counts: true, hint: 'Sesi dengan pelatih' },
  { key: 'recovery', label: 'Pemulihan', emoji: '🛁', counts: false, hint: 'Peregangan, pijat, area pemulihan' },
  { key: 'other', label: 'Lainnya', emoji: '⭐', counts: true, hint: 'Hyrox, lari, renang… (tulis sendiri)' },
]

export const activityMeta = (k: string | null | undefined): ActivityMeta => ACTIVITIES.find((a) => a.key === k) ?? ACTIVITIES[0]
export const defaultCounts = (k: Activity) => activityMeta(k).counts

export interface ActivityFields {
  activity?: Activity | string | null
  activity_name?: string | null
  class_name?: string | null
}

/** Human label of one entry: the class name for classes, the custom name for "Lainnya", else the type label. */
export function activityLabel(v: ActivityFields): string {
  const a = v.activity ?? 'gym'
  if (a === 'class') return v.class_name || 'Kelas'
  if (a === 'other') return v.activity_name || 'Lainnya'
  return activityMeta(a).label
}

export interface ClassOption {
  id: number
  name: string
  minutes: number | null
}
export interface ClassGroup {
  category: string
  classes: ClassOption[]
}

/** The gym's classes grouped by category, for the class picker. */
export function classGroups(data: ClassInfoData): ClassGroup[] {
  const groups = new Map<string, ClassOption[]>()
  for (const c of Object.values(data.classes)) {
    const cat = data.categories[String(c.categoryId)]?.name ?? 'Lainnya'
    const list = groups.get(cat) ?? []
    list.push({ id: c.id, name: c.name, minutes: c.minutes })
    groups.set(cat, list)
  }
  return [...groups.entries()]
    .map(([category, classes]) => ({ category, classes: classes.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

/** Case-insensitive name search; empty query returns everything. */
export function searchClasses(groups: ClassGroup[], q: string): ClassGroup[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return groups
  return groups
    .map((g) => ({ ...g, classes: g.classes.filter((c) => c.name.toLowerCase().includes(needle)) }))
    .filter((g) => g.classes.length)
}
