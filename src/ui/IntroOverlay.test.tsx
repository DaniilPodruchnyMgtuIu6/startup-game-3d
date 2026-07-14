import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { IntroOverlay } from './IntroOverlay'
import { useGameStore } from '../game/gameStore'

afterEach(cleanup)
beforeEach(() => {
  useGameStore.setState({ phase: 'intro', playerName: '', activeDialogue: null })
})

describe('IntroOverlay', () => {
  it('walks through both story steps to the name step', () => {
    render(<IntroOverlay />)
    expect(screen.getByText(/Совет директоров собрал вас/)).toBeTruthy()
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText(/Теперь отдел — ваша ответственность/)).toBeTruthy()
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText('Как к вам обращаться?')).toBeTruthy()
  })

  it('rejects an empty name and stays in the intro', () => {
    render(<IntroOverlay />)
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Приступить'))
    expect(useGameStore.getState().phase).toBe('intro')
  })

  it('accepts a name (Enter works) and moves the game to meetPm', () => {
    render(<IntroOverlay />)
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Иван' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Ваше имя'), { key: 'Enter' })
    expect(useGameStore.getState().phase).toBe('meetPm')
    expect(useGameStore.getState().playerName).toBe('Иван')
  })

  it('renders nothing outside the intro phase', () => {
    useGameStore.setState({ phase: 'free' })
    const { container } = render(<IntroOverlay />)
    expect(container.innerHTML).toBe('')
  })
})
