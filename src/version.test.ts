import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './version'

describe('APP_VERSION', () => {
  it('is the git short hash or a dev fallback', () => {
    expect(APP_VERSION).toMatch(/^[0-9a-f]{7}$|^dev$/)
  })
})
