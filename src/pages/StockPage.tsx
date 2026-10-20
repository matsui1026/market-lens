import { useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useApp } from '../app/appContext'
import { useCodeList } from '../app/codeLists'
import { useBars, useFinancials, useListings, useRefreshStock } from '../app/queries'
import { useToast } from '../app/toast'
import { useElapsed } from '../app/useElapsed'
import { FinancialCharts } from '../components/charts/FinancialCharts'
import { PriceChart, type PricePoint } from '../components/charts/PriceChart'
import { Icon } from '../components/Icon'
import { PeriodSelector } from '../components/PeriodSelector'
import { StatTiles } from '../components/StatTiles'
import { EmptyState, ErrorState, Notice, Skeleton } from '../components/States'
import { FinancialTable, PriceTable, TableToggle } from '../components/tables'
import {
  isPeriodId,
  MA_WINDOWS,
  movingAverage,
  PERIODS,
  sliceByPeriod,
  summarize,
  type PeriodId,
} from '../lib/analytics'
import { errorCopy } from '../lib/data/errorMessages'
import { annualResults } from '../lib/data/jquantsMapping'
import type { Loaded } from '../lib/data/types'
import { formatDate } from '../lib/format'
import { findByCode, normalizeQuery } from '../lib/search'

const CODE_LIKE = /^[0-9A-Z]{4}[0-9]?$/
const DEFAULT_PERIOD: PeriodId = '1y'

function DataNotice({ loaded, lastDate }: { loaded: Loaded<unknown>; lastDate: string | null }) {
  if (loaded.origin === 'demo') {
    return <Notice>架空のデモデータです。実在の企業・株価ではありません。</Notice>
  }
  const fetched = new Date(loaded.fetchedAt)
  const fetchedText = Number.isNaN(fetched.getTime())
    ? ''
    : fetched.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <Notice>
      データ: J-Quants API（あなたの API キーで取得し、この PC の中だけに保存）。最終取引日{' '}
      {formatDate(lastDate)}。{loaded.origin === 'cache' ? 'キャッシュから表示' : '取得'}:{' '}
      {fetchedText}。 Free プランのデータは約 12 週間遅れです。
    </Notice>
  )
}

/** Matches the page structure; `withHeader` adds the title rows (before the listing is known). */
function StockSkeleton({ withHeader }: { withHeader: boolean }) {
  return (
    <div className="stack-lg" aria-hidden="true">
      {withHeader && (
        <>
          <div className="stack">
            <Skeleton height={36} width="min(420px, 80%)" />
            <Skeleton height={20} width="min(260px, 60%)" />
          </div>
          <Skeleton height={48} width="min(380px, 100%)" />
        </>
      )}
      <div className="tiles">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={104} />
        ))}
      </div>
      <Skeleton height={460} />
    </div>
  )
}

export function StockPage() {
  const params = useParams()
  const code = normalizeQuery(params.code ?? '').toUpperCase()
  const [searchParams, setSearchParams] = useSearchParams()
  const periodParam = searchParams.get('period')
  const period: PeriodId = isPeriodId(periodParam) ? periodParam : DEFAULT_PERIOD

  const { sourceKind } = useApp()
  const listings = useListings()
  const listing = listings.data === undefined ? undefined : findByCode(listings.data.data, code)
  // If the listing master is unavailable, still try a code that looks valid.
  const fetchCode = listing?.code ?? (listings.isError && CODE_LIKE.test(code) ? code : null)
  const bars = useBars(fetchCode)
  const financials = useFinancials(fetchCode)
  const { refresh, refreshing, error: refreshError } = useRefreshStock(fetchCode)

  const watchlist = useCodeList('watchlist')
  const recent = useCodeList('recent')
  const addRecent = recent.add
  const toast = useToast()
  const slowLoad = useElapsed(
    sourceKind === 'jquants' && (listings.isPending || bars.isPending),
    2500,
  )

  useEffect(() => {
    if (listing !== undefined && bars.isSuccess) addRecent(listing.code)
  }, [listing, bars.isSuccess, addRecent])

  const name = listing?.name ?? code

  const view = useMemo(() => {
    if (bars.data === undefined) return null
    const all = bars.data.data
    const periodBars = sliceByPeriod(all, period)
    const ma25 = movingAverage(all, MA_WINDOWS[0])
    const ma75 = movingAverage(all, MA_WINDOWS[1])
    const offset = all.length - periodBars.length
    const points: PricePoint[] = periodBars.map((b, i) => ({
      ...b,
      ma25: ma25[offset + i] ?? null,
      ma75: ma75[offset + i] ?? null,
    }))
    return { points, summary: summarize(periodBars), lastDate: all.at(-1)?.date ?? null }
  }, [bars.data, period])

  const annual = useMemo(
    () => (financials.data === undefined ? [] : annualResults(financials.data.data).slice(-5)),
    [financials.data],
  )

  useEffect(() => {
    document.title =
      listing === undefined ? 'Market Lens' : `${listing.name}（${listing.code}）| Market Lens`
    return () => {
      document.title = 'Market Lens'
    }
  }, [listing])

  if (code === '') {
    return (
      <div className="page">
        <EmptyState title="銘柄コードを指定してください">
          <Link to="/">銘柄を検索する</Link>
        </EmptyState>
      </div>
    )
  }

  if (listings.isPending && !listings.isError) {
    return (
      <div className="page">
        <StockSkeleton withHeader />
        {slowLoad && <SlowNotice />}
      </div>
    )
  }

  if (listings.isError && fetchCode === null) {
    return (
      <div className="page">
        <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
      </div>
    )
  }

  if (listings.isSuccess && listing === undefined) {
    return (
      <div className="page">
        <EmptyState title={`銘柄コード「${code}」は見つかりません`}>
          <p className="muted">
            {sourceKind === 'demo'
              ? 'デモデータの銘柄コードは DM01〜DM10 です。'
              : '上場銘柄一覧にないコードです。コードを確認してください。'}
          </p>
          <Link className="btn" to="/">
            銘柄を検索する
          </Link>
        </EmptyState>
      </div>
    )
  }

  const inWatchlist = watchlist.has(listing?.code ?? code)
  function toggleWatchlist() {
    const target = listing?.code ?? code
    if (inWatchlist) {
      const index = watchlist.remove(target)
      toast.show({
        message: `${name} をウォッチリストから外しました`,
        actionLabel: '元に戻す',
        onAction: () => watchlist.restore(target, index),
      })
    } else {
      watchlist.add(target)
      toast.show({ message: `${name} をウォッチリストに追加しました` })
    }
  }

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? ''

  return (
    <div className="page stack-lg">
      <section className="stack">
        <div className="spread">
          <div className="stack" style={{ gap: 6 }}>
            <h1 className="stock-title">
              <span>{name}</span>
              <span className="stock-code">{listing?.code ?? code}</span>
            </h1>
            {listing !== undefined && (
              <div className="chips">
                {[listing.market, listing.sector33, listing.scale]
                  .filter((v) => v !== '')
                  .map((v) => (
                    <span key={v} className="chip">
                      {v}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              aria-pressed={inWatchlist}
              onClick={toggleWatchlist}
              data-testid="watchlist-toggle"
            >
              <Icon name={inWatchlist ? 'starFilled' : 'star'} size={18} />
              {inWatchlist ? 'ウォッチリスト登録済み' : 'ウォッチリストに追加'}
            </button>
            <Link
              className="btn"
              to={`/compare?codes=${encodeURIComponent(listing?.code ?? code)}`}
            >
              <Icon name="compare" size={18} />
              比較する
            </Link>
            {sourceKind === 'jquants' && (
              <button
                type="button"
                className="btn"
                onClick={() => void refresh()}
                disabled={refreshing || bars.isPending}
              >
                <Icon name="refresh" size={18} />
                {refreshing ? '取得中…' : '再取得'}
              </button>
            )}
          </div>
        </div>
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

      {refreshError !== null && (
        <Notice tone="warn">
          再取得できませんでした: {errorCopy(refreshError).title}。{errorCopy(refreshError).body}
        </Notice>
      )}

      {bars.isPending && (
        <>
          <StockSkeleton withHeader={false} />
          {slowLoad && <SlowNotice />}
        </>
      )}

      {bars.isError && <ErrorState error={bars.error} onRetry={() => void bars.refetch()} />}

      {view !== null && view.points.length === 0 && (
        <EmptyState title="この期間の株価データはありません">
          <p className="muted">期間を「全期間」に変えるか、別の銘柄を選んでください。</p>
        </EmptyState>
      )}

      {view !== null && view.points.length > 0 && bars.data !== undefined && (
        <>
          <StatTiles summary={view.summary} />
          <section className="card" aria-labelledby="price-heading">
            <div className="card__head">
              <h2 id="price-heading">株価（{periodLabel}）</h2>
              <span className="card__sub">
                {formatDate(view.points[0]?.date)} 〜 {formatDate(view.points.at(-1)?.date)}
                ・調整済み株価
              </span>
            </div>
            <PriceChart points={view.points} stale={bars.isFetching || refreshing} name={name} />
            <TableToggle summary="表で見る" testId="price-table-toggle">
              {() => <PriceTable points={view.points} name={name} />}
            </TableToggle>
          </section>
          <DataNotice loaded={bars.data} lastDate={view.lastDate} />
        </>
      )}

      {fetchCode !== null && (
        <section className="card" aria-labelledby="fin-heading">
          <div className="card__head">
            <h2 id="fin-heading">業績の推移（通期）</h2>
            <span className="card__sub">決算短信の数値・直近 5 期まで</span>
          </div>
          {financials.isPending && <Skeleton height={220} />}
          {financials.isError && (
            <ErrorState error={financials.error} onRetry={() => void financials.refetch()} />
          )}
          {financials.isSuccess && annual.length === 0 && (
            <p className="muted">
              通期決算のデータがありません。Free プランで取得できるのは約 2 年分です。
            </p>
          )}
          {annual.length > 0 && (
            <>
              <FinancialCharts statements={annual} />
              <TableToggle
                summary="表で見る（EPS・ROE・自己資本比率を含む）"
                testId="fin-table-toggle"
              >
                {() => <FinancialTable statements={annual} />}
              </TableToggle>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function SlowNotice() {
  return (
    <div style={{ marginTop: 16 }}>
      <Notice>
        J-Quants から取得しています。Free プランは 1 分間に 5
        回までのため、待ち時間が出ることがあります。一度取得したデータは、次回からこの PC
        のキャッシュですぐに表示されます。
      </Notice>
    </div>
  )
}
