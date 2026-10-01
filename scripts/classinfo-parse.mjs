// Parsers for the public https://gritfitness.id/kelas pages (server-rendered HTML).
// Kept separate from the build script so they can be tested against saved pages.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/** Plain text from an HTML fragment: <br> becomes a newline, tags are stripped, whitespace collapsed. */
export function text(html) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Category links on /kelas: [{ id, slug }] */
export function parseCategoryLinks(html) {
  const seen = new Map()
  for (const m of html.matchAll(/href="\/kelas\/(\d+)\/([a-z0-9-]+)"/g)) seen.set(m[1], { id: Number(m[1]), slug: m[2] })
  return [...seen.values()]
}

/** One category page: its title, tagline, header image and class cards. */
export function parseCategoryPage(html) {
  const title = html.match(/<h1[^>]*class="breadcumb-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1]
  const tagline = html.match(/<p[^>]*class="breadcumb-menu"[^>]*>([\s\S]*?)<\/p>/)?.[1]
  const image = html.match(/class="breadcumb-wrapper"[^>]*data-bg-src="([^"]+)"/)?.[1] ?? null
  if (!title) throw new Error('category title not found (page layout changed?)')

  const classes = []
  for (const chunk of html.split('class="class-card2"').slice(1)) {
    const link = chunk.match(/href="\/kelas\/detail\/(\d+)\/([^"]+)"/)
    const hover = chunk.match(/class-card_hover-content"[^>]*>\s*<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>\s*<p[^>]*class="class-card_text"[^>]*>([\s\S]*?)<\/p>/)
    if (!link || !hover) throw new Error('unrecognised class card layout')
    classes.push({
      id: Number(link[1]),
      slug: link[2],
      name: text(hover[1]),
      description: text(hover[2]),
      minutes: Number(chunk.match(/overlay-text">\s*(\d+)\s*Min/i)?.[1] ?? 0) || null,
      photo: chunk.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null,
    })
  }
  return { title: text(title), tagline: text(tagline ?? ''), image, classes }
}
