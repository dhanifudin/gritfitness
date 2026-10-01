// Run with: node tests/unit/trackerData.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const d = await import(ROOT + 'src/lib/trackerData.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const up = (key: string, row: any, table: any = 'visits') => ({ table, kind: 'upsert' as const, key, row })
const del = (key: string, table: any = 'visits') => ({ table, kind: 'delete' as const, key })

let q = d.enqueue([], up('a', { note: 'x' }))
q = d.enqueue(q, up('b', { note: 'y' }))
q = d.enqueue(q, up('a', { energy: 4 }))
ok('upsert on the same row merges columns and keeps order (b before a)', q.length === 2 && q[0].key === 'b' && q[1].key === 'a' && q[1].row.note === 'x' && q[1].row.energy === 4)
q = d.enqueue(q, del('a')); ok('delete after upsert replaces it', q.length === 2 && q[1].kind === 'delete' && !q[1].row)
q = d.enqueue(q, up('a', { note: 'again' })); ok('upsert after delete = fresh upsert (no stale columns)', q[1].kind === 'upsert' && q[1].row.note === 'again' && q[1].row.energy === undefined)
ok('same key in a different table is a different row', d.enqueue([up('a', {}, 'visits')], up('a', {}, 'body_metrics')).length === 2)
ok('input outbox is not mutated', (() => { const o = [up('a', {})]; d.enqueue(o, up('a', { z: 1 })); return o.length === 1 && o[0].row.z === undefined })())

const V = (id: string, day: string, extra = {}) => ({ client_id: id, visited_on: day, source: 'checkin' as const, ...extra })
const server = { visits: [V('s1', '2026-09-30'), V('s2', '2026-09-29')], metrics: [{ measured_on: '2026-09-01', weight_kg: 80 }], signups: [], badges: [], settings: { goal_per_week: 3 } }
let m = d.mergeServer(server, [up('n1', V('n1', '2026-10-01'))])
ok('pending new visit appears once on top of server rows', m.visits.length === 3 && m.visits.filter((v: any) => v.client_id === 'n1').length === 1)
m = d.mergeServer(server, [up('s1', { note: 'edited' })])
ok('pending edit overlays the server row (columns merged)', m.visits.find((v: any) => v.client_id === 's1').note === 'edited' && m.visits.find((v: any) => v.client_id === 's1').visited_on === '2026-09-30')
m = d.mergeServer(server, [del('s2')]); ok('pending delete hides the server row', m.visits.length === 1 && m.visits[0].client_id === 's1')
m = d.mergeServer(server, []); ok('empty outbox = server data', m.visits.length === 2 && m.metrics.length === 1)
m = d.mergeServer(server, [up('2026-09-01', { weight_kg: 79.5 }, 'body_metrics')])
ok('metric overlay by date', m.metrics.length === 1 && m.metrics[0].weight_kg === 79.5)
m = d.mergeServer(server, [up('me', { goal_per_week: 5 }, 'members')]); ok('pending settings win', m.settings.goal_per_week === 5)
ok('conflict targets include member_id', Object.values(d.CONFLICT).every((c: any) => c.startsWith('member_id')))
ok('sortVisits newest first', d.sortVisits([V('a', '2026-09-01'), V('b', '2026-09-30')])[0].client_id === 'b')
const NOW = new Date(2026, 9, 1)
const mm = [{ measured_on: '2026-08-05', weight_kg: 82 }, { measured_on: '2026-09-10', weight_kg: 80 }, { measured_on: '2026-09-30', weight_kg: 79.2, waist_cm: 90 }, { measured_on: '2026-09-30x', waist_cm: 1 }]
ok('weightChange over 30 days = newest - oldest in range', d.weightChange(mm.slice(0, 3), 30, NOW) === -0.8, String(d.weightChange(mm.slice(0, 3), 30, NOW)))
ok('weightChange null with fewer than 2 weights', d.weightChange(mm.slice(2, 3), 30, NOW) === null)
