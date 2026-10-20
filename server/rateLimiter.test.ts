import { describe, expect, it } from 'vitest'
import { QueueTimeoutError, SlidingWindowLimiter } from './rateLimiter.ts'
import { fakeClock } from './testUtils.ts'

describe('SlidingWindowLimiter', () => {
  it('grants up to the limit immediately, then waits for the window to slide', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(5, 61_000, clock)
    const waits: number[] = []
    for (let i = 0; i < 6; i++) waits.push(await limiter.acquire(200_000))
    expect(waits.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
    expect(waits[5]).toBe(61_000)
  })

  it('never grants more than the limit inside any window', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(3, 10_000, clock)
    const grantedAt: number[] = []
    for (let i = 0; i < 12; i++) {
      await limiter.acquire(1_000_000)
      grantedAt.push(clock.now())
      clock.advance(1_234)
    }
    for (const t of grantedAt) {
      const inWindow = grantedAt.filter((g) => g >= t && g < t + 10_000)
      expect(inWindow.length).toBeLessThanOrEqual(3)
    }
  })

  it('serves concurrent callers in FIFO order', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(1, 1_000, clock)
    const order: number[] = []
    await Promise.all([1, 2, 3].map((n) => limiter.acquire(10_000).then(() => order.push(n))))
    expect(order).toEqual([1, 2, 3])
  })

  it('rejects when the slot would come after the deadline', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(1, 60_000, clock)
    await limiter.acquire(1_000)
    await expect(limiter.acquire(5_000)).rejects.toBeInstanceOf(QueueTimeoutError)
    // The queue keeps working after a timeout.
    clock.advance(60_000)
    await expect(limiter.acquire(5_000)).resolves.toBe(0)
  })

  it('blocks every request during a penalty after a 429', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(5, 61_000, clock)
    limiter.penalize(120_000)
    expect(limiter.secondsUntilFree()).toBe(120)
    await expect(limiter.acquire(130_000)).resolves.toBe(120_000)
  })

  it('applies a new limit set at runtime', async () => {
    const clock = fakeClock()
    const limiter = new SlidingWindowLimiter(1, 60_000, clock)
    limiter.setLimit(3)
    const waits = [await limiter.acquire(1), await limiter.acquire(1), await limiter.acquire(1)]
    expect(waits).toEqual([0, 0, 0])
    limiter.setLimit(0) // ignored
    await expect(limiter.acquire(1)).rejects.toBeInstanceOf(QueueTimeoutError)
  })
})
