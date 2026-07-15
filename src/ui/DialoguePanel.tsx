import { useGameStore } from '../game/gameStore'
import './ui.css'

// Bottom dialogue panel: one line at a time with the speaker's name and
// role. Once a dialogue's last line has been read, a scene may follow up
// with a player choice (activeChoice) - the panel then swaps the single
// advance button for one button per option.
export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.activeDialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  const choice = useGameStore((s) => s.activeChoice)
  const chooseOption = useGameStore((s) => s.chooseOption)

  if (choice) {
    return (
      <div className="dialogue-panel">
        <div className="card-body">
          <div className="dialogue-choices">
            {choice.options.map((option) => (
              <button key={option.id} className="primary" onClick={() => chooseOption(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!dialogue) return null

  const line = dialogue.lines[dialogue.index]
  const isLast = dialogue.index === dialogue.lines.length - 1

  return (
    <div className="dialogue-panel">
      {line.portrait ? <img className="card-picture" src={line.portrait} alt={line.speaker} /> : null}
      <div className="card-body">
        <div className="dialogue-speaker">
          {line.speaker}
          {line.speakerRole ? <span className="dialogue-role"> · {line.speakerRole}</span> : null}
        </div>
        <p className="dialogue-text">{line.text}</p>
        <button className="primary" onClick={advance}>
          {isLast ? (dialogue.closingLabel ?? 'Далее') : 'Далее'}
        </button>
      </div>
    </div>
  )
}
