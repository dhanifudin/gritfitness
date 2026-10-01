#!/usr/bin/env node
// Builds src/data/classInfo.json from the public class pages (no login needed):
//
//   npm run gen:classinfo
//
// https://gritfitness.id/kelas lists the categories; every category page has a card per class with its
// full description, duration and photo. The id in each card's link (/kelas/detail/<id>/<slug>) is the class
// package id (id_paket_kelas) that schedule rows and timetable slots carry, so the app joins on it.
import { writeFileSync } from 'node:fs'
import { parseCategoryLinks, parseCategoryPage } from './classinfo-parse.mjs'

const SITE = process.env.GRIT_SITE ?? 'https://gritfitness.id'
const OUT = new URL('../src/data/classInfo.json', import.meta.url)

const page = async (path) => {
  const res = await fetch(SITE + path, { headers: { 'User-Agent': 'Mozilla/5.0 (gritfitness-pwa build script)' } })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.text()
}

const links = parseCategoryLinks(await page('/kelas'))
if (!links.length) throw new Error('no category links found on /kelas (page layout changed?)')

const categories = {}
const classes = {}
for (const { id, slug } of links) {
  const cat = parseCategoryPage(await page(`/kelas/${id}/${slug}`))
  categories[id] = { name: cat.title, tagline: cat.tagline, image: cat.image }
  for (const c of cat.classes) {
    const photo = c.photo && !/\/assets\/media\/default/.test(c.photo) ? c.photo : null // the site's placeholder image is not a photo
    classes[c.id] = { id: c.id, name: c.name, categoryId: id, minutes: c.minutes, description: c.description, photo }
  }
}

const total = Object.keys(classes).length
if (total < 20) throw new Error(`only ${total} classes parsed; refusing to overwrite classInfo.json`)

const out = { generatedAt: new Date().toISOString().slice(0, 10), source: `${SITE}/kelas`, categories, classes }
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

const empty = Object.values(classes).filter((c) => !c.description)
console.log(`wrote ${Object.keys(categories).length} categories and ${total} classes to src/data/classInfo.json`)
for (const [id, c] of Object.entries(categories)) console.log(`  ${id} ${c.name}: ${Object.values(classes).filter((x) => String(x.categoryId) === id).length} classes`)
if (empty.length) console.log(`no description on the site for: ${empty.map((c) => `${c.name} (#${c.id})`).join(', ')}`)
