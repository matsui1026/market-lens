import { createContext, useContext } from 'react'
import type { ResolvedTheme } from '../components/charts/chartTheme'
import type { DataSource, SourceKind } from '../lib/data/types'

export type ThemeSetting = 'system' | 'light' | 'dark'

export type AppContextValue = {
  source: DataSource
  sourceKind: SourceKind
  setSourceKind: (kind: SourceKind) => void
  themeSetting: ThemeSetting
  setThemeSetting: (setting: ThemeSetting) => void
  resolvedTheme: ResolvedTheme
  reducedMotion: boolean
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (value === null) throw new Error('useApp must be used inside <AppProvider>')
  return value
}
