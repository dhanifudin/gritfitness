// Join between schedule rows / timetable slots and the class descriptions scraped from
// https://gritfitness.id/kelas (src/data/classInfo.json, built by scripts/build-class-info.mjs).
// Pure functions: the data is passed in so they can be tested with plain Node.

export interface ClassCategory {
  name: string
  tagline: string
  image: string | null
}
export interface ClassInfo {
  id: number
  name: string
  categoryId: number | string
  minutes: number | null
  description: string
  photo: string | null
}
export interface ClassInfoData {
  generatedAt: string
  source: string
  categories: Record<string, ClassCategory>
  classes: Record<string, ClassInfo>
}
export interface ClassQuery {
  packageId?: number | null
  kelas?: string | null
}
export interface ClassMatch {
  cls: ClassInfo
  category: ClassCategory | null
}

/** "Les Mills Body Pump" and "Lesmills Body Pump" are the same class; compare without spacing/punctuation noise. */
export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/les\s*mills/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** By package id first (exact), then by normalized class name; null when unknown. */
export function classInfoFor(data: ClassInfoData, q: ClassQuery): ClassMatch | null {
  let cls: ClassInfo | undefined = q.packageId != null ? data.classes[String(q.packageId)] : undefined
  if (!cls && q.kelas) {
    const want = normalizeName(q.kelas)
    cls = Object.values(data.classes).find((c) => normalizeName(c.name) === want)
  }
  if (!cls) return null
  return { cls, category: data.categories[String(cls.categoryId)] ?? null }
}
