// @ts-check
/**
 * A fake J-Quants V2 API for end-to-end tests. It mimics the documented
 * behaviour the app relies on (x-api-key auth, Free-plan 400 for the listing
 * master without a date, 403/429 errors, pagination). Data is synthetic.
 *
 *   node e2e/fakeJquants.mjs   (listens on 127.0.0.1:4599)
 */
import { createServer } from 'node:http'

export const FAKE_PORT = 4599
export const FAKE_API_KEY = 'e2e-test-key-not-a-real-secret'

const COMPANIES = [
  {
    Code: '72030',
    CoName: 'テスト自動車',
    CoNameEn: 'Test Motor',
    S17Nm: '自動車・輸送機',
    S33Nm: '輸送用機器',
    MktNm: 'プライム',
    ScaleCat: 'TOPIX Core30',
    base: 2500,
    seed: 1,
  },
  {
    Code: '67580',
    CoName: 'テスト電機',
    CoNameEn: 'Test Electric',
    S17Nm: '電機・精密',
    S33Nm: '電気機器',
    MktNm: 'プライム',
    ScaleCat: 'TOPIX Core30',
    base: 3200,
    seed: 2,
  },
  {
    Code: '13010',
    CoName: 'テスト水産',
    CoNameEn: 'Test Fisheries',
    S17Nm: '食品',
    S33Nm: '水産・農林業',
    MktNm: 'プライム',
    ScaleCat: 'TOPIX Small 1',
    base: 4000,
    seed: 3,
  },
  {
    Code: '99840',
    CoName: 'テスト通信',
    CoNameEn: 'Test Telecom',
    S17Nm: '情報通信・サービスその他',
    S33Nm: '情報・通信業',
    MktNm: 'プライム',
    ScaleCat: 'TOPIX Core30',
    base: 9000,
    seed: 4,
  },
]

/** @param {string} from @param {string} to */
function businessDays(from, to) {
  const out = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export const DAYS = businessDays('2025-01-06', '2026-07-24')

/** @param {{ base: number, seed: number }} company */
function bars(company) {
  return DAYS.map((date, i) => {
    const c = Math.round(
      company.base * (1 + 0.15 * Math.sin((i + company.seed * 17) / 23) + i * 0.0004),
    )
    const o = Math.round(c * (1 + 0.004 * Math.cos(i * company.seed)))
    const h = Math.max(o, c) + 5
    const l = Math.min(o, c) - 5
    return {
      Date: date,
      Code: '',
      O: o,
      H: h,
      L: l,
      C: c,
      UL: '0',
      LL: '0',
      Vo: 100000 + i,
      Va: c * (100000 + i),
      AdjFactor: 1,
      AdjO: o,
      AdjH: h,
      AdjL: l,
      AdjC: c,
      AdjVo: 100000 + i,
      MktCap: null,
      ExRT: null,
    }
  })
}

/** @param {string} code */
function fins(code) {
  return [2025, 2026].map((year) => ({
    DiscDate: `${year}-05-12`,
    DiscTime: '15:00:00',
    Code: code,
    DiscNo: `${year}0512000001`,
    DocType: 'FYFinancialStatements_Consolidated_JP',
    CurPerType: 'FY',
    CurPerSt: `${year - 1}-04-01`,
    CurPerEn: `${year}-03-31`,
    CurFYSt: `${year - 1}-04-01`,
    CurFYEn: `${year}-03-31`,
    NxtFYSt: '',
    NxtFYEn: '',
    Sales: String(1000e9 + year),
    OP: String(80e9),
    OdP: '',
    NP: String(55e9),
    EPS: '123.45',
    DEPS: '',
    TA: String(3000e9),
    Eq: String(1200e9),
    EqAR: '0.4',
    BPS: '',
    ROE: '0.0458',
  }))
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function startFake(port = FAKE_PORT) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    if (req.headers['x-api-key'] !== FAKE_API_KEY) {
      send(res, 403, { message: 'The incoming api key is invalid or expired.' })
      return
    }
    const code = url.searchParams.get('code') ?? ''
    const company = COMPANIES.find((c) => c.Code === code || c.Code.slice(0, 4) === code)
    if (company?.Code === '13010' && url.pathname !== '/v2/equities/master') {
      send(res, 403, { message: 'Forbidden' })
      return
    }
    if (company?.Code === '99840' && url.pathname !== '/v2/equities/master') {
      send(res, 429, { message: 'Too Many Requests' })
      return
    }
    switch (url.pathname) {
      case '/v2/equities/master': {
        if (!url.searchParams.has('date')) {
          send(res, 400, {
            message:
              'Your subscription covers the following dates: 2024-05-01 ~ 2026-07-28. If you want more data, please check other plans:  https://jpx-jquants.com/',
          })
          return
        }
        const date = url.searchParams.get('date')
        send(res, 200, {
          data: COMPANIES.map((c) => ({
            Date: date,
            Code: c.Code,
            CoName: c.CoName,
            CoNameEn: c.CoNameEn,
            S17: '',
            S17Nm: c.S17Nm,
            S33: '',
            S33Nm: c.S33Nm,
            ScaleCat: c.ScaleCat,
            Mkt: '0111',
            MktNm: c.MktNm,
            Mrgn: '1',
            MrgnNm: '信用',
            ProdCat: '011',
          })),
        })
        return
      }
      case '/v2/equities/bars/daily': {
        if (company === undefined) {
          send(res, 200, { data: [] })
          return
        }
        const rows = bars(company).map((r) => ({ ...r, Code: company.Code }))
        // Two pages, to exercise pagination.
        const half = Math.floor(rows.length / 2)
        if (url.searchParams.get('pagination_key') === 'page2')
          send(res, 200, { data: rows.slice(half) })
        else send(res, 200, { data: rows.slice(0, half), pagination_key: 'page2' })
        return
      }
      case '/v2/fins/summary':
        send(res, 200, { data: company === undefined ? [] : fins(company.Code) })
        return
      default:
        send(res, 404, { message: 'Not Found' })
    }
  })
  server.listen(port, '127.0.0.1')
  return server
}

if (process.argv[1]?.endsWith('fakeJquants.mjs')) {
  startFake()
  console.log(`fake J-Quants listening on http://127.0.0.1:${FAKE_PORT}`)
}
