import { rmSync } from 'node:fs'

/** Fake data from earlier runs must not be served from the cache. */
export default function globalSetup(): void {
  for (const dir of ['test-results/e2e-cache-key', 'test-results/e2e-cache-nokey']) {
    rmSync(dir, { recursive: true, force: true })
  }
}
