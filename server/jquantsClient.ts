import type { SlidingWindowLimiter } from './rateLimiter.ts'

export type UpstreamErrorKind =
  | 'invalid_key'
  | 'forbidden'
  | 'out_of_range'
  | 'bad_request'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'bad_response'

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind
  readonly status: number | null
  /** Message returned by J-Quants (never contains the API key). */
  readonly detail: string

  constructor(kind: UpstreamErrorKind, status: number | null, detail: string) {
    super(`J-Quants upstream error: ${kind}`)
    this.name = 'UpstreamError'
    this.kind = kind
    this.status = status
    this.detail = detail
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type FetchAllOptions = {
  apiBase: string
  apiKey: string
  path: string
  params: Record<string, string>
  limiter: SlidingWindowLimiter
  maxWaitMs: number
  fetchImpl: FetchLike
  timeoutMs?: number
  maxPages?: number
}

const DATE_IN_TEXT = /\d{4}-\d{2}-\d{2}/g

/** Extracts YYYY-MM-DD dates from a J-Quants message, e.g. a subscription-range notice. */
export function datesInMessage(message: string): string[] {
  return message.match(DATE_IN_TEXT) ?? []
}

export function classifyError(status: number, message: string): UpstreamError {
  const detail = message.slice(0, 300)
  if (status === 401 || (status === 403 && /invalid or expired/i.test(message))) {
    return new UpstreamError('invalid_key', status, detail)
  }
  if (status === 403) return new UpstreamError('forbidden', status, detail)
  if (status === 400) {
    return new UpstreamError(
      datesInMessage(message).length > 0 ? 'out_of_range' : 'bad_request',
      status,
      detail,
    )
  }
  if (status === 429) return new UpstreamError('rate_limited', status, detail)
  if (status >= 500) return new UpstreamError('server', status, detail)
  return new UpstreamError('bad_response', status, detail)
}

/**
 * Calls a J-Quants V2 endpoint and follows `pagination_key` until every page
 * is fetched. Each page waits for its own rate-limit slot.
 */
export async function fetchAllPages(options: FetchAllOptions): Promise<unknown[]> {
  const { apiBase, apiKey, path, params, limiter, maxWaitMs, fetchImpl } = options
  const timeoutMs = options.timeoutMs ?? 30_000
  const maxPages = options.maxPages ?? 50
  const rows: unknown[] = []
  let paginationKey: string | undefined

  for (let page = 0; page < maxPages; page++) {
    await limiter.acquire(maxWaitMs)

    const url = new URL(path, apiBase)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    if (paginationKey !== undefined) url.searchParams.set('pagination_key', paginationKey)

    let response: Response
    try {
      response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { 'x-api-key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new UpstreamError('timeout', null, '')
      }
      throw new UpstreamError('network', null, '')
    }

    const text = await response.text()
    let body: unknown = null
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text)
      } catch {
        body = null
      }
    }
    const record =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}

    if (!response.ok) {
      const message = typeof record.message === 'string' ? record.message : ''
      throw classifyError(response.status, message)
    }

    const data = record.data
    if (!Array.isArray(data)) {
      // 210 "No Content (Partial)" and empty bodies mean "no data", not a failure.
      if (response.status === 210 || text.trim() === '') return rows
      throw new UpstreamError('bad_response', response.status, 'response has no data array')
    }
    rows.push(...data)

    const next = record.pagination_key
    paginationKey = typeof next === 'string' && next !== '' ? next : undefined
    if (paginationKey === undefined) return rows
  }
  throw new UpstreamError('bad_response', null, 'too many pages')
}
