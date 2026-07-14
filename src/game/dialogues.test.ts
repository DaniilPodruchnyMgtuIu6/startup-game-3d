import { describe, it, expect } from 'vitest'
import { pmIntroDialogue } from './dialogues'
import { femalePm } from '../character/characters/femalePm'

describe('pmIntroDialogue', () => {
  it('greets the player by name in the first line', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines[0].text).toContain('Иван')
  })

  it('has six non-empty lines with pictures, including one spoken by the player', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines.length).toBe(6)
    for (const line of lines) {
      expect(line.text.length).toBeGreaterThan(0)
      expect(line.portrait).toBeTruthy()
    }
    expect(lines[0].speaker).toBe(femalePm.persona!.name)
    expect(lines.some((line) => line.speaker === 'Иван')).toBe(true)
  })
})
