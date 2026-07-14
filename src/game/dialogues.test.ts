import { describe, it, expect } from 'vitest'
import { pmIntroDialogue } from './dialogues'
import { femalePm } from '../character/characters/femalePm'

describe('pmIntroDialogue', () => {
  it('greets the player by name in the first line', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines[0].text).toContain('Иван')
  })

  it('has five non-empty lines spoken by the PM persona', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines.length).toBe(5)
    for (const line of lines) {
      expect(line.text.length).toBeGreaterThan(0)
      expect(line.speaker).toBe(femalePm.persona!.name)
      expect(line.speakerRole).toBe(femalePm.persona!.role)
    }
  })
})
