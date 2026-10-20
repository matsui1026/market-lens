import { useMemo } from 'react'
import { useApp } from '../../app/appContext'
import { formatDate, formatNumber } from '../../lib/format'
import { CHART_THEMES } from './chartTheme'
import { EChart, type ChartOption } from './EChart'
import { axisCommon, tooltipBase, tooltipHtml } from './tooltip'

export type CompareSeries = {
  code: string
  name: string
  /** Index into the categorical palette; follows the stock, not its position. */
  slot: number
  values: Array<{ date: string; value: number }>
}

export function CompareChart({ series, stale }: { series: CompareSeries[]; stale: boolean }) {
  const { resolvedTheme, reducedMotion } = useApp()
  const theme = CHART_THEMES[resolvedTheme]

  const option = useMemo<ChartOption>(() => {
    const dates = [...new Set(series.flatMap((s) => s.values.map((v) => v.date)))].sort()
    const ax = axisCommon(theme)
    const lookup = series.map((s) => new Map(s.values.map((v) => [v.date, v.value])))
    return {
      animation: !reducedMotion,
      animationDuration: 300,
      grid: { left: 52, right: 16, top: 16, bottom: 28 },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.muted, width: 1 } },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params]
          const first = list[0] as { dataIndex?: number } | undefined
          const date = first?.dataIndex === undefined ? undefined : dates[first.dataIndex]
          if (date === undefined) return ''
          return tooltipHtml(
            formatDate(date),
            series.map((s, i) => {
              const v = lookup[i]?.get(date)
              return {
                name: s.name,
                value: v === undefined ? '—' : formatNumber(v, 1),
                color: theme.series[s.slot % 4],
              }
            }),
          )
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        ...ax,
        splitLine: { show: false },
        axisLabel: { ...ax.axisLabel, formatter: (v: string) => v.slice(2).replaceAll('-', '/') },
      },
      yAxis: {
        type: 'value',
        scale: true,
        ...ax,
        axisLine: { show: false },
        axisLabel: { ...ax.axisLabel, formatter: (v: number) => formatNumber(v) },
      },
      series: series.map((s, i) => {
        const color = theme.series[s.slot % 4]
        return {
          name: s.name,
          type: 'line' as const,
          data: dates.map((d) => lookup[i]?.get(d) ?? '-'),
          showSymbol: false,
          connectNulls: true,
          lineStyle: { width: 2, color, cap: 'round' as const, join: 'round' as const },
          itemStyle: { color },
          // No end labels: lines that end close together would collide. The legend above
          // names every line, and the tooltip lists all values at the hovered date.
          emphasis: { focus: 'series' as const },
        }
      }),
    }
  }, [series, theme, reducedMotion])

  return (
    <>
      <ul className="chart-legend" aria-label="凡例">
        {series.map((s) => (
          <li key={s.code}>
            <span
              className="key-line"
              style={{ color: theme.series[s.slot % 4] }}
              aria-hidden="true"
            />
            {s.name}（{s.code}）
          </li>
        ))}
      </ul>
      <EChart
        option={option}
        height={380}
        stale={stale}
        testId="compare-chart"
        label={`${series.map((s) => s.name).join('、')}の値動きを、比較期間の初日を100として比べた折れ線グラフ。数値は下の表で確認できます。`}
      />
    </>
  )
}
