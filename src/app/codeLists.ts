import { useCallback, useSyncExternalStore } from 'react'
import type { SourceKind } from '../lib/data/types'
import { isStringArray, readJson, writeJson } from '../lib/storage'
import { useApp } from './appContext'

/**
 * Small persisted lists of stock codes (watchlist, recently viewed), kept per
 * data source because demo codes and real codes are different.
 */
type ListName = 'watchlist' | 'recent'

const LIMITS: Record<ListName, number> = { watchlist: 50, recent: 8 }
const cache = new Map<string, string[]>()
const listeners = new Set<() => void>()

function storageKey(name: ListName, kind: SourceKind): string {
  return `${name}:${kind}`
}

function read(key: string): string[] {
  let value = cache.get(key)
  if (value === undefined) {
    value = readJson(key, [], isStringArray)
    cache.set(key, value)
  }
  return value
}

function write(key: string, value: string[]): void {
  cache.set(key, value)
  writeJson(key, value)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCodeList(name: ListName) {
  const { sourceKind } = useApp()
  const key = storageKey(name, sourceKind)
  const codes = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => read(key),
  )

  const add = useCallback(
    (code: string) => {
      const current = read(key)
      const next =
        name === 'recent'
          ? [code, ...current.filter((c) => c !== code)]
          : current.includes(code)
            ? current
            : [...current, code]
      write(key, next.slice(0, LIMITS[name]))
    },
    [key, name],
  )

  const remove = useCallback(
    (code: string): number => {
      const current = read(key)
      const index = current.indexOf(code)
      if (index >= 0)
        write(
          key,
          current.filter((c) => c !== code),
        )
      return index
    },
    [key],
  )

  /** Puts a removed code back where it was (undo). */
  const restore = useCallback(
    (code: string, index: number) => {
      const current = read(key).filter((c) => c !== code)
      const at = Math.max(0, Math.min(index, current.length))
      write(key, [...current.slice(0, at), code, ...current.slice(at)].slice(0, LIMITS[name]))
    },
    [key, name],
  )

  return { codes, add, remove, restore, has: (code: string) => codes.includes(code) }
}
