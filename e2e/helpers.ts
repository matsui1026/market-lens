import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Collects console errors, page errors and requests that leave the app's origin. */
export function watchPage(page: Page) {
  const errors: string[] = []
  const foreignRequests: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:') foreignRequests.push(req.url())
  })
  return { errors, foreignRequests }
}

/** Runs axe and fails on serious or critical WCAG violations. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
  expect(serious, `${label} accessibility violations`).toEqual([])
}

/** Asserts that the document has no horizontal scroll. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}
