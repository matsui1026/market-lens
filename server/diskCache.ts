import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Entry<T> = { savedAt: number; key: string; value: T }

/**
 * JSON file cache kept inside the project (`.cache/jquants`, git-ignored).
 * The data never leaves the user's PC. File names are hashes so that request
 * parameters never become part of a path.
 */
export class DiskCache {
  private readonly dir: string
  private readonly now: () => number

  constructor(dir: string, now: () => number = Date.now) {
    this.dir = dir
    this.now = now
  }

  private fileFor(key: string): string {
    return join(this.dir, `${createHash('sha256').update(key).digest('hex')}.json`)
  }

  async get<T>(key: string, ttlMs: number): Promise<{ value: T; savedAt: number } | null> {
    try {
      const text = await readFile(this.fileFor(key), 'utf8')
      const entry = JSON.parse(text) as Entry<T>
      if (entry.key !== key || typeof entry.savedAt !== 'number') return null
      if (this.now() - entry.savedAt > ttlMs) return null
      return { value: entry.value, savedAt: entry.savedAt }
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const target = this.fileFor(key)
    const temp = `${target}.${randomUUID()}.tmp`
    const entry: Entry<T> = { savedAt: this.now(), key, value }
    await writeFile(temp, JSON.stringify(entry), 'utf8')
    await rename(temp, target)
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true })
  }
}
