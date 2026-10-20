import { describe, expect, it } from 'vitest'
import { cleanKey, upsertEnv } from './setup.mjs'

describe('cleanKey', () => {
  it('removes bracketed-paste markers, control characters and surrounding spaces', () => {
    const esc = String.fromCharCode(0x1b)
    expect(cleanKey(`${esc}[200~  abc123XYZ \r${esc}[201~`)).toBe('abc123XYZ')
    expect(cleanKey('key\twith\u0000ctrl')).toBe('keywithctrl')
  })
})

describe('upsertEnv', () => {
  it('updates existing keys, keeps other lines and appends new keys', () => {
    const before = '# my settings\nJQUANTS_API_KEY=old\nOTHER=1\n'
    expect(upsertEnv(before, { JQUANTS_API_KEY: 'new', JQUANTS_RATE_LIMIT_PER_MIN: '60' })).toBe(
      '# my settings\nJQUANTS_API_KEY=new\nOTHER=1\nJQUANTS_RATE_LIMIT_PER_MIN=60\n',
    )
  })

  it('creates a file from nothing', () => {
    expect(upsertEnv('', { A: '1' })).toBe('A=1\n')
  })
})
