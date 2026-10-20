import { describe, expect, it, vi } from 'vitest'
import { classifyError, datesInMessage, fetchAllPages, UpstreamError } from './jquantsClient.ts'
import { SlidingWindowLimiter } from './rateLimiter.ts'
import { fakeClock, jsonResponse } from './testUtils.ts'

function setup(responses: Array<Response | Error>) {
  const clock = fakeClock()
  const limiter = new SlidingWindowLimiter(5, 61_000, clock)
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (next === undefined) throw new Error('unexpected call')
    if (next instanceof Error) throw next
    return next
  })
  const run = (params: Record<string, string> = { code: '72030' }) =>
    fetchAllPages({
      apiBase: 'https://api.jquants.com',
      apiKey: 'secret-key',
      path: '/v2/equities/bars/daily',
      params,
      limiter,
      maxWaitMs: 200_000,
      fetchImpl,
    })
  return { run, calls, clock }
}

describe('fetchAllPages', () => {
  it('sends the key as x-api-key and follows pagination_key until the end', async () => {
    const { run, calls } = setup([
      jsonResponse(200, { data: [{ n: 1 }, { n: 2 }], pagination_key: 'p2' }),
      jsonResponse(200, { data: [{ n: 3 }], pagination_key: 'p3' }),
      jsonResponse(200, { data: [{ n: 4 }] }),
    ])
    await expect(run()).resolves.toEqual([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }])
    expect(calls.map((c) => new URL(c.url).search)).toEqual([
      '?code=72030',
      '?code=72030&pagination_key=p2',
      '?code=72030&pagination_key=p3',
    ])
    expect((calls[0]?.init?.headers as Record<string, string>)['x-api-key']).toBe('secret-key')
  })

  it('treats an empty data array, 210 and empty bodies as no data', async () => {
    expect(await setup([jsonResponse(200, { data: [] })]).run()).toEqual([])
    expect(await setup([new Response('', { status: 210 })]).run()).toEqual([])
    expect(await setup([new Response('', { status: 200 })]).run()).toEqual([])
  })

  it('waits for the rate limiter between pages', async () => {
    const pages = Array.from({ length: 6 }, (_, i) =>
      jsonResponse(200, { data: [i], ...(i < 5 ? { pagination_key: `k${i}` } : {}) }),
    )
    const { run, clock } = setup(pages)
    await expect(run()).resolves.toEqual([0, 1, 2, 3, 4, 5])
    expect(clock.slept).toEqual([61_000])
  })

  it('maps HTTP errors to error kinds', async () => {
    const cases: Array<[Response, string]> = [
      [
        jsonResponse(403, { message: 'The incoming api key is invalid or expired.' }),
        'invalid_key',
      ],
      [jsonResponse(403, { message: 'Forbidden' }), 'forbidden'],
      [new Response('', { status: 403 }), 'forbidden'],
      [
        jsonResponse(400, {
          message: 'Your subscription covers the following dates: 2024-05-01 ~ 2026-07-28.',
        }),
        'out_of_range',
      ],
      [jsonResponse(400, { message: 'This API requires at least 1 parameter' }), 'bad_request'],
      [jsonResponse(429, {}), 'rate_limited'],
      [new Response('oops', { status: 500 }), 'server'],
      [jsonResponse(200, { nodata: true }), 'bad_response'],
    ]
    for (const [response, kind] of cases) {
      const error = await setup([response])
        .run()
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(UpstreamError)
      expect((error as UpstreamError).kind).toBe(kind)
    }
  })

  it('maps network failures and timeouts', async () => {
    const network = await setup([new TypeError('fetch failed')])
      .run()
      .catch((e: unknown) => e)
    expect((network as UpstreamError).kind).toBe('network')
    const timeoutError = new Error('timed out')
    timeoutError.name = 'TimeoutError'
    const timeout = await setup([timeoutError])
      .run()
      .catch((e: unknown) => e)
    expect((timeout as UpstreamError).kind).toBe('timeout')
  })

  it('never puts the API key into error details', async () => {
    const error = (await setup([jsonResponse(403, { message: 'Forbidden' })])
      .run()
      .catch((e: unknown) => e)) as UpstreamError
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain('secret-key')
  })
})

describe('helpers', () => {
  it('extracts dates from a range message', () => {
    expect(datesInMessage('covers 2024-05-01 ~ 2026-07-28.')).toEqual(['2024-05-01', '2026-07-28'])
    expect(datesInMessage('no dates')).toEqual([])
  })

  it('treats 401 as an invalid key and truncates long details', () => {
    expect(classifyError(401, '').kind).toBe('invalid_key')
    expect(classifyError(418, 'x'.repeat(1000)).detail).toHaveLength(300)
  })
})
