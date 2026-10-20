import { PERIODS, type PeriodId } from '../lib/analytics'

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodId
  onChange: (period: PeriodId) => void
}) {
  return (
    <div className="segmented" role="group" aria-label="期間">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.id === value}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
