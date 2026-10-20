import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalApiHandler, normalizeCode } from './handler.ts'
import { fakeClock, jsonResponse } from './testUtils.ts'

type Reply = { status: number; body: Record<string, unknown> }

const cleanups: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn()
})

async function startApp(options: { envLocal?: string; upstream?: (url: URL) => Response }) {
  const root = mkdtempSync(join(tmpdir(), 'ml-handler-'))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  if (options.envLocal !== undefined) writeFileSync(join(root, '.env.local'), options.envLocal)

  const upstreamCalls: URL[] = []
  const fetchImpl = vi.fn(async (input: string) => {
    const url = new URL(input)
    upstreamCalls.push(url)
    if (options.upstream === undefined) throw new Error('no upstream configured')
    return options.upstream(url)
  })
  const logs: string[] = []
  const handler = createLocalApiHandler({
    root,
    fetchImpl,
    clock: fakeClock(),
    log: (m) => logs.push(m),
  })
  const server: Server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404
      res.end('next')
    }),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const port = (server.address() as AddressInfo).port

  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
    new Promise<Reply>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: { host: `127.0.0.1:${port}`, ...headers },
        },
        (res) => {
          let text = ''
          res.setEncoding('utf8')
          res.on('data', (chunk: string) => (text += chunk))
          res.on('end', () => {
            let body: Record<string, unknown>
            try {
              body = JSON.parse(text) as Record<string, unknown>
            } catch {
              body = { raw: text }
            }
            resolve({ status: res.statusCode ?? 0, body })
          })
        },
      )
      req.on('error', reject)
      req.end()
    })

  return { get, upstreamCalls, logs, port }
}

const KEY = 'JQUANTS_API_KEY=test-secret-key\n'

describe('local API handler', () => {
  it('passes non-API paths to the next middleware', async () => {
    const app = await startApp({})
    const reply = await app.get('/index.html')
    expect(reply).toEqual({ status: 404, body: { raw: 'next' } })
  })

  it('reports whether a key is configured without revealing it', async () => {
    const without = await startApp({})
    expect((await without.get('/api/status')).body).toMatchObject({
      mode: 'local',
      apiKeyConfigured: false,
      ratePerMin: 5,
    })
    const withKey = await startApp({ envLocal: KEY })
    const reply = await withKey.get('/api/status')
    expect(reply.body.apiKeyConfigured).toBe(true)
    expect(JSON.stringify(reply.body)).not.toContain('test-secret-key')
  })

  it('rejects requests from other sites and non-loopback hosts', async () => {
    const app = await startApp({ envLocal: KEY })
    expect((await app.get('/api/status', { origin: 'https://evil.example' })).status).toBe(403)
    expect((await app.get('/api/status', { origin: 'null' })).status).toBe(403)
    expect((await app.get('/api/status', { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await app.get('/api/status', { host: 'evil.example' })).status).toBe(403)
    expect((await app.get('/api/status', { host: 'localhost.evil.example' })).status).toBe(403)
    expect(
      (
        await app.get('/api/status', {
          origin: `http://127.0.0.1:${app.port}`,
          'sec-fetch-site': 'same-origin',
        })
      ).status,
    ).toBe(200)
    expect((await app.get('/api/status', { host: `localhost:${app.port}` })).status).toBe(200)
  })

  it('only allows GET and known endpoints', async () => {
    const app = await startApp({ envLocal: KEY })
    expect((await app.get('/api/status', {}, 'POST')).status).toBe(405)
    expect((await app.get('/api/jquants/../../v2/fins/details')).status).toBe(404)
    expect((await app.get('/api/jquants/details')).status).toBe(404)
    expect(app.upstreamCalls).toHaveLength(0)
  })

  it('asks for setup when no key is configured', async () => {
    const app = await startApp({})
    const reply = await app.get('/api/jquants/bars?code=7203')
    expect(reply).toEqual({ status: 503, body: { error: 'not_configured' } })
  })

  it('validates stock codes before calling J-Quants', async () => {
    const app = await startApp({ envLocal: KEY, upstream: () => jsonResponse(200, { data: [] }) })
    for (const code of ['', '72', '7203&date=x', '../x', '7203 ', 'abcd']) {
      const reply = await app.get(`/api/jquants/bars?code=${encodeURIComponent(code)}`)
      if (code === '7203 ') expect(reply.status).toBe(200)
      else expect(reply.status, code).toBe(400)
    }
  })

  it('fetches, caches and serves bars from the cache on the second request', async () => {
    const app = await startApp({
      envLocal: KEY,
      upstream: () =>
        jsonResponse(200, { data: [{ Date: '2026-01-05', Code: '72030', AdjC: 100 }] }),
    })
    const first = await app.get('/api/jquants/bars?code=7203')
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ source: 'api', data: [{ AdjC: 100 }] })
    const second = await app.get('/api/jquants/bars?code=7203')
    expect(second.body).toMatchObject({ source: 'cache', data: [{ AdjC: 100 }] })
    expect(app.upstreamCalls).toHaveLength(1)
    expect(app.upstreamCalls[0]?.pathname).toBe('/v2/equities/bars/daily')
    expect(app.upstreamCalls[0]?.searchParams.get('code')).toBe('7203')

    const refreshed = await app.get('/api/jquants/bars?code=7203&refresh=1')
    expect(refreshed.body.source).toBe('api')
    expect(app.upstreamCalls).toHaveLength(2)
  })

  it('routes financial summaries to /v2/fins/summary', async () => {
    const app = await startApp({ envLocal: KEY, upstream: () => jsonResponse(200, { data: [] }) })
    expect((await app.get('/api/jquants/fins?code=86970')).status).toBe(200)
    expect(app.upstreamCalls[0]?.pathname).toBe('/v2/fins/summary')
  })

  it('retries the listing master at the latest allowed date on the Free plan', async () => {
    const app = await startApp({
      envLocal: KEY,
      upstream: (url) =>
        url.searchParams.has('date')
          ? jsonResponse(200, { data: [{ Code: '72030', CoName: 'テスト' }] })
          : jsonResponse(400, {
              message: 'Your subscription covers the following dates: 2024-05-01 ~ 2026-07-28.',
            }),
    })
    const reply = await app.get('/api/jquants/listings')
    expect(reply.status).toBe(200)
    expect(reply.body.data).toEqual([{ Code: '72030', CoName: 'テスト' }])
    expect(app.upstreamCalls.map((u) => u.searchParams.get('date'))).toEqual([null, '2026-07-28'])
  })

  it('maps upstream errors to stable error codes', async () => {
    const cases: Array<[Response, number, string]> = [
      [
        jsonResponse(403, { message: 'The incoming api key is invalid or expired.' }),
        401,
        'invalid_key',
      ],
      [jsonResponse(403, { message: 'Forbidden' }), 403, 'forbidden'],
      [jsonResponse(500, {}), 502, 'server'],
    ]
    for (const [response, status, error] of cases) {
      const app = await startApp({ envLocal: KEY, upstream: () => response })
      const reply = await app.get('/api/jquants/bars?code=7203')
      expect(reply.status).toBe(status)
      expect(reply.body.error).toBe(error)
      expect(JSON.stringify(reply.body)).not.toContain('test-secret-key')
    }
  })

  it('backs off after a 429 and tells the client when to retry', async () => {
    const app = await startApp({ envLocal: KEY, upstream: () => jsonResponse(429, {}) })
    const reply = await app.get('/api/jquants/bars?code=7203')
    expect(reply).toEqual({ status: 429, body: { error: 'rate_limited', retryAfterSec: 120 } })
    expect((await app.get('/api/status')).body.waitSec).toBe(120)
  })

  it('never logs the API key', async () => {
    const app = await startApp({ envLocal: KEY, upstream: () => jsonResponse(200, { data: [] }) })
    await app.get('/api/jquants/bars?code=7203')
    await app.get('/api/status', { origin: 'https://evil.example' })
    expect(app.logs.join('\n')).not.toContain('test-secret-key')
    expect(app.logs.length).toBeGreaterThan(0)
  })
})

describe('normalizeCode', () => {
  it('accepts 4- and 5-character codes including letters', () => {
    expect(normalizeCode('7203')).toBe('7203')
    expect(normalizeCode('72030')).toBe('72030')
    expect(normalizeCode('130a')).toBe('130A')
    expect(normalizeCode(' 86970 ')).toBe('86970')
  })
  it('rejects anything else', () => {
    for (const bad of [null, '', '720', '720300', 'A203', '7203;', '72-3']) {
      expect(normalizeCode(bad)).toBeNull()
    }
  })
})
