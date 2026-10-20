export type Clock = {
  now(): number
  sleep(ms: number): Promise<void>
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** Thrown when a request could not get a slot before its deadline. */
export class QueueTimeoutError extends Error {
  readonly retryAfterSec: number
  constructor(retryAfterSec: number) {
    super('rate limit queue timeout')
    this.name = 'QueueTimeoutError'
    this.retryAfterSec = retryAfterSec
  }
}

/**
 * First-in-first-out sliding-window limiter: at most `limit` grants in any
 * `windowMs` period. J-Quants also counts rejected (429) requests, so we stay
 * strictly under the documented limit instead of retrying blindly.
 */
export class SlidingWindowLimiter {
  private granted: number[] = []
  private cooldownUntil = 0
  private tail: Promise<void> = Promise.resolve()
  private limit: number
  private readonly windowMs: number
  private readonly clock: Clock

  constructor(limit: number, windowMs: number, clock: Clock = realClock) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError('limit must be a positive integer')
    this.limit = limit
    this.windowMs = windowMs
    this.clock = clock
  }

  setLimit(limit: number): void {
    if (Number.isInteger(limit) && limit >= 1) this.limit = limit
  }

  /** Blocks every request until `ms` from now (used after an upstream 429). */
  penalize(ms: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, this.clock.now() + ms)
  }

  /** Seconds until the next request could be sent, for status display. */
  secondsUntilFree(): number {
    const now = this.clock.now()
    this.prune(now)
    let readyAt = this.cooldownUntil
    if (this.granted.length >= this.limit) {
      const oldest = this.granted[this.granted.length - this.limit] ?? now
      readyAt = Math.max(readyAt, oldest + this.windowMs)
    }
    return Math.max(0, Math.ceil((readyAt - now) / 1000))
  }

  /**
   * Waits for a slot. Resolves with the number of milliseconds waited.
   * Rejects with QueueTimeoutError if the slot would come after `maxWaitMs`.
   */
  acquire(maxWaitMs: number): Promise<number> {
    const start = this.clock.now()
    const deadline = start + maxWaitMs
    const run = async (): Promise<number> => {
      for (;;) {
        const now = this.clock.now()
        this.prune(now)
        let readyAt = now
        if (this.cooldownUntil > now) readyAt = this.cooldownUntil
        if (this.granted.length >= this.limit) {
          const oldest = this.granted[this.granted.length - this.limit] ?? now
          readyAt = Math.max(readyAt, oldest + this.windowMs)
        }
        if (readyAt <= now) {
          this.granted.push(now)
          return now - start
        }
        if (readyAt > deadline) {
          throw new QueueTimeoutError(Math.ceil((readyAt - now) / 1000))
        }
        await this.clock.sleep(readyAt - now)
      }
    }
    const result = this.tail.then(run)
    // Keep the chain alive whether this request succeeds or times out.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private prune(now: number): void {
    while (this.granted.length > 0 && (this.granted[0] ?? 0) + this.windowMs <= now) {
      this.granted.shift()
    }
  }
}
