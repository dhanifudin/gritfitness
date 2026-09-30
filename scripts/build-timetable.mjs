#!/usr/bin/env node
// Builds src/data/timetable.json: the gym's recurring weekly class timetable, inferred from past schedules.
//
//   GRIT_TOKEN=<member bearer token> node scripts/build-timetable.mjs [--max-id 1136]
//
// The API only lists today's classes, but GET /jadwal-kelas/detail/:id returns any existing row by id,
// so history can be read. A slot (weekday + start time + class) is kept when it appeared in at least
// MIN_WEEKS of the last WEEKS complete Mon–Sun weeks. The result is backtested against the newest
// complete week (template built from the WEEKS weeks before it) and the score is printed.
import { writeFileSync } from 'node:fs'

const API = process.env.GRIT_API ?? 'https://gritfitness.id/api'
const TOKEN = process.env.GRIT_TOKEN
const WEEKS = 4
const MIN_WEEKS = 2
const OUT = new URL('../src/data/timetable.json', import.meta.url)

if (!TOKEN) {
  console.error('Set GRIT_TOKEN to a member bearer token (log in via /verify-otp).')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }
const get = async (path) => {
  const res = await fetch(API + path, { headers })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, body }
}

const parseDate = (s) => {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const monday = (d) => addDays(d, -((d.getDay() + 6) % 7))
const weekday = (d) => (d.getDay() + 6) % 7 // Mon=0
const norm = (s) => (s ?? '').toLowerCase().replace(/lesmills/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// ---- find the newest id -------------------------------------------------------------------------
const argMax = process.argv.indexOf('--max-id')
let maxId = argMax > -1 ? Number(process.argv[argMax + 1]) : 0
if (!maxId) {
  const list = await get('/jadwal-kelas')
  if (!list.ok || !Array.isArray(list.body)) {
    console.error('Could not read /jadwal-kelas (', list.status, '). Token expired?')
    process.exit(1)
  }
  maxId = Math.max(0, ...list.body.map((r) => r.id))
  if (!maxId) {
    console.error('Today has no listed classes; pass --max-id <newest schedule id>.')
    process.exit(1)
  }
}

// ---- scan history downward -----------------------------------------------------------------------
const thisMonday = monday(new Date())
const cutoff = addDays(thisMonday, -7 * (WEEKS + 1)) // WEEKS template weeks + 1 backtest week
const rows = []
let id = maxId
let olderStreak = 0
const CONCURRENCY = 8
while (id > 0 && olderStreak < 40) {
  const batch = Array.from({ length: CONCURRENCY }, (_, i) => id - i).filter((n) => n > 0)
  id -= CONCURRENCY
  const res = await Promise.all(batch.map((n) => get(`/jadwal-kelas/detail/${n}`)))
  for (const r of res) {
    const d = r.body
    if (!r.ok || !d?.tanggal) continue
    const date = parseDate(d.tanggal)
    if (date < cutoff) olderStreak++
    else olderStreak = 0
    if (date >= cutoff && !d.dihapus_pada) rows.push({ date, ...d })
  }
}
console.log(`scanned down to id ${id + 1}, kept ${rows.length} active rows since ${cutoff.toISOString().slice(0, 10)}`)

// ---- build template ---------------------------------------------------------------------------------
const mode = (arr) => {
  const c = new Map()
  for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function template(firstMonday) {
  const weeks = Array.from({ length: WEEKS }, (_, k) => addDays(firstMonday, 7 * k))
  const groups = new Map() // key -> { rows, weeks:Set }
  for (const r of rows) {
    const w = weeks.findIndex((m) => r.date >= m && r.date < addDays(m, 7))
    if (w < 0) continue
    const key = `${weekday(r.date)}|${r.jam_awal}|${norm(r.nama_kelas)}`
    const g = groups.get(key) ?? { rows: [], weeks: new Set() }
    g.rows.push(r)
    g.weeks.add(w)
    groups.set(key, g)
  }
  const slots = []
  for (const g of groups.values()) {
    if (g.weeks.size < MIN_WEEKS) continue
    const latest = g.rows.reduce((a, b) => (b.date > a.date ? b : a))
    slots.push({
      wd: weekday(latest.date),
      start: latest.jam_awal,
      end: mode(g.rows.map((r) => r.jam_akhir)),
      name: latest.nama_jadwal_kelas,
      kelas: latest.nama_kelas,
      instructor: mode(g.rows.map((r) => r.instruktur).filter(Boolean)) ?? null,
      packageId: mode(g.rows.map((r) => r.id_paket_kelas)) ?? null,
      weeks: g.weeks.size,
    })
  }
  return slots.sort((a, b) => a.wd - b.wd || a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
}

const finalSlots = template(addDays(thisMonday, -7 * WEEKS))

// ---- backtest: template from the WEEKS weeks before the newest complete week vs that week --------------
const lastWeek = addDays(thisMonday, -7)
const pred = new Set(template(addDays(lastWeek, -7 * WEEKS)).map((s) => `${s.wd}|${s.start}|${norm(s.kelas)}`))
const actual = new Set(
  rows.filter((r) => r.date >= lastWeek && r.date < thisMonday).map((r) => `${weekday(r.date)}|${r.jam_awal}|${norm(r.nama_kelas)}`),
)
const hit = [...pred].filter((k) => actual.has(k)).length
const precision = pred.size ? hit / pred.size : 0
const recall = actual.size ? hit / actual.size : 0
console.log(`backtest vs week of ${lastWeek.toISOString().slice(0, 10)}: predicted ${pred.size}, actual ${actual.size}, hit ${hit}, precision ${precision.toFixed(2)}, recall ${recall.toFixed(2)}`)

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  weeksUsed: WEEKS,
  backtest: { precision: +precision.toFixed(2), recall: +recall.toFixed(2) },
  slots: finalSlots,
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

const NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
for (let wd = 0; wd < 7; wd++) {
  const s = finalSlots.filter((x) => x.wd === wd)
  console.log(`${NAMES[wd]} (${s.length}): ${s.map((x) => `${x.start} ${x.name}`).join(' | ') || '-'}`)
}
console.log(`wrote ${finalSlots.length} slots to src/data/timetable.json`)
