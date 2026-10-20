/** ASCII hyphen-minus: U+2212 renders full-width in Japanese fonts. */
const MINUS = '-'

const integer = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const twoDecimals = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const DASH = '—'

function signed(text: string, value: number, showPlus: boolean): string {
  if (value < 0) return `${MINUS}${text}`
  if (value > 0 && showPlus) return `+${text}`
  return text
}

/** 0.1234 → "+12.3%". */
export function formatPercent(
  value: number | null,
  options: { signed?: boolean; digits?: 1 | 2 } = {},
): string {
  if (value === null || !Number.isFinite(value)) return DASH
  const pct = value * 100
  const fmt = options.digits === 2 ? twoDecimals : oneDecimal
  const text = `${fmt.format(Math.abs(pct))}%`
  // Avoid "−0.0%" for values that round to zero.
  const rounded = Number(fmt.format(Math.abs(pct)).replace(/,/g, ''))
  return signed(text, rounded === 0 ? 0 : pct, options.signed ?? false)
}

/** Stock price in yen; adjusted prices may have one decimal place. */
export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH
  const text = Number.isInteger(value)
    ? integer.format(Math.abs(value))
    : oneDecimal.format(Math.abs(value))
  return signed(`${text}円`, value, false)
}

/** Large yen amounts: 兆円 / 億円 / 百万円 / 円. */
export function formatYenLarge(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH
  const abs = Math.abs(value)
  let text: string
  if (abs >= 1e12) text = `${twoDecimals.format(abs / 1e12)}兆円`
  else if (abs >= 1e10) text = `${integer.format(abs / 1e8)}億円`
  else if (abs >= 1e8) text = `${oneDecimal.format(abs / 1e8)}億円`
  else if (abs >= 1e6) text = `${integer.format(abs / 1e6)}百万円`
  else text = `${integer.format(abs)}円`
  return signed(text, value, false)
}

/** Share volume: 億株 / 万株 / 株. */
export function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH
  if (value >= 1e8) return `${twoDecimals.format(value / 1e8)}億株`
  if (value >= 1e4) return `${integer.format(value / 1e4)}万株`
  return `${integer.format(value)}株`
}

export function formatNumber(value: number | null, digits: 0 | 1 | 2 = 0): string {
  if (value === null || !Number.isFinite(value)) return DASH
  const fmt = digits === 2 ? twoDecimals : digits === 1 ? oneDecimal : integer
  return signed(fmt.format(Math.abs(value)), value, false)
}

/** "2026-07-24" → "2026/07/24". */
export function formatDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return DASH
  return iso.slice(0, 10).replaceAll('-', '/')
}

/** "2026-03-31" → "2026年3月期". */
export function fiscalYearLabel(fiscalYearEnd: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(fiscalYearEnd)
  if (match === null) return fiscalYearEnd
  return `${match[1]}年${Number(match[2])}月期`
}

/** Compact axis labels: 1.2兆, 3,400億, 5,000万. */
export function formatAxisYen(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? MINUS : ''
  if (abs >= 1e12) return `${sign}${oneDecimal.format(abs / 1e12)}兆`
  if (abs >= 1e8) return `${sign}${integer.format(abs / 1e8)}億`
  if (abs >= 1e4) return `${sign}${integer.format(abs / 1e4)}万`
  return `${sign}${integer.format(abs)}`
}
