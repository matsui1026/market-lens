// @ts-check
/**
 * Saves your J-Quants API key to .env.local (git-ignored) without echoing it.
 *
 *   npm run setup
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { checkApi } from './check-api.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')

const PLANS = [
  { label: 'Free', rate: 5 },
  { label: 'Light', rate: 60 },
  { label: 'Standard', rate: 120 },
  { label: 'Premium', rate: 500 },
]

/** @type {AsyncIterator<string> | null} */
let pipedLines = null

/** Reads the next line of piped (non-TTY) input, sharing one reader across prompts. */
async function readPipedLine() {
  if (pipedLines === null) pipedLines = createInterface({ input: stdin })[Symbol.asyncIterator]()
  const next = await pipedLines.next()
  return next.done === true ? '' : next.value
}

/**
 * Reads a line without echoing it.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function readHidden(prompt) {
  stdout.write(prompt)
  if (!stdin.isTTY) return readPipedLine()
  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    /** @param {string} chunk */
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          cleanup()
          stdout.write('\n')
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          cleanup()
          stdout.write('\n')
          reject(new Error('cancelled'))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1)
          continue
        }
        value += ch
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    stdin.on('data', onData)
  })
}

/**
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function readVisible(prompt) {
  if (!stdin.isTTY) {
    stdout.write(prompt)
    return readPipedLine()
  }
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    return await rl.question(prompt)
  } finally {
    rl.close()
  }
}

/** Removes bracketed-paste markers and control characters, then trims. */
export function cleanKey(/** @type {string} */ raw) {
  const ESC = String.fromCharCode(0x1b)
  const withoutPaste = raw.split(`${ESC}[200~`).join('').split(`${ESC}[201~`).join('')
  return [...withoutPaste]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .trim()
}

/**
 * Updates or appends KEY=value lines, keeping everything else in the file.
 * @param {string} text
 * @param {Record<string, string>} values
 */
export function upsertEnv(text, values) {
  const lines = text === '' ? [] : text.split(/\r?\n/)
  const remaining = new Map(Object.entries(values))
  const updated = lines.map((line) => {
    const eq = line.indexOf('=')
    if (eq <= 0 || line.trim().startsWith('#')) return line
    const key = line.slice(0, eq).trim()
    if (!remaining.has(key)) return line
    const value = remaining.get(key)
    remaining.delete(key)
    return `${key}=${value}`
  })
  while (updated.length > 0 && updated[updated.length - 1] === '') updated.pop()
  for (const [key, value] of remaining) updated.push(`${key}=${value}`)
  return `${updated.join('\n')}\n`
}

async function main() {
  console.log('Market Lens セットアップ')
  console.log('J-Quants のダッシュボード（設定 » API キー）で発行した API キーを使います。')
  console.log('キーはこの PC の .env.local にだけ保存され、Git にはコミットされません。\n')

  const key = cleanKey(await readHidden('API キーを貼り付けて Enter（入力内容は表示されません）: '))
  if (key.length < 8 || /\s/.test(key)) {
    console.log('API キーの形式が正しくありません。もう一度 npm run setup を実行してください。')
    process.exit(1)
  }

  console.log('\nご契約のプランを選んでください（1 分間に送れるリクエスト数の上限に使います）')
  PLANS.forEach((plan, i) => console.log(`  ${i + 1}) ${plan.label}（${plan.rate} 回/分）`))
  const answer = (await readVisible('番号を入力して Enter [1]: ')).trim()
  const index = answer === '' ? 0 : Number(answer) - 1
  const plan = PLANS[index]
  if (plan === undefined) {
    console.log('1〜4 の番号を入力してください。もう一度 npm run setup を実行してください。')
    process.exit(1)
  }

  const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  writeFileSync(
    envPath,
    upsertEnv(current, { JQUANTS_API_KEY: key, JQUANTS_RATE_LIMIT_PER_MIN: String(plan.rate) }),
    { encoding: 'utf8', mode: 0o600 },
  )
  console.log(`\n.env.local に保存しました（プラン: ${plan.label}）。\n`)

  const verify = (await readVisible('今すぐ接続を確認しますか？ [Y/n]: ')).trim().toLowerCase()
  if (verify === '' || verify === 'y' || verify === 'yes') {
    const ok = await checkApi(key)
    process.exit(ok ? 0 : 1)
  }
  console.log('npm start でアプリを起動できます。')
}

const invokedDirectly = process.argv[1]?.endsWith('setup.mjs') ?? false
if (invokedDirectly) {
  main().catch((error) => {
    if (error instanceof Error && error.message === 'cancelled') {
      console.log('キャンセルしました。')
      process.exit(130)
    }
    console.error('セットアップに失敗しました:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
