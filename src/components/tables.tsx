import { useState, type ReactNode } from 'react'
import type { FinancialStatement } from '../lib/data/types'
import {
  fiscalYearLabel,
  formatDate,
  formatNumber,
  formatPercent,
  formatPrice,
  formatVolume,
  formatYenLarge,
} from '../lib/format'
import type { PricePoint } from './charts/PriceChart'

/** Collapsible table view. Rows render only while open, so long tables cost nothing when closed. */
export function TableToggle({
  summary,
  children,
  testId,
}: {
  summary: string
  children: () => ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="table-toggle"
      data-testid={testId}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>{summary}</summary>
      {open && children()}
    </details>
  )
}

export function PriceTable({ points, name }: { points: PricePoint[]; name: string }) {
  const rows = [...points].reverse()
  return (
    <div
      className="table-wrap table-wrap--scroll"
      role="region"
      tabIndex={0}
      aria-label={`${name}の日次データ（新しい順）`}
    >
      <table className="data">
        <caption>日次データ（調整済み株価・新しい順、{rows.length}営業日）</caption>
        <thead>
          <tr>
            <th scope="col">日付</th>
            <th scope="col">始値</th>
            <th scope="col">高値</th>
            <th scope="col">安値</th>
            <th scope="col">終値</th>
            <th scope="col">出来高</th>
            <th scope="col">売買代金</th>
            <th scope="col">25日平均</th>
            <th scope="col">75日平均</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatDate(p.date)}</th>
              <td>{formatPrice(p.open)}</td>
              <td>{formatPrice(p.high)}</td>
              <td>{formatPrice(p.low)}</td>
              <td>{formatPrice(p.close)}</td>
              <td>{formatVolume(p.volume)}</td>
              <td>{formatYenLarge(p.turnover)}</td>
              <td>{formatNumber(p.ma25, 1)}</td>
              <td>{formatNumber(p.ma75, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FinancialTable({ statements }: { statements: FinancialStatement[] }) {
  return (
    <div className="table-wrap" role="region" tabIndex={0} aria-label="通期決算の数値">
      <table className="data" data-testid="financial-table">
        <caption>通期決算（決算短信）</caption>
        <thead>
          <tr>
            <th scope="col">決算期</th>
            <th scope="col">売上高</th>
            <th scope="col">営業利益</th>
            <th scope="col">純利益</th>
            <th scope="col">EPS</th>
            <th scope="col">ROE</th>
            <th scope="col">自己資本比率</th>
            <th scope="col">開示日</th>
          </tr>
        </thead>
        <tbody>
          {[...statements].reverse().map((s) => (
            <tr key={s.fiscalYearEnd}>
              <th scope="row">{fiscalYearLabel(s.fiscalYearEnd)}</th>
              <td>{formatYenLarge(s.sales)}</td>
              <td>{formatYenLarge(s.operatingProfit)}</td>
              <td>{formatYenLarge(s.netProfit)}</td>
              <td>{s.eps === null ? '—' : `${formatNumber(s.eps, 2)}円`}</td>
              <td>{formatPercent(s.roe)}</td>
              <td>{formatPercent(s.equityRatio)}</td>
              <td>{formatDate(s.disclosedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
