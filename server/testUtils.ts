import type { Clock } from './rateLimiter.ts'

/** A clock whose sleep() advances time instantly, so waits can be asserted exactly. */
export function fakeClock(
  start = 1_000_000,
): Clock & { advance(ms: number): void; slept: number[] } {
  let time = start
  const slept: number[] = []
  return {
    now: () => time,
    sleep: async (ms: number) => {
      slept.push(ms)
      time += ms
    },
    advance(ms: number) {
      time += ms
    },
    slept,
  }
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
