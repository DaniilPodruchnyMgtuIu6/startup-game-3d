import { useGameStore } from '../game/gameStore'
import './ui.css'

// Bottom dialogue panel: one line at a time with the speaker's name and
// role. Later AI-driven dialogues reuse this panel (a reply input slots in).
export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.activeDialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  if (!dialogue) return null

  const line = dialogue.lines[dialogue.index]
  const isLast = dialogue.index === dialogue.lines.length - 1

  return (
    <div className="dialogue-panel">
      <div className="dialogue-speaker">
        {line.speaker}
        {line.speakerRole ? <span className="dialogue-role"> · {line.speakerRole}</span> : null}
      </div>
      <p className="dialogue-text">{line.text}</p>
      <button className="primary" onClick={advance}>
        {isLast ? 'За работу' : 'Далее'}
      </button>
    </div>
  )
}
