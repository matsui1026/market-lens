import { Link } from 'react-router'
import { EmptyState } from '../components/States'

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState title="ページが見つかりません">
        <Link className="btn" to="/">
          ホームへ
        </Link>
      </EmptyState>
    </div>
  )
}
