import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MinigameOverlay } from './MinigameOverlay'
import { useServerIncidentsStore, type ServerRole } from '../serverIncidentsStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'

// Verifies the runtime link that unit tests on the store cannot cover: a broken
// rack, once repair begins, actually RENDERS the correct mini-game overlay from
// store state, and its exit / win / lose buttons drive the store back the way
// the 3D flow expects. (The 3D click→walk→arrive→beginRepair half is covered by
// the store + machine + ServerRoom tests; this closes the DOM/overlay half.)

afterEach(cleanup)
beforeEach(() => {
  useGameOutcomeStore.setState({ status: 'playing' })
  useServerIncidentsStore.getState().resetServerRacks()
})

function openRepair(role: ServerRole) {
  useServerIncidentsStore.getState().breakServer(role)
  useServerIncidentsStore.getState().beginRepair(role)
  render(<MinigameOverlay />)
}

const TITLE_BY_ROLE: Array<[ServerRole, string]> = [
  ['gateway', 'Фаервол · Шлюз'],
  ['auth', 'Логи · Аутентификация'],
  ['database', 'SQL-инъекция · База данных'],
  ['backup', 'Резервные копии · Backup'],
]

describe('MinigameOverlay (break → render → repair)', () => {
  it('renders the mini-game bound to each broken rack, with its Cyrillic title', () => {
    for (const [role, title] of TITLE_BY_ROLE) {
      useServerIncidentsStore.getState().resetServerRacks()
      openRepair(role)
      expect(screen.getByText(title)).toBeTruthy()
      expect(useServerIncidentsStore.getState().activeMinigame).toEqual({ role, kind: expect.any(String) })
      cleanup()
    }
  })

  it('nothing is shown while no rack is being repaired', () => {
    const { container } = render(<MinigameOverlay />)
    expect(container.innerHTML).toBe('')
  })

  it('exiting closes the overlay and reverts the rack from repairing back to broken', () => {
    openRepair('gateway')
    expect(screen.getByText('Фаервол · Шлюз')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Выйти'))

    expect(useServerIncidentsStore.getState().activeMinigame).toBeNull()
    expect(useServerIncidentsStore.getState().racks.gateway.status).toBe('broken')
    expect(screen.queryByText('Фаервол · Шлюз')).toBeNull()
  })

  it('solving the backup restore repairs the rack and closes the overlay', () => {
    // Math.random → 0 makes the overlay pick backup SCENARIOS[0], whose unique
    // freshest safe restore point is "вчера 03:00" (offline, verified, clean).
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      openRepair('backup')
      fireEvent.click(screen.getByText(/вчера 03:00/))
      fireEvent.click(screen.getByText('Восстановить'))
      // win result screen
      expect(screen.getByText('Сервер восстановлен')).toBeTruthy()
      fireEvent.click(screen.getByText('Готово'))

      expect(useServerIncidentsStore.getState().racks.backup.status).toBe('ok')
      expect(useServerIncidentsStore.getState().activeMinigame).toBeNull()
    } finally {
      rng.mockRestore()
    }
  })

  it('a wrong restore point fails, counts the attempt, and offers a retry', () => {
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      openRepair('backup')
      // "сегодня 03:00" in SCENARIOS[0] is infected → an invalid restore point.
      fireEvent.click(screen.getByText(/сегодня 03:00/))
      fireEvent.click(screen.getByText('Восстановить'))

      expect(screen.getByText('Атака не отражена')).toBeTruthy()
      expect(screen.getByText('Ещё раз')).toBeTruthy()
      expect(useServerIncidentsStore.getState().racks.backup.failures).toBe(1)
      // still repairing (overlay open), not yet fixed
      expect(useServerIncidentsStore.getState().activeMinigame).not.toBeNull()
    } finally {
      rng.mockRestore()
    }
  })
})
