import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DialoguePanel } from './DialoguePanel'
import { useGameStore, type DialogueLine } from '../game/gameStore'
import { useCinematicStore } from '../game/cinematics/cinematicDirector'

afterEach(cleanup)

const LINES: DialogueLine[] = [
  { speaker: 'Соня Соколова', speakerRole: 'Product Manager', text: 'Первая реплика' },
  { speaker: 'Соня Соколова', speakerRole: 'Product Manager', text: 'Последняя реплика' },
]

beforeEach(() => {
  useGameStore.setState({
    phase: 'meetPm',
    playerName: 'Иван',
    activeDialogue: { lines: LINES, index: 0, closingLabel: 'За работу' },
  })
  useCinematicStore.setState({ active: false, panelSide: 'center' })
})

describe('DialoguePanel', () => {
  it('shows the speaker, role and current line', () => {
    render(<DialoguePanel />)
    expect(screen.getByText('Соня Соколова')).toBeTruthy()
    expect(screen.getByText(/Product Manager/)).toBeTruthy()
    expect(screen.getByText('Первая реплика')).toBeTruthy()
  })

  it('advances lines; the last line closes the dialogue via «За работу»', () => {
    render(<DialoguePanel />)
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText('Последняя реплика')).toBeTruthy()
    fireEvent.click(screen.getByText('За работу'))
    expect(useGameStore.getState().activeDialogue).toBeNull()
    expect(useGameStore.getState().phase).toBe('free')
  })

  it('renders nothing without an active dialogue', () => {
    useGameStore.setState({ activeDialogue: null })
    const { container } = render(<DialoguePanel />)
    expect(container.innerHTML).toBe('')
  })
})

describe('DialoguePanel safe-area layout (18H §8)', () => {
  it('a non-center panelSide is ignored outside a cinematic (no stale side class)', () => {
    useCinematicStore.setState({ active: false, panelSide: 'left' })
    const { container } = render(<DialoguePanel />)
    const panel = container.querySelector('.dialogue-panel')
    expect(panel?.className).not.toContain('dialogue-panel--left')
  })

  it('applies the cinematic + left side class together during an active cinematic', () => {
    useCinematicStore.setState({ active: true, panelSide: 'left' })
    const { container } = render(<DialoguePanel />)
    const panel = container.querySelector('.dialogue-panel')
    expect(panel?.className).toContain('dialogue-panel--cinematic')
    expect(panel?.className).toContain('dialogue-panel--left')
  })

  it('stays unshifted (no side class) while cinematic and panelSide is center', () => {
    useCinematicStore.setState({ active: true, panelSide: 'center' })
    const { container } = render(<DialoguePanel />)
    const panel = container.querySelector('.dialogue-panel')
    expect(panel?.className).toContain('dialogue-panel--cinematic')
    expect(panel?.className).not.toMatch(/dialogue-panel--(left|right)/)
  })
})
