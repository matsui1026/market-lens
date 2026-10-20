import { expect, test } from '@playwright/test'
import { DAYS, FAKE_API_KEY } from './fakeJquants.mjs'
import { expectAccessible, watchPage } from './helpers'

/**
 * Local mode (npm start) against a fake J-Quants API on 127.0.0.1:4599.
 * Port 4175 has an API key configured; port 4176 has none.
 * Tests run in order; the rate-limit test is last because it blocks the server for 2 minutes.
 */

const NO_KEY = 'http://127.0.0.1:4176'

test('loads a stock through the local proxy, following pagination and the Free-plan master fallback', async ({
  page,
}) => {
  const watched = watchPage(page)
  await page.goto('/')
  const search = page.getByRole('combobox', { name: '銘柄コードまたは社名で検索' })
  await expect(search).toBeFocused()
  await search.fill('7203')
  await expect(page.getByRole('option')).toContainText('テスト自動車')
  await search.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('テスト自動車')
  await expect(page.getByTestId('price-chart').locator('svg')).toBeVisible()
  await expect(page.locator('main')).toContainText(
    'J-Quants API（あなたの API キーで取得し、この PC の中だけに保存）',
  )

  // Both pages of the fake response arrived: "全期間" covers every fake trading day.
  await page.getByRole('group', { name: '期間' }).getByRole('button', { name: '全期間' }).click()
  await expect(page.getByTestId('tile-turnover')).toContainText(`（${DAYS.length}営業日）`)

  await expect(page.getByTestId('financial-charts').locator('svg')).toHaveCount(3)
  await expectAccessible(page, 'local stock page')
  expect(watched.errors).toEqual([])
  expect(watched.foreignRequests).toEqual([])
})

test('serves the next visit from the local disk cache', async ({ page }) => {
  await page.goto('/#/stock/7203')
  await expect(page.locator('main')).toContainText('キャッシュから表示')
})

test('never sends the API key to the browser', async ({ page }) => {
  const bodies: string[] = []
  page.on('response', async (response) => {
    try {
      bodies.push(await response.text())
    } catch {
      // Redirects and aborted responses have no body.
    }
  })
  await page.goto('/#/stock/6758')
  await expect(page.getByTestId('price-chart').locator('svg')).toBeVisible()
  await page.goto('/#/setup')
  await expect(page.getByText('API キーは設定済みです')).toBeVisible()
  expect(bodies.length).toBeGreaterThan(3)
  for (const body of bodies) expect(body).not.toContain(FAKE_API_KEY)
  const html = await page.content()
  expect(html).not.toContain(FAKE_API_KEY)
})

test('rejects requests from other websites and unknown endpoints', async ({ request }) => {
  const evil = await request.get('/api/status', { headers: { Origin: 'https://evil.example' } })
  expect(evil.status()).toBe(403)
  const crossSite = await request.get('/api/jquants/bars?code=7203', {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  })
  expect(crossSite.status()).toBe(403)
  const unknown = await request.get('/api/jquants/details?code=7203')
  expect(unknown.status()).toBe(404)
  const badCode = await request.get('/api/jquants/bars?code=7203%26date%3D2020-01-01')
  expect(badCode.status()).toBe(400)
  const post = await request.post('/api/status')
  expect(post.status()).toBe(405)
})

test('explains data outside the plan', async ({ page }) => {
  await page.goto('/#/stock/1301')
  await expect(page.getByRole('alert').first()).toContainText(
    'ご契約のプランでは取得できないデータです',
  )
})

test('can switch to demo data', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('group', { name: 'データの取得元' })
    .getByRole('button', { name: 'デモ' })
    .click()
  await expect(page.getByRole('heading', { name: 'デモ銘柄' })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('group', { name: 'データの取得元' }).getByRole('button', { name: 'デモ' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('guides the user to setup when no API key is configured', async ({ page }) => {
  await page.goto(`${NO_KEY}/`)
  await expect(page.getByRole('alert')).toContainText('API キーが設定されていません')
  await page.getByRole('link', { name: 'セットアップ手順を見る' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'J-Quants を使うためのセットアップ',
  )
  await expect(page.locator('main')).toContainText('API キーはまだ設定されていません。')
  await expect(page.locator('main')).toContainText('npm run setup')
  await page.getByRole('button', { name: 'デモデータで試す' }).click()
  await page.goto(`${NO_KEY}/`)
  await expect(page.getByRole('heading', { name: 'デモ銘柄' })).toBeVisible()
})

test('tells the user when J-Quants rate-limits the requests (runs last)', async ({ page }) => {
  await page.goto('/#/stock/9984')
  const alert = page.getByRole('alert').first()
  await expect(alert).toContainText('J-Quants の回数制限に達しました')
  await expect(alert).toContainText('約 120 秒')
  await expect(alert.getByRole('button', { name: '再試行' })).toBeVisible()
})
