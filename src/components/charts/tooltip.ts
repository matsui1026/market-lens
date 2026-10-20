import type { ChartTheme } from './chartTheme'
import { escapeHtml } from './chartTheme'

export type TooltipRow = { name: string; value: string; color?: string; key?: 'line' | 'none' }

/**
 * Builds tooltip HTML. Every string is escaped: names may come from the API.
 * Values lead (bold), names follow — the reader already knows the series.
 */
export function tooltipHtml(title: string, rows: TooltipRow[]): string {
  const body = rows
    .map((row) => {
      const key =
        row.color !== undefined && row.key !== 'none'
          ? `<span style="display:inline-block;width:14px;border-top:2px solid ${escapeHtml(row.color)};border-radius:2px"></span>`
          : ''
      return `<div class="chart-tooltip__row"><span class="chart-tooltip__name">${key}${escapeHtml(row.name)}</span><span class="chart-tooltip__value">${escapeHtml(row.value)}</span></div>`
    })
    .join('')
  return `<div class="chart-tooltip"><div class="chart-tooltip__date">${escapeHtml(title)}</div>${body}</div>`
}

export function tooltipBase(theme: ChartTheme) {
  return {
    backgroundColor: theme.tooltipBg,
    borderColor: theme.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: theme.text, fontSize: 13 },
    extraCssText: 'border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.12);',
    confine: true,
  }
}

export function axisCommon(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.axis, width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: theme.text2, fontSize: 11, hideOverlap: true },
    splitLine: { lineStyle: { color: theme.grid, width: 1, type: 'solid' as const } },
  }
}
