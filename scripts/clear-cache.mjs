// @ts-check
/**
 * Deletes the local J-Quants data cache (.cache/jquants).
 * J-Quants asks you to delete stored data after cancelling or downgrading your plan.
 *
 *   npm run cache:clear
 */
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'jquants')
rmSync(dir, { recursive: true, force: true })
console.log('ローカルキャッシュを削除しました: .cache/jquants')
