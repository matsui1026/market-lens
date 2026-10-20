import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { readLocalConfig } from './config.ts'
import { DiskCache } from './diskCache.ts'
import { datesInMessage, fetchAllPages, UpstreamError, type FetchLike } from './jquantsClient.ts'
import { QueueTimeoutError, realClock, SlidingWindowLimiter, type Clock } from './rateLimiter.ts'

export type LocalApiOptions = {
  root: string
  cacheDir?: string
  fetchImpl?: FetchLike
  clock?: Clock
  maxWaitMs?: number
  log?: (message: string) => void
}

type Next = (error?: unknown) => void

/** A window slightly longer than one minute keeps us safely under J-Quants' sliding window. */
const WINDOW_MS = 61_000
/** `/v2/fins/summary` has its own 60/min limit on every plan. */
const FINS_RATE_PER_MIN = 60
/** J-Quants recommends waiting about two minutes after a 429. */
const RATE_LIMIT_PENALTY_MS = 120_000

const TTL = {
  listings: 12 * 60 * 60 * 1000,
  bars: 6 * 60 * 60 * 1000,
  fins: 6 * 60 * 60 * 1000,
} as const

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i
const LOOPBACK_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i
/** Stock codes are 4 characters (e.g. 7203, 130A), optionally followed by a check digit. */
const STOCK_CODE = /^[0-9][0-9A-Z]{3}[0-9]?$/

type Route = 'listings' | 'bars' | 'fins'

const ROUTES: Record<Route, { path: string; bucket: 'plan' | 'fins' }> = {
  listings: { path: '/v2/equities/master', bucket: 'plan' },
  bars: { path: '/v2/equities/bars/daily', bucket: 'plan' },
  fins: { path: '/v2/fins/summary', bucket: 'fins' },
}

export type ErrorBody = { error: string; detail?: string; retryAfterSec?: number }

/** Rejects anything that is not a same-origin request to a loopback address. */
export function checkRequestOrigin(req: IncomingMessage): string | null {
  const host = req.headers.host ?? ''
  if (!LOOPBACK_HOST.test(host)) return 'host'
  const origin = req.headers.origin
  if (origin !== undefined && !LOOPBACK_ORIGIN.test(origin)) return 'origin'
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return 'sec-fetch-site'
  return null
}

export function normalizeCode(raw: string | null): string | null {
  if (raw === null) return null
  const code = raw.trim().toUpperCase()
  return STOCK_CODE.test(code) ? code : null
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value)
  res.end(payload)
}

const STATUS_BY_KIND: Record<UpstreamError['kind'], number> = {
  invalid_key: 401,
  forbidden: 403,
  out_of_range: 400,
  bad_request: 400,
  rate_limited: 429,
  server: 502,
  network: 502,
  timeout: 504,
  bad_response: 502,
}

export function createLocalApiHandler(options: LocalApiOptions) {
  const clock = options.clock ?? realClock
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const maxWaitMs = options.maxWaitMs ?? 130_000
  const log = options.log ?? ((message: string) => console.info(`[market-lens] ${message}`))
  const cache = new DiskCache(options.cacheDir ?? join(options.root, '.cache', 'jquants'), () =>
    clock.now(),
  )
  const limiters = {
    plan: new SlidingWindowLimiter(5, WINDOW_MS, clock),
    fins: new SlidingWindowLimiter(FINS_RATE_PER_MIN, WINDOW_MS, clock),
  }
  const inFlight = new Map<string, Promise<{ data: unknown[]; savedAt: number; source: string }>>()

  async function load(
    route: Route,
    params: Record<string, string>,
    apiKey: string,
    apiBase: string,
    refresh: boolean,
  ): Promise<{ data: unknown[]; savedAt: number; source: string }> {
    const keyId = createHash('sha256').update(apiKey).digest('hex').slice(0, 16)
    const cacheKey = JSON.stringify({ v: 1, route, params, apiBase, keyId })

    if (!refresh) {
      const hit = await cache.get<unknown[]>(cacheKey, TTL[route])
      if (hit !== null) return { data: hit.value, savedAt: hit.savedAt, source: 'cache' }
    }

    const pending = inFlight.get(cacheKey)
    if (pending !== undefined) return pending

    const task = (async () => {
      const { path, bucket } = ROUTES[route]
      const limiter = limiters[bucket]
      const call = (query: Record<string, string>) =>
        fetchAllPages({ apiBase, apiKey, path, params: query, limiter, maxWaitMs, fetchImpl })

      let data: unknown[]
      try {
        data = await call(params)
      } catch (error) {
        // Free plan: "today" is outside the plan's range for the listing master.
        // J-Quants answers 400 with the allowed range, so retry at its latest date.
        if (
          route === 'listings' &&
          error instanceof UpstreamError &&
          error.kind === 'out_of_range' &&
          params.date === undefined
        ) {
          const latest = datesInMessage(error.detail).sort().at(-1)
          if (latest === undefined) throw error
          data = await call({ ...params, date: latest })
        } else {
          throw error
        }
      }
      await cache.set(cacheKey, data)
      return { data, savedAt: clock.now(), source: 'api' }
    })()

    inFlight.set(cacheKey, task)
    try {
      return await task
    } finally {
      inFlight.delete(cacheKey)
    }
  }

  return function localApi(req: IncomingMessage, res: ServerResponse, next: Next): void {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (!url.pathname.startsWith('/api/')) {
      next()
      return
    }

    const blocked = checkRequestOrigin(req)
    if (blocked !== null) {
      log(`blocked request (${blocked})`)
      sendJson(res, 403, { error: 'forbidden_origin' } satisfies ErrorBody)
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' } satisfies ErrorBody, { Allow: 'GET' })
      return
    }

    const config = readLocalConfig(options.root)
    limiters.plan.setLimit(config.ratePerMin)

    if (url.pathname === '/api/status') {
      sendJson(res, 200, {
        mode: 'local',
        apiKeyConfigured: config.apiKey !== null,
        ratePerMin: config.ratePerMin,
        waitSec: limiters.plan.secondsUntilFree(),
      })
      return
    }

    const match = /^\/api\/jquants\/(listings|bars|fins)$/.exec(url.pathname)
    if (match === null) {
      sendJson(res, 404, { error: 'not_found' } satisfies ErrorBody)
      return
    }
    const route = match[1] as Route

    if (config.apiKey === null) {
      sendJson(res, 503, { error: 'not_configured' } satisfies ErrorBody)
      return
    }

    const params: Record<string, string> = {}
    if (route !== 'listings') {
      const code = normalizeCode(url.searchParams.get('code'))
      if (code === null) {
        sendJson(res, 400, { error: 'invalid_code' } satisfies ErrorBody)
        return
      }
      params.code = code
    }
    const refresh = url.searchParams.get('refresh') === '1'
    const started = clock.now()

    load(route, params, config.apiKey, config.apiBase, refresh).then(
      (result) => {
        const label = params.code === undefined ? route : `${route} code=${params.code}`
        log(`${label} -> ${result.source} (${result.data.length} rows, ${clock.now() - started}ms)`)
        sendJson(res, 200, {
          data: result.data,
          fetchedAt: new Date(result.savedAt).toISOString(),
          source: result.source,
        })
      },
      (error: unknown) => {
        if (error instanceof QueueTimeoutError) {
          sendJson(res, 429, {
            error: 'queue_timeout',
            retryAfterSec: error.retryAfterSec,
          } satisfies ErrorBody)
          return
        }
        if (error instanceof UpstreamError) {
          if (error.kind === 'rate_limited') {
            limiters[ROUTES[route].bucket].penalize(RATE_LIMIT_PENALTY_MS)
          }
          log(`${route} -> upstream error ${error.kind} (${error.status ?? 'no status'})`)
          const body: ErrorBody = { error: error.kind }
          if (error.detail !== '') body.detail = error.detail
          if (error.kind === 'rate_limited') body.retryAfterSec = RATE_LIMIT_PENALTY_MS / 1000
          sendJson(res, STATUS_BY_KIND[error.kind], body)
          return
        }
        log(`${route} -> internal error`)
        sendJson(res, 500, { error: 'internal' } satisfies ErrorBody)
      },
    )
  }
}
