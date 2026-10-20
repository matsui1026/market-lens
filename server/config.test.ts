import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE, parseDotEnv, readLocalConfig } from './config.ts'

const dirs: string[] = []
function tempRoot(envLocal?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ml-config-'))
  dirs.push(dir)
  if (envLocal !== undefined) writeFileSync(join(dir, '.env.local'), envLocal)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('parseDotEnv', () => {
  it('parses plain, quoted, commented and CRLF lines', () => {
    const parsed = parseDotEnv('# c\r\nA=1\r\nB="two words"\nC=\'x=y\'\n\nbad line\n=nokey\n')
    expect(parsed).toEqual({ A: '1', B: 'two words', C: 'x=y' })
  })
})

describe('readLocalConfig', () => {
  it('reports no key when nothing is configured', () => {
    const config = readLocalConfig(tempRoot(), {})
    expect(config).toEqual({ apiKey: null, ratePerMin: 5, apiBase: DEFAULT_API_BASE })
  })

  it('reads the key and rate limit from .env.local', () => {
    const root = tempRoot('JQUANTS_API_KEY=abc123\nJQUANTS_RATE_LIMIT_PER_MIN=60\n')
    expect(readLocalConfig(root, {})).toMatchObject({ apiKey: 'abc123', ratePerMin: 60 })
  })

  it('lets environment variables override the file', () => {
    const root = tempRoot('JQUANTS_API_KEY=fromfile\n')
    expect(readLocalConfig(root, { JQUANTS_API_KEY: 'fromenv' }).apiKey).toBe('fromenv')
  })

  it('can be told to ignore .env.local (used by automated tests)', () => {
    const root = tempRoot('JQUANTS_API_KEY=real-key\n')
    expect(readLocalConfig(root, { MARKET_LENS_NO_ENV_FILE: '1' }).apiKey).toBeNull()
  })

  it('ignores an empty key and invalid rate limits', () => {
    const root = tempRoot('JQUANTS_API_KEY=\nJQUANTS_RATE_LIMIT_PER_MIN=abc\n')
    expect(readLocalConfig(root, {})).toMatchObject({ apiKey: null, ratePerMin: 5 })
    expect(readLocalConfig(root, { JQUANTS_RATE_LIMIT_PER_MIN: '0' }).ratePerMin).toBe(5)
    expect(readLocalConfig(root, { JQUANTS_RATE_LIMIT_PER_MIN: '2.5' }).ratePerMin).toBe(5)
  })

  it('only accepts a loopback API base override, so the key cannot be sent elsewhere', () => {
    const root = tempRoot()
    expect(readLocalConfig(root, { JQUANTS_API_BASE: 'http://127.0.0.1:9999' }).apiBase).toBe(
      'http://127.0.0.1:9999',
    )
    for (const bad of [
      'https://evil.example',
      'http://127.0.0.1.evil.example',
      'http://localhost:1',
    ]) {
      expect(readLocalConfig(root, { JQUANTS_API_BASE: bad }).apiBase).toBe(DEFAULT_API_BASE)
    }
  })
})
