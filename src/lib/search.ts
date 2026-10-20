import type { Listing } from './data/types'

/** Full-width → half-width (NFKC), lower case, katakana → hiragana, no spaces. */
export function normalizeQuery(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '')
}

type Indexed = { listing: Listing; code: string; name: string; nameEn: string }

const indexCache = new WeakMap<Listing[], Indexed[]>()

function indexOf(listings: Listing[]): Indexed[] {
  let index = indexCache.get(listings)
  if (index === undefined) {
    index = listings.map((listing) => ({
      listing,
      code: normalizeQuery(listing.code),
      name: normalizeQuery(listing.name),
      nameEn: normalizeQuery(listing.nameEn),
    }))
    indexCache.set(listings, index)
  }
  return index
}

/**
 * Ranks: exact code > code prefix > name prefix > name contains > English name contains.
 * Ties keep code order.
 */
export function searchListings(listings: Listing[], query: string, limit = 8): Listing[] {
  const q = normalizeQuery(query)
  if (q === '') return []
  const scored: Array<{ listing: Listing; score: number }> = []
  for (const item of indexOf(listings)) {
    let score = -1
    if (item.code === q) score = 0
    else if (item.code.startsWith(q)) score = 1
    else if (item.name.startsWith(q)) score = 2
    else if (item.name.includes(q)) score = 3
    else if (item.nameEn.includes(q)) score = 4
    if (score >= 0) scored.push({ listing: item.listing, score })
  }
  scored.sort((a, b) => a.score - b.score || a.listing.code.localeCompare(b.listing.code))
  return scored.slice(0, limit).map((s) => s.listing)
}

/** Finds a listing by a code typed by the user ("7203", "72030", "７２０３"). */
export function findByCode(listings: Listing[], code: string): Listing | undefined {
  const q = normalizeQuery(code).toUpperCase()
  const short = q.length === 5 && q.endsWith('0') ? q.slice(0, 4) : q
  return listings.find((l) => l.code.toUpperCase() === short || l.code.toUpperCase() === q)
}
