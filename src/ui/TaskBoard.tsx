import { useGameStore } from '../game/gameStore'
import './ui.css'

// The meeting room whiteboard, up close: a hand-written TODO list of the
// department's tasks. Opens by clicking the whiteboard in the 3D scene.
export function TaskBoard() {
  const open = useGameStore((s) => s.taskBoardOpen)
  const close = useGameStore((s) => s.closeTaskBoard)
  const tasks = useGameStore((s) => s.tasks)
  if (!open) return null

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="taskboard" onClick={(e) => e.stopPropagation()}>
        <button className="taskboard-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <h2 className="taskboard-title">TODO:</h2>
        <ul className="taskboard-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? 'taskboard-done' : ''}>
              <span className="taskboard-checkbox">{task.done ? '✔' : ''}</span>
              <span>{task.text}</span>
            </li>
          ))}
        </ul>
        <div className="taskboard-tray" />
      </div>
    </div>
  )
}
