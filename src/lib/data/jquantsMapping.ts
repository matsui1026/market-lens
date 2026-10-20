import type { Bar, FinancialStatement, Listing } from './types'

/**
 * The only place that knows J-Quants V2 field names.
 * Spec: https://jpx-jquants.com/ja/spec (equities/master, equities/bars/daily, fins/summary)
 */

type Raw = Record<string, unknown>

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Numbers may arrive as numbers (bars) or strings (fins). Null, '' and non-finite become null. */
export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** J-Quants returns 5-digit codes ("72030"); people use 4 characters ("7203"). */
export function displayCode(code: string): string {
  return code.length === 5 && code.endsWith('0') ? code.slice(0, 4) : code
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mapListings(rows: unknown[]): Listing[] {
  const byCode = new Map<string, Listing>()
  for (const row of rows) {
    if (!isRecord(row)) continue
    const code = str(row.Code)
    const name = str(row.CoName)
    if (code === '' || name === '') continue
    const listing: Listing = {
      code: displayCode(code),
      name,
      nameEn: str(row.CoNameEn),
      sector17: str(row.S17Nm),
      sector33: str(row.S33Nm),
      market: str(row.MktNm),
      scale: str(row.ScaleCat),
    }
    // Ordinary shares ("xxxx0") win over other share classes with the same display code.
    if (!byCode.has(listing.code) || code.endsWith('0')) byCode.set(listing.code, listing)
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export function mapBars(rows: unknown[]): Bar[] {
  const bars: Bar[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    const date = str(row.Date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    bars.push({
      date,
      open: num(row.AdjO),
      high: num(row.AdjH),
      low: num(row.AdjL),
      close: num(row.AdjC),
      volume: num(row.AdjVo),
      turnover: num(row.Va),
    })
  }
  bars.sort((a, b) => a.date.localeCompare(b.date))
  // Drop duplicate dates (keep the last occurrence).
  return bars.filter((bar, i) => bars[i + 1]?.date !== bar.date)
}

export function mapFinancials(rows: unknown[]): FinancialStatement[] {
  const out: FinancialStatement[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    const date = str(row.DiscDate)
    if (date === '') continue
    const time = str(row.DiscTime)
    out.push({
      disclosedAt: time === '' ? date : `${date}T${time}`,
      fiscalYearStart: str(row.CurFYSt),
      fiscalYearEnd: str(row.CurFYEn),
      periodType: str(row.CurPerType),
      docType: str(row.DocType),
      sales: num(row.Sales),
      operatingProfit: num(row.OP),
      netProfit: num(row.NP),
      eps: num(row.EPS),
      roe: num(row.ROE),
      equityRatio: num(row.EqAR),
      totalAssets: num(row.TA),
      equity: num(row.Eq),
    })
  }
  return out.sort((a, b) => a.disclosedAt.localeCompare(b.disclosedAt))
}

/**
 * Full-year results only (annual earnings reports), one per fiscal year:
 * the latest disclosure wins so that corrections replace the original.
 */
export function annualResults(statements: FinancialStatement[]): FinancialStatement[] {
  const byYear = new Map<string, FinancialStatement>()
  for (const s of statements) {
    if (s.periodType !== 'FY' || !s.docType.includes('FYFinancialStatements')) continue
    if (s.fiscalYearEnd === '') continue
    const prev = byYear.get(s.fiscalYearEnd)
    if (prev === undefined || prev.disclosedAt <= s.disclosedAt) byYear.set(s.fiscalYearEnd, s)
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd))
}
