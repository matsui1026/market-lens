import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi, type ToastInput } from '../app/toast'

const DURATION_MS = 7000

type ActiveToast = ToastInput & { id: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const [paused, setPaused] = useState(false)
  const nextId = useRef(1)

  const show = useCallback((input: ToastInput) => {
    setToast({ ...input, id: nextId.current++ })
  }, [])

  useEffect(() => {
    if (toast === null || paused) return
    const timer = window.setTimeout(() => setToast(null), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {toast !== null && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            <div className="row">
              {toast.actionLabel !== undefined && toast.onAction !== undefined && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    toast.onAction?.()
                    setToast(null)
                    setPaused(false)
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                type="button"
                className="btn btn--icon"
                aria-label="通知を閉じる"
                onClick={() => {
                  setToast(null)
                  setPaused(false)
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
