// @ts-check
/**
 * Checks that your J-Quants API key works and that each endpoint returns the
 * fields this app expects. Prints status codes, row counts and field names only —
 * never the data itself and never the key.
 *
 *   npm run check:api
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const API_BASE = 'https://api.jquants.com'

/** Fields the app reads from each endpoint (see src/lib/data/jquantsMapping.ts). */
export const EXPECTED_FIELDS = {
  listings: ['Date', 'Code', 'CoName', 'S17Nm', 'S33Nm', 'MktNm', 'ScaleCat'],
  bars: ['Date', 'Code', 'AdjO', 'AdjH', 'AdjL', 'AdjC', 'AdjVo', 'Va'],
  fins: [
    'DiscDate',
    'DiscTime',
    'Code',
    'DocType',
    'CurPerType',
    'CurFYEn',
    'Sales',
    'OP',
    'NP',
    'EPS',
    'ROE',
    'EqAR',
  ],
}

/** @param {string} text */
function parseDotEnv(text) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let value = line.slice(eq + 1).trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

export function readApiKey() {
  if (process.env.JQUANTS_API_KEY) return process.env.JQUANTS_API_KEY.trim()
  try {
    const env = parseDotEnv(readFileSync(join(root, '.env.local'), 'utf8'))
    return env.JQUANTS_API_KEY?.trim() || null
  } catch {
    return null
  }
}

/**
 * @param {string} apiKey
 * @param {string} path
 * @param {Record<string, string>} params
 */
async function call(apiKey, path, params) {
  const url = new URL(path, API_BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    /** @type {any} */
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    return { status: res.status, body }
  } catch (error) {
    return { status: 0, body: { message: error instanceof Error ? error.message : String(error) } }
  }
}

/**
 * @param {string} label
 * @param {{ status: number, body: any }} result
 * @param {string[]} expected
 */
function report(label, result, expected) {
  const { status, body } = result
  if (status !== 200 || !Array.isArray(body?.data)) {
    const message = typeof body?.message === 'string' ? ` — ${body.message.slice(0, 200)}` : ''
    console.log(`  ✗ ${label}: HTTP ${status}${message}`)
    return false
  }
  const rows = body.data
  const fields = rows.length > 0 ? Object.keys(rows[0]) : []
  const missing = rows.length > 0 ? expected.filter((f) => !fields.includes(f)) : []
  const more = body.pagination_key ? ' (more pages available)' : ''
  console.log(`  ✓ ${label}: HTTP 200, ${rows.length} rows${more}`)
  if (rows.length > 0) {
    console.log(
      missing.length === 0
        ? '    all expected fields present'
        : `    ✗ missing fields: ${missing.join(', ')}`,
    )
  }
  return missing.length === 0
}

/** @param {string} apiKey */
export async function checkApi(apiKey) {
  console.log('J-Quants API の接続を確認しています（3〜4 回リクエストします）')
  let ok = true
  ok =
    report(
      '株価四本値 /v2/equities/bars/daily',
      await call(apiKey, '/v2/equities/bars/daily', { code: '86970' }),
      EXPECTED_FIELDS.bars,
    ) && ok
  ok =
    report(
      '財務情報 /v2/fins/summary',
      await call(apiKey, '/v2/fins/summary', { code: '86970' }),
      EXPECTED_FIELDS.fins,
    ) && ok

  let master = await call(apiKey, '/v2/equities/master', {})
  if (master.status === 400 && typeof master.body?.message === 'string') {
    const dates = (master.body.message.match(/\d{4}-\d{2}-\d{2}/g) ?? []).sort()
    const latest = dates.at(-1)
    if (latest) {
      console.log(`  i 上場銘柄一覧: プランの範囲外のため ${latest} 時点で再取得します`)
      master = await call(apiKey, '/v2/equities/master', { date: latest })
    }
  }
  ok = report('上場銘柄一覧 /v2/equities/master', master, EXPECTED_FIELDS.listings) && ok

  console.log(
    ok
      ? '\nすべて正常です。npm start でアプリを起動できます。'
      : '\n問題があります。上の ✗ を確認してください。',
  )
  return ok
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  const apiKey = readApiKey()
  if (apiKey === null) {
    console.log('API キーが設定されていません。先に npm run setup を実行してください。')
    process.exit(1)
  }
  const ok = await checkApi(apiKey)
  process.exit(ok ? 0 : 1)
}
