import { describe, expect, it } from 'vitest'
import { isCronDue } from '../automation-server'

describe('isCronDue', () => {
  it('matches a five-field expression in the requested time zone', () => {
    // 09:00 in Istanbul is 06:00 UTC during standard time.
    expect(isCronDue('0 9 * * *', 'Europe/Istanbul', new Date('2026-11-24T06:00:00.000Z'))).toBe(true)
    expect(isCronDue('0 9 * * *', 'Europe/Istanbul', new Date('2026-11-24T06:01:00.000Z'))).toBe(false)
  })

  it('supports lists, ranges and step values', () => {
    const mondayAtNine = new Date('2026-11-23T09:15:00.000Z')
    expect(isCronDue('*/15 9-10 * * 1,3,5', 'UTC', mondayAtNine)).toBe(true)
    expect(isCronDue('*/20 9-10 * * 1,3,5', 'UTC', mondayAtNine)).toBe(false)
  })

  it('applies day-of-month and weekday matching rules', () => {
    const monday = new Date('2026-11-23T09:00:00.000Z')
    const tuesday = new Date('2026-11-24T09:00:00.000Z')

    expect(isCronDue('0 9 23 * *', 'UTC', monday)).toBe(true)
    expect(isCronDue('0 9 * * 1', 'UTC', monday)).toBe(true)
    expect(isCronDue('0 9 23 * 2', 'UTC', monday)).toBe(true)
    expect(isCronDue('0 9 23 * 2', 'UTC', tuesday)).toBe(true)
    expect(isCronDue('0 9 23 * 1', 'UTC', tuesday)).toBe(false)
  })

  it('rejects malformed expressions and invalid time zones', () => {
    const date = new Date('2026-11-23T09:00:00.000Z')
    expect(isCronDue('* * * *', 'UTC', date)).toBe(false)
    expect(isCronDue('61 * * * *', 'UTC', date)).toBe(false)
    expect(isCronDue('* * * * *', 'Not/A_Timezone', date)).toBe(false)
  })
})
