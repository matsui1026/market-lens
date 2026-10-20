import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/appContext'
import { IS_DEMO_BUILD } from '../app/env'
import { errorCopy, toAppError } from '../lib/data/errorMessages'
import { Icon } from './Icon'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { sourceKind, setSourceKind } = useApp()
  const appError = toAppError(error)
  const copy = errorCopy(appError)
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">
        <Icon name="alert" />
        {copy.title}
      </p>
      <p>{copy.body}</p>
      {appError.retryAfterSec !== null && (
        <p className="muted small">再試行できるまでの目安: 約 {appError.retryAfterSec} 秒</p>
      )}
      {appError.detail !== '' && (
        <p className="state__detail">J-Quants からのメッセージ: {appError.detail}</p>
      )}
      <div className="row">
        {copy.retryable && onRetry !== undefined && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            <Icon name="refresh" size={18} />
            再試行
          </button>
        )}
        {copy.needsSetup && (
          <Link className="btn btn--primary" to="/setup">
            セットアップ手順を見る
          </Link>
        )}
        {!IS_DEMO_BUILD && sourceKind === 'jquants' && (
          <button type="button" className="btn" onClick={() => setSourceKind('demo')}>
            デモデータで試す
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children}
    </div>
  )
}

export function Skeleton({ height, width = '100%' }: { height: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warn'
}) {
  return (
    <div className={tone === 'warn' ? 'notice notice--warn' : 'notice'}>
      <Icon name={tone === 'warn' ? 'alert' : 'info'} size={16} />
      <div>{children}</div>
    </div>
  )
}
