// Display formatting helpers. Pure and framework-free (shared with the Edge Functions).

const SMALL = new Set(['dan', 'di', 'for', 'of', 'the', 'all'])

/** The gym API shouts class names ("BODY PUMP"); show them title-cased. Short all-caps words (PT, TRX)
 *  and connector words stay as they are. */
export function titleCase(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .split(' ')
    .map((w, i) => {
      if (!/[a-zA-Z]/.test(w)) return w
      const lower = w.toLowerCase()
      if (i > 0 && SMALL.has(lower)) return lower
      if (w.length <= 3 && w === w.toUpperCase()) return w
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}
