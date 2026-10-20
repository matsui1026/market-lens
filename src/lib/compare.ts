import {
  closes,
  correlation,
  logReturns,
  normalizeToHundred,
  sliceByPeriod,
  summarize,
  type PeriodId,
  type Summary,
} from './analytics'
import type { Bar } from './data/types'
import { normalizeQuery } from './search'

export const MAX_COMPARE = 4
const CODE_PATTERN = /^[0-9A-Z]{4}[0-9]?$/

/** Parses `codes=7203,6758` into unique, valid, upper-case codes (max 4). */
export function parseCodes(raw: string | null): string[] {
  if (raw === null) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const code = normalizeQuery(part).toUpperCase()
    if (CODE_PATTERN.test(code) && !out.includes(code)) out.push(code)
    if (out.length === MAX_COMPARE) break
  }
  return out
}

export type SlotEntry = { code: string; slot: number }

/**
 * Keeps each code's color slot when the list changes; new codes take the lowest
 * free slot. Color follows the stock, never its position in the list.
 */
export function reconcileSlots(previous: SlotEntry[], codes: string[]): SlotEntry[] {
  const kept = new Map(previous.filter((e) => codes.includes(e.code)).map((e) => [e.code, e.slot]))
  const used = new Set(kept.values())
  return codes.map((code) => {
    const existing = kept.get(code)
    if (existing !== undefined) return { code, slot: existing }
    let slot = 0
    while (used.has(slot)) slot++
    used.add(slot)
    return { code, slot }
  })
}

export type CompareInput = { code: string; bars: Bar[] }

export type CompareResult = {
  start: string | null
  end: string | null
  series: Array<{ code: string; values: Array<{ date: string; value: number }>; summary: Summary }>
  correlations: Array<Array<{ value: number; days: number } | null>>
}

/**
 * Aligns every stock to the dates they all have (so each line starts at 100 on
 * the same day), then computes per-stock metrics and pairwise correlations.
 */
export function compareStocks(inputs: CompareInput[], period: PeriodId): CompareResult {
  const lastDates = inputs
    .map((i) => i.bars.at(-1)?.date)
    .filter((d): d is string => d !== undefined)
  const globalLast = lastDates.sort().at(-1)
  const sliced = inputs.map((i) => ({
    code: i.code,
    bars: globalLast === undefined ? [] : sliceByPeriod(i.bars, period, globalLast),
  }))

  const firsts: string[] = []
  const lasts: string[] = []
  for (const s of sliced) {
    const points = closes(s.bars)
    const first = points[0]
    const last = points.at(-1)
    if (first !== undefined && last !== undefined) {
      firsts.push(first.date)
      lasts.push(last.date)
    }
  }
  const start =
    firsts.length === sliced.length && firsts.length > 0 ? (firsts.sort().at(-1) ?? null) : null
  const end = lasts.length === sliced.length && lasts.length > 0 ? (lasts.sort()[0] ?? null) : null
  const aligned = sliced.map((s) => ({
    code: s.code,
    bars:
      start === null || end === null || start > end
        ? []
        : s.bars.filter((b) => b.date >= start && b.date <= end),
  }))

  const returns = aligned.map((a) => logReturns(a.bars))
  const correlations = returns.map((ra, i) =>
    returns.map((rb, j) =>
      i === j ? (ra.size > 0 ? { value: 1, days: ra.size } : null) : correlation(ra, rb),
    ),
  )

  return {
    start: start !== null && end !== null && start <= end ? start : null,
    end: start !== null && end !== null && start <= end ? end : null,
    series: aligned.map((a) => ({
      code: a.code,
      values: normalizeToHundred(a.bars),
      summary: summarize(a.bars),
    })),
    correlations,
  }
}
