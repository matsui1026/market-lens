import { mapBars, mapFinancials, mapListings } from './jquantsMapping'
import { AppError, type AppErrorKind, type DataSource } from './types'

const KNOWN_KINDS: ReadonlySet<string> = new Set<AppErrorKind>([
  'not_configured',
  'invalid_key',
  'forbidden',
  'out_of_range',
  'bad_request',
  'invalid_code',
  'rate_limited',
  'queue_timeout',
  'server',
  'network',
  'timeout',
  'bad_response',
  'not_found',
])

type ApiSuccess = { data: unknown[]; fetchedAt: string; source: 'cache' | 'api' }

export type LocalStatus = {
  mode: 'local'
  apiKeyConfigured: boolean
  ratePerMin: number
  waitSec: number
}

async function getJson(path: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, { headers: { Accept: 'application/json' } })
  } catch {
    throw new AppError('local_server_down')
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // A non-JSON reply means something other than our local server answered.
    throw new AppError(response.ok ? 'bad_response' : 'local_server_down')
  }
  if (!response.ok) {
    const record = (typeof body === 'object' && body !== null ? body : {}) as Record<
      string,
      unknown
    >
    const kind =
      typeof record.error === 'string' && KNOWN_KINDS.has(record.error) ? record.error : 'unknown'
    const detail = typeof record.detail === 'string' ? record.detail : ''
    const retry = typeof record.retryAfterSec === 'number' ? record.retryAfterSec : null
    throw new AppError(kind as AppErrorKind, detail, retry)
  }
  return body
}

function asSuccess(body: unknown): ApiSuccess {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!Array.isArray(record.data)) throw new AppError('bad_response')
  return {
    data: record.data,
    fetchedAt: typeof record.fetchedAt === 'string' ? record.fetchedAt : new Date().toISOString(),
    source: record.source === 'cache' ? 'cache' : 'api',
  }
}

export async function fetchLocalStatus(): Promise<LocalStatus> {
  const body = (await getJson('/api/status')) as Partial<LocalStatus>
  if (body.mode !== 'local') throw new AppError('bad_response')
  return {
    mode: 'local',
    apiKeyConfigured: body.apiKeyConfigured === true,
    ratePerMin: typeof body.ratePerMin === 'number' ? body.ratePerMin : 5,
    waitSec: typeof body.waitSec === 'number' ? body.waitSec : 0,
  }
}

function query(code: string, refresh: boolean | undefined): string {
  const params = new URLSearchParams({ code })
  if (refresh === true) params.set('refresh', '1')
  return params.toString()
}

export const jquantsSource: DataSource = {
  kind: 'jquants',

  async listings() {
    const res = asSuccess(await getJson('/api/jquants/listings'))
    return { data: mapListings(res.data), fetchedAt: res.fetchedAt, origin: res.source }
  },

  async bars(code, options) {
    const res = asSuccess(await getJson(`/api/jquants/bars?${query(code, options?.refresh)}`))
    return { data: mapBars(res.data), fetchedAt: res.fetchedAt, origin: res.source }
  },

  async financials(code, options) {
    const res = asSuccess(await getJson(`/api/jquants/fins?${query(code, options?.refresh)}`))
    return { data: mapFinancials(res.data), fetchedAt: res.fetchedAt, origin: res.source }
  },
}
