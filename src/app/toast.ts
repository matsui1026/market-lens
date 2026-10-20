import { createContext, useContext } from 'react'

export type ToastInput = {
  message: string
  actionLabel?: string
  onAction?: () => void
}

export type ToastApi = { show: (toast: ToastInput) => void }

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
