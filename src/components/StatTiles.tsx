import type { Summary } from '../lib/analytics'
import { formatDate, formatPercent, formatPrice, formatYenLarge } from '../lib/format'

function Tile({
  label,
  value,
  note,
  testId,
}: {
  label: string
  value: string
  note: string
  testId: string
}) {
  return (
    <div className="tile" data-testid={testId}>
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
      <span className="tile__note">{note}</span>
    </div>
  )
}

export function StatTiles({ summary }: { summary: Summary }) {
  // No ▲/▼: in Japanese accounting "▲" often means a negative number.
  const ret = summary.periodReturn
  const dd = summary.maxDrawdown
  return (
    <section className="tiles" aria-label="期間の基本指標">
      <Tile
        testId="tile-return"
        label="期間騰落率"
        value={formatPercent(ret, { signed: true })}
        note={
          summary.first !== null && summary.last !== null
            ? `${formatPrice(summary.first.close)} → ${formatPrice(summary.last.close)}`
            : 'データが足りません'
        }
      />
      <Tile
        testId="tile-volatility"
        label="年率ボラティリティ"
        value={formatPercent(summary.volatility)}
        note="日次リターンの標準偏差 × √245"
      />
      <Tile
        testId="tile-drawdown"
        label="最大下落率"
        value={formatPercent(dd === null ? null : dd.value, { signed: true })}
        note={
          dd === null || dd.value === 0
            ? '期間中に高値からの下落はありません'
            : `${formatDate(dd.peakDate)} → ${formatDate(dd.troughDate)}`
        }
      />
      <Tile
        testId="tile-turnover"
        label="平均売買代金"
        value={formatYenLarge(summary.averageTurnover)}
        note={`1日あたり（${summary.tradingDays}営業日）`}
      />
    </section>
  )
}
