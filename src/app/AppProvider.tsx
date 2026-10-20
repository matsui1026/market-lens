import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ResolvedTheme } from '../components/charts/chartTheme'
import { demoSource } from '../lib/data/demoSource'
import { jquantsSource } from '../lib/data/jquantsSource'
import type { SourceKind } from '../lib/data/types'
import { readJson, writeJson } from '../lib/storage'
import { AppContext, type AppContextValue, type ThemeSetting } from './appContext'
import { IS_DEMO_BUILD } from './env'

const isSourceKind = (v: unknown): v is SourceKind => v === 'demo' || v === 'jquants'
const isThemeSetting = (v: unknown): v is ThemeSetting =>
  v === 'system' || v === 'light' || v === 'dark'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sourceKind, setSourceKindState] = useState<SourceKind>(() =>
    IS_DEMO_BUILD ? 'demo' : readJson('source', 'jquants', isSourceKind),
  )
  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>(() =>
    readJson('theme', 'system', isThemeSetting),
  )
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const resolvedTheme: ResolvedTheme =
    themeSetting === 'system' ? (prefersDark ? 'dark' : 'light') : themeSetting

  useEffect(() => {
    const root = document.documentElement
    if (themeSetting === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', themeSetting)
  }, [themeSetting])

  const setSourceKind = useCallback((kind: SourceKind) => {
    if (IS_DEMO_BUILD) return
    setSourceKindState(kind)
    writeJson('source', kind)
  }, [])

  const setThemeSetting = useCallback((setting: ThemeSetting) => {
    setThemeSettingState(setting)
    writeJson('theme', setting)
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      source: sourceKind === 'demo' ? demoSource : jquantsSource,
      sourceKind,
      setSourceKind,
      themeSetting,
      setThemeSetting,
      resolvedTheme,
      reducedMotion,
    }),
    [sourceKind, setSourceKind, themeSetting, setThemeSetting, resolvedTheme, reducedMotion],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
