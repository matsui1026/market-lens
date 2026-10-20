import { Link } from 'react-router'
import type { Listing } from '../lib/data/types'
import { Icon } from './Icon'

export function StockList({
  codes,
  listings,
  onRemove,
  removeLabel = 'リストから外す',
  testId,
}: {
  codes: string[]
  listings: Listing[] | undefined
  onRemove?: (code: string) => void
  removeLabel?: string
  testId?: string
}) {
  const byCode = new Map((listings ?? []).map((l) => [l.code, l]))
  return (
    <ul className="stock-list" data-testid={testId}>
      {codes.map((code) => {
        const listing = byCode.get(code)
        const name =
          listing?.name ?? (listings === undefined ? '読み込み中…' : '（一覧にない銘柄）')
        return (
          <li key={code} className="stock-list__item">
            <Link className="stock-list__link" to={`/stock/${encodeURIComponent(code)}`}>
              <span className="code">{code}</span>
              <span className="name">{name}</span>
            </Link>
            {onRemove !== undefined && (
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label={`${listing?.name ?? code} を${removeLabel}`}
                onClick={() => onRemove(code)}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
