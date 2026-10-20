import { expect, test } from '@playwright/test'
import { expectAccessible, expectNoHorizontalScroll, watchPage } from './helpers'

/** Public demo build (synthetic data only). */

test.describe('demo: core flow', () => {
  test('opens with the search focused and shows a stock within 3 seconds', async ({ page }) => {
    const watched = watchPage(page)
    await page.goto('/')
    const search = page.getByRole('combobox', { name: '銘柄コードまたは社名で検索' })
    await expect(search).toBeFocused()
    await expect(page.getByTestId('demo-badge')).toHaveText('デモ（架空データ）')

    const started = Date.now()
    await search.fill('DM01')
    await search.press('Enter')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('デモ精機')
    await expect(page.getByTestId('price-chart').locator('svg')).toBeVisible()
    await expect(page.getByTestId('tile-return')).toContainText('%')
    expect(Date.now() - started).toBeLessThan(3000)

    expect(watched.errors).toEqual([])
    expect(watched.foreignRequests).toEqual([])
  })

  test('supports keyboard selection and kana-insensitive search', async ({ page }) => {
    await page.goto('/')
    const search = page.getByRole('combobox', { name: '銘柄コードまたは社名で検索' })
    await search.fill('dm0')
    await expect(page.getByRole('option')).toHaveCount(8)
    await search.press('ArrowDown')
    await search.press('ArrowDown')
    await expect(page.getByRole('option', { selected: true })).toContainText('デモ食品')
    await search.press('Enter')
    await expect(page).toHaveURL(/#\/stock\/DM02$/)

    await page.goto('/')
    // Hiragana "でも" must match katakana "デモ".
    await search.fill('でも商')
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option')).toContainText('デモ商事')
    await search.fill('zzzz')
    await expect(page.getByText('「zzzz」に一致する銘柄はありません')).toBeVisible()
    await search.press('Escape')
    await expect(search).toHaveAttribute('aria-expanded', 'false')
  })

  test('recalculates everything when the period changes', async ({ page }) => {
    await page.goto('/#/stock/DM03')
    const ret = page.getByTestId('tile-return')
    const oneYear = await ret.textContent()
    await page.getByRole('group', { name: '期間' }).getByRole('button', { name: '3か月' }).click()
    await expect(page).toHaveURL(/period=3m/)
    await expect(page.getByRole('heading', { name: '株価（3か月）' })).toBeVisible()
    await expect(ret).not.toHaveText(oneYear ?? '')
    await expect(page.getByTestId('tile-turnover')).toContainText(/（6\d営業日）/)

    await page.getByTestId('price-table-toggle').getByText('表で見る').click()
    const rows = page.getByTestId('price-table-toggle').locator('tbody tr')
    expect(await rows.count()).toBeGreaterThan(55)
    await expect(rows.first().locator('th')).toHaveText('2026/07/24')
  })

  test('shows financial results including a loss year', async ({ page }) => {
    await page.goto('/#/stock/DM06')
    await expect(page.getByTestId('financial-charts').locator('svg')).toHaveCount(3)
    await page
      .getByTestId('fin-table-toggle')
      .getByText(/表で見る/)
      .click()
    const table = page.getByTestId('financial-table')
    await expect(table.locator('tbody tr')).toHaveCount(5)
    await expect(table).toContainText('2025年3月期')
    await expect(table.locator('tbody tr', { hasText: '2025年3月期' })).toContainText('-')
  })

  test('adds, removes and restores watchlist items, and keeps them after reload', async ({
    page,
  }) => {
    await page.goto('/#/stock/DM04')
    const toggle = page.getByTestId('watchlist-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('status')).toContainText('ウォッチリストに追加しました')

    await page.goto('/')
    await expect(page.getByTestId('watchlist')).toContainText('デモ銀行')
    await page.getByRole('button', { name: 'デモ銀行 をウォッチリストから外す' }).click()
    await expect(page.getByTestId('watchlist')).toHaveCount(0)
    await page.getByRole('button', { name: '元に戻す' }).click()
    await expect(page.getByTestId('watchlist')).toContainText('デモ銀行')

    await page.reload()
    await expect(page.getByTestId('watchlist')).toContainText('デモ銀行')
    await expect(page.getByTestId('recent')).toContainText('デモ銀行')
  })

  test('compares stocks, keeps colors with each stock and supports undo', async ({ page }) => {
    const watched = watchPage(page)
    await page.goto('/#/stock/DM01')
    await page.getByRole('link', { name: '比較する' }).click()
    await expect(page).toHaveURL(/#\/compare\?codes=DM01/)
    await expect(page.getByText('比べたい銘柄を 2 つ以上追加してください')).toBeVisible()

    const add = page.getByRole('combobox', { name: '比較する銘柄を追加' })
    await add.fill('DM03')
    await add.press('Enter')
    await add.fill('DM10')
    await add.press('Enter')
    await expect(page.getByTestId('compare-chart').locator('svg')).toBeVisible()
    await expect(page.getByTestId('correlation-table').locator('tbody tr')).toHaveCount(3)
    await expect(page.getByTestId('compare-metrics').locator('tbody tr')).toHaveCount(3)

    const legendColor = (name: string) =>
      page
        .getByRole('list', { name: '凡例' })
        .locator('li', { hasText: name })
        .locator('.key-line')
        .evaluate((el) => getComputedStyle(el).color)
    const dm10Color = await legendColor('デモAIラボ')

    await page.getByRole('button', { name: 'デモ精機 を比較から外す' }).click()
    await expect(page).toHaveURL(/codes=DM03%2CDM10|codes=DM03,DM10/)
    expect(await legendColor('デモAIラボ')).toBe(dm10Color)

    await page.getByRole('button', { name: '元に戻す' }).click()
    await expect(page.getByTestId('compare-chips')).toContainText('デモ精機')
    await expect(page.getByTestId('compare-chips').locator('li').first()).toContainText('デモ精機')

    await add.fill('DM02')
    await add.press('Enter')
    await expect(add).toBeDisabled()
    expect(watched.errors).toEqual([])
  })

  test('explains unknown codes and pages', async ({ page }) => {
    await page.goto('/#/stock/9999')
    await expect(page.getByText('銘柄コード「9999」は見つかりません')).toBeVisible()
    await page.goto('/#/no/such/page')
    await expect(page.getByText('ページが見つかりません')).toBeVisible()
  })

  test('states the data rules required by J-Quants and makes no affiliation claims', async ({
    page,
  }) => {
    await page.goto('/#/about')
    const body = page.locator('main')
    await expect(body).toContainText(
      '利用者それぞれが自分で J-Quants API を契約し、自分の API キーで取得します',
    )
    await expect(body).toContainText('非公式')
    await expect(body).toContainText('投資助言や売買の推奨ではありません')
    const all = (await page.locator('body').textContent()) ?? ''
    // "非公式" (unofficial) is required; "公式" (official), "提携" and "Powered by" are not allowed.
    expect(all).not.toMatch(/Powered by|(?<!非)公式|提携/)
  })
})

test.describe('demo: quality', () => {
  test('has a Content-Security-Policy and loads nothing from other origins', async ({ page }) => {
    const watched = watchPage(page)
    await page.goto('/')
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("connect-src 'self'")
    await page.goto('/#/stock/DM05')
    await page.goto('/#/compare?codes=DM05,DM06')
    await expect(page.getByTestId('compare-chart').locator('svg')).toBeVisible()
    expect(watched.foreignRequests).toEqual([])
    expect(watched.errors).toEqual([])
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no serious accessibility violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      for (const path of [
        '/',
        '/#/stock/DM01',
        '/#/compare?codes=DM01,DM02',
        '/#/about',
        '/#/setup',
      ]) {
        await page.goto(path)
        await page.locator('main h1').waitFor()
        if (path.includes('stock')) await page.getByTestId('price-chart').locator('svg').waitFor()
        await expectAccessible(page, `${path} (${scheme})`)
      }
    })
  }

  test('fits a phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    for (const path of ['/', '/#/stock/DM10', '/#/compare?codes=DM01,DM02,DM10', '/#/about']) {
      await page.goto(path)
      await page.locator('main h1').waitFor()
      await expectNoHorizontalScroll(page)
    }
    // Tap targets are at least 44px tall.
    for (const name of ['比較', 'このツールについて']) {
      const box = await page
        .getByRole('navigation', { name: 'メイン' })
        .getByRole('link', { name })
        .boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test('works with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/stock/DM02')
    await expect(page.getByTestId('price-chart').locator('svg')).toBeVisible()
    const duration = await page
      .locator('.page')
      .evaluate((el) => getComputedStyle(el).animationDuration)
    expect(parseFloat(duration)).toBeLessThan(0.01)
  })

  test('switches the theme and remembers it', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /表示テーマ/ })
    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('the skip link moves focus to the main content without changing the route', async ({
    page,
  }) => {
    await page.goto('/#/about')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: '本文へスキップ' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
    await expect(page).toHaveURL(/#\/about$/)
  })
})
