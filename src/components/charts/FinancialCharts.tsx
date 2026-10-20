import { useMemo } from 'react'
import { useApp } from '../../app/appContext'
import type { FinancialStatement } from '../../lib/data/types'
import { fiscalYearLabel, formatAxisYen, formatYenLarge } from '../../lib/format'
import { CHART_THEMES } from './chartTheme'
import { EChart, type ChartOption } from './EChart'
import { axisCommon, tooltipBase, tooltipHtml } from './tooltip'

type Metric = 'sales' | 'operatingProfit' | 'netProfit'

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: 'sales', label: '売上高' },
  { key: 'operatingProfit', label: '営業利益' },
  { key: 'netProfit', label: '純利益' },
]

function MetricChart({
  statements,
  metric,
  label,
}: {
  statements: FinancialStatement[]
  metric: Metric
  label: string
}) {
  const { resolvedTheme, reducedMotion } = useApp()
  const theme = CHART_THEMES[resolvedTheme]

  const option = useMemo<ChartOption>(() => {
    const ax = axisCommon(theme)
    const years = statements.map((s) =>
      fiscalYearLabel(s.fiscalYearEnd).replace('年', '/').replace('月期', ''),
    )
    const lastIndex = statements.length - 1
    return {
      animation: !reducedMotion,
      animationDuration: 300,
      grid: { left: 56, right: 12, top: 24, bottom: 28 },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { dataIndex?: number }
          const s = p.dataIndex === undefined ? undefined : statements[p.dataIndex]
          if (s === undefined) return ''
          return tooltipHtml(fiscalYearLabel(s.fiscalYearEnd), [
            { name: label, value: formatYenLarge(s[metric]) },
          ])
        },
      },
      xAxis: { type: 'category', data: years, ...ax, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        ...ax,
        axisLine: { show: false },
        splitNumber: 3,
        axisLabel: { ...ax.axisLabel, formatter: (v: number) => formatAxisYen(v) },
      },
      series: [
        {
          name: label,
          type: 'bar',
          barMaxWidth: 24,
          data: statements.map((s, i) => {
            const value = s[metric]
            return {
              value: value ?? '-',
              itemStyle: {
                color: theme.series[0],
                borderRadius: value !== null && value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0],
              },
              label: {
                show: i === lastIndex && value !== null,
                position: value !== null && value < 0 ? 'bottom' : 'top',
                color: theme.text2,
                fontSize: 11,
                formatter: () => formatYenLarge(value),
              },
            }
          }),
        },
      ],
    }
  }, [statements, metric, label, theme, reducedMotion])

  const latest = statements.at(-1)
  return (
    <div>
      <h3>{label}</h3>
      <EChart
        option={option}
        height={190}
        label={`${label}の推移（通期）。${latest === undefined ? '' : `直近の${fiscalYearLabel(latest.fiscalYearEnd)}は${formatYenLarge(latest[metric])}。`}数値は下の表で確認できます。`}
      />
    </div>
  )
}

export function FinancialCharts({ statements }: { statements: FinancialStatement[] }) {
  return (
    <div className="small-multiples" data-testid="financial-charts">
      {METRICS.map((m) => (
        <MetricChart key={m.key} statements={statements} metric={m.key} label={m.label} />
      ))}
    </div>
  )
}
