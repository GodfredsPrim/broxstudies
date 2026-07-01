import { describe, it, expect } from 'vitest'
import { levelFromXp, xpForLevel } from '@/hooks/useGamification'

describe('useGamification helpers', () => {
  it('computes level from xp', () => {
    expect(levelFromXp(0).level).toBe(1)
    expect(levelFromXp(250).level).toBe(2)
    expect(levelFromXp(750).level).toBe(3)
  })

  it('scales xp per level', () => {
    expect(xpForLevel(1)).toBe(250)
    expect(xpForLevel(5)).toBe(1250)
  })
})
