import { useEffect, useState } from 'react'

/** True once `active` has stayed true for `ms` milliseconds. */
export function useElapsed(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setElapsed(true), ms)
    return () => {
      window.clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, ms])
  return active && elapsed
}
