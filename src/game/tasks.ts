// Seed data for the department's task board. gameStore's `tasks` field is
// what the game and the whiteboard UI actually read and mutate at runtime -
// this array only seeds its initial value.

export interface BoardTask {
  id: string
  text: string
  done: boolean
}

export const BOARD_TASKS: BoardTask[] = [{ id: 'build-team', text: 'Сформировать команду', done: false }]
