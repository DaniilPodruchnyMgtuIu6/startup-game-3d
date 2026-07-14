import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TaskBoard } from './TaskBoard'
import { useGameStore } from '../game/gameStore'

afterEach(cleanup)
beforeEach(() => {
  useGameStore.setState({ taskBoardOpen: true })
})

describe('TaskBoard', () => {
  it('shows the hand-written TODO list with the team task', () => {
    render(<TaskBoard />)
    expect(screen.getByText('TODO:')).toBeTruthy()
    expect(screen.getByText('Сформировать команду')).toBeTruthy()
  })

  it('closes via the close button and renders nothing when closed', () => {
    render(<TaskBoard />)
    fireEvent.click(screen.getByLabelText('Закрыть'))
    expect(useGameStore.getState().taskBoardOpen).toBe(false)
  })
})
