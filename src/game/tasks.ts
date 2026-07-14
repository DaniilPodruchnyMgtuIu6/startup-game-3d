// The department's task reminders written on the meeting room whiteboard.
// Future game mechanics will move completion state into the game store; for
// now the list is static content.

export interface BoardTask {
  id: string
  text: string
  done: boolean
}

export const BOARD_TASKS: BoardTask[] = [{ id: 'build-team', text: 'Сформировать команду', done: false }]
