import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DEFAULT_API_BASE = 'https://api.jquants.com'
export const DEFAULT_RATE_LIMIT_PER_MIN = 5

/** Only a loopback HTTP server may replace the real API (used by the automated tests). */
const LOOPBACK_BASE = /^http:\/\/127\.0\.0\.1:\d{1,5}$/

export type LocalConfig = {
  apiKey: string | null
  ratePerMin: number
  apiBase: string
}

/** Parses a dotenv-style file. Supports `KEY=value`, `KEY="value"`, comments and blank lines. */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function readDotEnvLocal(root: string): Record<string, string> {
  try {
    return parseDotEnv(readFileSync(join(root, '.env.local'), 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Reads the configuration on every call so that `npm run setup` takes effect
 * without restarting the server. Environment variables override `.env.local`.
 */
export function readLocalConfig(root: string, env: NodeJS.ProcessEnv = process.env): LocalConfig {
  // Automated tests set this so that a developer's real .env.local is never read.
  const file = env.MARKET_LENS_NO_ENV_FILE === '1' ? {} : readDotEnvLocal(root)
  const pick = (name: string): string | undefined => {
    const fromEnv = env[name]
    if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv.trim()
    const fromFile = file[name]
    if (fromFile !== undefined && fromFile.trim() !== '') return fromFile.trim()
    return undefined
  }

  const apiKey = pick('JQUANTS_API_KEY') ?? null

  const rateRaw = Number(pick('JQUANTS_RATE_LIMIT_PER_MIN'))
  const ratePerMin =
    Number.isInteger(rateRaw) && rateRaw >= 1 && rateRaw <= 1000
      ? rateRaw
      : DEFAULT_RATE_LIMIT_PER_MIN

  const baseRaw = pick('JQUANTS_API_BASE')
  const apiBase = baseRaw !== undefined && LOOPBACK_BASE.test(baseRaw) ? baseRaw : DEFAULT_API_BASE

  return { apiKey, ratePerMin, apiBase }
}
