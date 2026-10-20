import { useApp } from '../../app/appContext'
import { MIN_CORRELATION_DAYS } from '../../lib/analytics'
import { formatNumber } from '../../lib/format'
import { CHART_THEMES, divergingColor, inkOn } from './chartTheme'

export type CorrelationCell = { value: number; days: number } | null

/**
 * Correlation matrix as an HTML table with a diverging color scale
 * (blue = moves opposite, gray = unrelated, red = moves together).
 * The numbers are always printed, so color is never the only channel.
 */
export function CorrelationTable({
  names,
  matrix,
}: {
  names: Array<{ code: string; name: string }>
  matrix: CorrelationCell[][]
}) {
  const { resolvedTheme } = useApp()
  const theme = CHART_THEMES[resolvedTheme]
  const gradient = `linear-gradient(90deg, ${theme.diverging.negative}, ${theme.diverging.mid}, ${theme.diverging.positive})`

  return (
    <div>
      <div className="table-wrap">
        <table className="data heatmap" data-testid="correlation-table">
          <caption>日次リターンの相関係数（−1〜+1）</caption>
          <thead>
            <tr>
              <th scope="col">銘柄</th>
              {names.map((n) => (
                <th key={n.code} scope="col">
                  {n.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((row, i) => (
              <tr key={row.code}>
                <th scope="row">{row.name}</th>
                {names.map((col, j) => {
                  const cell = matrix[i]?.[j] ?? null
                  if (cell === null) {
                    return (
                      <td
                        key={col.code}
                        title={`共通の取引日が${MIN_CORRELATION_DAYS}日未満のため計算できません`}
                      >
                        —
                      </td>
                    )
                  }
                  const fill = divergingColor(theme, cell.value)
                  return (
                    <td
                      key={col.code}
                      style={{ background: fill, color: inkOn(fill) }}
                      title={`${cell.days}日分のリターンから計算`}
                    >
                      {formatNumber(cell.value, 2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-scale" aria-hidden="true">
        <span>−1 逆に動く</span>
        <span className="heatmap-scale__bar" style={{ background: gradient }} />
        <span>+1 同じに動く</span>
      </div>
    </div>
  )
}
