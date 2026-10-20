import { useEffect } from 'react'
import { useApp } from '../app/appContext'
import { useCodeList } from '../app/codeLists'
import { useListings } from '../app/queries'
import { useToast } from '../app/toast'
import { SearchBox } from '../components/SearchBox'
import { ErrorState, Notice } from '../components/States'
import { StockList } from '../components/StockList'

export function HomePage() {
  const { sourceKind } = useApp()
  const listings = useListings()
  const watchlist = useCodeList('watchlist')
  const recent = useCodeList('recent')
  const toast = useToast()

  // Warm up the chart page code while the user is typing.
  useEffect(() => {
    void import('./StockPage')
  }, [])

  function removeFromWatchlist(code: string) {
    const index = watchlist.remove(code)
    const name = listings.data?.data.find((l) => l.code === code)?.name ?? code
    toast.show({
      message: `${name} をウォッチリストから外しました`,
      actionLabel: '元に戻す',
      onAction: () => watchlist.restore(code, index),
    })
  }

  const list = listings.data?.data
  return (
    <div className="page stack-lg">
      <section className="hero">
        <h1>銘柄を調べる</h1>
        <p>銘柄コードか社名を入力して、株価チャートと基本指標を表示します。</p>
        <SearchBox variant="hero" autoFocus testId="hero-search" />
        {sourceKind === 'demo' && (
          <Notice>
            デモデータを表示しています。会社名・株価・財務はすべて架空です（DM01〜DM10）。
          </Notice>
        )}
      </section>

      {listings.isError && (
        <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
      )}

      <section className="stack" aria-labelledby="watchlist-heading">
        <h2 id="watchlist-heading">ウォッチリスト</h2>
        {watchlist.codes.length === 0 ? (
          <p className="muted">
            まだありません。銘柄画面の「ウォッチリストに追加」で保存できます。
          </p>
        ) : (
          <StockList
            codes={watchlist.codes}
            listings={list}
            onRemove={removeFromWatchlist}
            removeLabel="ウォッチリストから外す"
            testId="watchlist"
          />
        )}
      </section>

      {recent.codes.length > 0 && (
        <section className="stack" aria-labelledby="recent-heading">
          <h2 id="recent-heading">最近見た銘柄</h2>
          <StockList codes={recent.codes} listings={list} testId="recent" />
        </section>
      )}

      {sourceKind === 'demo' && list !== undefined && (
        <section className="stack" aria-labelledby="demo-heading">
          <h2 id="demo-heading">デモ銘柄</h2>
          <StockList codes={list.map((l) => l.code)} listings={list} testId="demo-list" />
        </section>
      )}
    </div>
  )
}
