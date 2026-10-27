// Run with: node tests/unit/classInfo.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
import { readFileSync } from 'node:fs'
const R = ROOT.replace(/\/$/, '')
const lib = await import(R + '/src/lib/classInfo.ts')
const { parseCategoryPage, decode, text } = await import(R + '/scripts/classinfo-parse.mjs')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
// parser basics (the saved-page fixtures lived in an old session scratchpad; the parser's
// layout-change guard and decoding stay covered without them)
ok('decode()', decode('A &amp; B &#39;x&#39; &lt;') === "A & B 'x' <" && text('a<br>b  <b>c</b>') === 'a\nb c')
let threw = false; try { parseCategoryPage('<html></html>') } catch { threw = true }; ok('layout change throws instead of writing junk', threw)
// lookup against the generated file
const data = JSON.parse(readFileSync(R + '/src/data/classInfo.json', 'utf8'))
const tt = JSON.parse(readFileSync(R + '/src/data/timetable.json', 'utf8'))
ok('28 classes, 3 categories', Object.keys(data.classes).length === 28 && Object.keys(data.categories).length === 3)
ok('lookup by package id', lib.classInfoFor(data, { packageId: 12 })?.cls.name === 'Yoga all Level' && lib.classInfoFor(data, { packageId: 12 })?.category?.name === 'Flexibility')
ok('lookup by name fallback (Lesmills vs Les Mills)', lib.classInfoFor(data, { kelas: 'Les Mills Body Combat' })?.cls.id === 2 && lib.classInfoFor(data, { kelas: 'LESMILLS BODY PUMP' }) !== null)
ok('unknown -> null', lib.classInfoFor(data, { packageId: 999, kelas: 'Nonexistent' }) === null && lib.classInfoFor(data, {}) === null)
ok('id wins over a wrong name', lib.classInfoFor(data, { packageId: 10, kelas: 'Zumba' })?.cls.name === 'Boxing')
const unresolved = tt.slots.filter((s: any) => !lib.classInfoFor(data, { packageId: s.packageId, kelas: s.kelas }))
ok('every timetable slot resolves to class info', unresolved.length === 0, unresolved.length + ' unresolved')
ok('two 19:00 yoga slots resolve to different descriptions', (() => { const y = tt.slots.filter((s: any) => s.wd === 3 && s.start === '19:00').map((s: any) => lib.classInfoFor(data, { packageId: s.packageId, kelas: s.kelas })!.cls.description); return y.length === 2 && y[0] !== y[1] && y.every(Boolean) })())
