// Run with: node tests/unit/format.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const f = await import(ROOT + '/src/lib/format.ts')
const ok = (n: string, v: boolean, x = '') => {
  if (!v) process.exitCode = 1
  console.log((v ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
ok('shouted name', f.titleCase('BODY PUMP') === 'Body Pump', f.titleCase('BODY PUMP'))
ok('long shouted name', f.titleCase('STRENGTH TRAINING FOR SENIOR') === 'Strength Training for Senior', f.titleCase('STRENGTH TRAINING FOR SENIOR'))
ok('already cased stays sane', f.titleCase('Lesmills Body Pump') === 'Lesmills Body Pump')
ok('ampersand kept', f.titleCase('STRENGTH & CONDITIONING') === 'Strength & Conditioning', f.titleCase('STRENGTH & CONDITIONING'))
ok('short acronyms kept', f.titleCase('PT SESSION') === 'PT Session')
ok('connector not capitalised mid-name', f.titleCase('yoga all level') === 'Yoga all Level', f.titleCase('yoga all level'))
ok('leading connector still capitalised', f.titleCase('all out hiit')[0] === 'A')
ok('empty/null -> empty', f.titleCase('') === '' && f.titleCase(null) === '' && f.titleCase(undefined) === '')
