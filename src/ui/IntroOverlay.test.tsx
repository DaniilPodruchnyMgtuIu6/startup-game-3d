import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { IntroOverlay } from './IntroOverlay'
import { useGameStore } from '../game/gameStore'

afterEach(cleanup)
beforeEach(() => {
  useGameStore.setState({ phase: 'intro', playerName: '', activeDialogue: null })
})

function toChoiceStep() {
  fireEvent.click(screen.getByText('Далее'))
  fireEvent.click(screen.getByText('Далее'))
}

describe('IntroOverlay', () => {
  it('walks the story steps to the accept/refuse choice, then to the name step', () => {
    render(<IntroOverlay />)
    expect(screen.getByText(/Поздравлять вас не с чем/)).toBeTruthy()
    toChoiceStep()
    expect(screen.getByText('Берусь за дело')).toBeTruthy()
    expect(screen.getByText('Отказаться')).toBeTruthy()
    fireEvent.click(screen.getByText('Берусь за дело'))
    expect(screen.getByText('Как к вам обращаться?')).toBeTruthy()
  })

  it('refusing the job fires the player and offers a restart', () => {
    render(<IntroOverlay />)
    toChoiceStep()
    fireEvent.click(screen.getByText('Отказаться'))
    expect(useGameStore.getState().phase).toBe('fired')
    expect(screen.getByText('Вы уволены!')).toBeTruthy()
    fireEvent.click(screen.getByText('Начать заново'))
    expect(useGameStore.getState().phase).toBe('intro')
  })

  it('rejects an empty name and accepts a valid one (Enter works)', () => {
    render(<IntroOverlay />)
    toChoiceStep()
    fireEvent.click(screen.getByText('Берусь за дело'))
    fireEvent.click(screen.getByText('Приступить'))
    expect(useGameStore.getState().phase).toBe('intro')
    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Иван' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Ваше имя'), { key: 'Enter' })
    expect(useGameStore.getState().phase).toBe('meetPm')
    expect(useGameStore.getState().playerName).toBe('Иван')
  })

  it('renders nothing in free play', () => {
    useGameStore.setState({ phase: 'free' })
    const { container } = render(<IntroOverlay />)
    expect(container.innerHTML).toBe('')
  })
})
