import { describe, it, expect } from 'vitest'
import { resolveClip, sitSettleMs } from './CharacterModel'

// Pure animation-selection logic of CharacterModel (18C §3/§4). The rendering
// half is covered by Office.test (mount) and the E2E specs.

const FULL_SET = new Set(['idle', 'walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit', 'talk', 'look'])
const NO_SIT = new Set(['idle', 'walk', 'sitIdle', 'type', 'talk'])

describe('resolveClip fallbacks', () => {
  it('picks the preferred clip when present', () => {
    expect(resolveClip('sittingDown', FULL_SET)).toBe('sit')
    expect(resolveClip('looking', FULL_SET)).toBe('look')
    expect(resolveClip('talking', FULL_SET)).toBe('talk')
  })

  it('walks the fallback chain to the closest available pose', () => {
    expect(resolveClip('sittingDown', NO_SIT)).toBe('sitIdle')
    expect(resolveClip('looking', NO_SIT)).toBe('idle')
    expect(resolveClip('sofaSitting', NO_SIT)).toBe('sitIdle')
  })

  it('unknown states resolve to idle', () => {
    expect(resolveClip('definitely-not-a-state', FULL_SET)).toBe('idle')
  })

  it('performing plays the named gesture clip and degrades to talk without it (18C)', () => {
    const WITH_GESTURES = new Set([...FULL_SET, 'agree', 'celebrate', 'explain'])
    expect(resolveClip('performing', WITH_GESTURES, 'celebrate')).toBe('celebrate')
    expect(resolveClip('performing', WITH_GESTURES, 'agree')).toBe('agree')
    expect(resolveClip('performing', FULL_SET, 'explain')).toBe('talk')
    expect(resolveClip('performing', new Set(['idle']), 'agree')).toBe('idle')
  })
})

describe('sitSettleMs (18C §4: settle follows the clip, not an arbitrary timeout)', () => {
  it('a real sit clip settles when the one-shot ends (minus the crossfade overlap)', () => {
    expect(sitSettleMs('sit', 4.29)).toBe(3940)
  })

  it('never settles before the crossfade can finish', () => {
    expect(sitSettleMs('sit', 0.4)).toBe(600)
  })

  it('a seated-loop fallback keeps the short legacy settle', () => {
    expect(sitSettleMs('sitIdle', 6.38)).toBe(1000)
    expect(sitSettleMs('idle', 8.33)).toBe(1000)
  })
})
