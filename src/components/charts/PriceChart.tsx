import { useMemo } from 'react'
import { useApp } from '../../app/appContext'
import type { Bar } from '../../lib/data/types'
import { formatDate, formatNumber, formatPrice, formatVolume } from '../../lib/format'
import { CHART_THEMES } from './chartTheme'
import { EChart, type ChartOption } from './EChart'
import { axisCommon, tooltipBase, tooltipHtml, type TooltipRow } from './tooltip'

export type PricePoint = Bar & { ma25: number | null; ma75: number | null }

function shortDate(iso: string): string {
  return iso.slice(2).replaceAll('-', '/')
}

/** Candles (ink: hollow up / filled down), 25- and 75-day moving averages, and volume. */
export function PriceChart({
  points,
  stale,
  name,
}: {
  points: PricePoint[]
  stale: boolean
  name: string
}) {
  const { resolvedTheme, reducedMotion } = useApp()
  const theme = CHART_THEMES[resolvedTheme]

  const option = useMemo<ChartOption>(() => {
    const dates = points.map((p) => p.date)
    const [ma25Color, ma75Color] = theme.series
    // ECharts order is [open, close, low, high]; '-' marks a day without trades.
    const candles = points.map((p): Array<number | '-'> =>
      p.open === null || p.close === null || p.low === null || p.high === null
        ? ['-', '-', '-', '-']
        : [p.open, p.close, p.low, p.high],
    )
    const ax = axisCommon(theme)
    return {
      animation: !reducedMotion,
      animationDuration: 300,
      // The two moving averages converge often, so they are named by the legend above
      // instead of end labels that would collide.
      grid: [
        { left: 64, right: 16, top: 12, height: '62%' },
        { left: 64, right: 16, top: '76%', bottom: 28 },
      ],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.muted, width: 1 } },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params]
          const first = list[0] as { dataIndex?: number } | undefined
          const point = first?.dataIndex === undefined ? undefined : points[first.dataIndex]
          if (point === undefined) return ''
          const rows: TooltipRow[] =
            point.close === null
              ? [{ name: '取引', value: 'なし' }]
              : [
                  { name: '始値', value: formatPrice(point.open) },
                  { name: '高値', value: formatPrice(point.high) },
                  { name: '安値', value: formatPrice(point.low) },
                  { name: '終値', value: formatPrice(point.close) },
                  { name: '出来高', value: formatVolume(point.volume) },
                ]
          rows.push(
            {
              name: '25日移動平均',
              value: point.ma25 === null ? '—' : `${formatNumber(point.ma25, 1)}円`,
              color: ma25Color,
            },
            {
              name: '75日移動平均',
              value: point.ma75 === null ? '—' : `${formatNumber(point.ma75, 1)}円`,
              color: ma75Color,
            },
          )
          return tooltipHtml(formatDate(point.date), rows)
        },
      },
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          ...ax,
          splitLine: { show: false },
          axisLabel: { ...ax.axisLabel, show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          ...ax,
          splitLine: { show: false },
          axisLabel: { ...ax.axisLabel, formatter: shortDate },
        },
      ],
      yAxis: [
        {
          type: 'value',
          scale: true,
          ...ax,
          axisLine: { show: false },
          axisLabel: { ...ax.axisLabel, formatter: (v: number) => formatNumber(v) },
        },
        {
          type: 'value',
          gridIndex: 1,
          ...ax,
          axisLine: { show: false },
          splitNumber: 2,
          axisLabel: {
            ...ax.axisLabel,
            formatter: (v: number) => (v === 0 ? '0' : formatVolume(v).replace('株', '')),
          },
        },
      ],
      series: [
        {
          name: '株価',
          type: 'candlestick',
          data: candles,
          barMaxWidth: 10,
          itemStyle: {
            color: theme.surface,
            color0: theme.candle,
            borderColor: theme.candle,
            borderColor0: theme.candle,
            borderWidth: 1,
          },
        },
        {
          name: '25日移動平均',
          type: 'line',
          data: points.map((p) => p.ma25 ?? '-'),
          showSymbol: false,
          connectNulls: true,
          lineStyle: { width: 2, color: ma25Color, cap: 'round', join: 'round' },
          itemStyle: { color: ma25Color },
          emphasis: { disabled: true },
        },
        {
          name: '75日移動平均',
          type: 'line',
          data: points.map((p) => p.ma75 ?? '-'),
          showSymbol: false,
          connectNulls: true,
          lineStyle: { width: 2, color: ma75Color, cap: 'round', join: 'round' },
          itemStyle: { color: ma75Color },
          emphasis: { disabled: true },
        },
        {
          name: '出来高',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: points.map((p) => p.volume ?? '-'),
          barMaxWidth: 10,
          itemStyle: { color: theme.volume, borderRadius: [2, 2, 0, 0] },
          emphasis: { disabled: true },
        },
      ],
    }
  }, [points, theme, reducedMotion])

  const first = points.find((p) => p.close !== null)
  const last = [...points].reverse().find((p) => p.close !== null)
  const label =
    first !== undefined && last !== undefined
      ? `${name}の株価チャート。${formatDate(first.date)}から${formatDate(last.date)}まで、終値は${formatPrice(first.close)}から${formatPrice(last.close)}。数値は下の表で確認できます。`
      : `${name}の株価チャート。表示できるデータがありません。`

  return (
    <>
      <ul className="chart-legend" aria-label="凡例">
        <li>
          <span className="key-candle" aria-hidden="true" />
          陽線（終値 ≥ 始値）
        </li>
        <li>
          <span className="key-candle key-candle--down" aria-hidden="true" />
          陰線（終値 &lt; 始値）
        </li>
        <li>
          <span className="key-line" style={{ color: theme.series[0] }} aria-hidden="true" />
          25日移動平均
        </li>
        <li>
          <span className="key-line" style={{ color: theme.series[1] }} aria-hidden="true" />
          75日移動平均
        </li>
      </ul>
      <EChart option={option} height={420} label={label} stale={stale} testId="price-chart" />
    </>
  )
}
