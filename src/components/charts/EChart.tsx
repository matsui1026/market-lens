import { BarChart, CandlestickChart, LineChart } from 'echarts/charts'
import type { BarSeriesOption, CandlestickSeriesOption, LineSeriesOption } from 'echarts/charts'
import { AxisPointerComponent, GridComponent, TooltipComponent } from 'echarts/components'
import type {
  AxisPointerComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import {
  init,
  use as registerEChartsModules,
  type ComposeOption,
  type EChartsType,
} from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

registerEChartsModules([
  BarChart,
  CandlestickChart,
  LineChart,
  AxisPointerComponent,
  GridComponent,
  TooltipComponent,
  SVGRenderer,
])

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | CandlestickSeriesOption
  | LineSeriesOption
  | AxisPointerComponentOption
  | GridComponentOption
  | TooltipComponentOption
>

/**
 * Thin ECharts wrapper: SVG renderer, resizes with its container, disposed on unmount.
 * The chart is described for screen readers by `label`; every chart also has a table view.
 */
export function EChart({
  option,
  height,
  label,
  stale = false,
  testId,
}: {
  option: ChartOption
  height: number
  label: string
  stale?: boolean
  testId?: string
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (element === null) return
    const chart = init(element, null, { renderer: 'svg' })
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  return (
    <div
      ref={elementRef}
      className="chart"
      style={{ height }}
      role="img"
      aria-label={label}
      data-stale={stale}
      data-testid={testId}
    />
  )
}
