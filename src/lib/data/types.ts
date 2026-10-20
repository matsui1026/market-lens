export type Listing = {
  /** 4-character display code (e.g. "7203", "130A", "DM01"). */
  code: string
  name: string
  nameEn: string
  sector17: string
  sector33: string
  market: string
  scale: string
}

/** One trading day. Prices and volume are split-adjusted; turnover is not adjusted. */
export type Bar = {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  turnover: number | null
}

export type FinancialStatement = {
  disclosedAt: string
  fiscalYearStart: string
  fiscalYearEnd: string
  periodType: string
  docType: string
  sales: number | null
  operatingProfit: number | null
  netProfit: number | null
  eps: number | null
  roe: number | null
  equityRatio: number | null
  totalAssets: number | null
  equity: number | null
}

export type SourceKind = 'demo' | 'jquants'

export type Loaded<T> = {
  data: T
  /** ISO timestamp of when the data was fetched from its origin. */
  fetchedAt: string
  /** 'cache' when served from the local disk cache. */
  origin: 'cache' | 'api' | 'demo'
}

export interface DataSource {
  readonly kind: SourceKind
  listings(): Promise<Loaded<Listing[]>>
  bars(code: string, options?: { refresh?: boolean }): Promise<Loaded<Bar[]>>
  financials(code: string, options?: { refresh?: boolean }): Promise<Loaded<FinancialStatement[]>>
}

export type AppErrorKind =
  | 'not_configured'
  | 'invalid_key'
  | 'forbidden'
  | 'out_of_range'
  | 'bad_request'
  | 'invalid_code'
  | 'rate_limited'
  | 'queue_timeout'
  | 'server'
  | 'network'
  | 'timeout'
  | 'bad_response'
  | 'local_server_down'
  | 'not_found'
  | 'unknown'

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly detail: string
  readonly retryAfterSec: number | null

  constructor(kind: AppErrorKind, detail = '', retryAfterSec: number | null = null) {
    super(kind)
    this.name = 'AppError'
    this.kind = kind
    this.detail = detail
    this.retryAfterSec = retryAfterSec
  }
}
