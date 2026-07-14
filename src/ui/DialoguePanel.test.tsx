import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DialoguePanel } from './DialoguePanel'
import { useGameStore, type DialogueLine } from '../game/gameStore'

afterEach(cleanup)

const LINES: DialogueLine[] = [
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Первая реплика' },
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Последняя реплика' },
]

beforeEach(() => {
  useGameStore.setState({ phase: 'meetPm', playerName: 'Иван', activeDialogue: { lines: LINES, index: 0 } })
})

describe('DialoguePanel', () => {
  it('shows the speaker, role and current line', () => {
    render(<DialoguePanel />)
    expect(screen.getByText('Анна Соколова')).toBeTruthy()
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
