import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { fetchLocalStatus } from '../lib/data/jquantsSource'
import { useApp } from './appContext'
import { IS_DEMO_BUILD } from './env'

const MINUTE = 60_000

export function useListings() {
  const { source } = useApp()
  return useQuery({
    queryKey: ['listings', source.kind],
    queryFn: () => source.listings(),
    staleTime: source.kind === 'demo' ? Infinity : 60 * MINUTE,
  })
}

export function useBars(code: string | null) {
  const { source } = useApp()
  return useQuery({
    queryKey: ['bars', source.kind, code],
    queryFn: () => source.bars(code ?? ''),
    enabled: code !== null,
    staleTime: source.kind === 'demo' ? Infinity : 30 * MINUTE,
  })
}

export function useFinancials(code: string | null) {
  const { source } = useApp()
  return useQuery({
    queryKey: ['financials', source.kind, code],
    queryFn: () => source.financials(code ?? ''),
    enabled: code !== null,
    staleTime: source.kind === 'demo' ? Infinity : 30 * MINUTE,
  })
}

/** Whether the local server has an API key. Not used by the demo build. */
export function useLocalStatus() {
  const { sourceKind } = useApp()
  return useQuery({
    queryKey: ['local-status'],
    queryFn: fetchLocalStatus,
    enabled: !IS_DEMO_BUILD && sourceKind === 'jquants',
    staleTime: 10_000,
  })
}

/** Bypasses the local disk cache and replaces the cached query data. */
export function useRefreshStock(code: string | null) {
  const { source } = useApp()
  const client = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const refresh = useCallback(async () => {
    if (code === null || source.kind === 'demo') return
    setRefreshing(true)
    setError(null)
    try {
      const [bars, financials] = await Promise.all([
        source.bars(code, { refresh: true }),
        source.financials(code, { refresh: true }),
      ])
      client.setQueryData(['bars', source.kind, code], bars)
      client.setQueryData(['financials', source.kind, code], financials)
    } catch (e) {
      setError(e)
    } finally {
      setRefreshing(false)
    }
  }, [client, code, source])

  return { refresh, refreshing, error }
}
