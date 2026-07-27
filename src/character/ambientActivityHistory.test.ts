import { describe, it, expect } from 'vitest'
import {
  createAmbientHistory,
  isOnCooldown,
  dailyLimitReached,
  wasJustDone,
  recordActivityStart,
  resetForNewWorkday,
} from './ambientActivityHistory'

describe('ambient activity history (18H §15/§16)', () => {
  it('a fresh history has nothing on cooldown, no daily count, no repeats', () => {
    const history = createAmbientHistory('npc-kirill-morozov')
    expect(isOnCooldown(history, 'coffee', 0)).toBe(false)
    expect(dailyLimitReached(history, 2)).toBe(false)
    expect(wasJustDone(history, 'coffee')).toBe(false)
  })

  it('recordActivityStart puts the activity on cooldown for the given beat span', () => {
    let history = createAmbientHistory('npc-alina-belova')
    history = recordActivityStart(history, 'ping-pong', 10, 3, 'workday-1')
    expect(isOnCooldown(history, 'ping-pong', 12)).toBe(true)
    expect(isOnCooldown(history, 'ping-pong', 13)).toBe(false)
    // an unrelated activity is unaffected
    expect(isOnCooldown(history, 'coffee', 10)).toBe(false)
  })

  it('the most recent activity never repeats back-to-back, even past its cooldown', () => {
    let history = createAmbientHistory('npc-ilya-vlasov')
    history = recordActivityStart(history, 'coffee', 0, 1, 'workday-1')
    expect(wasJustDone(history, 'coffee')).toBe(true)
    history = recordActivityStart(history, 'wander', 5, 1, 'workday-1')
    expect(wasJustDone(history, 'coffee')).toBe(false)
    expect(wasJustDone(history, 'wander')).toBe(true)
  })

  it('daily limit counts activities within the same workday and resets on a new one', () => {
    let history = createAmbientHistory('npc-female-pm')
    history = recordActivityStart(history, 'coffee', 0, 1, 'workday-1')
    history = recordActivityStart(history, 'sofa', 10, 1, 'workday-1')
    expect(dailyLimitReached(history, 2)).toBe(true)
    history = resetForNewWorkday(history, 'workday-2')
    expect(dailyLimitReached(history, 2)).toBe(false)
    // cooldowns and recent-activity memory survive the day boundary
    expect(isOnCooldown(history, 'sofa', 10)).toBe(true)
  })

  it('resetForNewWorkday is a no-op for the same workday id', () => {
    let history = createAmbientHistory('npc-kirill-morozov')
    history = recordActivityStart(history, 'coffee', 0, 1, 'workday-1')
    const again = resetForNewWorkday(history, 'workday-1')
    expect(again.completedToday).toBe(1)
  })
})
