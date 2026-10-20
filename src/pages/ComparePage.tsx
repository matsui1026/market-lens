import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useApp } from '../app/appContext'
import { useListings } from '../app/queries'
import { useToast } from '../app/toast'
import { CompareChart, type CompareSeries } from '../components/charts/CompareChart'
import { CorrelationTable } from '../components/charts/CorrelationTable'
import { Icon } from '../components/Icon'
import { PeriodSelector } from '../components/PeriodSelector'
import { SearchBox } from '../components/SearchBox'
import { EmptyState, ErrorState, Notice, Skeleton } from '../components/States'
import { TableToggle } from '../components/tables'
import { isPeriodId, type PeriodId } from '../lib/analytics'
import {
  compareStocks,
  MAX_COMPARE,
  parseCodes,
  reconcileSlots,
  type SlotEntry,
} from '../lib/compare'
import type { Bar, Loaded } from '../lib/data/types'
import { formatDate, formatNumber, formatPercent, formatYenLarge } from '../lib/format'

const DEFAULT_PERIOD: PeriodId = '1y'

/** Module-level so TanStack Query re-runs it only when a result actually changes. */
function combineBars(results: Array<UseQueryResult<Loaded<Bar[]>>>) {
  return {
    datas: results.map((r) => r.data),
    pending: results.some((r) => r.isPending),
    fetching: results.some((r) => r.isFetching),
    error: results.find((r) => r.isError)?.error ?? null,
    retryFailed: () => {
      for (const r of results) if (r.isError) void r.refetch()
    },
  }
}

/** Codes in the URL right now (used by undo, which runs after later changes). */
function currentCodes(): string[] {
  const query = window.location.hash.split('?')[1] ?? ''
  return parseCodes(new URLSearchParams(query).get('codes'))
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const codesKey = searchParams.get('codes') ?? ''
  const codes = useMemo(() => parseCodes(codesKey), [codesKey])
  const periodParam = searchParams.get('period')
  const period: PeriodId = isPeriodId(periodParam) ? periodParam : DEFAULT_PERIOD

  // Color slots follow each stock across additions/removals (derived-state pattern).
  const [slotState, setSlotState] = useState<{ key: string; entries: SlotEntry[] }>(() => ({
    key: codesKey,
    entries: reconcileSlots([], codes),
  }))
  let entries = slotState.entries
  if (slotState.key !== codesKey) {
    entries = reconcileSlots(slotState.entries, codes)
    setSlotState({ key: codesKey, entries })
  }

  const { source, sourceKind } = useApp()
  const listings = useListings()
  const toast = useToast()
  const byCode = useMemo(
    () => new Map((listings.data?.data ?? []).map((l) => [l.code, l])),
    [listings.data],
  )

  const bars = useQueries({
    queries: codes.map((code) => ({
      queryKey: ['bars', source.kind, code],
      queryFn: () => source.bars(code),
      staleTime: source.kind === 'demo' ? Infinity : 30 * 60_000,
    })),
    combine: combineBars,
  })

  function setCodes(next: string[]) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next.length === 0) p.delete('codes')
        else p.set('codes', next.join(','))
        return p
      },
      { replace: false },
    )
  }

  function add(code: string) {
    if (codes.includes(code) || codes.length >= MAX_COMPARE) return
    setCodes([...codes, code])
  }

  function remove(code: string) {
    const index = codes.indexOf(code)
    setCodes(codes.filter((c) => c !== code))
    toast.show({
      message: `${byCode.get(code)?.name ?? code} を比較から外しました`,
      actionLabel: '元に戻す',
      onAction: () => {
        const current = currentCodes()
        if (current.includes(code) || current.length >= MAX_COMPARE) return
        setCodes([...current.slice(0, index), code, ...current.slice(index)])
      },
    })
  }

  const unknownCodes = listings.isSuccess ? codes.filter((c) => !byCode.has(c)) : []

  const comparison = useMemo(() => {
    if (codes.length < 2 || bars.datas.length !== codes.length) return null
    const inputs = []
    for (const [i, code] of codes.entries()) {
      const loaded = bars.datas[i]
      if (loaded === undefined) return null
      inputs.push({ code, bars: loaded.data })
    }
    return compareStocks(inputs, period)
  }, [codes, period, bars.datas])

  const series: CompareSeries[] =
    comparison?.series.map((s) => ({
      code: s.code,
      name: byCode.get(s.code)?.name ?? s.code,
      slot: entries.find((e) => e.code === s.code)?.slot ?? 0,
      values: s.values,
    })) ?? []

  const hasRange = comparison !== null && comparison.start !== null

  return (
    <div className="page stack-lg">
      <section className="stack">
        <h1>銘柄を比較</h1>
        <p className="muted">
          最大 {MAX_COMPARE} 銘柄の値動きを、比較期間の初日を 100 にそろえて比べます。
        </p>
        <div style={{ maxWidth: 520 }}>
          <SearchBox
            label="比較する銘柄を追加"
            placeholder={
              codes.length >= MAX_COMPARE
                ? `比較できるのは ${MAX_COMPARE} 銘柄までです`
                : '追加する銘柄コードまたは社名'
            }
            onSelect={(item) => add(item.code)}
            excludeCodes={codes}
            disabled={codes.length >= MAX_COMPARE}
            testId="compare-search"
          />
        </div>
        {codes.length > 0 && (
          <ul className="compare-chips" aria-label="比較中の銘柄" data-testid="compare-chips">
            {entries.map((entry) => (
              <li key={entry.code} className="compare-chip">
                <Link to={`/stock/${encodeURIComponent(entry.code)}`}>
                  {byCode.get(entry.code)?.name ?? entry.code}
                </Link>
                <span className="muted small">{entry.code}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  aria-label={`${byCode.get(entry.code)?.name ?? entry.code} を比較から外す`}
                  onClick={() => remove(entry.code)}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <PeriodSelector
          value={period}
          onChange={(next) =>
            setSearchParams(
              (prev) => {
                const p = new URLSearchParams(prev)
                p.set('period', next)
                return p
              },
              { replace: true },
            )
          }
        />
      </section>

      {unknownCodes.length > 0 && (
        <Notice tone="warn">見つからない銘柄コードがあります: {unknownCodes.join('、')}</Notice>
      )}

      {codes.length < 2 && (
        <EmptyState title="比べたい銘柄を 2 つ以上追加してください">
          {sourceKind === 'demo' && listings.data !== undefined && (
            <div className="row">
              {listings.data.data
                .filter((l) => !codes.includes(l.code))
                .slice(0, 4)
                .map((l) => (
                  <button key={l.code} type="button" className="btn" onClick={() => add(l.code)}>
                    <Icon name="plus" size={16} />
                    {l.name}
                  </button>
                ))}
            </div>
          )}
        </EmptyState>
      )}

      {bars.error !== null && <ErrorState error={bars.error} onRetry={bars.retryFailed} />}

      {codes.length >= 2 && bars.pending && bars.error === null && <Skeleton height={420} />}

      {comparison !== null && !hasRange && (
        <EmptyState title="すべての銘柄にデータがある期間がありません">
          <p className="muted">期間を長くするか、銘柄を入れ替えてください。</p>
        </EmptyState>
      )}

      {comparison !== null && hasRange && (
        <>
          <section className="card" aria-labelledby="compare-heading">
            <div className="card__head">
              <h2 id="compare-heading">値動きの比較（初日 = 100）</h2>
              <span className="card__sub">
                比較期間: {formatDate(comparison.start)} 〜 {formatDate(comparison.end)}
                （すべての銘柄にデータがある期間）
              </span>
            </div>
            <CompareChart series={series} stale={bars.fetching} />
            <TableToggle summary="表で見る（指数の推移）" testId="compare-table-toggle">
              {() => <IndexTable series={series} />}
            </TableToggle>
          </section>

          <section className="card" aria-labelledby="metrics-heading">
            <div className="card__head">
              <h2 id="metrics-heading">指標の比較</h2>
              <span className="card__sub">比較期間で計算</span>
            </div>
            <div className="table-wrap" role="region" tabIndex={0} aria-label="指標の比較表">
              <table className="data" data-testid="compare-metrics">
                <thead>
                  <tr>
                    <th scope="col">銘柄</th>
                    <th scope="col">騰落率</th>
                    <th scope="col">年率ボラティリティ</th>
                    <th scope="col">最大下落率</th>
                    <th scope="col">平均売買代金</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.series.map((s) => (
                    <tr key={s.code}>
                      <th scope="row">{byCode.get(s.code)?.name ?? s.code}</th>
                      <td>{formatPercent(s.summary.periodReturn, { signed: true })}</td>
                      <td>{formatPercent(s.summary.volatility)}</td>
                      <td>
                        {formatPercent(s.summary.maxDrawdown?.value ?? null, { signed: true })}
                      </td>
                      <td>{formatYenLarge(s.summary.averageTurnover)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-labelledby="corr-heading">
            <div className="card__head">
              <h2 id="corr-heading">値動きの相関</h2>
              <span className="card__sub">
                +1 に近いほど同じ方向に動き、−1 に近いほど逆に動きます
              </span>
            </div>
            <CorrelationTable
              names={comparison.series.map((s) => ({
                code: s.code,
                name: byCode.get(s.code)?.name ?? s.code,
              }))}
              matrix={comparison.correlations}
            />
          </section>
        </>
      )}
    </div>
  )
}

function IndexTable({ series }: { series: CompareSeries[] }) {
  const dates = [...new Set(series.flatMap((s) => s.values.map((v) => v.date)))].sort().reverse()
  const lookups = series.map((s) => new Map(s.values.map((v) => [v.date, v.value])))
  return (
    <div
      className="table-wrap table-wrap--scroll"
      role="region"
      tabIndex={0}
      aria-label="指数の推移（新しい順）"
    >
      <table className="data">
        <caption>初日 = 100 とした指数（新しい順）</caption>
        <thead>
          <tr>
            <th scope="col">日付</th>
            {series.map((s) => (
              <th key={s.code} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => (
            <tr key={d}>
              <th scope="row">{formatDate(d)}</th>
              {lookups.map((m, i) => (
                <td key={series[i]?.code ?? i}>{formatNumber(m.get(d) ?? null, 1)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
